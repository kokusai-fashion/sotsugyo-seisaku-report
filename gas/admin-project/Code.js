/**
 * 卒業制作報告書 作成ツール：管理ページ（Google Apps Script。スプレッドシートに付属させる）
 *
 * スプレッドシートの3つのシート
 *   年度設定 … 年度 | 状態（公開中・準備中・終了）| 設定（JSON）| 更新日時 | 更新者
 *   変更履歴 … 日時 | 更新者 | 年度 | 操作 | 設定（JSON）（管理者・先生の登録の変更は、年度と設定が空の行）
 *   管理者   … メールアドレス | メモ | 役割（管理者・先生。空なら管理者）
 * 配信の窓口（gas/api-project）が作るシート：届いた声（学生の「困ったこと・おかしいことを知らせる」）・エラーの記録。
 * 届いた声は、管理ページの「届いた声」で見て状態を変える（getFeedback・updateFeedback）。学生に知らせるメールを送るには、
 * 配り直したあと、エディタで1回だけ setupFeedbackMail を実行して承認する（新しく届いた声を、10分ごとに管理者にメールで知らせる仕掛けも作る）
 *
 * ウェブアプリとして公開する（実行するユーザー：自分、アクセス：大学のドメイン内）。
 * 「管理者」シートに載っている人だけが使える。
 *   管理者 … 年度の設定をすべて変更・公開できる。先生を登録できる
 *   先生   … どのコースの「下書きのひな形」「お知らせ」と、「書き間違えやすい語」を編集できる（ほかの設定は変えられない）
 * 学生のツールへの配信は、別のプロジェクト（gas/api-project）が担う。
 *
 * 先生の許可の仕組み（点検表。docs/設計_許可の仕組み.md。依頼者の選択 2026-11-04）：
 *   学生の名簿 … 配信の窓口が書く（年度・コース・学籍番号・姓・名・セイ・メイ・並び・PDF の ID・PDF の日時・書き換え日時・更新日時）。並びだけは管理ページが書く
 *   点検表     … 年度 | コース | スプレッドシートの ID（コースごとの点検表。ensureCheckSheet が作って書く）
 *   コースの点検表は、PDF の控えのコースのフォルダに置く（見られる人は、PDF の控えと同じ。共有はフォルダのまま）。
 *   10分ごとの仕掛け（syncCheckSheets）が、名簿から点検表に写す。先生が ✓ を入れると、編集の仕掛け（onCheckSheetEdit）が日時と名字を残す。
 *   点検表の並びはツールが決める（名簿の並び、なければふりがなの順）。写すたびに、その順に書き直す（シートで行を動かしても戻る）。
 *   ツールが書く列（番号・氏名・最新 PDF・知らせ・見えない学籍番号と許可の記録・段のあいだのすき間）・✓ の列の見出し・案内の行は、デプロイした人だけが書けるように守る
 *   （先生が書けるのは、白い回の列（見出しも。足す・名前を変えるのも自由）と ✓ の列の中身だけ）。守った列にかかる行の移動・並べ替えは、Google スプレッドシートが断る。
 *   段ごとに列は見出しの名前で探す（先生が片方の段にだけ回の列を足した・名前を変えたときも、そのまま読む）。
 *   それでも見える氏名と見えない学籍番号がずれた行（見える氏名が名簿のほかの学生の氏名）は、許可を学生に渡さず、「知らせ」に「並びが崩れています」と出す
 *   （依頼者の選択 2026-11-04。氏名の書き方の違い・（試し）・名簿の氏名を直した直後だけでは出さない：nameKey_・outOfStep_）
 *   配り直したあと、エディタで1回だけ setupCheckSheets を実行する（ドライブ・仕掛けの権限を承認し、仕掛けを作り直す。届いた声のメールの仕掛けも作り直す）。
 *   配信の窓口（gas/api-project）も、点検表の「知らせ」「氏名」を書くので、管理ページと同じ人がデプロイする
 *
 * このファイルは app/gas/admin-project/Code.js が元。scripts/build-gas.mjs で初期値を埋め込んで gas-dist に出力する。
 */

const SHEET_YEARS = '年度設定'
const SHEET_HISTORY = '変更履歴'
const SHEET_ADMINS = '管理者'
const STATUS_PUBLISHED = '公開中'
const STATUS_DRAFT = '準備中'
const STATUS_ENDED = '終了'
const ROLE_ADMIN = '管理者'
const ROLE_TEACHER = '先生'
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+$/

/** 下書きのひな形の部品の種類と、その呼び名（管理ページのひな形の窓と同じ。改ページ・ふつうの表は mockups/v44 で足した） */
const BLOCK_TYPES = ['chapter', 'subheading', 'paragraph', 'figure', 'materialTable', 'pageBreak', 'table']
// text：書き出しの文の段落の呼び名（行の種類ではない。mockups/v70）
const BLOCK_LABELS = { chapter: '大見出し', subheading: '中見出し', paragraph: '説明', figure: '図の枠', materialTable: '素材表', pageBreak: '改ページ', table: '表', text: '書き出しの文' }
/** 文字数・数の上限（学生のツールの src/config/validate.ts の LIMITS と同じ値にする。tableColumns・tableRows：ひな形の表の列の数と、見出しの下の行の数） */
const LIMITS = { blocks: 100, name: 100, hint: 300, text: 500, abstractExample: 500, notice: 1000, words: 300, word: 50, wordNote: 200, tableColumns: 6, tableRows: 9, groups: 20, group: 30 }

/** 初期値（2026年度）。ビルド時に app/src/config/2026.json の内容が入る */
const INITIAL_CONFIG = /*INITIAL_CONFIG*/ null
// お試しの見本の原稿（scripts/build-gas.mjs が、git に入れないファイル gas/trial-sample.private.json から入れる。なければ null）
const TRIAL_SAMPLE = /*TRIAL_SAMPLE*/ null
// 管理ページの版の印（scripts/build-gas.mjs が、管理ページの画面に入れたものと同じ印を入れる。なければ ''）
const BUILD_ID = /*BUILD_ID*/ ''
// 公開中の管理ページの場所（scripts/build-gas.mjs が gas/deployments.json の admin.url を入れる。なければ ''）。
// 届いた声のメールに書く。10分ごとの仕掛けの中では ScriptApp.getService().getUrl() が別の場所を返し、開けなかった（2026-11-01）
const ADMIN_URL = /*ADMIN_URL*/ ''
// 先生向けのリンク（ログインした先生と管理者にだけ渡す。依頼者 2026-11-03）。scripts/build-gas.mjs が、git に入れないファイル
// gas/admin-links.local.json の materialsUrl・aiUrl を入れる。なければ ''（スクリプト プロパティ MATERIALS_URL・TEACHER_AI_URL を使う。担当が替わったとき用）
// MATERIALS_URL：説明の資料一式（スライド・動画・手引き・録画）のページ。TEACHER_AI_URL：管理ページの使い方を答える AI（Gemini の Gem）
const MATERIALS_URL = /*MATERIALS_URL*/ ''
const TEACHER_AI_URL = /*TEACHER_AI_URL*/ ''
// 書き出した PDF の控えを置く、先生のドライブのフォルダ（配信の窓口 gas/api-project と同じ。scripts/build-gas.mjs が、git に入れないファイル
// gas/pdf-folder.local.json の folderId を入れる。なければ ''：スクリプト プロパティ PDF_FOLDER_ID を使う）。コースの点検表は、この中のコースのフォルダに置く
const PDF_FOLDER_ID = /*PDF_FOLDER_ID*/ ''

function doGet() {
  return HtmlService.createHtmlOutputFromFile('admin')
    .setTitle('卒業制作報告書 管理ページ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
}

/**
 * 最初に1回だけ、Apps Script の画面（エディタ）から実行する。担当が替わって配り直したときも、新しい担当者が実行する。
 * シートを作り、実行した人を管理者に登録し、初期値の年度設定を「公開中」で入れる。
 * 管理ページ（google.script.run）からも呼べてしまうため、デプロイした本人が実行したとき
 * （ログイン中の人と、プログラムを動かしている人が同じとき）だけ通す。
 * 有効な管理者が0人になっても（役割の書き間違い・シート名の変更など）、ほかの人が管理者になれないように。
 */
function setup() {
  const me = Session.getActiveUser().getEmail()
  const owner = Session.getEffectiveUser().getEmail()
  if (!me || me.toLowerCase() !== String(owner || '').toLowerCase()) {
    throw new Error('setup は、管理ページをデプロイした人が、Apps Script のエディタから実行してください（ログイン中：' + (me || '不明') + '）')
  }
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    const ensure = (name, header) => {
      let sheet = ss.getSheetByName(name)
      if (!sheet) sheet = ss.insertSheet(name)
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(header)
        sheet.setFrozenRows(1)
        sheet.getRange(1, 1, 1, header.length).setFontWeight('bold')
      }
      return sheet
    }
    const years = ensure(SHEET_YEARS, ['年度', '状態', '設定（JSON）', '更新日時', '更新者'])
    ensure(SHEET_HISTORY, ['日時', '更新者', '年度', '操作', '設定（JSON）'])
    const admins = ensure(SHEET_ADMINS, ['メールアドレス', 'メモ', '役割'])
    // 役割の列がない古いシートには、見出しを足す
    if (!admins.getRange(1, 3).getValue()) admins.getRange(1, 3).setValue('役割')
    const register = !roleOf_(me)
    if (register) appendRow_(admins, [me, '初期設定で登録', ROLE_ADMIN])
    appendMemberHistory_(me, '初期設定（setup）を実行' + (register ? '：' + me + ' を管理者に登録' : ''))
    if (years.getLastRow() < 2 && INITIAL_CONFIG) {
      appendRow_(years, [INITIAL_CONFIG.fiscalYear, STATUS_PUBLISHED, JSON.stringify(INITIAL_CONFIG), new Date(), me])
      appendHistory_(me, INITIAL_CONFIG.fiscalYear, '初期設定', INITIAL_CONFIG)
    }
    const defaultSheet = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1')
    if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet)
    // 配信用のプロジェクトがこのスプレッドシートを読めるよう、ID を表示する
    Logger.log('スプレッドシートの ID: ' + ss.getId())
  })
}

// ---- 管理ページから呼ぶ関数（google.script.run） ----
// 変更する関数は、役割の確かめも鍵（withLock_）の中で行う（2人が同時にお互いの役割を変えて、管理者が0人にならないように）

function getState() {
  const user = Session.getActiveUser().getEmail()
  const role = roleOf_(user)
  // checkSheets：作ってある点検表の場所（「点検表を開く」を、サーバーに聞かずにすぐ開くため。依頼者の試し 2026-11-04）
  return {
    user: user,
    isAdmin: role === ROLE_ADMIN,
    role: role === ROLE_ADMIN ? 'admin' : role === ROLE_TEACHER ? 'teacher' : null,
    years: role ? readYears_() : [],
    links: role ? teacherLinks_() : {},
    checkSheets: role ? checkSheetLinks_() : [],
  }
}

