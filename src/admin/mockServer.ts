import { BUILD_ID } from '../app/newVersion'
import { currentConfig, type Course, type YearConfig } from '../config'
import { DEV_TRIAL_SAMPLE } from '../trial/devSample'
import { FEEDBACK_NOTIFY, type AdminServer, type AdminState, type Assignment, type CheckField, type CheckStudent, type CheckView, type FeedbackItem, type HistoryRow, type Member, type PdfFolder, type StudentEntry, type YearRow } from './server'
import { effectiveGroups, roundCell, splitGroups, surnameOf } from './checkView'
import { applyNotices, applyPermissions, applySheetSettings, applySubtitles, applyTemplates, changedMessage, checkConfig, cleanWords, deletedMessage, folderIdFromLink, removedMemberMessage } from './serverRules'
import { byKana, comparerFor, movedFlags } from './studentOrder'

/**
 * 開発用の試験サーバー（ブラウザ内だけで動く）。本番の gas/admin-project/Code.js と同じ振る舞いをまねる
 * （保存の前の確かめとエラーの言葉は serverRules.ts で Code.js と同じにしている）。
 * 年度設定はこのブラウザの localStorage に保存する。
 * admin.html?as=teacher で開くと、先生（ひな形・お知らせ・書き間違えやすい語だけ編集できる）として振る舞う。
 */

const KEY = 'sotsugyo-admin-mock'
/** 試験用サーバーの「公開中の版の印」（なければ、この画面と同じ） */
const MOCK_VERSION_KEY = 'sotsugyo-admin-mock-version'
const ADMIN = 'admin@example.ac.jp'
const TEACHER = 'sensei@example.ac.jp'
const USER = new URLSearchParams(location.search).get('as') === 'teacher' ? TEACHER : ADMIN

interface Store {
  years: YearRow[]
  history: HistoryRow[]
  members?: Member[]
}

/**
 * はじめの登録。先生は、氏名と担当コースを登録してある（admin.html?as=teacher&profile=none で開くと、まだ登録していない先生：
 * はじめて開いたときに氏名を選ぶ窓を確かめる）
 */
const NO_PROFILE = new URLSearchParams(location.search).get('profile') === 'none'
const DEFAULT_MEMBERS: Member[] = [
  { email: ADMIN, memo: '試験用の管理者', role: '管理者', name: '', courseId: '' },
  { email: TEACHER, memo: '試験用の先生', role: '先生', name: NO_PROFILE ? '' : '梶田　貴子', courseId: NO_PROFILE ? '' : 'film-stage-costume' },
]

function load(): Store {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Store | null
    if (saved) return saved
  } catch {
    // 壊れていたら作り直す
  }
  // はじめての状態は、すぐ控えておく（読むたびに作り直すと更新日時が変わり、「ほかの人が保存した」と判定されてしまう）
  const initial: Store = { years: [{ year: currentConfig.fiscalYear, status: '公開中', config: currentConfig, updatedAt: new Date().toISOString(), updatedBy: USER }], history: [] }
  save(initial)
  return initial
}

/** 試験用の届いた声（本番はシート「届いた声」。学生のツールの「困ったこと・おかしいことを知らせる」から届く） */
const MOCK_FEEDBACK: FeedbackItem[] = [
  {
    id: '1105-002', receivedAt: '2026-11-05 14:20', kind: 'やり方が分からない', text: '抄録に本文の文を写したいのですが、コピーのやり方が分かりません。',
    email: 'wu00zz0124@bunka-wu.ac.jp', studentId: '00ZZ0124', name: '文化　次郎', course: '映画・舞台衣装デザイナー', version: 'mvx8c101', device: 'スマホの画面・iPhone・Safari（画面 390×844）', page: '抄録',
    notice: '', errors: '', screen: '', status: '受け付けた', reply: '', memo: '', changedAt: '', notifiedAt: '',
  },
  {
    id: '1105-001', receivedAt: '2026-11-05 10:02', kind: 'うまく動かない', text: '表の生地見本のマスに写真を入れたら、カーソルが下のマスに出て、どこを書いているのか分からなくなった。',
    email: 'wu00zz0123@bunka-wu.ac.jp', studentId: '00ZZ0123', name: '文化　花子', course: '映画・舞台衣装デザイナー', version: 'mvx8c101', device: 'パソコンの画面・Windows・Chrome（画面 1440×900）', page: '本文 2ページ',
    notice: '生地見本の写真は、左の道具の「画像を入れる」から入れます', errors: '', screen: 'https://drive.google.com/file/d/example/view', status: '確かめ中', reply: '', memo: '表の画像を入れたあと（mockups/v84）', changedAt: '2026-11-05 11:00', notifiedAt: '',
  },
]
const FEEDBACK_KEY = 'sotsugyo-admin-mock-feedback'
function loadFeedback(): FeedbackItem[] {
  try {
    const saved = JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? 'null') as FeedbackItem[] | null
    if (Array.isArray(saved)) return saved
  } catch {
    // 壊れていたら作り直す
  }
  return JSON.parse(JSON.stringify(MOCK_FEEDBACK)) as FeedbackItem[]
}

