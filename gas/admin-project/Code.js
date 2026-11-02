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
// text：本文に入る文の段落の呼び名（行の種類ではない。mockups/v70）
const BLOCK_LABELS = { chapter: '大見出し', subheading: '小見出し', paragraph: '説明', figure: '図の枠', materialTable: '素材表', pageBreak: '改ページ', table: '表', text: '本文に入る文' }
/** 文字数・数の上限（学生のツールの src/config/validate.ts の LIMITS と同じ値にする。tableColumns・tableRows：ひな形の表の列の数と、見出しの下の行の数） */
const LIMITS = { blocks: 100, name: 100, hint: 300, text: 500, abstractExample: 500, notice: 1000, words: 300, word: 50, wordNote: 200, tableColumns: 6, tableRows: 9 }

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
  return { user: user, isAdmin: role === ROLE_ADMIN, role: role === ROLE_ADMIN ? 'admin' : role === ROLE_TEACHER ? 'teacher' : null, years: role ? readYears_() : [], links: role ? teacherLinks_() : {} }
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
 * 先生の画面の「保存」：ひな形・お知らせ・書き間違えやすい語を、まとめて1回で保存する（先生も使える）。
 * 別々に送ると、途中で失敗したときに一部だけが保存されるため。edits は { templates?, notices?, words? }
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
 * 下書きのひな形を確かめ、決まった項目だけの形にして返す。崩れていたら（種類が決まったもの以外、
 * 名前や説明・本文に入る文が文字でない・長すぎる、名前が空、先頭が大見出しでない）エラーにする。
 * 学生のツールが崩れたひな形で止まらないように（学生のツールの src/config/validate.ts の templateProblems と同じ決まり）
 */
function cleanTemplate_(template, courseName) {
  const label = '「' + courseName + '」のひな形'
  if (!Array.isArray(template)) throw new Error(label + 'の形が正しくありません')
  if (template.length > LIMITS.blocks) throw new Error(label + 'の部品が多すぎます（' + LIMITS.blocks + '個まで）')
  const cleaned = template.map((block, i) => {
    if (!block || typeof block !== 'object' || BLOCK_TYPES.indexOf(block.type) < 0) throw new Error(label + 'の' + (i + 1) + '行目の形が正しくありません')
    // 改ページは、種類だけ
    if (block.type === 'pageBreak') return { type: 'pageBreak' }
    const key = block.type === 'chapter' || block.type === 'subheading' ? 'title' : block.type === 'paragraph' ? 'hint' : 'caption'
    const row = label + 'の' + rowName_(i, block.type, block[key])
    const text = checkText_(block[key], key === 'hint' ? LIMITS.hint : LIMITS.name, row)
    // 段落の説明は空でもよい（大見出し・小見出し・図・表の名前は空にしない）
    if (key !== 'hint' && !text.trim()) throw new Error(row + 'の名前が空です')
    const out = { type: block.type }
    out[key] = text
    // 段落の本文に入る文（学生の本文にそのまま入る。空なら持たない。mockups/v70）
    if (block.type === 'paragraph' && block.text !== undefined) {
      const fixed = checkText_(block.text, LIMITS.text, label + 'の' + rowName_(i, 'text', block.text))
      if (fixed.trim()) {
        out.hint = ''
        out.text = fixed
      }
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
  })
  if (config.wordChecks !== undefined && config.wordChecks !== null) cleanWords_(config.wordChecks)
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