/** 先生向けのリンク（説明の資料一式・使い方を AI に聞く）。スクリプト プロパティがあれば、そちらを使う */
function teacherLinks_() {
  const props = PropertiesService.getScriptProperties()
  const pick = (name, built) => String(props.getProperty(name) || built || '').trim()
  const links = {}
  const materials = pick('MATERIALS_URL', MATERIALS_URL)
  const ai = pick('TEACHER_AI_URL', TEACHER_AI_URL)
  if (/^https:\/\//.test(materials)) links.materials = materials
  if (/^https:\/\//.test(ai)) links.ai = ai
  return links
}

/**
 * 下書きのひな形だけを保存する（先生も使える）。templates は { コースID: { template, abstractExample } }。
 * 年度の設定のうち、指定したコースのひな形と抄録の書き出し例だけを書き換え、ほかは変えない。
 */
function saveTemplates(year, templates) {
  return editYear_(year, null, (config) => {
    if (!templates || typeof templates !== 'object') throw new Error('ひな形の形が正しくありません')
    return '下書きのひな形を保存（' + applyTemplates_(config, templates).join('・') + '）'
  })
}

/**
 * コースのお知らせだけを保存する（先生も使える）。notices は { コースID: お知らせ }。
 * 指定したコースのお知らせだけを書き換え、ほかは変えない
 */
function saveNotices(year, notices) {
  return editYear_(year, null, (config) => {
    if (!notices || typeof notices !== 'object') throw new Error('お知らせの形が正しくありません')
    return 'お知らせを保存（' + applyNotices_(config, notices).join('・') + '）'
  })
}

/**
 * 書き間違えやすい語の一覧だけを保存する（先生も使える）。words は [{ wrong, right, note, severity }]。
 * 書き間違いか正しい語が空の行、2つが同じ行は捨てる。
 */
function saveWordChecks(year, words) {
  return editYear_(year, null, (config) => {
    config.wordChecks = cleanWords_(words)
    return '書き間違えやすい語を保存（' + config.wordChecks.length + '語）'
  })
}

/**
 * 先生の画面の「保存」：ひな形・お知らせ・書き間違えやすい語・先生の許可を、まとめて1回で保存する（先生も使える）。
 * 別々に送ると、途中で失敗したときに一部だけが保存されるため。edits は { templates?, notices?, words?, permissions? }
 * （permissions：{ コースID: { abstract?, final? } }。先生も切り替えられる：依頼者の選択 2026-11-04）
 * expectedUpdatedAt は、画面を開いたときの更新日時（そのあとにほかの人が保存していたら、保存せずに知らせる）
 */
function saveTeacherEdits(year, edits, expectedUpdatedAt) {
  return editYear_(year, expectedUpdatedAt, (config) => {
    if (!edits || typeof edits !== 'object') throw new Error('保存する内容の形が正しくありません')
    const done = []
    if (edits.templates && typeof edits.templates === 'object' && Object.keys(edits.templates).length) {
      done.push('下書きのひな形を保存（' + applyTemplates_(config, edits.templates).join('・') + '）')
    }
    if (edits.notices && typeof edits.notices === 'object' && Object.keys(edits.notices).length) {
      done.push('お知らせを保存（' + applyNotices_(config, edits.notices).join('・') + '）')
    }
    if (edits.permissions && typeof edits.permissions === 'object' && Object.keys(edits.permissions).length) {
      done.push('先生の許可を保存（' + applyPermissions_(config, edits.permissions).join('・') + '）')
    }
    // 所属・点検表の順番・並べ方（先生も変えられる：依頼者の選択 2026-11-09 mockups/v119）
    if (edits.sheets && typeof edits.sheets === 'object' && Object.keys(edits.sheets).length) {
      done.push('所属と点検表の並びを保存（' + applySheetSettings_(config, edits.sheets).join('・') + '）')
    }
    // サブタイトルを使うか（先生も切り替えられる：依頼者の選択 2026-11-09）
    if (edits.subtitles && typeof edits.subtitles === 'object' && Object.keys(edits.subtitles).length) {
      done.push('サブタイトルを使うかを保存（' + applySubtitles_(config, edits.subtitles).join('・') + '）')
    }
    if (edits.words !== undefined && edits.words !== null) {
      config.wordChecks = cleanWords_(edits.words)
      done.push('書き間違えやすい語を保存（' + config.wordChecks.length + '語）')
    }
    return done.join('・') || '保存（変更なし）'
  })
}

/**
 * 年度の設定を読み、fn で書き換えて保存し、変更履歴に残す（先生も使える。fn は履歴に残す操作の名前を返す）。
 * fn の中で形の誤りが見つかったら（エラーを投げたら）、何も保存しない
 */
function editYear_(year, expectedUpdatedAt, fn) {
  return withLock_(() => {
    const user = requireTeacher_()
    const sheet = sheet_(SHEET_YEARS)
    const rowIndex = findYearRow_(year)
    if (rowIndex < 0) throw new Error(year + '年度の設定がありません')
    checkNotChanged_(sheet, rowIndex, expectedUpdatedAt)
    const config = parseConfig_(sheet.getRange(rowIndex, 3).getValue(), year)
    const action = fn(config)
    checkConfig_(config)
    setRow_(sheet, rowIndex, 3, [JSON.stringify(config), new Date(), user])
    appendHistory_(user, year, action, config)
    return getState()
  })
}

/** 指定したコースのひな形と抄録の書き出し例を書き換える（形を確かめる）。書き換えたコースの名前を返す */
function applyTemplates_(config, templates) {
  const names = []
  config.courses.forEach((course) => {
    const t = templates[course.id]
    if (!t) return
    if (typeof t !== 'object') throw new Error('「' + course.name + '」のひな形の形が正しくありません')
    course.template = cleanTemplate_(t.template, course.name)
    course.abstractExample = t.abstractExample === undefined || t.abstractExample === null ? '' : checkText_(t.abstractExample, LIMITS.abstractExample, '「' + course.name + '」の抄録の書き出し例')
    names.push(course.name)
  })
  return names
}

/** 指定したコースのお知らせを書き換える（形を確かめる）。書き換えたコースの名前を返す */
function applyNotices_(config, notices) {
  const names = []
  config.courses.forEach((course) => {
    if (!Object.prototype.hasOwnProperty.call(notices, course.id)) return
    const notice = notices[course.id]
    course.notice = notice === null ? '' : checkText_(notice, LIMITS.notice, '「' + course.name + '」のお知らせ')
    names.push(course.name)
  })
  return names
}

/**
 * 先生の許可（コースの permission：{ abstract?: true, final?: true }）の形を確かめる（崩れていたらエラー）。
 * abstract：抄録は、先生の許可が出てから書ける。final：提出用の PDF は、先生の許可が出てから作れる（mockups/v103）
 */
function checkPermission_(permission, courseName) {
  const p = permission
  if (!p || typeof p !== 'object' || Array.isArray(p) || (p.abstract !== undefined && typeof p.abstract !== 'boolean') || (p.final !== undefined && typeof p.final !== 'boolean')) {
    throw new Error('「' + courseName + '」の先生の許可の設定が正しくありません')
  }
}

/**
 * 指定したコースの先生の許可を書き換える（形を確かめる）。両方とも切ったら、項目ごと消す（今までと同じ「使わない」）。書き換えたコースの名前を返す
 */
function applyPermissions_(config, permissions) {
  const names = []
  config.courses.forEach((course) => {
    if (!Object.prototype.hasOwnProperty.call(permissions, course.id)) return
    const p = permissions[course.id]
    if (p !== null) checkPermission_(p, course.name)
    const next = {}
    if (p && p.abstract === true) next.abstract = true
    if (p && p.final === true) next.final = true
    if (Object.keys(next).length) course.permission = next
    else delete course.permission
    names.push(course.name)
  })
  return names
}

/**
 * 指定したコースの「サブタイトルを使うか」を書き換える（値は「使わない」なら true。使うなら項目ごと消す。src/admin/serverRules.ts の applySubtitles と同じ）。
 * 書き換えたコースの名前を返す
 */
function applySubtitles_(config, subtitles) {
  const names = []
  config.courses.forEach((course) => {
    if (!Object.prototype.hasOwnProperty.call(subtitles, course.id)) return
    const off = subtitles[course.id]
    if (typeof off !== 'boolean') throw new Error('「' + course.name + '」のサブタイトルを使うかの設定が正しくありません')
    if (off) course.noSubtitle = true
    else delete course.noSubtitle
    names.push(course.name)
  })
  return names
}

/**
 * 所属の名前の形を確かめる（崩れていたらエラー。学生のツールの src/config/validate.ts の groupProblems と同じ決まり）：
 * 文字の並び・20個まで・空の名前なし・30字まで・同じ名前は1つ
 */
function checkGroups_(groups, courseName) {
  const label = '「' + courseName + '」の所属'
  if (!Array.isArray(groups) || groups.some((g) => typeof g !== 'string')) throw new Error(label + 'の形が正しくありません')
  if (groups.length > LIMITS.groups) throw new Error(label + 'が多すぎます（' + LIMITS.groups + '個まで）')
  if (groups.some((g) => !g.trim())) throw new Error(label + 'に、空の名前があります')
  const long = groups.find((g) => g.length > LIMITS.group)
  if (long) throw new Error(label + '「' + long + '」が長すぎます（' + LIMITS.group + '字まで）')
  const dup = groups.find((g, i) => groups.indexOf(g) !== i)
  if (dup) throw new Error(label + '「' + dup + '」が2つあります')
}

/**
 * 指定したコースの所属・点検表の順番（学籍番号順）・並べ方（いつも縦1列）を書き換える（src/admin/serverRules.ts の applySheetSettings と同じ）。
 * 所属が空・五十音順・26人から2列（今のまま）なら、項目ごと消す。書き換えたコースの名前を返す
 */
function applySheetSettings_(config, sheets) {
  const names = []
  config.courses.forEach((course) => {
    if (!Object.prototype.hasOwnProperty.call(sheets, course.id)) return
    const s = sheets[course.id]
    if (!s || typeof s !== 'object' || typeof s.checkById !== 'boolean' || typeof s.checkOneColumn !== 'boolean') throw new Error('「' + course.name + '」の点検表の並びの設定が正しくありません')
    checkGroups_(s.groups, course.name)
    const groups = s.groups.map((g) => g.trim())
    if (groups.length) course.groups = groups
    else delete course.groups
    if (s.checkById) course.checkById = true
    else delete course.checkById
    if (s.checkOneColumn) course.checkOneColumn = true
    else delete course.checkOneColumn
    names.push(course.name)
  })
  return names
}

/**
 * 下書きのひな形を確かめ、決まった項目だけの形にして返す。崩れていたら（種類が決まったもの以外、
 * 名前や説明・書き出しの文が文字でない・長すぎる、名前が空、先頭が大見出しでない）エラーにする。
 * 学生のツールが崩れたひな形で止まらないように（学生のツールの src/config/validate.ts の templateProblems と同じ決まり）
 */
function cleanTemplate_(template, courseName, wholeLabel) {
  // 標準のひな形は、名前ごと渡す（wholeLabel：「標準のひな形」）
  const label = wholeLabel || '「' + courseName + '」のひな形'
  if (!Array.isArray(template)) throw new Error(label + 'の形が正しくありません')
  if (template.length > LIMITS.blocks) throw new Error(label + 'の部品が多すぎます（' + LIMITS.blocks + '個まで）')
  const cleaned = template.map((block, i) => {
    if (!block || typeof block !== 'object' || BLOCK_TYPES.indexOf(block.type) < 0) throw new Error(label + 'の' + (i + 1) + '行目の形が正しくありません')
    // 改ページは、種類だけ
    if (block.type === 'pageBreak') return { type: 'pageBreak' }
    const key = block.type === 'chapter' || block.type === 'subheading' ? 'title' : block.type === 'paragraph' ? 'hint' : 'caption'
    const row = label + 'の' + rowName_(i, block.type, block[key])
    const text = checkText_(block[key], key === 'hint' ? LIMITS.hint : LIMITS.name, row)
    // 段落の説明は空でもよい（大見出し・中見出し・図・表の名前は空にしない）
    if (key !== 'hint' && !text.trim()) throw new Error(row + 'の名前が空です')
    const out = { type: block.type }
    out[key] = text
    // 小見出し（（1））は、中見出しに level: 3 の印（見出しを大・中・小の3つにした：依頼者の選択 2026-11-03）
    if (block.type === 'subheading' && block.level === 3) out.level = 3
    // 段落の書き出しの文（学生の本文にそのまま入る。空なら持たない。mockups/v70）。説明（hint）は、書き出しの文の続きの説明として残す（mockups/v111 案B）
    if (block.type === 'paragraph' && block.text !== undefined) {
      const fixed = checkText_(block.text, LIMITS.text, label + 'の' + rowName_(i, 'text', block.text))
      if (fixed.trim()) out.text = fixed
    }
    if (block.type === 'table') cleanTable_(block, out, row)
    return out
  })
  if (cleaned.length && cleaned[0].type !== 'chapter') throw new Error(label + 'は、大見出しから始めてください')
  return cleaned
}

/**
 * ひな形のふつうの表の、名前のほかの項目（見出しの行・行の数・列の幅・行の高さ・左端の列）を確かめて out に写す。
 * 形が崩れていたらエラー（学生のツールの src/config/validate.ts の templateTableProblem と同じ決まり）
 */
function cleanTable_(block, out, row) {
  const header = block.header
  if (!Array.isArray(header) || header.length < 1 || header.length > LIMITS.tableColumns || header.some((h) => typeof h !== 'string')) throw new Error(row + 'の見出しの行の形が正しくありません')
  header.forEach((h, k) => checkText_(h, LIMITS.name, row + 'の見出しの' + (k + 1) + '列目'))
  out.header = header.slice()
  const rows = block.rows
  if (rows !== undefined) {
    if (!(typeof rows === 'number' && Number.isInteger(rows) && rows >= 1 && rows <= LIMITS.tableRows)) throw new Error(row + 'の行の数が正しくありません')
    out.rows = rows
  }
  if (block.widths !== undefined) {
    if (['equal', 'auto', 'custom'].indexOf(block.widths) < 0) throw new Error(row + 'の列の幅の形が正しくありません')
    out.widths = block.widths
  }
  const ws = block.colWidths
  if (ws !== undefined) {
    if (!Array.isArray(ws) || ws.length !== header.length || ws.some((w) => typeof w !== 'number' || !isFinite(w) || w <= 0 || w > 100)) throw new Error(row + 'の列の幅の形が正しくありません')
    out.colWidths = ws.slice()
  }
  if (block.heights !== undefined) {
    if (['equal', 'auto', 'photo'].indexOf(block.heights) < 0) throw new Error(row + 'の行の高さの形が正しくありません')
    out.heights = block.heights
  }
  if (block.labelColumn !== undefined) {
    if (typeof block.labelColumn !== 'boolean') throw new Error(row + 'の左端の列の形が正しくありません')
    out.labelColumn = block.labelColumn
  }
}

/**
 * ひな形の行の呼び名（例：3行目の説明「デザインの意図を書く…」）。どの行か見つけやすいよう、種類と書き出しを付ける
 * （学生のツールの src/config/validate.ts の templateRowName と同じ言い方）
 */
function rowName_(index, type, text) {
  const head = typeof text === 'string' ? text.trim() : ''
  const preview = head ? '「' + (head.length > 12 ? head.slice(0, 12) + '…' : head) + '」' : ''
  return (index + 1) + '行目の' + BLOCK_LABELS[type] + preview
}

/** 文字の項目を確かめる（文字でない・長すぎるときはエラー） */
function checkText_(value, max, label) {
  if (typeof value !== 'string') throw new Error(label + 'の形が正しくありません')
  if (value.length > max) throw new Error(label + 'が長すぎます（' + max + '字まで。今は' + value.length + '字）')
  return value
}

/**
 * 書き間違えやすい語の一覧を確かめて整える（形が崩れていたらエラー。書き間違いか正しい語が空の行、2つが同じ行は捨てる。
 * 重さが「注意」でなければ「エラー」にする）
 */
function cleanWords_(words) {
  if (!Array.isArray(words)) throw new Error('書き間違えやすい語の形が正しくありません')
  if (words.length > LIMITS.words) throw new Error('書き間違えやすい語が多すぎます（' + LIMITS.words + '語まで）')
  return words
    .map((w, i) => {
      const row = '書き間違えやすい語の' + (i + 1) + '行目'
      if (!w || typeof w !== 'object') throw new Error(row + 'の形が正しくありません')
      const text = (key, max) => (w[key] === undefined || w[key] === null ? '' : checkText_(w[key], max, row).trim())
      return { wrong: text('wrong', LIMITS.word), right: text('right', LIMITS.word), note: text('note', LIMITS.wordNote), severity: w.severity === 'warning' ? 'warning' : 'error' }
    })
    .filter((w) => w.wrong && w.right && w.wrong !== w.right)
}

/** 管理者と先生の一覧（管理者だけ） */
function getMembers() {
  requireAdmin_()
  return readMembers_()
}

/**
 * 管理者・先生を登録する（管理者だけ）。すでに登録されていれば、役割とメモを書き換える。
 * mustExist（一覧の役割を変えるとき）なら、登録されていない人は書き足さない（別のタブで外した人が、古い一覧から登録し直されないように）
 */
function addMember(email, role, memo, mustExist) {
  return withLock_(() => {
    const user = requireAdmin_()
    const address = String(email || '').trim()
    if (!EMAIL_PATTERN.test(address)) throw new Error('メールアドレスが正しくありません')
    if (role !== ROLE_ADMIN && role !== ROLE_TEACHER) throw new Error('役割が正しくありません')
    const sheet = sheet_(SHEET_ADMINS)
    const values = sheet.getDataRange().getValues()
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim().toLowerCase() === address.toLowerCase()) {
        if (address.toLowerCase() === user.toLowerCase() && role !== ROLE_ADMIN) throw new Error('自分を管理者から外すことはできません')
        const before = roleOfCell_(values[i][2])
        const next = values.slice()
        next[i] = [values[i][0], String(memo || values[i][1] || ''), role]
        keepAdmin_(next)
        setRow_(sheet, i + 1, 2, [next[i][1], role])
        appendMemberHistory_(user, (before === role ? '登録を更新：' : '役割を変更：') + address + '（' + (before && before !== role ? before + '→' : '') + role + '）')
        return readMembers_()
      }
    }
    if (mustExist) throw new Error(removedMemberMessage_(address))
    appendRow_(sheet, [address, String(memo || ''), role])
    appendMemberHistory_(user, '登録：' + address + '（' + role + '）')
    return readMembers_()
  })
}

/**
 * まとめて登録する（管理者だけ）。entries は [{ email, memo }]。すでに登録されている人は、そのままにする（役割もメモも変えない）
 */
function addMembers(entries, role) {
  return withLock_(() => {
    const user = requireAdmin_()
    if (!Array.isArray(entries)) throw new Error('登録する人の形が正しくありません')
    if (role !== ROLE_ADMIN && role !== ROLE_TEACHER) throw new Error('役割が正しくありません')
    const list = entries
      .map((e) => ({ email: String((e && e.email) || '').trim(), memo: String((e && e.memo) || '').trim() }))
      .filter((e) => EMAIL_PATTERN.test(e.email))
    const sheet = sheet_(SHEET_ADMINS)
    const values = sheet.getDataRange().getValues()
    const known = values.slice(1).map((r) => String(r[0]).trim().toLowerCase())
    const added = []
    list.forEach((e) => {
      if (known.indexOf(e.email.toLowerCase()) >= 0) return
      added.push([e.email, e.memo, role])
      known.push(e.email.toLowerCase())
    })
    keepAdmin_(values.concat(added))
    added.forEach((row) => appendRow_(sheet, row))
    if (added.length) appendMemberHistory_(user, 'まとめて登録：' + added.map((r) => r[0]).join('、') + '（' + role + '）')
    return readMembers_()
  })
}

/** 管理者・先生の登録を外す（管理者だけ。自分は外せない） */
function removeMember(email) {
  return withLock_(() => {
    const user = requireAdmin_()
    const address = String(email || '').trim().toLowerCase()
    if (address === user.toLowerCase()) throw new Error('自分の登録は外せません')
    const sheet = sheet_(SHEET_ADMINS)
    const values = sheet.getDataRange().getValues()
    const matches = (r) => String(r[0]).trim().toLowerCase() === address
    keepAdmin_(values.filter((r, i) => i === 0 || !matches(r)))
    let removed = 0
    for (let i = values.length - 1; i >= 1; i--) {
      if (!matches(values[i])) continue
      sheet.deleteRow(i + 1)
      removed++
    }
    if (removed) appendMemberHistory_(user, '登録を外す：' + address)
    return readMembers_()
  })
}

/**
 * 年度の設定を丸ごと保存する（管理者だけ）。
 * expectedUpdatedAt は、画面を開いたときの更新日時。そのあとにほかの人（先生など）が保存していたら、
 * 丸ごと書き戻すとその変更が消えるので、保存せずに知らせる
 */
function saveYear(config, expectedUpdatedAt) {
  return withLock_(() => {
    const user = requireAdmin_()
    checkConfig_(config)
    const sheet = sheet_(SHEET_YEARS)
    const rowIndex = findYearRow_(config.fiscalYear)
    if (rowIndex > 0) {
      checkNotChanged_(sheet, rowIndex, expectedUpdatedAt)
      setRow_(sheet, rowIndex, 3, [JSON.stringify(config), new Date(), user])
    } else if (expectedUpdatedAt) {
      // 画面を開いたときにはあった年度が、別のタブ・ほかの人に削除されていた（黙って作り直さない）
      throw new Error(deletedMessage_(config.fiscalYear))
    } else {
      appendRow_(sheet, [config.fiscalYear, STATUS_DRAFT, JSON.stringify(config), new Date(), user])
    }
    appendHistory_(user, config.fiscalYear, '保存', config)
    return getState()
  })
}