function save(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store))
}

/** 試験用の学生の名簿（どのコースも同じ12人。名前・学籍番号はすべて作り物：mockups/v103 と同じ）。ふりがな・氏名・学籍番号 */
const MOCK_STUDENTS: [string, string, string][] = [
  ['アオキ ミサキ', '青木　美咲', '00ZZ0107'],
  ['イシダ ハルカ', '石田　遥', '00ZZ0131'],
  ['ウエノ ソラ', '上野　空', '00ZZ0112'],
  ['エンドウ リコ', '遠藤　莉子', '00ZZ0145'],
  ['オオタ ユイ', '太田　結衣', '00ZZ0103'],
  ['カネコ ナナ', '金子　奈々', '00ZZ0126'],
  ['キムラ アオイ', '木村　葵', '00ZZ0119'],
  ['クボ メイ', '久保　芽依', '00ZZ0140'],
  ['コバヤシ ヒナ', '小林　陽菜', '00ZZ0108'],
  ['サイトウ ミオ', '斎藤　美緒', '00ZZ0134'],
  ['シミズ カエデ', '清水　楓', '00ZZ0122'],
  ['ブンカ ハナコ', '文化　花子', '00ZZ0123'],
]
/** 先生が直した点検表の並び（年度:コース → 学籍番号の並び）。本番は名簿の「並び」の列 */
const ORDER_KEY = 'sotsugyo-admin-mock-order'
function loadOrders(): Record<string, string[]> {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? 'null') as Record<string, string[]> | null
    if (saved && typeof saved === 'object') return saved
  } catch {
    // 壊れていたら、ふりがなの順から
  }
  return {}
}
/**
 * PDF の控えのもとのフォルダ（本番は管理用スプレッドシートのシート「設定」。mockups/v112 案A）。
 * 試験用は ID と名前を覚える。ID に noaccess を含むフォルダは「編集できない」、gone を含むフォルダは「開けない」ことにする（自動テスト用）
 */
const PDF_FOLDER_KEY = 'sotsugyo-admin-mock-pdffolder'
const DEFAULT_PDF_FOLDER = { id: 'mock-pdf-folder-0001', name: '卒業制作報告書　提出された PDF' }
function loadPdfFolder(): { id: string; name: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(PDF_FOLDER_KEY) ?? 'null') as { id: string; name: string } | null
    if (saved && typeof saved.id === 'string') return saved
  } catch {
    // 壊れていたら、はじめのフォルダ
  }
  return DEFAULT_PDF_FOLDER
}
const folderInfo = (f: { id: string; name: string }): PdfFolder => ({ id: f.id, name: f.name, url: `https://drive.google.com/drive/folders/${f.id}` })