/**
 * 年度を学生に公開する（管理者だけ。今公開中の年度は「終了」になる）。
 * expectedUpdatedAt は、画面を開いたときの更新日時（そのあとにほかの人が保存していたら、見ていない内容を公開しないよう、公開せずに知らせる）。
 * 公開した年度と終了にした年度は、更新日時も変える（公開の前から開いていた別のタブの保存が、黙って学生に届かないように）
 */
function publishYear(year, expectedUpdatedAt) {
  return withLock_(() => {
    const user = requireAdmin_()
    const sheet = sheet_(SHEET_YEARS)
    const rowIndex = findYearRow_(year)
    if (rowIndex < 0) throw new Error(year + '年度の設定がありません')
    checkNotChanged_(sheet, rowIndex, expectedUpdatedAt)
    const config = parseConfig_(sheet.getRange(rowIndex, 3).getValue(), year)
    const values = sheet.getDataRange().getValues()
    const now = new Date()
    for (let i = 1; i < values.length; i++) {
      if (Number(values[i][0]) === Number(year)) setRow_(sheet, i + 1, 2, [STATUS_PUBLISHED])
      else if (values[i][1] === STATUS_PUBLISHED) setRow_(sheet, i + 1, 2, [STATUS_ENDED])
      else continue
      setRow_(sheet, i + 1, 4, [now, user])
    }
    appendHistory_(user, year, '公開', config)
    return getState()
  })
}

function createYear(fromYear, newYear) {
  return withLock_(() => {
    const user = requireAdmin_()
    // 年度は、西暦4桁の整数だけ（スプレッドシートに数式などが入らないように）。年度の設定の確かめ（validate.ts）と同じく 2000〜2100（2207 などの打ち間違いで作らない）
    if (!/^[1-9]\d{3}$/.test(String(newYear).trim()) || Number(newYear) < 2000 || Number(newYear) > 2100) throw new Error('新しい年度は、2000〜2100 の西暦4桁の数字で入力してください')
    const year = Number(newYear)
    if (findYearRow_(year) > 0) throw new Error(year + '年度はすでにあります')
    const fromIndex = findYearRow_(fromYear)
    if (fromIndex < 0) throw new Error(fromYear + '年度の設定がありません')
    const config = parseConfig_(sheet_(SHEET_YEARS).getRange(fromIndex, 3).getValue(), fromYear)
    config.fiscalYear = year
    appendRow_(sheet_(SHEET_YEARS), [year, STATUS_DRAFT, JSON.stringify(config), new Date(), user])
    appendHistory_(user, year, Number(fromYear) + '年度からコピーして作成', config)
    return getState()
  })
}

/**
 * 準備中の年度を削除する（管理者だけ）。間違えて作った年度を消すため。一度も学生に公開したことのない年度だけ消せる
 * （公開中・終了の年度や、変更履歴に「公開」がある年度は、学生が使っている・使ったことがあるので消さない）。
 * 変更履歴には「削除」の行を残す（消した内容は、その行の設定から写せる）
 */
function deleteYear(year, expectedUpdatedAt) {
  return withLock_(() => {
    const user = requireAdmin_()
    const sheet = sheet_(SHEET_YEARS)
    const rowIndex = findYearRow_(year)
    if (rowIndex < 0) throw new Error(year + '年度の設定がありません')
    if (sheet.getRange(rowIndex, 2).getValue() !== STATUS_DRAFT || wasPublished_(year)) {
      throw new Error(Number(year) + '年度は、学生に公開したことがあるため削除できません（削除できるのは、一度も公開していない「準備中」の年度だけです）')
    }
    checkNotChanged_(sheet, rowIndex, expectedUpdatedAt)
    const config = parseConfig_(sheet.getRange(rowIndex, 3).getValue(), year)
    sheet.deleteRow(rowIndex)
    appendHistory_(user, year, '削除', config)
    return getState()
  })
}

/** その年度を、これまでに学生に公開したことがあるか（変更履歴に「公開」か「初期設定」（setup で公開中として入れた）の行がある） */
function wasPublished_(year) {
  return publishedYears_().indexOf(Number(year)) >= 0
}

/**
 * これまでに学生に公開したことのある年度の一覧（変更履歴に「公開」か「初期設定」の行がある年度）。
 * 変更履歴の年度と操作の列（C・D 列）だけを読む（設定の列は大きいため、読まない）
 */
function publishedYears_() {
  const sheet = sheet_(SHEET_HISTORY)
  const last = sheet.getLastRow()
  if (last < 2) return []
  const years = []
  sheet
    .getRange(2, 3, last - 1, 2)
    .getValues()
    .forEach((r) => {
      if (r[0] === '' || (r[1] !== '公開' && r[1] !== '初期設定')) return
      if (years.indexOf(Number(r[0])) < 0) years.push(Number(r[0]))
    })
  return years
}

/**
 * お試し（学生の画面を試す）の見本の原稿（登録された先生と管理者だけ。学生には渡さない）。
 * 中身は scripts/build-gas.mjs が、git に入れないファイル gas/trial-sample.private.json から入れる（公開しているソースコードには入れない）
 */
/**
 * 公開中の管理ページの版の印と場所（依頼者の判断 2026-10-27：管理ページにも「新しい版があります」を出す）。
 * 開いたままの画面が、自分の印と比べる。違えば、新しく公開された版がある。だれでも呼べる（印と場所のほかは返さない）
 */
function getVersion() {
  return { id: BUILD_ID, url: ScriptApp.getService().getUrl() }
}

function getTrialSample() {
  requireTeacher_()
  if (!TRIAL_SAMPLE) throw new Error('見本の原稿が入っていません（管理者にお知らせください）')
  return TRIAL_SAMPLE
}

function getHistory(year) {
  requireTeacher_()
  const values = sheet_(SHEET_HISTORY).getDataRange().getValues().slice(1)
  const rows = []
  for (let i = values.length - 1; i >= 0 && rows.length < 50; i--) {
    const r = values[i]
    if (r[2] === '' || Number(r[2]) !== Number(year)) continue
    // 書き損じた行（設定の JSON や日時が読めない行）は飛ばす
    const config = parseJson_(r[4])
    const at = isoOf_(r[0])
    if (!config || !at) continue
    rows.push({ at: at, user: r[1], year: Number(r[2]), action: r[3], config: config })
  }
  return rows
}

// ---- 内部の処理 ----

function sheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)
  if (!sheet) throw new Error('シート「' + name + '」がありません。setup を実行してください')
  return sheet
}

/**
 * 年度の設定の一覧。書き損じた行（年度・設定の JSON・更新日時が読めない行）は飛ばす
 * （1行が壊れていても、ほかの年度は使えるように。直すときは、変更履歴のシートから設定の JSON を写す）
 */
function readYears_() {
  const years = []
  sheet_(SHEET_YEARS)
    .getDataRange()
    .getValues()
    .slice(1)
    .forEach((r, i) => {
      if (r[0] === '') return
      const year = Number(r[0])
      const config = parseJson_(r[2])
      const updatedAt = isoOf_(r[3])
      if (!Number.isInteger(year) || !config || !updatedAt) {
        Logger.log('「' + SHEET_YEARS + '」シートの ' + (i + 2) + ' 行目は読めないため、飛ばしました')
        return
      }
      years.push({ year: year, status: r[1], config: config, updatedAt: updatedAt, updatedBy: r[4] })
    })
  // 削除できる年度（一度も公開していない「準備中」。deleteYear と同じ決まり。管理ページは、この年度にだけ「この年度を削除」を出す）。
  // 変更履歴を読むのは、準備中の年度があるときだけ
  const published = years.some((y) => y.status === STATUS_DRAFT) ? publishedYears_() : []
  years.forEach((y) => (y.deletable = y.status === STATUS_DRAFT && published.indexOf(y.year) < 0))
  return years.sort((a, b) => b.year - a.year)
}

function findYearRow_(year) {
  const values = sheet_(SHEET_YEARS).getDataRange().getValues()
  for (let i = 1; i < values.length; i++) if (Number(values[i][0]) === Number(year)) return i + 1
  return -1
}

/** JSON を読む（読めない・オブジェクトでないときは null） */
function parseJson_(text) {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch (e) {
    return null
  }
}

/** 年度の設定のセルを読む（壊れていたらエラー） */
function parseConfig_(text, year) {
  const config = parseJson_(text)
  if (!config) throw new Error(year + '年度の設定（スプレッドシートの「' + SHEET_YEARS + '」シート）が壊れていて読めません。「' + SHEET_HISTORY + '」シートから、前の設定を写してください')
  return config
}

/** 日時を ISO の形の文字列にする（日時として読めなければ null） */
function isoOf_(value) {
  if (value === '' || value === null || value === undefined) return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * 画面を開いたあとに、ほかの人がこの年度の設定を保存していないか確かめる（保存していたらエラー）。
 * expectedUpdatedAt は、画面を開いたときの更新日時（空なら確かめない）
 */
function checkNotChanged_(sheet, rowIndex, expectedUpdatedAt) {
  if (!expectedUpdatedAt) return
  const [updatedAt, updatedBy] = sheet.getRange(rowIndex, 4, 1, 2).getValues()[0]
  if (isoOf_(updatedAt) !== expectedUpdatedAt) throw new Error(changedMessage_(updatedBy, Session.getActiveUser().getEmail()))
}

/** 役割を変えようとした人の登録が、画面を開いたあとに外されていたときの説明（試験用サーバーと同じ言葉） */
function removedMemberMessage_(email) {
  return email + ' の登録は、この画面を開いたあとに外されています。役割は変えませんでした。ページを読み込み直してください'
}

/** 画面を開いたあとに、年度が削除されていたときの説明（試験用サーバーと同じ言葉） */
function deletedMessage_(year) {
  return Number(year) + '年度は、この画面を開いたあとに削除されています。保存しませんでした。ページを読み込み直してください'
}

/** 画面を開いたあとに保存されていたときの説明。保存したのが自分なら、別のタブ・ウィンドウで保存したと伝える（試験用サーバーと同じ言葉） */
function changedMessage_(updatedBy, user) {
  const who = String(updatedBy || '').toLowerCase() === String(user || '').toLowerCase() ? '別のタブかウィンドウで（' + updatedBy + ' で）' : 'ほかの人（' + updatedBy + '）が'
  return 'この画面を開いたあとに、' + who + 'この年度の設定を保存しました。そのまま保存すると、その変更が消えてしまうため、保存しませんでした。ページを読み込み直してから、もう一度変更してください'
}

/** 役割の欄の読み方：「管理者」「先生」のどちらか（空欄は管理者）。それ以外（書き間違いなど）は null */
function roleOfCell_(value) {
  const role = String(value || '').trim()
  return role === ROLE_TEACHER ? ROLE_TEACHER : role === ROLE_ADMIN || role === '' ? ROLE_ADMIN : null
}

/** 管理者シートの行（見出しを除く）を一覧にする。役割を書き間違えた行は、使えないようにする（間違って管理者にならないように） */
function parseMembers_(rows) {
  return rows.map((r) => ({ email: String(r[0]).trim(), memo: String(r[1] || ''), role: roleOfCell_(r[2]) })).filter((m) => m.email && m.role)
}

/**
 * 管理者シートの一覧。役割は「管理者」「先生」のどちらか（役割の列がなかった頃の行＝空欄は管理者）。
 * それ以外（書き間違いなど）の行は、使えないようにする（間違って管理者にならないように）
 */
function readMembers_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ADMINS)
  if (!sheet) return []
  return parseMembers_(sheet.getDataRange().getValues().slice(1))
}

/** 有効な管理者の人数（同じアドレスの行がいくつかあれば、roleOf_ と同じく最初の行の役割で数える） */
function adminCount_(members) {
  const seen = {}
  let count = 0
  members.forEach((m) => {
    const key = m.email.toLowerCase()
    if (seen[key]) return
    seen[key] = true
    if (m.role === ROLE_ADMIN) count++
  })
  return count
}

/** 変更したあとの管理者シート（見出しを含む）で、有効な管理者が0人になるならエラーにする */
function keepAdmin_(values) {
  if (adminCount_(parseMembers_(values.slice(1))) === 0) throw new Error('有効な管理者が1人もいなくなるため、変更しませんでした。管理者を1人以上残してください')
}

/** その人の役割（管理者・先生）。登録されていなければ null */
function roleOf_(email) {
  if (!email) return null
  const member = readMembers_().find((m) => m.email.toLowerCase() === email.toLowerCase())
  return member ? member.role : null
}

function requireAdmin_() {
  const user = Session.getActiveUser().getEmail()
  if (roleOf_(user) !== ROLE_ADMIN) throw new Error('管理者だけが変更できます（ログイン中：' + (user || '不明') + '）')
  return user
}

/** 管理者か先生 */
function requireTeacher_() {
  const user = Session.getActiveUser().getEmail()
  if (!roleOf_(user)) throw new Error('登録された先生だけが使えます（ログイン中：' + (user || '不明') + '）')
  return user
}

function appendHistory_(user, year, action, config) {
  appendRow_(sheet_(SHEET_HISTORY), [new Date(), user, Number(year), action, JSON.stringify(config)])
}

/** 管理者・先生の登録の変更を、変更履歴に残す（年度と設定の欄は空） */
function appendMemberHistory_(user, action) {
  appendRow_(sheet_(SHEET_HISTORY), [new Date(), user, '', action, ''])
}

/**
 * セルに書く値。先頭が = + - @ の文字は、数式として動かないよう ' を付けて文字として書く
 * （' はスプレッドシートの画面にも、読み出した値にも出ない）
 */
function cell_(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value
}

function appendRow_(sheet, row) {
  sheet.appendRow(row.map(cell_))
}

/** row 行目の col 列から右へ、values を書く */
function setRow_(sheet, row, col, values) {
  sheet.getRange(row, col, 1, values.length).setValues([values.map(cell_)])
}

/**
 * 保存する設定の形を確かめる（形が崩れていたらエラー）。学生のツールが崩れた設定で止まらないように、
 * コースの項目・下書きのひな形・お知らせ・書き間違えやすい語の型と長さを確かめる。
 * 題目や締切が空かどうかなどの細かい確認は、管理ページの画面で行う（準備中の年度は、途中でも保存できるように）
 */
function checkConfig_(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('設定の形が正しくありません')
  if (!Number.isInteger(config.fiscalYear) || config.fiscalYear < 1000 || config.fiscalYear > 9999) throw new Error('年度が正しくありません')
  if (!Array.isArray(config.courses)) throw new Error('コースの一覧がありません')
  config.courses.forEach((course, i) => {
    const name = course && typeof course.name === 'string' && course.name ? course.name : (i + 1) + '番目のコース'
    if (
      !course ||
      typeof course !== 'object' ||
      typeof course.id !== 'string' ||
      !course.id ||
      typeof course.name !== 'string' ||
      typeof course.subtitleTemplate !== 'string' ||
      !Array.isArray(course.advisors) ||
      course.advisors.some((a) => typeof a !== 'string')
    ) {
      throw new Error('「' + name + '」の形が正しくありません')
    }
    if (course.template !== undefined && course.template !== null) cleanTemplate_(course.template, name)
    if (course.abstractExample !== undefined && course.abstractExample !== null) checkText_(course.abstractExample, LIMITS.abstractExample, '「' + name + '」の抄録の書き出し例')
    if (course.notice !== undefined && course.notice !== null) checkText_(course.notice, LIMITS.notice, '「' + name + '」のお知らせ')
    if (course.blankRowsOk !== undefined && typeof course.blankRowsOk !== 'boolean') throw new Error('「' + name + '」の表の空の行の設定が正しくありません')
    if (course.noSubtitle !== undefined && typeof course.noSubtitle !== 'boolean') throw new Error('「' + name + '」のサブタイトルを使うかの設定が正しくありません')
    if (course.permission !== undefined && course.permission !== null) checkPermission_(course.permission, name)
    if (course.groups !== undefined && course.groups !== null) checkGroups_(course.groups, name)
    if ((course.checkById !== undefined && typeof course.checkById !== 'boolean') || (course.checkOneColumn !== undefined && typeof course.checkOneColumn !== 'boolean')) {
      throw new Error('「' + name + '」の点検表の並びの設定が正しくありません')
    }
  })
  if (config.wordChecks !== undefined && config.wordChecks !== null) cleanWords_(config.wordChecks)
  // 標準のひな形（管理者が「詳細設定」で直したもの。ないときは、ツールに入っている標準のひな形）
  if (config.standardTemplate !== undefined && config.standardTemplate !== null) cleanTemplate_(config.standardTemplate, '', '標準のひな形')
  if (JSON.stringify(config).length > 45000) throw new Error('設定が大きすぎます')
}

function withLock_(fn) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    return fn()
  } finally {
    lock.releaseLock()
  }
}

// ---- 届いた声（学生のツールの「困ったこと・おかしいことを知らせる」。受け付けるのは配信の窓口 gas/api-project。mockups/v85） ----

const SHEET_FEEDBACK = '届いた声'
/** 届いた声のシートの列（配信の窓口 gas/api-project/Code.js の FEEDBACK_HEADER と同じ） */
const FEEDBACK_HEADER = ['受付番号', '確かめの鍵', '受け付けた日時', '種類', '内容', 'アドレス', '学籍番号', '氏名', 'コース', 'ツールの版', '端末', '開いていたページ', '直前の知らせ', 'ツールの中のエラー', '画面の写真', '状態', '学生へのひとこと', '先生のメモ', '状態を変えた日時', '知らせた日時', '管理者に知らせた日時']
/** 状態（学生に知らせるのは「直しました」「使い方で解決」） */
const FEEDBACK_STATUSES = ['受け付けた', '確かめ中', '直しました', '使い方で解決', '対応しない']
const FEEDBACK_NOTIFY = ['直しました', '使い方で解決']
/** 一覧に出す数（新しいものから） */
const FEEDBACK_LIST_MAX = 300

/** 新しく届いた声を管理者にメールで知らせる間隔（分） */
const FEEDBACK_MAIL_MINUTES = 10

/**
 * 届いた声のメールの準備（管理ページを配り直したあと、エディタで1回だけ実行する）：メールを送る権限を承認し、
 * 10分ごとに notifyNewFeedback を動かす仕掛けを作る（前に作ったものは消して作り直す）
 */
function setupFeedbackMail() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'notifyNewFeedback')
    .forEach((t) => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger('notifyNewFeedback').timeBased().everyMinutes(FEEDBACK_MAIL_MINUTES).create()
  Logger.log('届いた声を ' + FEEDBACK_MAIL_MINUTES + ' 分ごとに管理者に知らせます（メールの今日の残り：' + MailApp.getRemainingDailyQuota() + '通）')
}

/**
 * 新しく届いた声（管理者に知らせた日時が空の行）を、管理者（シート「管理者」の役割が管理者の人）に1通のメールでまとめて知らせる。
 * setupFeedbackMail が作った仕掛けから10分ごとに動く。送ったら、その行に知らせた日時を書く
 */
function notifyNewFeedback() {
  withLock_(() => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FEEDBACK)
    if (!sheet) return
    const rows = sheet.getDataRange().getValues()
    const fresh = []
    for (let i = 1; i < rows.length; i++) if (rows[i][0] !== '' && !String(rows[i][20] || '')) fresh.push({ index: i, item: feedbackOf_(rows[i]) })
    if (!fresh.length) return
    const admins = readMembers_()
      .filter((m) => m.role === ROLE_ADMIN)
      .map((m) => m.email)
    const to = [...new Set([...admins, ...feedbackMailTo_()])]
    if (!to.length) return
    const lines = ['卒業制作報告書のツールに、困ったこと・おかしいことが ' + fresh.length + ' 件届きました。', '']
    fresh.forEach(({ item }) => {
      const who = [item.studentId, item.name, item.email || '（ログインなし）'].filter(Boolean).join('　')
      lines.push('■ ' + item.id + '（' + item.kind + '）' + item.receivedAt, '送った人：' + who, '端末：' + item.device, '開いていたページ：' + item.page, item.text, '')
    })
    lines.push('管理ページの「届いた声」で、くわしく見て、状態を変えられます：' + (ADMIN_URL || ScriptApp.getService().getUrl()))
    MailApp.sendEmail({ to: to.join(','), subject: '【卒業制作報告書】届いた声 ' + fresh.length + '件（' + fresh.map((f) => f.item.id).join('・') + '）', body: lines.join('\n') })
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm')
    fresh.forEach(({ index }) => setRow_(sheet, index + 1, 21, [now]))
  })
}

/**
 * 届いた声のメールを、管理者のほかにも送る宛先（依頼者 2026-11-01：大学の外の、ふだん読むアドレスにも届けたい）。
 * エディタの「プロジェクトの設定」→「スクリプト プロパティ」の FEEDBACK_MAIL_TO（カンマ区切り）。アドレスはコードに書かない（公開のため）
 */
function feedbackMailTo_() {
  const value = PropertiesService.getScriptProperties().getProperty('FEEDBACK_MAIL_TO') || ''
  return value
    .split(/[,、\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))
}

/** 届いた声のシートの行を、管理ページに渡す形にする（確かめの鍵は渡さない） */
function feedbackOf_(r) {
  // 日時の列は、シートが日付として読み替えている（そのまま文字にすると「Sun Nov 01 2026 15:06:00 GMT+0900」になる）
  const s = (i) => (r[i] === undefined || r[i] === null ? '' : r[i] instanceof Date ? Utilities.formatDate(r[i], 'Asia/Tokyo', 'yyyy-MM-dd HH:mm') : String(r[i]))
  return {
    id: s(0),
    receivedAt: s(2),
    kind: s(3),
    text: s(4),
    email: s(5),
    studentId: s(6),
    name: s(7),
    course: s(8),
    version: s(9),
    device: s(10),
    page: s(11),
    notice: s(12),
    errors: s(13),
    screen: s(14),
    status: s(15) || FEEDBACK_STATUSES[0],
    reply: s(16),
    memo: s(17),
    changedAt: s(18),
    notifiedAt: s(19),
  }
}

/** 届いた声の一覧（新しいものから。管理者・先生） */
function getFeedback() {
  requireTeacher_()
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FEEDBACK)
  if (!sheet) return []
  return sheet
    .getDataRange()
    .getValues()
    .slice(1)
    .filter((r) => r[0] !== '')
    .map(feedbackOf_)
    .reverse()
    .slice(0, FEEDBACK_LIST_MAX)
}

/**
 * 届いた声の状態・学生へのひとこと・先生のメモを変える（管理者・先生）。
 * notify：学生に知らせる（「直しました」「使い方で解決」のとき。学生のツールには、次に開いたときに出る。
 * ログインして送った声なら、大学のメールにも送る）。返り値は、変えたあとの一覧
 */
function updateFeedback(id, status, reply, memo, notify) {
  return withLock_(() => {
    const user = requireTeacher_()
    if (FEEDBACK_STATUSES.indexOf(status) < 0) throw new Error('状態が正しくありません')
    const text = (value, max, label) => {
      const v = value === undefined || value === null ? '' : String(value)
      if (v.length > max) throw new Error(label + 'が長すぎます（' + max + '字まで）')
      return v
    }
    const replyText = text(reply, 500, '学生へのひとこと')
    const memoText = text(memo, 1000, '先生のメモ')
    const sheet = sheet_(SHEET_FEEDBACK)
    const rows = sheet.getDataRange().getValues()
    const index = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(id))
    if (index < 0) throw new Error('受付番号 ' + id + ' が見つかりません')
    const row = rows[index]
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm')
    const changed = String(row[15]) !== status || String(row[16] || '') !== replyText
    let notifiedAt = String(row[19] || '')
    if (notify && FEEDBACK_NOTIFY.indexOf(status) >= 0) {
      const email = String(row[5] || '')
      if (email) sendFeedbackMail_(feedbackOf_(row), status, replyText)
      notifiedAt = now
    }
    setRow_(sheet, index + 1, 16, [status, replyText, memoText, changed ? now : String(row[18] || ''), notifiedAt])
    console.log('届いた声 ' + id + ' を「' + status + '」に（' + user + '）')
    return getFeedback()
  })
}

/** 学生に、送った声を直したことをメールで知らせる */
function sendFeedbackMail_(item, status, reply) {
  const date = String(item.receivedAt).slice(5, 10).replace('-', '月').replace(/^0/, '') + '日'
  const summary = item.text.length > 40 ? item.text.slice(0, 40) + '…' : item.text
  const lines = item.name ? [item.name + ' さん', ''] : []
  lines.push(
    date + 'に送っていただいた「' + summary + '」（受付番号 ' + item.id + '）は、' + (status === '直しました' ? '直しました。' : '使い方で解決できます。'),
  )
  if (reply) lines.push('', reply)
  if (status === '直しました') lines.push('', 'ツールを開き直すと、新しい版になります。')
  lines.push('', '知らせていただき、ありがとうございました。', '', '卒業制作報告書の作成ツール（国際ファッション文化学科）', '※このメールには返事を送れません。急ぐときは、担当の先生に直接お知らせください。')
  MailApp.sendEmail({ to: item.email, subject: '【卒業制作報告書】送っていただいた件（受付番号 ' + item.id + '）', body: lines.join('\n'), noReply: true })
}

// ---- 先生の許可の仕組み：点検表（docs/設計_許可の仕組み.md。依頼者の選択 2026-11-04。見本は mockups/v103・v106・v107 案A） ----

const SHEET_ROSTER = '学生の名簿'
/** 学生の名簿の列（配信の窓口 gas/api-project/Code.js の ROSTER_HEADER と同じ）。年度と学籍番号で1行 */
const ROSTER_HEADER = ['年度', 'コース', '学籍番号', '姓', '名', 'セイ', 'メイ', '並び', 'PDF の ID', 'PDF の日時', '書き換え日時', '更新日時', '所属', '所属の日時']
/** 名簿の列の番号（0 から） */
/**
 * group：所属（制作グループなど。依頼者の選択 2026-11-09 mockups/v119）。groupAt：所属を決めた日時（ISO の文字。学生が選んだ・先生が直した。
 * 新しく決めた方を使う：配信の窓口の register_）。前の名簿にはない列なので、いちばん右に足した
 */
const ROSTER = { year: 0, course: 1, id: 2, familyName: 3, givenName: 4, familyKana: 5, givenKana: 6, order: 7, pdfId: 8, pdfAt: 9, touchedAt: 10, updatedAt: 11, group: 12, groupAt: 13 }
/** コースごとの点検表の一覧（年度・コース・スプレッドシートの ID。配信の窓口が読む） */
const SHEET_CHECK_SHEETS = '点検表'
const CHECK_SHEETS_HEADER = ['年度', 'コース', 'スプレッドシートの ID']
/** 点検表の中のシートの名前 */
const CHECK_TAB = '点検表'
/**
 * 点検表の見出し（空白・改行を除いたもの。配信の窓口の CHECK_COLUMNS と同じ）。ツールが決めておくのは、灰色の列と、許可の2列と、見えない列だけ。
 * これ以外の見出しのある列は、回の列（白い列。コースで自由に足す・消す・名前を変える）
 */
const CHECK_COLUMNS = { no: '番号', group: '所属', name: '氏名', pdf: '最新PDF', abstractOk: '抄録許可', finalOk: '最終提出可', kyomu: '教務提出', note: '知らせ', key: '学籍番号', abstractRec: '抄録許可の記録', finalRec: '最終提出可の記録' }
/** 新しく作る点検表の見出しの字（mockups/v106・v107。狭い列は2行に） */
const CHECK_HEAD_TEXT = { no: '番号', group: '所属', name: '氏名', pdf: '最新\nPDF', abstractOk: '抄録\n許可', finalOk: '最終\n提出可', kyomu: '教務\n提出', note: '知らせ', key: '学籍番号', abstractRec: '抄録許可の記録', finalRec: '最終提出可の記録' }
/** 先生が書く列（行が動いても、学生と一緒に動かす）。回の列も先生が書く */
const TEACHER_COLUMNS = ['abstractOk', 'finalOk', 'kyomu', 'abstractRec', 'finalRec']
/** 見えない列（行を見つける印と、許可の記録） */
const HIDDEN_COLUMNS = ['key', 'abstractRec', 'finalRec']
/** 1段に載せる人数（これをこえたら、半分ずつ2段。前半が左） */
const ONE_BLOCK_MAX = 25
/** 名簿 → 点検表の仕掛けの間隔（分） */
const CHECK_SYNC_MINUTES = 10
/** 先生ごとの「済み」の色（くすんだ淡い地と字。v107 案A。4人目からは繰り返し）と、「予定」の灰色の字 */
const TEACHER_TONES = [
  // 1人目は薄赤（依頼者の選択 2026-11-07 案A。前の薄青は、回の列の見出しの薄青と似ていた）
  { bg: '#f8e1e4', ink: '#8a3442' },
  { bg: '#e7efe6', ink: '#3d6342' },
  { bg: '#f2ece0', ink: '#7a5a2c' },
]
const PLAN_INK = '#a0a5ad'
/**
 * 所属の列の色（所属ごとの淡い地と濃い字。登録した順に、青灰・藤色・水色。4つ目からは繰り返し）。依頼者の選択 2026-11-09 mockups/v121 案A：
 * 所属の列のセルだけを塗る（回の列の先生の色（薄赤・緑・砂色）や、見出しの色とまぎれない色）
 */
const GROUP_TONES = [
  { bg: '#d7e1f2', ink: '#2d4470' },
  { bg: '#e5d9f2', ink: '#56377c' },
  { bg: '#cfeaec', ink: '#1b5a5e' },
]
/**
 * 見出しと列の色（v107 案A：ツールが入れる列は灰色、許可の列はうすい黄色）。見出しは役目ごとに淡い色と濃い字で分ける
 * （依頼者の選択 2026-11-07 案A。前はどれも灰色に近く、違いが分かりにくかった）：ツールが書く列は灰色・点検の回は青・許可は黄色・教務提出は緑
 */
const CHECK_COLORS = { toolHead: '#dadce0', toolInk: '#3c4043', roundHead: '#d6e4f5', roundInk: '#1f3f6b', permHead: '#f8dc8c', permInk: '#5c3b00', kyomuHead: '#d3ead6', kyomuInk: '#1e5b2a', toolCell: '#f3f4f6', permCell: '#fcf9ee', warnInk: '#c5221f', warnBg: '#fce8e6', dimInk: '#80868b' }
/** 列の幅（px。見本の狭い列に合わせる） */
const CHECK_WIDTHS = { no: 36, group: 72, name: 96, pdf: 48, round: 76, abstractOk: 44, finalOk: 48, kyomu: 44, note: 80, key: 90, abstractRec: 160, finalRec: 160, gap: 12 }
/** ツールが書く列（守る列。先生が書けるのは、回の列と ✓ の列だけ） */
const TOOL_COLUMNS = ['no', 'group', 'name', 'pdf', 'note', 'key', 'abstractRec', 'finalRec']
/** ツールが書く列と見出しの行を守るときの説明（先生が書こうとすると、この説明が出る） */
const PROTECT_NOTE = 'ツールが書く列です（並べ替えは管理ページの「学生の並びを直す」から）'
/**
 * 点検表の行の氏名と見えない学籍番号がずれたときの「知らせ」（配信の窓口の BROKEN_NOTE と同じ）。この知らせの行の許可・回の記録は、学生に渡さない。
 * 先生が行の中身を確かめて、その行の許可の ✓（抄録許可・最終提出可）を入れ直すと消える（onCheckSheetEdit。知らせの列は守ってあり、先生は直接は消せないため）
 */
const BROKEN_NOTE = '並びが崩れています'
/**
 * 点検表のいちばん上の案内（1つのセルに2行。見出しの行と一緒に固定して守る。依頼者 2026-11-04）。
 * 2行目は回の列のこと（コースごとに変えられる、と点検表の上で分かるように：依頼者の選択 2026-11-07 案1）
 */
const CHECK_TOP_NOTE = '⚠ 並びを直すときは、管理ページの「コースごとの設定」→「学生の並びを直す」から（灰色の列はツールが書きます）\n✎ 青い見出しの列（点検の回）は、コースごとに名前を変えたり、列を足したり消したりできます'
/** 前の案内の文（今ある点検表の1行目がこれなら、今の文に書き換える） */
const OLD_TOP_NOTES = [
  '並びを直すときは、管理ページの「コースごとの設定」→「学生の並びを直す」から（灰色の列はツールが書きます）',
  '⚠ 並びを直すときは、管理ページの「コースごとの設定」→「学生の並びを直す」から（灰色の列はツールが書きます）',
]
/** 案内の行：薄い黄色の帯に、濃い茶色の太字（依頼者の選択 2026-11-07 案B。前の小さな灰色の字では気づかれにくかった） */
const TOP_NOTE_INK = '#5c3b00'
const TOP_NOTE_FILL = '#fff1c2'
const TOP_NOTE_SIZE = 12