/** 試験用の点検表の回の列（本番は点検表の青い見出しの列） */
const MOCK_ROUNDS = ['1回目', '2回目', '3回目', '4回目', '抄録']
/** 試験用の点検表の中身（年度:コース:学籍番号 → 回の欄と ✓）。本番は点検表のスプレッドシート */
const CELLS_KEY = 'sotsugyo-admin-mock-checkcells'
type MockCells = Record<string, { rounds?: Record<string, string>; abstractOk?: boolean; finalOk?: boolean; kyomu?: boolean }>
function loadCells(): MockCells {
  try {
    const saved = JSON.parse(localStorage.getItem(CELLS_KEY) ?? 'null') as MockCells | null
    if (saved && typeof saved === 'object') return saved
  } catch {
    // 壊れていたら、まだ何も書いていない
  }
  return {}
}
/** 試験用の担当の割り振り（年度:コース → 割り振り）。本番はスクリプト プロパティ assign: */
const ASSIGN_KEY = 'sotsugyo-admin-mock-assign'
function loadAssign(): Record<string, Assignment> {
  try {
    const saved = JSON.parse(localStorage.getItem(ASSIGN_KEY) ?? 'null') as Record<string, Assignment> | null
    if (saved && typeof saved === 'object') return saved
  } catch {
    // 壊れていたら、割り振りなし
  }
  return {}
}
/** 作った点検表（年度:コース → 場所）。本番は管理用スプレッドシートのシート「点検表」 */
const SHEETS_KEY = 'sotsugyo-admin-mock-checksheets'
function loadSheets(): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(SHEETS_KEY) ?? 'null') as Record<string, string> | null
    if (saved && typeof saved === 'object') return saved
  } catch {
    // 壊れていたら、まだ作っていない
  }
  return {}
}
/** 先生が並びを直したときの順番（年度:コース → 学籍番号順か。本番のスクリプト プロパティ orderMode:）。順番を変えたら、直した並びは使わない */
const ORDER_MODE_KEY = 'sotsugyo-admin-mock-order-mode'
/** 先生が直した学生の所属（年度:コース → 学籍番号 → 所属。本番は名簿の「所属」） */
const GROUP_FIX_KEY = 'sotsugyo-admin-mock-group-fix'
function loadGroupFixes(): Record<string, Record<string, string>> {
  try {
    const saved = JSON.parse(localStorage.getItem(GROUP_FIX_KEY) ?? 'null') as Record<string, Record<string, string>> | null
    if (saved && typeof saved === 'object') return saved
  } catch {
    // 壊れていたら、直していない
  }
  return {}
}
function loadOrderModes(): Record<string, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_MODE_KEY) ?? 'null') as Record<string, boolean> | null
    if (saved && typeof saved === 'object') return saved
  } catch {
    // 壊れていたら、五十音順で直したことに
  }
  return {}
}
/**
 * 点検表の並び（本番の studentList_ と同じ形。並べ替えてあればその順、あとから来た学生は決まった順で後ろに）。
 * 所属のあるコースは、試験用の学生に、登録した所属を順に割り当てる（最後の学生は、まだ選んでいない）
 */
function mockStudentList(year: number, courseId: string, course: Course | undefined): StudentEntry[] {
  const groups = course?.groups ?? []
  const compare = comparerFor(course)
  const key = `${year}:${courseId}`
  const fixes = loadGroupFixes()[key] ?? {}
  const groupOf = (studentId: string, i: number) => {
    const g = fixes[studentId] ?? (groups.length && i < MOCK_STUDENTS.length - 1 ? groups[i % groups.length] : '')
    return groups.includes(g) ? g : ''
  }
  const all = byKana(
    MOCK_STUDENTS.map(([kana, name, studentId], i) => ({ studentId, name, kana, group: groupOf(studentId, i), moved: false })),
    compare,
  )
  const saved = (loadOrderModes()[key] ?? false) === !!course?.checkById ? loadOrders()[key] : undefined
  // 所属は、いつも所属ごと（直した並びは、所属の中の順として使う）
  const placed = saved ? [...saved.flatMap((id) => all.filter((s) => s.studentId === id)), ...all.filter((s) => !saved.includes(s.studentId))] : all
  const rank = (e: StudentEntry) => (groups.includes(e.group) ? groups.indexOf(e.group) : groups.length)
  const list = groups.length ? [...placed].sort((a, b) => rank(a) - rank(b)) : placed
  const moved = movedFlags(list, compare)
  return list.map((s, i) => ({ ...s, moved: moved[i] }))
}

/**
 * 1回のやり取りにかかる時間。admin.html?delay=3000 で開くと 3 秒待つ（本番の Apps Script は、しばらく使っていないと
 * 10秒ほどかかることがあるので、待つ間の表示「保存しています…」「数秒〜十数秒かかることがあります」を確かめるため）
 */
const DELAY = Number(new URLSearchParams(location.search).get('delay')) || 200
const wait = () => new Promise((r) => setTimeout(r, DELAY))
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