/**
 * 案内の文の幅（ピクセルの見積もり。いちばん長い行：全角の字は文字の大きさ1つぶん、半角は半分、左のすき間）。
 * 本物より少し多め（12 ポイントの1行目は、画面で約 846 ピクセル・見積もり 872）
 */
function noteWidthPx_(text, pt) {
  const em = (pt * 4) / 3
  return Math.max.apply(null, String(text).split('\n').map((line) => {
    let px = 4
    for (const ch of line) px += ch.codePointAt(0) > 0xff ? em : em / 2
    return px
  }))
}

/** 見出しの名前（空白・改行を除く。「最新\nPDF」→「最新PDF」） */
function headName_(value) {
  return String(value === undefined || value === null ? '' : value).replace(/\s/g, '')
}

/** 見出しの名前の種類（決まった列は CHECK_COLUMNS の名前、それ以外は round。空は ''） */
function columnKind_(name) {
  if (!name) return ''
  const keys = Object.keys(CHECK_COLUMNS)
  return keys.find((k) => CHECK_COLUMNS[k] === name) || 'round'
}

/** 回の列のはじめの名前（1回目〜4回目のあとに抄録：依頼者 2026-11-07。前は「3回目・抄録・4回目」の順） */
const DEFAULT_ROUNDS = ['1回目', '2回目', '3回目', '4回目', '抄録']

/** 新しい点検表の1段の見出し：回の列のあとに、許可の2列（右に2つ並べる）・教務提出・知らせ */
function checkTemplate_() {
  const t = CHECK_HEAD_TEXT
  return [t.no, t.name, t.pdf].concat(DEFAULT_ROUNDS, [t.abstractOk, t.finalOk, t.kyomu, t.note, t.key, t.abstractRec, t.finalRec])
}

/**
 * 点検表の見出しの行から、段（2段組なら2つ）を読む。段は「番号」の列から、次の「番号」の列の前まで（end は、段の中の見出しのある最後の列）。
 * cols：決まった列の場所（0 から。なければ -1）、rounds：回の列（{ col, label }。並んだ順）。配信の窓口の checkBlocks_ と同じ読み方
 */
function checkBlocks_(header) {
  const names = header.map(headName_)
  const keys = Object.keys(CHECK_COLUMNS)
  const starts = []
  names.forEach((n, i) => n === CHECK_COLUMNS.no && starts.push(i))
  return starts.map((start, b) => {
    const next = b + 1 < starts.length ? starts[b + 1] : names.length
    const cols = {}
    keys.forEach((k) => (cols[k] = -1))
    const rounds = []
    let end = start
    for (let c = start; c < next; c++) {
      if (!names[c]) continue
      end = c
      const k = columnKind_(names[c])
      if (k !== 'round') {
        if (cols[k] < 0) cols[k] = c
      } else rounds.push({ col: c, label: String(header[c]).replace(/\s+/g, ' ').trim() })
    }
    return { start: start, end: end, cols: cols, rounds: rounds }
  })
}

/**
 * 人数から、段の数と1段の人数（25人まで1段、26人からは半分ずつ2段。前半が左）。
 * oneColumn：コースで「いつも縦1列」を選んだ（依頼者の選択 2026-11-09 mockups/v119）
 */
function blockLayout_(count, oneColumn) {
  if (oneColumn || count <= ONE_BLOCK_MAX) return { count: count, blocks: 1, perBlock: count }
  return { count: count, blocks: 2, perBlock: Math.ceil(count / 2) }
}

/** 氏名の名字（最初の空白（半角・全角）の前。空白がなければ全部） */
function surnameOf_(name) {
  const text = String(name || '').trim()
  const m = /^(\S+)\s/.exec(text)
  return m ? m[1] : text
}

/** コースの指導教員の名字の一覧（欄の中が「、」「,」で区切ってあっても分ける。重なりは1つに） */
function advisorSurnames_(advisors) {
  const out = []
  ;(Array.isArray(advisors) ? advisors : []).forEach((a) =>
    String(a || '')
      .split(/[、,，]/)
      .forEach((part) => {
        const s = surnameOf_(part)
        if (s && out.indexOf(s) < 0) out.push(s)
      }),
  )
  return out
}

/**
 * ✓ を入れた先生の名字：先生の登録（シート「管理者」）のメモに、コースの指導教員の名字があれば、その名字（長いものを先に）。
 * なければ、アドレスの @ より前（学生のツールに「許可が出ました（12/15 〇〇先生）」と出る）
 */
function editorSurname_(email, memo, surnames) {
  const text = String(memo || '')
  const hit = (surnames || []).filter((s) => s && text.indexOf(s) >= 0).sort((a, b) => b.length - a.length)[0]
  return hit || String(email || '').split('@')[0]
}

/** ふりがなを比べる形（ひらがなはカタカナに、半角カナは全角に。続く空白は1つに） */
function kanaKey_(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .replace(/\s+/g, ' ')
    .trim()
}

/** 学生の氏名（姓 名。全角の空白でつなぐ） */
function fullName_(s) {
  return [s.familyName, s.givenName].filter(Boolean).join('　')
}

/** ふりがなの順に比べる（セイ → メイ → 氏名 → 学籍番号。ふりがなのない学生は後ろ） */
function compareStudents_(a, b) {
  const ka = kanaKey_(a.familyKana)
  const kb = kanaKey_(b.familyKana)
  if (!ka !== !kb) return ka ? -1 : 1
  return ka.localeCompare(kb, 'ja') || kanaKey_(a.givenKana).localeCompare(kanaKey_(b.givenKana), 'ja') || fullName_(a).localeCompare(fullName_(b), 'ja') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** 学籍番号の順に比べる（念のため、同じならふりがなの順。教職員の試しの行は後ろ。管理ページの画面の compareById と同じ） */
function compareById_(a, b) {
  const staff = (s) => (String(s.id).indexOf('staff:') === 0 ? 1 : 0)
  return staff(a) - staff(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) || compareStudents_(a, b)
}

/** コースの所属の名前（先生が登録した順。空の名前は除く） */
function courseGroups_(course) {
  return course && Array.isArray(course.groups) ? course.groups.filter((g) => typeof g === 'string' && g.trim()) : []
}

/**
 * コースの点検表の並べ方（依頼者の選択 2026-11-09 mockups/v119）：所属があれば所属ごと（登録した順。選んでいない学生は後ろ）、
 * その中は五十音順（ふりがなの順）か学籍番号順。管理ページの画面（src/admin/studentOrder.ts の comparerFor）と同じ決め方
 */
function comparerFor_(course) {
  const groups = courseGroups_(course)
  const inner = course && course.checkById ? compareById_ : compareStudents_
  if (!groups.length) return inner
  const rank = (s) => {
    const i = groups.indexOf(s.group)
    return i < 0 ? groups.length : i
  }
  return (a, b) => rank(a) - rank(b) || inner(a, b)
}

/** 学生の所属を、コースに登録してある所属だけにする（先生が名前を変えた・消した所属は、まだ選んでいないとみなす） */
function knownGroups_(students, course) {
  const groups = courseGroups_(course)
  return students.map((s) => (groups.indexOf(s.group) >= 0 ? s : Object.assign({}, s, { group: '' })))
}

/**
 * 先生が直した並び（名簿の「並び」）を使えるか：直したときの順番（五十音順・学籍番号順）が、今のコースの順番と同じとき。
 * 順番を変えたら、前に直した並びは使わない（その順番で並び直す）。直したときの順番は、スクリプト プロパティ orderMode:年度:コース
 */
function manualOrderOk_(year, course) {
  const mode = PropertiesService.getScriptProperties().getProperty('orderMode:' + Number(year) + ':' + course.id) || 'kana'
  return mode === (course.checkById ? 'id' : 'kana')
}

/**
 * 並びの中で「手で動かした」学生（決まった順（compare。はじめはふりがなの順）に並んでいる、いちばん長いつながりに入らない学生）。
 * 1人を動かすと、その1人だけに印が付く（ほかの学生は、ずれても決まった順のまま）。管理ページの画面（src/admin/studentOrder.ts）と同じ決め方
 */
function movedFlags_(list, compare) {
  const cmp = compare || compareStudents_
  const n = list.length
  const len = list.map(() => 1)
  const prev = list.map(() => -1)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (cmp(list[j], list[i]) <= 0 && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1
        prev[i] = j
      }
    }
  }
  let best = -1
  for (let i = 0; i < n; i++) if (best < 0 || len[i] > len[best]) best = i
  const keep = list.map(() => false)
  for (let i = best; i >= 0; i = prev[i]) keep[i] = true
  return keep.map((k) => !k)
}

/**
 * 点検表の並び：先生が並べ替えていなければ、コースの順番（五十音順＝ふりがなの順・学籍番号順）。並べ替えてあれば（名簿の「並び」）その順で、
 * あとから来た学生（並びが空）は、その順番の所（手で動かした学生は目印にしない）に入れる。
 * 所属のあるコースは、所属ごと（登録した順。選んでいない学生は後ろ）に分けて、その中を並べる。
 * course：コースの設定（所属・順番。なければ五十音順）。manualOk が false なら、先生が直した並びは使わない（順番を変えたあと）
 */
function orderStudents_(students, course, manualOk) {
  const compare = comparerFor_(course)
  const groups = courseGroups_(course)
  if (!groups.length) return orderWithin_(students, compare, manualOk)
  // 所属ごとに分け（登録した順。選んでいない学生は後ろ）、それぞれの中を並べる（点検表は、いつも所属ごとに並ぶ）
  const buckets = groups.map(() => []).concat([[]])
  students.forEach((s) => {
    const i = groups.indexOf(s.group)
    buckets[i < 0 ? groups.length : i].push(s)
  })
  return [].concat.apply([], buckets.map((b) => orderWithin_(b, compare, manualOk)))
}

/** 1つのまとまり（所属の中・所属のないコースは全員）を並べる（orderStudents_ の中身。manualOk が false なら、先生が直した並びは使わない） */
function orderWithin_(students, compare, manualOk) {
  const byKana = students.slice().sort(compare)
  const placed = manualOk === false ? [] : students.filter((s) => s.order > 0).sort((a, b) => a.order - b.order || compare(a, b))
  if (!placed.length) return byKana
  const moved = movedFlags_(placed, compare)
  const out = placed.map((s, i) => ({ s: s, anchor: !moved[i] }))
  byKana
    .filter((s) => !(s.order > 0))
    .forEach((s) => {
      let at = out.findIndex((x) => x.anchor && compare(s, x.s) < 0)
      if (at < 0) at = out.length
      out.splice(at, 0, { s: s, anchor: true })
    })
  return out.map((x) => x.s)
}

/** 日時の値（シートの日付・ISO の文字）を Date に（読めなければ null） */
function dateOf_(value) {
  if (value === '' || value === null || value === undefined) return null
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/** 日時を、日本の時刻の「月/日」にする（例：1/14） */
function monthDay_(date) {
  const d = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return d.getUTCMonth() + 1 + '/' + d.getUTCDate()
}

/** 許可の記録（「ISO の日時 / 名字」）を読む。読めない日時は '' */
function recordOf_(value) {
  const text = String(value === undefined || value === null ? '' : value)
  const i = text.indexOf(' / ')
  const at = dateOf_((i >= 0 ? text.slice(0, i) : text).trim())
  return { at: at ? at.toISOString() : '', by: i >= 0 ? text.slice(i + 3).trim() : '' }
}

/**
 * 点検表の「知らせ」：最終提出可の ✓ のあとに書き換えた → 「書き換え 1/14」（赤）。PDF をまだ送っていない → 「PDF まだ」（灰色）
 */
function noteOf_(student, finalOk, finalRecord) {
  const touched = dateOf_(student.touchedAt)
  if (touched && finalOk === true) {
    const record = recordOf_(finalRecord)
    if (!record.at || new Date(record.at).getTime() < touched.getTime()) return '書き換え ' + monthDay_(touched)
  }
  return student.pdfId ? '' : 'PDF まだ'
}

/** 「最新 PDF」のセル（押すとドライブの PDF。字は送った日の「月/日」） */
function pdfFormula_(student) {
  if (!student.pdfId || !/^[\w-]+$/.test(student.pdfId)) return ''
  const at = dateOf_(student.pdfAt)
  return '=HYPERLINK("https://drive.google.com/file/d/' + student.pdfId + '/view","' + (at ? monthDay_(at) : 'PDF') + '")'
}

/**
 * 氏名を比べる形（字の幅・空白・教職員の試しの「（試し）」・先頭の ' の違いは見ない）。
 * 点検表の氏名と名簿の氏名が、書き方の違いだけで「並びが崩れた」にならないように（依頼者の試し 2026-11-04）
 */
function nameKey_(value) {
  return String(value === undefined || value === null ? '' : value)
    .normalize('NFKC')
    .replace(/\s/g, '')
    .replace(/^'/, '')
    .replace(/^\(試し\)/, '')
}

/** 名簿の学生の氏名（学籍番号 → 比べる形）と、氏名ごとの学籍番号（同じ氏名の学生がいても分かるように） */
function rosterNames_(students) {
  const byKey = {}
  const owners = {}
  students.forEach((s) => {
    const k = nameKey_(fullName_(s))
    byKey[s.id] = k
    ;(owners[k] = owners[k] || []).push(s.id)
  })
  return { byKey: byKey, owners: owners }
}

/**
 * 点検表の行の並びが崩れているか：見える氏名（shown）が、その行の学籍番号（key）の学生ではなく、名簿のほかの学生の氏名のとき。
 * 氏名が同じ・だれのものでもない（名簿を直した直後・書き方の違い）・名簿にない学生の行は、崩れたとはみなさない
 */
function outOfStep_(names, key, shown) {
  const mine = names.byKey[key]
  const k = nameKey_(shown)
  if (mine === undefined || !k || k === mine) return false
  const owners = names.owners[k]
  return !!owners && owners.indexOf(key) < 0
}

/** 点検表の「氏名」（教職員の試しの行は「（試し）」を付ける） */
function sheetName_(student) {
  return (student.id.indexOf('staff:') === 0 ? '（試し）' : '') + fullName_(student)
}

/** 点検表のスプレッドシートの名前 */
function checkSheetTitle_(year, course) {
  return Number(year) + '年度 点検表（' + String(course.name || '').trim() + ' コース）'
}

/** 名前のシート（なければ、見出しの行を付けて作る） */
function sheetWithHeader_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.appendRow(header)
    sheet.setFrozenRows(1)
    sheet.getRange(1, 1, 1, header.length).setFontWeight('bold')
  }
  return sheet
}

/** 管理用のスプレッドシート（点検表の編集の仕掛けの中では「今のスプレッドシート」が点検表なので、覚えておいた ID で開く） */
function adminBook_() {
  const id = PropertiesService.getScriptProperties().getProperty('ADMIN_SHEET_ID')
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet()
}

/** 管理用のスプレッドシートの ID を覚えておく（点検表の編集の仕掛けが使う） */
function rememberAdminBook_() {
  const props = PropertiesService.getScriptProperties()
  const id = SpreadsheetApp.getActiveSpreadsheet().getId()
  if (props.getProperty('ADMIN_SHEET_ID') !== id) props.setProperty('ADMIN_SHEET_ID', id)
}

/** 学生の名簿（同じ年度・学籍番号の行がいくつかあれば、下の行）。名簿のシートがなければ null */
function readRoster_(book) {
  const sheet = (book || SpreadsheetApp.getActiveSpreadsheet()).getSheetByName(SHEET_ROSTER)
  if (!sheet) return null
  const s = (v) => String(v === undefined || v === null ? '' : v).trim()
  const byKey = {}
  sheet
    .getDataRange()
    .getValues()
    .slice(1)
    .forEach((r, i) => {
      const id = s(r[ROSTER.id])
      if (!id || s(r[ROSTER.year]) === '') return
      byKey[s(r[ROSTER.year]) + ':' + id] = {
        row: i + 2,
        year: s(r[ROSTER.year]),
        course: s(r[ROSTER.course]),
        id: id,
        familyName: s(r[ROSTER.familyName]),
        givenName: s(r[ROSTER.givenName]),
        familyKana: s(r[ROSTER.familyKana]),
        givenKana: s(r[ROSTER.givenKana]),
        order: Number(r[ROSTER.order]) > 0 ? Number(r[ROSTER.order]) : 0,
        pdfId: s(r[ROSTER.pdfId]),
        pdfAt: r[ROSTER.pdfAt],
        touchedAt: r[ROSTER.touchedAt],
        group: s(r[ROSTER.group]),
      }
    })
  return Object.keys(byKey).map((k) => byKey[k])
}