export function createMockServer(): AdminServer {
  const members = (store: Store) => store.members ?? DEFAULT_MEMBERS
  const roleOf = (store: Store) => members(store).find((m) => m.email === USER)?.role ?? null
  /** その年度を、これまでに学生に公開したことがあるか（本番の wasPublished_ と同じ：変更履歴に「公開」か「初期設定」がある） */
  const wasPublished = (store: Store, year: number) => store.history.some((h) => h.year === year && (h.action === '公開' || h.action === '初期設定'))
  const state = (store: Store): AdminState => {
    const role = roleOf(store)
    // 削除できる年度（一度も公開していない「準備中」。本番の readYears_ と同じく、deleteYear と同じ決まりで付ける）
    const years = clone(store.years).map((y) => ({ ...y, deletable: y.status === '準備中' && !wasPublished(store, y.year) }))
    // 作ってある点検表の場所も（本番の getState の checkSheets と同じ）
    const checkSheets = Object.entries(loadSheets()).map(([key, url]) => ({ year: Number(key.split(':')[0]), courseId: key.slice(key.indexOf(':') + 1), url }))
    return {
      user: USER,
      isAdmin: role === '管理者',
      role: role === '管理者' ? 'admin' : role === '先生' ? 'teacher' : null,
      years: role ? years.sort((a, b) => b.year - a.year) : [],
      links: role ? { materials: 'https://example.com/materials', ai: 'https://example.com/teacher-ai' } : {},
      checkSheets: role ? checkSheets : [],
      me: role ? { name: me(store)?.name ?? '', courseId: me(store)?.courseId ?? '' } : null,
      adminUrl: role ? `${location.origin}${location.pathname}` : '',
    }
  }
  const me = (store: Store) => members(store).find((m) => m.email === USER)
  /** 先生は、担当のコースだけ（本番の requireCourseAccess_ と同じ言葉） */
  const requireCourseAccess = (store: Store, courseId: string) => {
    const m = me(store)
    if (!m || m.role === '管理者' || !m.courseId) return
    if (m.courseId !== courseId) throw new Error('担当のコースだけを見られます（担当のコースは、左下の「氏名と担当コース」で確かめられます）')
  }
  /** 氏名と担当コースの形（本番の cleanProfile_ と同じ） */
  const cleanProfile = (store: Store, name: string, courseId: string) => {
    const n = String(name ?? '').replace(/\s+/g, '　').trim()
    if (!n || n.length > 40) throw new Error('氏名は1〜40字で入れてください')
    const id = String(courseId ?? '').trim()
    if (!id || !store.years.some((y) => y.config.courses.some((c) => c.id === id))) throw new Error('担当のコースが見つかりません')
    return { name: n, courseId: id }
  }
  /** 点検表の画面の中身（本番の getCheckView と同じ形。点検表がまだなければ exists：false） */
  const checkView = (store: Store, year: number, courseId: string): CheckView => {
    const course = findYear(store, year).config.courses.find((c) => c.id === courseId)!
    const teachers = (course.advisors ?? []).map(surnameOf).filter((t, i, a) => t && a.indexOf(t) === i)
    const groups = effectiveGroups(course)
    const key = `${year}:${courseId}`
    const base: CheckView = { exists: false, rounds: [], students: [], teachers, groups, split: groups.length && !(course.groups ?? []).length ? (course.checkSplit ?? 0) : 0, assignment: loadAssign()[key] ?? null }
    if (!loadSheets()[key]) return base
    const listed = mockStudentList(year, courseId, course)
    const ordered = base.split ? splitGroups(listed, base.split) : listed
    const cells = loadCells()
    const students: CheckStudent[] = ordered.map((e, i) => {
      const c = cells[`${key}:${e.studentId}`] ?? {}
      return {
        key: e.studentId,
        no: i + 1,
        name: e.name,
        group: e.group,
        pdf: i % 6 === 5 ? null : { url: 'about:blank#pdf', label: `12/${10 + (i % 7)}` },
        note: i % 6 === 5 ? 'PDF まだ' : '',
        rounds: MOCK_ROUNDS.map((l) => roundCell(c.rounds?.[l] ?? '')),
        abstractOk: c.abstractOk === true,
        finalOk: c.finalOk === true,
        kyomu: c.kyomu === true,
      }
    })
    return { ...base, exists: true, url: loadSheets()[key], rounds: MOCK_ROUNDS, students }
  }
  const requireAdmin = (store: Store) => {
    if (roleOf(store) !== '管理者') throw new Error(`管理者だけが変更できます（ログイン中：${USER}）`)
  }
  const requireTeacher = (store: Store) => {
    if (!roleOf(store)) throw new Error(`登録された先生だけが使えます（ログイン中：${USER}）`)
  }
  const findYear = (store: Store, year: number) => {
    const row = store.years.find((y) => y.year === year)
    if (!row) throw new Error(`${year}年度の設定がありません`)
    return row
  }
  /** 保存してあるコース（本番の requireCourse_ と同じ言葉。まだ保存していないコースの点検表は開けない） */
  const requireSavedCourse = (store: Store, year: number, courseId: string) => {
    const row = findYear(store, year)
    if (!row.config.courses.some((c) => c.id === courseId)) throw new Error('このコースは、まだ保存されていません。保存してから使ってください')
  }
  /** 画面を開いたあとに、ほかの人（別のタブの自分）が保存していたら止める（本番の checkNotChanged_ と同じ） */
  const checkNotChanged = (row: YearRow, expectedUpdatedAt?: string) => {
    if (expectedUpdatedAt && row.updatedAt !== expectedUpdatedAt) throw new Error(changedMessage(row.updatedBy, USER))
  }
  /** 有効な管理者が0人になる変更は断る（本番の keepAdmin_ と同じ） */
  const keepAdmin = (list: Member[]) => {
    if (!list.some((m) => m.role === '管理者')) throw new Error('有効な管理者が1人もいなくなるため、変更しませんでした。管理者を1人以上残してください')
  }
  const record = (store: Store, year: number, action: string, config: YearConfig) =>
    store.history.push({ at: new Date().toISOString(), user: USER, year, action, config: clone(config) })
  /**
   * 年度の設定を読み、fn で書き換えて保存し、変更履歴に残す（本番の editYear_ と同じ。先生も使える）。
   * fn の中や書き換えたあとの確かめで誤りが見つかったら、何も保存しない
   */
  const editYear = (year: number, expectedUpdatedAt: string | undefined, fn: (config: YearConfig) => string) => {
    const store = load()
    requireTeacher(store)
    const row = findYear(store, year)
    checkNotChanged(row, expectedUpdatedAt)
    const config = clone(row.config)
    const action = fn(config)
    checkConfig(config)
    Object.assign(row, { config, updatedAt: new Date().toISOString(), updatedBy: USER })
    record(store, year, action, config)
    save(store)
    return state(store)
  }

  return {
    async getState() {
      await wait()
      return state(load())
    },
    async saveYear(config, expectedUpdatedAt) {
      await wait()
      const store = load()
      requireAdmin(store)
      checkConfig(config)
      const row = store.years.find((y) => y.year === config.fiscalYear)
      if (row) checkNotChanged(row, expectedUpdatedAt)
      // 画面を開いたときにはあった年度が、別のタブで削除されていたら、黙って作り直さない（本番の saveYear と同じ）
      if (!row && expectedUpdatedAt) throw new Error(deletedMessage(config.fiscalYear))
      if (row) Object.assign(row, { config, updatedAt: new Date().toISOString(), updatedBy: USER })
      else store.years.push({ year: config.fiscalYear, status: '準備中', config, updatedAt: new Date().toISOString(), updatedBy: USER })
      record(store, config.fiscalYear, '保存', config)
      save(store)
      return state(store)
    },
    async publishYear(year, expectedUpdatedAt) {
      await wait()
      const store = load()
      requireAdmin(store)
      const target = findYear(store, year)
      checkNotChanged(target, expectedUpdatedAt)
      // 公開した年度と終了にした年度は、更新日時も変える（本番の publishYear と同じ。前から開いていた別のタブの保存を止めるため）
      const now = new Date().toISOString()
      for (const row of store.years) {
        if (row.year === year) Object.assign(row, { status: '公開中', updatedAt: now, updatedBy: USER })
        else if (row.status === '公開中') Object.assign(row, { status: '終了', updatedAt: now, updatedBy: USER })
      }
      record(store, year, '公開', target.config)
      save(store)
      return state(store)
    },
    async createYear(fromYear, newYear) {
      await wait()
      const store = load()
      requireAdmin(store)
      if (!/^[1-9]\d{3}$/.test(String(newYear).trim()) || Number(newYear) < 2000 || Number(newYear) > 2100) throw new Error('新しい年度は、2000〜2100 の西暦4桁の数字で入力してください')
      const year = Number(newYear)
      if (store.years.some((y) => y.year === year)) throw new Error(`${year}年度はすでにあります`)
      const from = findYear(store, fromYear)
      const config: YearConfig = { ...clone(from.config), fiscalYear: year }
      store.years.push({ year, status: '準備中', config, updatedAt: new Date().toISOString(), updatedBy: USER })
      record(store, year, `${Number(fromYear)}年度からコピーして作成`, config)
      save(store)
      return state(store)
    },
    async deleteYear(year, expectedUpdatedAt) {
      await wait()
      const store = load()
      requireAdmin(store)
      const row = findYear(store, year)
      // 本番の deleteYear と同じく、一度も公開したことのない「準備中」の年度だけ消せる
      if (row.status !== '準備中' || wasPublished(store, year)) {
        throw new Error(`${year}年度は、学生に公開したことがあるため削除できません（削除できるのは、一度も公開していない「準備中」の年度だけです）`)
      }
      checkNotChanged(row, expectedUpdatedAt)
      store.years = store.years.filter((y) => y !== row)
      record(store, year, '削除', row.config)
      save(store)
      return state(store)
    },
    async getHistory(year) {
      await wait()
      const store = load()
      requireTeacher(store)
      return store.history
        .filter((h) => h.year === year)
        .reverse()
        .slice(0, 50)
    },
    async saveTeacherEdits(year, edits, expectedUpdatedAt) {
      await wait()
      return editYear(year, expectedUpdatedAt, (config) => {
        if (!edits || typeof edits !== 'object') throw new Error('保存する内容の形が正しくありません')
        const done: string[] = []
        if (edits.templates && typeof edits.templates === 'object' && Object.keys(edits.templates).length) done.push(`下書きのひな形を保存（${applyTemplates(config, edits.templates).join('・')}）`)
        if (edits.notices && typeof edits.notices === 'object' && Object.keys(edits.notices).length) done.push(`お知らせを保存（${applyNotices(config, edits.notices).join('・')}）`)
        if (edits.words !== undefined && edits.words !== null) {
          config.wordChecks = cleanWords(edits.words)
          done.push(`書き間違えやすい語を保存（${config.wordChecks.length}語）`)
        }
        if (edits.permissions && typeof edits.permissions === 'object' && Object.keys(edits.permissions).length) done.push(`先生の許可を保存（${applyPermissions(config, edits.permissions).join('・')}）`)
        if (edits.sheets && typeof edits.sheets === 'object' && Object.keys(edits.sheets).length) done.push(`所属と点検表の並びを保存（${applySheetSettings(config, edits.sheets).join('・')}）`)
        if (edits.subtitles && typeof edits.subtitles === 'object' && Object.keys(edits.subtitles).length) done.push(`サブタイトルを使うかを保存（${applySubtitles(config, edits.subtitles).join('・')}）`)
        return done.join('・') || '保存（変更なし）'
      })
    },
    async getPdfFolder() {
      await wait()
      requireAdmin(load())
      return folderInfo(loadPdfFolder())
    },
    async setPdfFolder(link) {
      await wait()
      const store = load()
      requireAdmin(store)
      // 本番の setPdfFolder と同じ言葉で断る
      const id = folderIdFromLink(link)
      if (!id) throw new Error('フォルダのリンクを貼ってください（https://drive.google.com/drive/folders/… の形）')
      if (id.includes('gone')) throw new Error('そのフォルダを開けません。リンクと、フォルダの共有を確かめてください')
      if (id.includes('noaccess')) throw new Error('そのフォルダを編集できません。フォルダの持ち主に「編集者」にしてもらってください')
      const folder = { id, name: `新しいフォルダ（${id.slice(0, 6)}…）` }
      localStorage.setItem(PDF_FOLDER_KEY, JSON.stringify(folder))
      return folderInfo(folder)
    },
    async ensureCheckSheet(year, courseId) {
      await wait()
      const store = load()
      requireTeacher(store)
      requireSavedCourse(store, year, courseId)
      requireCourseAccess(store, courseId)
      // 本番は Google スプレッドシートの場所。試験用は、新しいタブで開ける空のページ（自動テストが、開いたことを確かめる）。
      // 作ったことを覚えておく（次からは、管理ページの状態に場所が入り、サーバーに聞かずに開く）
      const url = `about:blank#check-sheet-${year}-${courseId}`
      localStorage.setItem(SHEETS_KEY, JSON.stringify({ ...loadSheets(), [`${year}:${courseId}`]: url }))
      return { url }
    },
    async listStudents(year, courseId) {
      await wait()
      const store = load()
      requireTeacher(store)
      requireSavedCourse(store, year, courseId)
      requireCourseAccess(store, courseId)
      return mockStudentList(year, courseId, findYear(store, year).config.courses.find((c) => c.id === courseId))
    },
    async saveStudentOrder(year, courseId, studentIds, groups) {
      await wait()
      const store = load()
      requireTeacher(store)
      requireSavedCourse(store, year, courseId)
      requireCourseAccess(store, courseId)
      if (studentIds !== null && (!Array.isArray(studentIds) || studentIds.some((x) => typeof x !== 'string'))) throw new Error('並びの形が正しくありません')
      const orders = loadOrders()
      if (studentIds) orders[`${year}:${courseId}`] = studentIds
      else delete orders[`${year}:${courseId}`]
      localStorage.setItem(ORDER_KEY, JSON.stringify(orders))
      const course = findYear(store, year).config.courses.find((c) => c.id === courseId)
      if (groups && Object.keys(groups).length) {
        if (Object.values(groups).some((g) => !(course?.groups ?? []).includes(g))) throw new Error('所属の形が正しくありません（コースに登録していない所属です）')
        const all = loadGroupFixes()
        all[`${year}:${courseId}`] = { ...(all[`${year}:${courseId}`] ?? {}), ...groups }
        localStorage.setItem(GROUP_FIX_KEY, JSON.stringify(all))
      }
      localStorage.setItem(ORDER_MODE_KEY, JSON.stringify({ ...loadOrderModes(), [`${year}:${courseId}`]: !!course?.checkById }))
      return mockStudentList(year, courseId, course)
    },
    async saveNotices(year, notices) {
      await wait()
      return editYear(year, undefined, (config) => {
        if (!notices || typeof notices !== 'object') throw new Error('お知らせの形が正しくありません')
        return `お知らせを保存（${applyNotices(config, notices).join('・')}）`
      })
    },
    async saveWordChecks(year, words) {
      await wait()
      return editYear(year, undefined, (config) => {
        config.wordChecks = cleanWords(words)
        return `書き間違えやすい語を保存（${config.wordChecks.length}語）`
      })
    },
    async saveTemplates(year, templates) {
      await wait()
      return editYear(year, undefined, (config) => {
        if (!templates || typeof templates !== 'object') throw new Error('ひな形の形が正しくありません')
        return `下書きのひな形を保存（${applyTemplates(config, templates).join('・')}）`
      })
    },
    async setMyProfile(name, courseId) {
      await wait()
      const store = load()
      requireTeacher(store)
      const profile = cleanProfile(store, name, courseId)
      store.members = members(store).map((m) => (m.email === USER ? { ...m, ...profile } : m))
      save(store)
      return profile
    },
    async setMemberProfile(email, name, courseId) {
      await wait()
      const store = load()
      requireAdmin(store)
      const profile = cleanProfile(store, name, courseId)
      if (!members(store).some((m) => m.email === email)) throw new Error(removedMemberMessage(email))
      store.members = members(store).map((m) => (m.email === email ? { ...m, ...profile } : m))
      save(store)
      return clone(store.members)
    },
    async getCheckView(year, courseId) {
      await wait()
      const store = load()
      requireTeacher(store)
      requireSavedCourse(store, year, courseId)
      requireCourseAccess(store, courseId)
      requireCourseAccess(store, courseId)
      return checkView(store, year, courseId)
    },
    async setCheckCell(year, courseId, studentId, field: CheckField) {
      await wait()
      const store = load()
      requireTeacher(store)
      requireSavedCourse(store, year, courseId)
      requireCourseAccess(store, courseId)
      requireCourseAccess(store, courseId)
      const key = `${year}:${courseId}:${studentId}`
      const cells = loadCells()
      const c = cells[key] ?? {}
      if ('round' in field) {
        const teacher = field.teacher.trim()
        c.rounds = { ...(c.rounds ?? {}), [field.round]: !teacher ? '' : teacher + (field.state === 'done' ? ' 済み' : field.state === 'plan' ? ' 予定' : '') }
      } else c[field.kind] = field.on
      cells[key] = c
      localStorage.setItem(CELLS_KEY, JSON.stringify(cells))
      return checkView(store, year, courseId).students.find((s) => s.key === studentId) ?? null
    },
    async saveAssignment(year, courseId, assignment: Assignment) {
      await wait()
      const store = load()
      requireTeacher(store)
      requireSavedCourse(store, year, courseId)
      requireCourseAccess(store, courseId)
      requireCourseAccess(store, courseId)
      const view = checkView(store, year, courseId)
      if (!view.groups.length) throw new Error('所属か、並び順で分ける数を、コースごとの設定で決めてください')
      for (const list of Object.values(assignment.rows)) for (const t of list) if (t && !view.teachers.includes(t)) throw new Error(`「${t}」は、このコースの指導教員にいません`)
      localStorage.setItem(ASSIGN_KEY, JSON.stringify({ ...loadAssign(), [`${year}:${courseId}`]: assignment }))
      // 点検表に入れる（済みの欄・割り振りが空の欄は書き換えない）
      const cells = loadCells()
      for (const s of view.students) {
        const plan = assignment.rows[s.group]
        if (!plan) continue
        const key = `${year}:${courseId}:${s.key}`
        const c = cells[key] ?? {}
        view.rounds.forEach((label, r) => {
          const i = assignment.labels.indexOf(label)
          const t = i >= 0 ? plan[i] : ''
          if (t && s.rounds[r].state !== 'done') c.rounds = { ...(c.rounds ?? {}), [label]: `${t} 予定` }
        })
        cells[key] = c
      }
      localStorage.setItem(CELLS_KEY, JSON.stringify(cells))
      return checkView(store, year, courseId)
    },
    async getMembers() {
      await wait()
      const store = load()
      requireAdmin(store)
      return clone(members(store))
    },
    async addMember(email, role, memo, mustExist) {
      await wait()
      const store = load()
      requireAdmin(store)
      const list = clone(members(store))
      const found = list.find((m) => m.email.toLowerCase() === email.trim().toLowerCase())
      if (found && found.email.toLowerCase() === USER && role !== '管理者') throw new Error('自分を管理者から外すことはできません')
      if (!found && mustExist) throw new Error(removedMemberMessage(email.trim()))
      if (found) Object.assign(found, { role, memo: memo || found.memo })
      else list.push({ email: email.trim(), role, memo })
      keepAdmin(list)
      store.members = list
      save(store)
      return clone(list)
    },
    async addMembers(entries, role) {
      await wait()
      const store = load()
      requireAdmin(store)
      const list = clone(members(store))
      for (const { email, memo } of entries) {
        if (!list.some((m) => m.email.toLowerCase() === email.trim().toLowerCase())) list.push({ email: email.trim(), role, memo })
      }
      store.members = list
      save(store)
      return clone(list)
    },
    async removeMember(email) {
      await wait()
      const store = load()
      requireAdmin(store)
      if (email.toLowerCase() === USER) throw new Error('自分の登録は外せません')
      const list = members(store).filter((m) => m.email.toLowerCase() !== email.toLowerCase())
      keepAdmin(list)
      store.members = list
      save(store)
      return clone(store.members)
    },
    async getTrialSample() {
      await wait()
      requireTeacher(load())
      // 開発中・自動テスト用にまとめた版（scripts/e2e/serveBuilt.mjs が返す）は、手元にある本番の見本（git に入れないファイル gas/trial-sample.private.json）を使う。なければ開発用の小さな見本
      if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
        const local = await fetch('/gas/trial-sample.private.json')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
        if (local) return local
      }
      return clone(DEV_TRIAL_SAMPLE)
    },
    async getFeedback() {
      await wait()
      requireTeacher(load())
      return loadFeedback()
    },
    async updateFeedback(id, status, reply, memo, notify) {
      await wait()
      requireTeacher(load())
      const list = loadFeedback()
      const item = list.find((f) => f.id === id)
      if (!item) throw new Error(`受付番号 ${id} が見つかりません`)
      const now = '2026-11-05 15:00'
      if (item.status !== status || item.reply !== reply) item.changedAt = now
      Object.assign(item, { status, reply, memo })
      if (notify && FEEDBACK_NOTIFY.includes(status)) item.notifiedAt = now
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list))
      return clone(list)
    },
    async getVersion() {
      await wait()
      // 公開中の版は、この画面と同じ。自動テスト（scripts/e2e/adminVersion.mjs）は sotsugyo-admin-mock-version で、新しい版が出たことにする
      let id = BUILD_ID
      try {
        id = localStorage.getItem(MOCK_VERSION_KEY) ?? BUILD_ID
      } catch {
        // 読めなければ、同じ版
      }
      return { id, url: location.href }
    },
  }
}