/** その年度・コースの学生（名簿から） */
function courseStudents_(roster, year, courseId) {
  return (roster || []).filter((r) => r.year === String(Number(year)) && r.course === courseId)
}

/** コースごとの点検表の一覧（{ index：シートの行番号, year, courseId, id }） */
function checkSheetEntries_(book) {
  const sheet = (book || SpreadsheetApp.getActiveSpreadsheet()).getSheetByName(SHEET_CHECK_SHEETS)
  if (!sheet) return []
  return sheet
    .getDataRange()
    .getValues()
    .slice(1)
    .map((r, i) => ({ index: i + 2, year: Number(r[0]), courseId: String(r[1] || ''), id: String(r[2] || '').trim() }))
    .filter((e) => e.id && Number.isInteger(e.year))
}

/** 年度の設定（読めなければ null）。book を渡すと、そのスプレッドシートから読む */
function yearConfig_(year, book) {
  const sheet = (book || SpreadsheetApp.getActiveSpreadsheet()).getSheetByName(SHEET_YEARS)
  if (!sheet) return null
  const row = sheet
    .getDataRange()
    .getValues()
    .slice(1)
    .find((r) => r[0] !== '' && Number(r[0]) === Number(year))
  return row ? { status: row[1], config: parseJson_(row[2]) } : null
}

function courseOf_(config, courseId) {
  const courses = config && Array.isArray(config.courses) ? config.courses : []
  return courses.find((c) => c && c.id === courseId) || null
}

/** 年度とコース（なければエラー：まだ保存していないコースなど） */
function requireCourse_(year, courseId) {
  const found = yearConfig_(year)
  if (!found || !found.config) throw new Error(Number(year) + '年度の設定がありません')
  const course = courseOf_(found.config, String(courseId))
  if (!course) throw new Error('このコースは、まだ保存されていません。保存してから使ってください')
  return course
}

/** ファイル名・フォルダ名に使えない文字を除く（配信の窓口の cleanName_ と同じ。PDF の控えのコースのフォルダと同じ名前にする） */
function cleanName_(value, max) {
  // 制御文字も除く（わざと入れている）
  // oxlint-disable-next-line no-control-regex
  const unusable = /[\u0000-\u001f\u007f\\/:*?"<>|]/g
  return String(value || '')
    .replace(unusable, '')
    .trim()
    .slice(0, max)
}

/**
 * PDF の控えのフォルダの中の、年度のフォルダ（「2026年度」）の中の、コースのフォルダ（配信の窓口の pdfCopy と同じ名前。なければ作る。
 * 年度ごとに分ける：依頼者 2026-11-05）
 */
function courseFolder_(year, courseName) {
  const rootId = pdfRootId_()
  if (!rootId) throw new Error('PDF の控えを置くフォルダが決まっていないため、点検表を作れません。管理者に知らせてください')
  const yearFolder = childFolder_(DriveApp.getFolderById(rootId), String(Number(year)) + '年度')
  return childFolder_(yearFolder, cleanName_(courseName, 80) || 'コース未設定')
}

// ---- PDF の控えのもとのフォルダ（管理ページの「詳細設定」で変える。依頼者の選択 2026-11-05 mockups/v112 案A） ----
/** 年度にかかわらない設定のシート（項目・値。配信の窓口も読む） */
const SHEET_SETTINGS = '設定'
const SETTINGS_HEADER = ['項目', '値', '変えた日時', '変えた人']
/** 設定のシートの、PDF の控えのもとのフォルダの項目（値はフォルダの ID） */
const SETTING_PDF_FOLDER = 'PDF の控えのフォルダ'

/** 設定のシートの値（なければ ''） */
function readSetting_(key) {
  const sheet = adminBook_().getSheetByName(SHEET_SETTINGS)
  if (!sheet) return ''
  const row = sheet.getDataRange().getValues().slice(1).find((r) => String(r[0]) === key)
  return row ? String(row[1] || '').trim() : ''
}

/** PDF の控えのもとのフォルダの ID（管理ページで決めたもの。なければ、配るときに入れたもの・スクリプト プロパティ） */
function pdfRootId_() {
  return readSetting_(SETTING_PDF_FOLDER) || String(PDF_FOLDER_ID || PropertiesService.getScriptProperties().getProperty('PDF_FOLDER_ID') || '').trim()
}

/** 貼られたフォルダのリンク（…/folders/ID・?id=ID）か ID から、ID を取り出す（取れなければ ''） */
function folderIdFromLink_(text) {
  const t = String(text || '').trim()
  const m = /\/folders\/([\w-]{10,})/.exec(t) || /[?&]id=([\w-]{10,})/.exec(t)
  if (m) return m[1]
  return /^[\w-]{10,}$/.test(t) ? t : ''
}

/** 管理者：PDF の控えのもとのフォルダ（名前・場所。開けなければ error） */
function getPdfFolder() {
  requireAdmin_()
  return pdfFolderInfo_()
}

function pdfFolderInfo_() {
  const id = pdfRootId_()
  if (!id) return { id: '', name: null, url: '', error: 'まだ決まっていません' }
  const url = 'https://drive.google.com/drive/folders/' + id
  try {
    const folder = DriveApp.getFolderById(id)
    if (folder.isTrashed()) return { id: id, name: folder.getName(), url: url, error: 'ごみ箱に入っています' }
    return { id: id, name: folder.getName(), url: url }
  } catch (err) {
    return { id: id, name: null, url: url, error: 'このフォルダを開けません（消えた・見る権限がない）' }
  }
}

/**
 * 管理者：PDF の控えのもとのフォルダを変える（貼られたリンク）。変えたあとに届く控えと、作る点検表が、新しいフォルダの年度・コースのフォルダに入る。
 * 今までの控え・点検表は、元のフォルダに残る（動かさない）
 */
function setPdfFolder(link) {
  const user = requireAdmin_()
  const id = folderIdFromLink_(link)
  if (!id) throw new Error('フォルダのリンクを貼ってください（https://drive.google.com/drive/folders/… の形）')
  let folder
  try {
    folder = DriveApp.getFolderById(id)
    folder.getName()
  } catch (err) {
    throw new Error('そのフォルダを開けません。リンクと、フォルダの共有を確かめてください')
  }
  if (folder.isTrashed()) throw new Error('そのフォルダはごみ箱に入っています')
  const access = folder.getAccess(user)
  if (access !== DriveApp.Permission.OWNER && access !== DriveApp.Permission.EDIT) throw new Error('そのフォルダを編集できません。フォルダの持ち主に「編集者」にしてもらってください')
  withLock_(() => {
    const sheet = sheetWithHeader_(SHEET_SETTINGS, SETTINGS_HEADER)
    const rows = sheet.getDataRange().getValues()
    const at = rows.findIndex((r, i) => i > 0 && String(r[0]) === SETTING_PDF_FOLDER)
    const row = [SETTING_PDF_FOLDER, id, new Date(), user]
    if (at > 0) sheet.getRange(at + 1, 1, 1, row.length).setValues([row.map(cell_)])
    else appendRow_(sheet, row)
  })
  appendMemberHistory_(user, 'PDF の控えのフォルダを変更：' + folder.getName())
  return pdfFolderInfo_()
}

/** フォルダ（parent）の中の、name のフォルダ（ごみ箱のものは使わない。なければ作る） */
function childFolder_(parent, name) {
  const found = parent.getFoldersByName(name)
  while (found.hasNext()) {
    const folder = found.next()
    if (!folder.isTrashed()) return folder
  }
  return parent.createFolder(name)
}

/** 点検表のスプレッドシートを使えるか（ごみ箱に入れた・消した・見られないときは false） */
function usableSheet_(id) {
  try {
    return !DriveApp.getFileById(id).isTrashed()
  } catch (err) {
    return false
  }
}

/** 点検表の場所（スプレッドシートの ID から） */
function checkSheetUrl_(id) {
  return 'https://docs.google.com/spreadsheets/d/' + id + '/edit'
}

/**
 * 作ってある点検表の場所の一覧（管理ページを開いたときに渡す。「点検表を開く」は、サーバーに聞かずに、すぐ開く：依頼者の試し 2026-11-04）
 */
function checkSheetLinks_() {
  return checkSheetEntries_().map((e) => ({ year: e.year, courseId: e.courseId, url: checkSheetUrl_(e.id) }))
}

/**
 * コースの点検表を作る（管理ページの「点検表を開く」で、まだ点検表がないとき。先生も使える）：PDF の控えのコースのフォルダに、
 * 「2026年度 点検表（〇〇 コース）」を作り、シート「点検表」に ID を書き、編集の仕掛けを付け、名簿から写してから、場所を返す。
 * もうあれば、写さずにすぐ場所を返す（写すのは10分ごとの仕掛けと「この並びにする」。開くのを待たせない：依頼者の試し 2026-11-04）
 */
function ensureCheckSheet(year, courseId) {
  requireTeacher_()
  const course = requireCourse_(year, courseId)
  rememberAdminBook_()
  const existing = checkSheetEntries_().find((e) => e.year === Number(year) && e.courseId === course.id)
  if (existing && usableSheet_(existing.id)) return { url: checkSheetUrl_(existing.id) }
  const id = withLock_(() => {
    const found = checkSheetEntries_().find((e) => e.year === Number(year) && e.courseId === course.id)
    if (found && usableSheet_(found.id)) return found.id
    const folder = courseFolder_(year, course.name)
    const book = SpreadsheetApp.create(checkSheetTitle_(year, course))
    const sheet = book.getSheets()[0]
    sheet.setName(CHECK_TAB)
    writeSheetHead_(sheet)
    DriveApp.getFileById(book.getId()).moveTo(folder)
    const list = sheetWithHeader_(SHEET_CHECK_SHEETS, CHECK_SHEETS_HEADER)
    // 前の点検表をごみ箱に入れていたら、その行を新しい ID にする（同じ年度・コースで2行にしない）
    if (found) setRow_(list, found.index, 3, [book.getId()])
    else appendRow_(list, [Number(year), course.id, book.getId()])
    appendMemberHistory_(Session.getActiveUser().getEmail(), '点検表を作成：' + checkSheetTitle_(year, course))
    return book.getId()
  })
  try {
    refreshEditTriggers_()
  } catch (err) {
    console.error('点検表の編集の仕掛けを付けられませんでした（setupCheckSheets を実行してください）：' + String(err && err.message ? err.message : err))
  }
  syncNow_(year, course.id)
  return { url: checkSheetUrl_(id) }
}

/** 並べ替えの窓の一覧：[{ studentId, name, kana, group, moved }]（点検表の並び。group：所属（まだ選んでいなければ ''）。moved：手で動かした） */
function studentList_(year, course) {
  const ordered = orderStudents_(knownGroups_(courseStudents_(readRoster_(), year, course.id), course), course, manualOrderOk_(year, course))
  const moved = movedFlags_(ordered, comparerFor_(course))
  return ordered.map((s, i) => ({ studentId: s.id, name: fullName_(s), kana: [s.familyKana, s.givenKana].filter(Boolean).join(' '), group: s.group || '', moved: moved[i] }))
}

/** 「学生の並びを直す」の窓の一覧（先生も使える） */
function listStudents(year, courseId) {
  requireTeacher_()
  return studentList_(year, requireCourse_(year, courseId))
}

/**
 * 「この並びにする」（先生も使える）：名簿の「並び」に書き、点検表をこの並びにする。
 * studentIds が null なら、決まった順（五十音順・学籍番号順）に戻す（並びを空にする）。一覧にない学生（窓を開いたあとに来た学生）は、並びを空のまま（決まった順の所に入る）。
 * groups：先生が直した学生の所属（学籍番号 → 所属。依頼者の選択 2026-11-09：学生が間違えて選んだときに、先生も直せる）。
 * 所属の日時を今にする（学生のツールは、点検表の様子を聞いたときに受け取り、学生の画面の所属も直す）
 */
function saveStudentOrder(year, courseId, studentIds, groups) {
  const course = withLock_(() => {
    const user = requireTeacher_()
    const found = requireCourse_(year, courseId)
    if (studentIds !== null && (!Array.isArray(studentIds) || studentIds.length > 2000 || studentIds.some((x) => typeof x !== 'string'))) throw new Error('並びの形が正しくありません')
    const known = courseGroups_(found)
    const fixes = groups && typeof groups === 'object' ? groups : {}
    if (Object.keys(fixes).length > 2000 || Object.keys(fixes).some((id) => known.indexOf(fixes[id]) < 0)) throw new Error('所属の形が正しくありません（コースに登録していない所属です）')
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ROSTER)
    if (!sheet) return found
    // 先生が直した所属（所属と、決めた日時）
    const fixed = []
    if (Object.keys(fixes).length) {
      if (!String(sheet.getRange(1, ROSTER.group + 1).getValue())) sheet.getRange(1, ROSTER.group + 1, 1, 2).setValues([[ROSTER_HEADER[ROSTER.group], ROSTER_HEADER[ROSTER.groupAt]]]).setFontWeight('bold')
      const now = new Date().toISOString()
      sheet
        .getDataRange()
        .getValues()
        .forEach((r, i) => {
          const id = String(r[ROSTER.id]).trim()
          if (i === 0 || String(r[ROSTER.year]).trim() !== String(Number(year)) || String(r[ROSTER.course]).trim() !== found.id || !Object.prototype.hasOwnProperty.call(fixes, id)) return
          sheet.getRange(i + 1, ROSTER.group + 1, 1, 2).setValues([["'" + fixes[id], "'" + now]])
          fixed.push(id)
        })
    }
    const rank = new Map()
    ;(studentIds || []).forEach((id, i) => rank.has(id) || rank.set(id, i + 1))
    const values = sheet.getDataRange().getValues()
    const column = values.map((r) => r[ROSTER.order])
    let lo = -1
    let hi = -1
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][ROSTER.year]).trim() !== String(Number(year)) || String(values[i][ROSTER.course]).trim() !== found.id) continue
      column[i] = rank.get(String(values[i][ROSTER.id]).trim()) || ''
      if (lo < 0) lo = i
      hi = i
    }
    if (lo > 0) sheet.getRange(lo + 1, ROSTER.order + 1, hi - lo + 1, 1).setValues(column.slice(lo, hi + 1).map((v) => [v]))
    // 直したときの順番を覚える（あとで順番を変えたら、この並びは使わない：manualOrderOk_）
    PropertiesService.getScriptProperties().setProperty('orderMode:' + Number(year) + ':' + found.id, found.checkById ? 'id' : 'kana')
    appendMemberHistory_(user, '点検表の学生の並びを' + (studentIds ? '直す' : (found.checkById ? '学籍番号順' : '五十音順') + 'に戻す') + (fixed.length ? '・' + fixed.length + '人の所属を直す' : '') + '（' + Number(year) + '年度・' + found.name + ' コース）')
    return found
  })
  syncNow_(year, course.id)
  return studentList_(year, course)
}

/**
 * 名簿 → 点検表（10分ごとの仕掛け。setupCheckSheets が作る）。終わった年度の点検表は、もう直さない。
 * ほかの写しが動いているあいだは、何もしない（次の10分で写す）
 */
function syncCheckSheets() {
  const lock = LockService.getDocumentLock()
  if (!lock.tryLock(1000)) return
  try {
    // 名簿のシートがまだない（だれも登録していない）ときも、点検表の見た目と守りは整える（学生のいる点検表は、syncCheckSheet_ が消さずに止まる）
    const roster = readRoster_() || []
    checkSheetEntries_().forEach((entry) => {
      const found = yearConfig_(entry.year)
      if (!found || !found.config || found.status === STATUS_ENDED) return
      const course = courseOf_(found.config, entry.courseId)
      if (!course) return
      try {
        syncCheckSheet_(entry, course, roster)
      } catch (err) {
        console.error('点検表（' + entry.year + '年度・' + course.name + '）を直せませんでした：' + String(err && err.message ? err.message : err))
      }
    })
  } finally {
    lock.releaseLock()
  }
}

/** 1つのコースの点検表を、今すぐ名簿から写す（点検表を開く・並びを直したとき。写せなくても、10分ごとの仕掛けがまた写す） */
function syncNow_(year, courseId) {
  try {
    const lock = LockService.getDocumentLock()
    lock.waitLock(30000)
    try {
      const entry = checkSheetEntries_().find((e) => e.year === Number(year) && e.courseId === courseId)
      const found = yearConfig_(year)
      const course = found && courseOf_(found.config, courseId)
      if (entry && course) syncCheckSheet_(entry, course, readRoster_() || [])
    } finally {
      lock.releaseLock()
    }
  } catch (err) {
    console.error('点検表を直せませんでした：' + String(err && err.message ? err.message : err))
  }
}

/** 段の中の列（見出しのある列）。id は「見出しの名前#同じ名前の何番目か」（行が動くときに、先生の書いた中身を同じ列に戻すため） */
function blockColumns_(header, block) {
  const seen = {}
  const out = []
  for (let c = block.start; c <= block.end; c++) {
    const name = headName_(header[c])
    if (!name) continue
    seen[name] = (seen[name] || 0) + 1
    out.push({ col: c, name: name, kind: columnKind_(name), id: name + '#' + seen[name] })
  }
  return out
}

/** 2つのセルの値が同じか（日付は時刻で、ほかは字で比べる） */
function sameCell_(a, b) {
  const norm = (v) => (v === undefined || v === null ? '' : v instanceof Date ? 'D' + v.getTime() : String(v))
  return norm(a) === norm(b)
}

/**
 * 1つのコースの点検表を、名簿から写す：学生の並び（ふりがな・先生の並び）・1段／2段（25人まで1段）・氏名・最新 PDF・知らせ。
 * 先生が書いた列（回の列・許可・教務提出・許可の記録）は、学籍番号（見えない列）で学生と一緒に動かす。
 * 変わったセルだけを書く（先生が同じ時に書いているセルを、なるべく上書きしない）。見た目は、並べ方が変わったときだけ整える
 */
function syncCheckSheet_(entry, course, roster) {
  const book = SpreadsheetApp.openById(entry.id)
  const sheet = book.getSheetByName(CHECK_TAB) || book.getSheets()[0]
  const title = checkSheetTitle_(entry.year, course)
  if (book.getName() !== title) book.rename(title)
  const students = orderStudents_(knownGroups_(courseStudents_(roster, entry.year, course.id), course), course, manualOrderOk_(entry.year, course))
  const layout = blockLayout_(students.length, course.checkOneColumn === true)
  // 所属の列（所属を登録したコースだけ。番号のすぐ右。依頼者の選択 2026-11-09 mockups/v118・v119）
  const wantGroup = courseGroups_(course).length > 0
  const surnames = advisorSurnames_(course.advisors)

  let values = sheet.getDataRange().getValues()
  // 見出しの行（「番号」のある行。上に案内の1行がある。行の番号は決め打ちしない）
  let h = headerRowOf_(values)
  if (h < 0) {
    // 見出しがない：空の点検表なら案内と見出しを書く（中身があるのに「番号」の見出しがないときは、壊さないよう何もしない）
    if (values.some((r) => r.some((v) => v !== '' && v !== null))) throw new Error('見出し「番号」が見つかりません')
    writeSheetHead_(sheet)
    values = sheet.getDataRange().getValues()
    h = headerRowOf_(values)
  }
  let blocks = checkBlocks_(values[h])
  if (blocks.some((b) => b.cols.key < 0)) throw new Error('見えない列「学籍番号」が見つかりません')

  // 先生が書いた中身（学籍番号ごと）と、学生の行のある最後の行。
  // 並びが崩れた行（先生が表の一部だけを並べ替えたなど）：見える氏名が、名簿の「ほかの学生」の氏名（outOfStep_）。中身がだれのものか分からない：
  // ほかの学生には移さず、その学籍番号の学生（untrusted）は、先生の列を書かずに今の中身のまま残し、「並びが崩れています」を出す（依頼者の選択 2026-11-04）。
  // 氏名がだれのものでもない（名簿の氏名を直した直後・書き方の違いなど）だけなら、崩れたとはみなさず、氏名を書き直す
  const names = rosterNames_(students)
  const kept = {}
  const untrusted = {}
  let lastRow = 0
  blocks.forEach((b) => {
    const columns = blockColumns_(values[h], b).filter((x) => x.kind === 'round' || TEACHER_COLUMNS.indexOf(x.kind) >= 0)
    for (let r = h + 1; r < values.length; r++) {
      const key = String(values[r][b.cols.key] === undefined ? '' : values[r][b.cols.key]).trim()
      if (!key) continue
      lastRow = Math.max(lastRow, r - h)
      const shown = b.cols.name >= 0 ? values[r][b.cols.name] : ''
      if (outOfStep_(names, key, shown)) {
        console.warn('点検表（' + entry.year + '年度・' + course.name + '）の ' + (r + 1) + ' 行目は並びが崩れています（見える氏名が、名簿のほかの学生の氏名）：' + key)
        untrusted[key] = true
        continue
      }
      // rounds：その段の回の列の並び（ほかの段に移ったときに、回の列を合わせるため：alignRounds_）
      const cells = { rounds: [] }
      columns.forEach((x) => {
        cells[x.id] = values[r][x.col]
        if (x.kind === 'round') cells.rounds.push(x.id)
      })
      // 前に「並びが崩れています」を出した行は、先生が確かめるまで、そのまま（学生と一緒に動かす）
      cells.broken = b.cols.note >= 0 && String(values[r][b.cols.note]).trim() === BROKEN_NOTE
      kept[key] = cells
    }
  })
  Object.keys(untrusted).forEach((key) => delete kept[key])
  // 名簿が空なのに点検表に学生がいる：名簿のシートが読めなかったなど。消さない
  if (!students.length && lastRow > 0) throw new Error('名簿にこのコースの学生がいません（点検表は、そのままにしました）')

  // 所属の列を足す・消す（所属を登録した・全部消した）。右の段から（左の段の列の場所が変わらないように）
  let groupFixed = false
  blocks
    .slice()
    .reverse()
    .forEach((b) => {
      if (wantGroup && b.cols.group < 0 && b.cols.no >= 0) {
        sheet.insertColumnAfter(b.cols.no + 1)
        sheet.getRange(h + 1, b.cols.no + 2).setValue(CHECK_HEAD_TEXT.group)
        groupFixed = true
      } else if (!wantGroup && b.cols.group >= 0) {
        sheet.deleteColumn(b.cols.group + 1)
        groupFixed = true
      }
    })
  if (groupFixed) {
    values = sheet.getDataRange().getValues()
    blocks = checkBlocks_(values[h])
  }

  // 1段 ↔ 2段 の組み直し（2段目は、1段目の見出しを写して、1段目の右に、すき間の列を1つあけて作る）
  const fresh = []
  const first = blocks[0]
  if (layout.blocks === 2 && blocks.length < 2) {
    const head = values[h].slice(first.start, first.end + 1)
    sheet.insertColumnsAfter(first.end + 1, head.length + 1)
    sheet.getRange(h + 1, first.end + 3, 1, head.length).setValues([head.map(cell_)])
    fresh.push(1)
  } else if (layout.blocks === 1 && blocks.length >= 2) {
    sheet.deleteColumns(first.end + 2, blocks[blocks.length - 1].end - first.end)
  }
  if (fresh.length || (layout.blocks === 1 && blocks.length >= 2)) {
    values = sheet.getDataRange().getValues()
    blocks = checkBlocks_(values[h])
  }
  const formulas = sheet.getDataRange().getFormulas()
  const header = values[h]
  const rows = Math.max(layout.perBlock, lastRow)

  // 回の列の対応（学生の前の段 → 今の段。段ごとに列が違ってもよい。同じ並びの組は1回だけ数える）
  const aligned = {}
  const alignOf = (from, to) => {
    const key = from.join('\n') + '\n>\n' + to.join('\n')
    return aligned[key] || (aligned[key] = alignRounds_(from, to))
  }
  blocks.slice(0, layout.blocks).forEach((b, bi) => {
    const columns = blockColumns_(header, b)
    const roundIds = columns.filter((x) => x.kind === 'round').map((x) => x.id)
    columns.forEach((x) => {
      const column = []
      for (let r = 0; r < rows; r++) {
        const index = bi * layout.perBlock + r
        const s = r < layout.perBlock ? students[index] : null
        const row = values[h + 1 + r] || []
        const mine = s ? kept[s.id] || null : null
        const v = s ? cellValue_(x, s, index, mine, !!untrusted[s.id], mine ? alignOf(mine.rounds, roundIds) : null) : ''
        // 並びが崩れた学生の、先生の列：その場所の今の中身のまま（だれのものか分からない中身を、ほかの学生に移さない）
        column.push(v === LEAVE ? (row[x.col] === undefined ? '' : row[x.col]) : v)
      }
      let lo = -1
      let hi = -1
      column.forEach((v, r) => {
        const row = values[h + 1 + r] || []
        const formula = formulas[h + 1 + r] && formulas[h + 1 + r][x.col]
        const old = x.kind === 'pdf' ? formula || row[x.col] : row[x.col]
        if (sameCell_(old, v)) return
        if (lo < 0) lo = r
        hi = r
      })
      if (lo >= 0) sheet.getRange(h + 2 + lo, x.col + 1, hi - lo + 1, 1).setValues(column.slice(lo, hi + 1).map((v) => [writeValue_(x.kind, v)]))
    })
  })

  // 見た目と守り（並べ方・人数・見出し・先生が変わったときだけ）
  const props = PropertiesService.getScriptProperties()
  // v：見た目の決まりを変えたら上げる（今ある点検表も、次に写すときに1回だけ整え直す。3：案内の行を黄色の帯に 2026-11-07。4：帯を文字の終わりの先まで。5：見出しを役目ごとの色に・氏名を折り返す。6：案内を2行に。7：1人目の先生の色を薄赤に）
  // 所属の境（段ごと、所属が前の行と変わる行。0 から）。境には太い線を引く
  const edges = blocks.slice(0, layout.blocks).map((b, bi) => {
    const out = []
    if (!wantGroup) return out
    for (let r = 1; r < layout.perBlock; r++) {
      const i = bi * layout.perBlock + r
      if (i < students.length && students[i].group !== students[i - 1].group) out.push(r)
    }
    return out
  })
  // 所属の色（段ごと、行ごとの所属の番号。選んでいない学生・学生のいない行は -1）
  const groupList = courseGroups_(course)
  const tones = blocks.slice(0, layout.blocks).map((b, bi) => {
    const out = []
    for (let r = 0; r < layout.perBlock; r++) {
      const st = students[bi * layout.perBlock + r]
      out.push(wantGroup && st ? groupList.indexOf(st.group) : -1)
    }
    return out
  })
  const signature = JSON.stringify({ v: 8, top: h, layout: layout, heads: blocks.slice(0, layout.blocks).map((b) => blockColumns_(header, b).map((x) => x.name)), surnames: surnames, edges: edges, tones: tones })
  if (props.getProperty('checkLayout:' + entry.id) !== signature) {
    formatCheckSheet_(sheet, h, header, blocks, layout, surnames, rows, fresh, edges, tones)
    props.setProperty('checkLayout:' + entry.id, signature)
  }
}

/** 見出しの行（「番号」のある最初の行。0 から。上から10行の中になければ -1） */
function headerRowOf_(values) {
  for (let r = 0; r < Math.min(values.length, 10); r++) if ((values[r] || []).some((v) => headName_(v) === CHECK_COLUMNS.no)) return r
  return -1
}

/** 新しい点検表の上の2行：案内の1行（黄色の帯）と、1段目の見出し */
function writeSheetHead_(sheet) {
  const head = checkTemplate_()
  sheet.getRange(1, 1).setValue(CHECK_TOP_NOTE)
  sheet.getRange(2, 1, 1, head.length).setValues([head])
}

/**
 * ツールが書く列・見出しを守る（書けるのは、プログラムを動かしている人＝デプロイした人だけ。先生がシートで行を動かしたり、
 * 一部の列だけを並べ替えたりして、見えない学籍番号と氏名・✓ がずれないように：依頼者の選択 2026-11-04）
 */
function protectRange_(range) {
  const me = Session.getEffectiveUser()
  const p = range.protect().setDescription(PROTECT_NOTE)
  p.addEditor(me)
  p.removeEditors(p.getEditors().filter((u) => u.getEmail() !== me.getEmail()))
  if (p.canDomainEdit()) p.setDomainEdit(false)
  return p
}

/** 「今の中身のまま」の印（cellValue_ が返す） */
const LEAVE = {}

/**
 * 2つの段の回の列の対応（今の段の列 → 前の段の列）。同じ名前の列はそのまま組にし、名前が違う列は、
 * 同じ名前の列のあいだで、並んだ順に組にする（先生が片方の段だけ「4回目」を「最終確認」に変えた → 組にする。足しただけの列は組にしない）
 */
function alignRounds_(from, to) {
  const n = from.length
  const m = to.length
  const same = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) same[i][j] = from[i] === to[j] ? same[i + 1][j + 1] + 1 : Math.max(same[i + 1][j], same[i][j + 1])
  const map = {}
  let gapFrom = []
  let gapTo = []
  const pair = () => {
    gapTo.forEach((t, k) => {
      if (k < gapFrom.length) map[t] = gapFrom[k]
    })
    gapFrom = []
    gapTo = []
  }
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && from[i] === to[j]) {
      pair()
      map[to[j]] = from[i]
      i++
      j++
    } else if (j >= m || (i < n && same[i + 1][j] >= same[i][j + 1])) gapFrom.push(from[i++])
    else gapTo.push(to[j++])
  }
  pair()
  return map
}

/**
 * 点検表の1つのセルの中身（s：その行の学生、index：通し番号（0 から）、kept：先生が書いた中身、
 * untrusted：並びが崩れた学生（先生の列は LEAVE：その場所の今の中身のまま。知らせは「並びが崩れています」）、
 * align：回の列の対応（alignRounds_。今の段の列 → 先生が書いた段の列）
 */
function cellValue_(column, s, index, kept, untrusted, align) {
  const old = (id) => (kept && kept[id] !== undefined ? kept[id] : undefined)
  switch (column.kind) {
    case 'no':
      return index + 1
    case 'name':
      return sheetName_(s)
    case 'group':
      return s.group || ''
    case 'pdf':
      return pdfFormula_(s)
    case 'note':
      return untrusted || (kept && kept.broken) ? BROKEN_NOTE : noteOf_(s, old(CHECK_COLUMNS.finalOk + '#1'), old(CHECK_COLUMNS.finalRec + '#1'))
    case 'key':
      return s.id
    case '':
      return LEAVE
  }
  if (untrusted) return LEAVE
  switch (column.kind) {
    case 'abstractOk':
    case 'finalOk':
    case 'kyomu': {
      const v = old(column.id)
      return v === undefined || v === '' ? false : v
    }
    case 'round': {
      // 段ごとに回の列が違ってもよい（先生が片方の段にだけ足した・名前を変えた）。対応する列の中身。なければ空
      const from = align ? align[column.id] : undefined
      const v = from ? old(from) : undefined
      return v === undefined ? '' : v
    }
    default: {
      const v = old(column.id)
      return v === undefined ? '' : v
    }
  }
}

/** シートに書く形（学生の氏名・学籍番号は ' を付けて文字に。最新 PDF は式。ほかの字は、先頭が = + - @ なら文字に） */
function writeValue_(kind, value) {
  if (kind === 'pdf') return value
  if (kind === 'name' || kind === 'key' || kind === 'group') return value === '' ? '' : "'" + value
  return cell_(value)
}

/**
 * 点検表の見た目（v106・v107 案A）：見出しの行は固定・太字。番号・最新 PDF・知らせは灰色、許可の2列はうすい黄色で ✓ の箱、教務提出も ✓ の箱、
 * 回の列は先生の名字のプルダウン（「山本 予定」「山本 済み」）。済みは先生ごとの淡い色、予定は灰色の字（条件付き書式）。
 * 学籍番号と許可の記録の列は隠す。学生のいない行の箱・色は外す。
 * いちばん上の案内の行と見出しの行は固定する。ツールが書く列（見出しから下まで。すき間の列も）・✓ の列の見出し・案内の行のはじめの3列は、
 * デプロイした人だけが書けるように守る（作り直す）。白い回の列は、見出しも中身も守らない（先生がコースで自由に足す・消す・名前を変える）
 */
function formatCheckSheet_(sheet, h, header, blocks, layout, surnames, rows, fresh, edges, tones) {
  sheet.setFrozenRows(h + 1)
  sheet.setRowHeight(h + 1, 36)
  const checkbox = SpreadsheetApp.newDataValidation().requireCheckbox().build()
  const choices = []
  surnames.forEach((t) => choices.push(t + ' 予定', t + ' 済み'))
  const dropdown = choices.length ? SpreadsheetApp.newDataValidation().requireValueInList(choices, true).setAllowInvalid(true).build() : null
  const roundRanges = []
  const noteRanges = []
  // 守る列（見出しから下まで）と、見出しだけ守る列（✓ の列。先生が ✓ を入れる。回の列の見出しは守らない：先生が足す・名前を変える）
  const lockedColumns = []
  const lockedHeads = []
  const used = blocks.slice(0, layout.blocks)
  used.forEach((b, bi) => {
    const filled = Math.max(0, Math.min(layout.perBlock, layout.count - bi * layout.perBlock))
    blockColumns_(header, b).forEach((x) => {
      const kind = x.kind
      const tool = kind === 'no' || kind === 'group' || kind === 'name' || kind === 'pdf' || kind === 'note'
      const perm = kind === 'abstractOk' || kind === 'finalOk'
      const role = kind === 'round' ? 'round' : perm ? 'perm' : kind === 'kyomu' ? 'kyomu' : 'tool'
      sheet
        .getRange(h + 1, x.col + 1)
        .setFontWeight('bold')
        .setWrap(true)
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setBackground(CHECK_COLORS[role + 'Head'])
        .setFontColor(CHECK_COLORS[role + 'Ink'])
      sheet.setColumnWidth(x.col + 1, CHECK_WIDTHS[kind] || CHECK_WIDTHS.round)
      if (HIDDEN_COLUMNS.indexOf(kind) >= 0) sheet.hideColumns(x.col + 1)
      else if (fresh.indexOf(bi) >= 0) sheet.showColumns(x.col + 1)
      if (TOOL_COLUMNS.indexOf(kind) >= 0) lockedColumns.push(x.col)
      else if (kind !== 'round') lockedHeads.push(x.col)
      if (filled > 0) {
        const cells = sheet.getRange(h + 2, x.col + 1, filled, 1)
        cells.setBackground(tool ? CHECK_COLORS.toolCell : perm ? CHECK_COLORS.permCell : null)
        cells.setDataValidation(perm || kind === 'kyomu' ? checkbox : kind === 'round' ? dropdown : null)
        cells.setHorizontalAlignment(kind === 'name' || kind === 'note' ? 'left' : kind === 'no' ? 'right' : 'center')
        // 長い氏名（留学生など）は折り返す：その学生の行だけ2行の高さになる（依頼者の選択 2026-11-07 案1。前は列の幅で切れた）。行の中の字は上下の真ん中に
        cells.setVerticalAlignment('middle').setWrap(kind === 'name' || kind === 'group')
        cells.setFontWeight(kind === 'name' ? 'bold' : null)
        // 所属の列：所属ごとの淡い地と濃い字（mockups/v121 案A）。選んでいない学生は、ほかのツールの列と同じ灰色
        if (kind === 'group') {
          const each = ((tones && tones[bi]) || []).slice(0, filled)
          while (each.length < filled) each.push(-1)
          const tone = (g) => (g >= 0 ? GROUP_TONES[g % GROUP_TONES.length] : null)
          cells.setBackgrounds(each.map((g) => [tone(g) ? tone(g).bg : CHECK_COLORS.toolCell]))
          cells.setFontColors(each.map((g) => [tone(g) ? tone(g).ink : CHECK_COLORS.toolInk]))
          cells.setFontWeight('bold')
        }
        if (kind === 'key') cells.setNumberFormat('@')
        if (kind === 'round') roundRanges.push(cells)
        if (kind === 'note') noteRanges.push(cells)
      }
      if (rows > filled) sheet.getRange(h + 2 + filled, x.col + 1, rows - filled, 1).setBackground(null).setDataValidation(null).setFontWeight(null)
    })
    // 所属の境の太い線（引き直す：前の線を消してから。所属のないコースは消すだけ。mockups/v118）
    if (rows > 0) sheet.getRange(h + 2, b.start + 1, rows, b.end - b.start + 1).setBorder(false, false, false, false, false, false)
    ;((edges && edges[bi]) || []).forEach((r) => {
      sheet.getRange(h + 2 + r, b.start + 1, 1, b.end - b.start + 1).setBorder(true, null, null, null, null, null, '#6b7280', SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
    })
    // 2段のときの、段のあいだのすき間の列（見出しのない列。ここも守る。先生が見出しを書いた列は、1段目の回の列になる）
    if (bi === 0 && layout.blocks === 2) {
      for (let c = b.end + 1; c < used[1].start; c++) {
        sheet.setColumnWidth(c + 1, CHECK_WIDTHS.gap)
        // 隠した列（許可の記録）のすぐ右に足した列なので、見えるようにしておく
        if (fresh.length) sheet.showColumns(c + 1)
        lockedColumns.push(c)
      }
    }
  })
  // 案内の行（見出しの上）：薄い黄色の帯にし、1段目の左から濃い茶色の太字で（依頼者の選択 2026-11-07 案B）。
  // 帯は表の幅（使っている最後の段の右の列まで）。文字が表より長いときは、文字の終わりの先の列まで伸ばす（表の幅だけでは、文字が帯からはみ出した）。
  // 列の幅で測るので、列を整えたあとに塗る
  if (h > 0) {
    const shown = blocks.slice(0, Math.max(1, layout.blocks))
    let width = Math.max(header.length, shown[shown.length - 1].end + 1)
    const note = sheet.getRange(1, 1)
    if (OLD_TOP_NOTES.indexOf(String(note.getValue())) >= 0) note.setValue(CHECK_TOP_NOTE)
    const need = noteWidthPx_(note.getValue(), TOP_NOTE_SIZE)
    const seen = (c) => (sheet.isColumnHiddenByUser(c) ? 0 : sheet.getColumnWidth(c))
    let px = 0
    for (let c = 1; c <= width; c++) px += seen(c)
    while (px < need && width < sheet.getMaxColumns()) px += seen(++width)
    sheet.getRange(1, 1, 1, width).setBackground(TOP_NOTE_FILL)
    note.setFontSize(TOP_NOTE_SIZE).setFontColor(TOP_NOTE_INK).setFontWeight('bold').setHorizontalAlignment('left').setVerticalAlignment('middle').setWrap(false)
    // 行の高さは、案内の行の数に合わせる（1行 28・2行 48）
    sheet.setRowHeight(1, 8 + 20 * String(note.getValue()).split('\n').length)
  }
  // 守り：前にツールが付けた守りを外して、付け直す（列・段が変わったときに、今の列に合わせる）。
  // 行ごとは守らない（白い回の列のところに、先生が列を足せるように：依頼者の選択 2026-11-04）
  sheet
    .getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .filter((p) => p.getDescription() === PROTECT_NOTE)
    .forEach((p) => p.remove())
  const below = Math.max(1, sheet.getMaxRows() - h)
  // 案内の行は、1段目のはじめの3列（番号・氏名・最新 PDF の上）だけ
  if (h > 0) protectRange_(sheet.getRange(1, used[0].start + 1, h, Math.min(3, used[0].end - used[0].start + 1)))
  lockedColumns.forEach((c) => protectRange_(sheet.getRange(h + 1, c + 1, below, 1)))
  lockedHeads.forEach((c) => protectRange_(sheet.getRange(h + 1, c + 1)))
  // 条件付き書式（作り直す。先生ごとの「済み」の色・「予定」の灰色の字・知らせの赤と灰色）
  const rules = []
  const rule = () => SpreadsheetApp.newConditionalFormatRule()
  if (roundRanges.length) {
    surnames.forEach((t, i) => {
      const tone = TEACHER_TONES[i % TEACHER_TONES.length]
      rules.push(rule().whenTextEqualTo(t + ' 済み').setBackground(tone.bg).setFontColor(tone.ink).setBold(true).setRanges(roundRanges).build())
    })
    rules.push(rule().whenTextContains('予定').setFontColor(PLAN_INK).setRanges(roundRanges).build())
  }
  if (noteRanges.length) {
    rules.push(rule().whenTextStartsWith('書き換え').setFontColor(CHECK_COLORS.warnInk).setBackground(CHECK_COLORS.warnBg).setBold(true).setRanges(noteRanges).build())
    rules.push(rule().whenTextEqualTo(BROKEN_NOTE).setFontColor(CHECK_COLORS.warnInk).setBackground(CHECK_COLORS.warnBg).setBold(true).setRanges(noteRanges).build())
    rules.push(rule().whenTextEqualTo('PDF まだ').setFontColor(CHECK_COLORS.dimInk).setRanges(noteRanges).build())
  }
  sheet.setConditionalFormatRules(rules)
}

/**
 * 点検表の編集の仕掛け（点検表を作ったときに付ける。installable onEdit）：「抄録許可」「最終提出可」の ✓ を入れたら、
 * 見えない記録の列に「日時 / 先生の名字」を残す（学生のツールに「許可が出ました（12/15 〇〇先生）」と出る）。✓ を外したら消す。
 * 見える氏名が名簿のほかの学生の氏名の行（並びが崩れた行：outOfStep_）には残さず、「知らせ」に「並びが崩れています」と出す。
 * 「並びが崩れています」の行でも、並びが戻っていれば、✓ を入れ直したときに知らせを消して残す（先生が行を確かめた印）
 */
function onCheckSheetEdit(e) {
  if (!e || !e.range) return
  const range = e.range
  const sheet = range.getSheet()
  const lastCol = sheet.getLastColumn()
  if (lastCol < 1) return
  const head = sheet.getRange(1, 1, Math.min(Math.max(sheet.getLastRow(), 1), 10), lastCol).getValues()
  const h = headerRowOf_(head)
  if (h < 0) return
  const c0 = range.getColumn() - 1
  const c1 = c0 + range.getNumColumns() - 1
  const pairs = []
  checkBlocks_(head[h]).forEach((b) =>
    [
      ['abstractOk', 'abstractRec'],
      ['finalOk', 'finalRec'],
    ].forEach((p) => {
      const c = b.cols[p[0]]
      const rc = b.cols[p[1]]
      if (c >= c0 && c <= c1 && rc >= 0) pairs.push({ block: b, c: c, rc: rc })
    }),
  )
  const top = Math.max(range.getRow(), h + 2)
  const bottom = range.getRow() + range.getNumRows() - 1
  if (!pairs.length || bottom < top) return
  const single = range.getNumRows() === 1 && range.getNumColumns() === 1
  const rows = sheet.getRange(top, 1, bottom - top + 1, lastCol).getValues()
  let context = null
  const ctx = () => context || (context = editContext_(e, sheet))
  const text = (v) => String(v === undefined || v === null ? '' : v).trim()
  pairs.forEach((p) => {
    const cols = p.block.cols
    const cells = sheet.getRange(top, p.rc + 1, rows.length, 1)
    let changed = false
    const next = rows.map((row, i) => {
      const old = text(row[p.rc])
      if (row[p.c] !== true) {
        if (old) changed = true
        return ['']
      }
      const key = cols.key >= 0 ? text(row[cols.key]) : ''
      const names = ctx().names
      const broken = cols.note >= 0 && text(row[cols.note]) === BROKEN_NOTE
      // 見える氏名が名簿のほかの学生の氏名なら、並びが崩れている（名簿が読めないときは確かめない。学生のツールへの答えは、配信の窓口がもう一度確かめる）
      if (names && key && outOfStep_(names, key, cols.name >= 0 ? row[cols.name] : '')) {
        if (cols.note >= 0 && !broken) sheet.getRange(top + i, cols.note + 1).setValue(BROKEN_NOTE)
        return [old]
      }
      if (broken) sheet.getRange(top + i, cols.note + 1).setValue('')
      // まとめて貼ったときは、前からの記録を残す（1つの ✓ を入れたときと、並びが崩れた行を確かめたときは、今の日時）
      if (old && !single && !broken) return [old]
      changed = true
      return [new Date().toISOString() + ' / ' + ctx().who]
    })
    if (changed) cells.setValues(next)
  })
}

/**
 * 編集した先生と、この点検表の学生：who は ✓ を入れた先生の名字（アドレス → 先生の登録のメモ → この点検表のコースの指導教員の名字。
 * わからなければアドレスの @ より前）。names はこの点検表の学生の氏名（rosterNames_。名簿から。読めなければ null）
 */
function editContext_(e, sheet) {
  let email = ''
  try {
    email = e.user && typeof e.user.getEmail === 'function' ? e.user.getEmail() : String(e.user || '')
    if (!email) email = Session.getActiveUser().getEmail()
  } catch (err) {
    email = ''
  }
  let memo = ''
  let surnames = []
  let names = null
  try {
    const book = adminBook_()
    const admins = book.getSheetByName(SHEET_ADMINS)
    const member = admins ? parseMembers_(admins.getDataRange().getValues().slice(1)).find((m) => m.email.toLowerCase() === String(email).toLowerCase()) : null
    memo = member ? member.memo : ''
    const id = (e.source && typeof e.source.getId === 'function' ? e.source : sheet.getParent()).getId()
    const entry = checkSheetEntries_(book).find((x) => x.id === id)
    const found = entry ? yearConfig_(entry.year, book) : null
    const course = found ? courseOf_(found.config, entry.courseId) : null
    surnames = course ? advisorSurnames_(course.advisors) : []
    const roster = entry ? readRoster_(book) : null
    if (roster) names = rosterNames_(courseStudents_(roster, entry.year, entry.courseId))
  } catch (err) {
    console.error('✓ を入れた先生・点検表の学生を調べられませんでした：' + String(err && err.message ? err.message : err))
  }
  return { who: editorSurname_(email, memo, surnames), names: names }
}

/**
 * 点検表の編集の仕掛けを、今の点検表に合わせる（終わった年度の点検表の仕掛けは外す。1つの点検表に1つ。仕掛けの数には上限があるため）
 */
function refreshEditTriggers_() {
  const ended = {}
  readYears_().forEach((y) => {
    if (y.status === STATUS_ENDED) ended[y.year] = true
  })
  const wanted = checkSheetEntries_()
    .filter((e) => !ended[e.year])
    .map((e) => e.id)
  const have = {}
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() !== 'onCheckSheetEdit') return
    const id = t.getTriggerSourceId()
    if (wanted.indexOf(id) < 0 || have[id]) ScriptApp.deleteTrigger(t)
    else have[id] = true
  })
  wanted.forEach((id) => {
    if (have[id]) return
    try {
      ScriptApp.newTrigger('onCheckSheetEdit').forSpreadsheet(id).onEdit().create()
      have[id] = true
    } catch (err) {
      console.error('点検表（' + id + '）に編集の仕掛けを付けられませんでした：' + String(err && err.message ? err.message : err))
    }
  })
}

/**
 * 点検表の準備（管理ページを配り直したあと、エディタで1回だけ実行する。依頼者の選択 2026-11-04）：
 * ドライブ・仕掛けなどの権限を承認し、10分ごとに名簿を点検表に写す仕掛け（syncCheckSheets）と、点検表ごとの編集の仕掛け（onCheckSheetEdit）を作り直す。
 * 届いた声のメールの仕掛け（setupFeedbackMail）も、いっしょに作り直す。「点検表の準備ができました」と出れば、準備できている
 */
function setupCheckSheets() {
  const me = Session.getActiveUser().getEmail()
  const owner = Session.getEffectiveUser().getEmail()
  if (!me || me.toLowerCase() !== String(owner || '').toLowerCase()) {
    throw new Error('setupCheckSheets は、管理ページをデプロイした人が、Apps Script のエディタから実行してください（ログイン中：' + (me || '不明') + '）')
  }
  rememberAdminBook_()
  const rootId = pdfRootId_()
  Logger.log(rootId ? '点検表を置くフォルダ（PDF の控え）：' + DriveApp.getFolderById(rootId).getName() : 'PDF の控えのフォルダが未設定のため、点検表は作れません（gas/pdf-folder.local.json に書いて配り直すか、スクリプト プロパティ PDF_FOLDER_ID に入れる）')
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'syncCheckSheets')
    .forEach((t) => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger('syncCheckSheets').timeBased().everyMinutes(CHECK_SYNC_MINUTES).create()
  refreshEditTriggers_()
  setupFeedbackMail()
  syncCheckSheets()
  Logger.log('点検表の準備ができました（' + CHECK_SYNC_MINUTES + ' 分ごとに、学生の名簿を点検表に写します）')
}
