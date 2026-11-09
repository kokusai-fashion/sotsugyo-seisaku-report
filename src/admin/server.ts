import type { TemplateBlock, WordCheck, YearConfig } from '../config'
import { createMockServer } from './mockServer'

/**
 * 管理ページとサーバー（Google Apps Script）のやり取り。
 * 本番では google.script.run で gas/admin-project/Code.js の関数を呼ぶ。
 * 開発サーバー（npm run dev の admin.html）では、ブラウザ内だけで動く試験用のサーバーを使う。
 */

export type YearStatus = '公開中' | '準備中' | '終了'

export interface YearRow {
  year: number
  status: YearStatus
  config: YearConfig
  updatedAt: string
  updatedBy: string
  /** 削除できる年度か（一度も公開していない「準備中」。サーバーの deleteYear と同じ決まり。古いサーバーは返さない） */
  deletable?: boolean
}

export interface HistoryRow {
  at: string
  user: string
  year: number
  action: string
  config: YearConfig
}

/** 管理者：年度の設定をすべて変更・公開できる。先生：すべてのコースの下書きのひな形・お知らせと、書き間違えやすい語を編集できる */
export type Role = 'admin' | 'teacher' | null

export interface AdminState {
  user: string
  isAdmin: boolean
  role?: Role
  years: YearRow[]
  /** 先生向けのリンク（ログインした先生と管理者にだけ届く。materials：説明の資料一式、ai：管理ページの使い方を答える AI。gas/admin-links.local.json） */
  links?: { materials?: string; ai?: string }
  /** 作ってある点検表の場所（「点検表を開く」を、サーバーに聞かずにすぐ開く。依頼者の試し 2026-11-04。前の版のサーバーは返さない） */
  checkSheets?: CheckSheetLink[]
  /** 自分の氏名と担当コース（先生は、はじめて開いたときに選ぶ。まだなら空の文字。依頼者の選択 2026-11-09。前の版のサーバーは返さない） */
  me?: Profile | null
  /** 管理ページの場所（点検表の画面に直接入るリンクを作る。前の版のサーバーは返さない） */
  adminUrl?: string
}

/** 先生の氏名と担当コース（担当のコースはいつも1つ） */
export interface Profile {
  name: string
  courseId: string
}

/** 点検表の回の欄（「山本 済み」→ teacher：山本・state：done。空は teacher も state も ''） */
export interface CheckRound {
  teacher: string
  state: 'done' | 'plan' | ''
}

/** 点検表の画面の学生の行（点検表の1行。key：学籍番号） */
export interface CheckStudent {
  key: string
  no: number
  name: string
  /** 所属（等分するコースは「1班」など。使わないコースは ''） */
  group: string
  pdf: { url: string; label: string } | null
  note: string
  /** 回ごと（CheckView.rounds と同じ並び） */
  rounds: CheckRound[]
  abstractOk: boolean
  finalOk: boolean
  kyomu: boolean
}

/** 担当の割り振り（まとまり → 回ごとの先生の名字。'' は入れない） */
export interface Assignment {
  labels: string[]
  rows: Record<string, string[]>
}

/** 点検表の画面の中身（gas/admin-project の getCheckView。点検表がまだなければ exists：false） */
export interface CheckView {
  exists: boolean
  url?: string
  /** 回の名前（1回目・2回目…。点検表の青い見出しの列） */
  rounds: string[]
  students: CheckStudent[]
  /** このコースの指導教員の名字（回の欄に入れる先生） */
  teachers: string[]
  /** まとまりの名前（所属、または等分した班。使わないコースは []） */
  groups: string[]
  /** 並び順で等分する数（しないコースは 0） */
  split: number
  assignment: Assignment | null
}

/** 点検表の画面から書く欄 */
export type CheckField = { round: string; teacher: string; state: CheckRound['state'] } | { kind: 'abstractOk' | 'finalOk' | 'kyomu'; on: boolean }

/**
 * PDF の控えのもとのフォルダ（管理者だけ。管理ページの「詳細設定」。依頼者の選択 2026-11-05 mockups/v112 案A）。
 * この中に、年度のフォルダ、その中にコースのフォルダが自動でできる。name：フォルダの名前（開けなければ null。そのときは error）
 */
export interface PdfFolder {
  id: string
  name: string | null
  url: string
  error?: string
}

/** コースの点検表の場所 */
export interface CheckSheetLink {
  year: number
  courseId: string
  url: string
}

/** その年度の、コースごとの点検表の場所（コースの ID → 場所） */
export function checkSheetUrls(state: AdminState, year: number): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of state.checkSheets ?? []) if (s.year === year && /^https?:|^about:/.test(s.url)) out[s.courseId] = s.url
  return out
}

export interface Member {
  email: string
  memo: string
  role: '管理者' | '先生'
  /** 氏名と担当コース（先生がはじめて開いたときに選ぶ。まだなら空） */
  name?: string
  courseId?: string
}

/** コースごとの下書きのひな形（コースID → ひな形と抄録の書き出し例） */
export type TemplateSet = Record<string, { template: TemplateBlock[]; abstractExample: string }>

/** コースごとの先生の許可（コースID → 抄録・提出用の PDF。依頼者の選択 2026-11-04） */
export type PermissionSet = Record<string, { abstract: boolean; final: boolean }>

/** コースごとの所属・点検表の順番・並べ方（コースID → 設定。先生も変えられる：依頼者の選択 2026-11-09 mockups/v119） */
export type SheetSettingSet = Record<string, { groups: string[]; checkById: boolean; checkOneColumn: boolean; checkSplit: number }>

/** 「学生の並びを直す」の窓の1行（点検表の並び。moved：手で動かした。studentId が「staff:」で始まるのは教職員の試し） */
export interface StudentEntry {
  studentId: string
  /** 姓と名（全角の空白でつなぐ） */
  name: string
  /** セイ メイ */
  kana: string
  /** 学生が選んだ所属（所属を使わないコース・まだ選んでいない学生は ''） */
  group: string
  moved: boolean
}

/** 役割（古いサーバーは role を返さないため、isAdmin から決める） */
export function roleOf(state: AdminState): Role {
  return state.role !== undefined ? state.role : state.isAdmin ? 'admin' : null
}

export interface AdminServer {
  getState(): Promise<AdminState>
  /** expectedUpdatedAt：画面を開いたときの更新日時（そのあとにほかの人が保存していたら、保存せずに知らせる） */
  saveYear(config: YearConfig, expectedUpdatedAt?: string): Promise<AdminState>
  /** expectedUpdatedAt：画面を開いたときの更新日時（そのあとにほかの人が保存していたら、見ていない内容を公開しないよう、公開せずに知らせる） */
  publishYear(year: number, expectedUpdatedAt?: string): Promise<AdminState>
  createYear(fromYear: number, newYear: number): Promise<AdminState>
  /** 一度も公開していない「準備中」の年度を削除する（間違えて作った年度を消すため。管理者だけ） */
  deleteYear(year: number, expectedUpdatedAt?: string): Promise<AdminState>
  getHistory(year: number): Promise<HistoryRow[]>
  saveTemplates(year: number, templates: TemplateSet): Promise<AdminState>
  /** コースのお知らせを保存する（管理者・先生）。notices はコースの ID → お知らせ */
  saveNotices(year: number, notices: Record<string, string>): Promise<AdminState>
  /** 書き間違えやすい語の一覧を保存する（管理者・先生） */
  saveWordChecks(year: number, words: WordCheck[]): Promise<AdminState>
  /**
   * 先生の画面の保存：ひな形・お知らせ・書き間違えやすい語・先生の許可を、まとめて1回で。
   * expectedUpdatedAt：画面を開いたときの更新日時（そのあとにほかの人が保存していたら、保存せずに知らせる）
   */
  saveTeacherEdits(year: number, edits: { templates?: TemplateSet; notices?: Record<string, string>; words?: WordCheck[]; permissions?: PermissionSet; subtitles?: Record<string, boolean>; sheets?: SheetSettingSet }, expectedUpdatedAt?: string): Promise<AdminState>
  /**
   * コースの点検表を作る（管理者・先生。まだ点検表がないときに「点検表を開く」から）。PDF の控えのコースのフォルダに作り、名簿から写してから、場所を返す。
   * もうあれば、すぐ場所を返す（gas/admin-project の ensureCheckSheet。依頼者の選択 2026-11-04）
   */
  ensureCheckSheet(year: number, courseId: string): Promise<{ url: string }>
  /** 管理者：PDF の控えのもとのフォルダ */
  getPdfFolder(): Promise<PdfFolder>
  /** 管理者：PDF の控えのもとのフォルダを変える（貼られたリンク）。返り値は変えたあとのフォルダ */
  setPdfFolder(link: string): Promise<PdfFolder>
  /** 「学生の並びを直す」の窓の一覧（点検表の並び） */
  listStudents(year: number, courseId: string): Promise<StudentEntry[]>
  /** 「この並びにする」（studentIds が null なら、ふりがなの順に戻す）。返り値は直したあとの一覧 */
  /** groups：先生が直した学生の所属（学籍番号 → 所属。依頼者の選択 2026-11-09：学生が間違えて選んだときに、先生も直せる） */
  saveStudentOrder(year: number, courseId: string, studentIds: string[] | null, groups?: Record<string, string>): Promise<StudentEntry[]>
  /** 自分の氏名と担当コースを登録する（先生・管理者） */
  setMyProfile(name: string, courseId: string): Promise<Profile>
  /** ほかの先生の氏名と担当コースを直す（管理者だけ）。返り値は直したあとの一覧 */
  setMemberProfile(email: string, name: string, courseId: string): Promise<Member[]>
  /** 点検表の画面の中身（先生は担当のコースだけ） */
  getCheckView(year: number, courseId: string): Promise<CheckView>
  /** 点検表の画面から1つの欄を書く。返り値は、その学生の書いたあとの行 */
  setCheckCell(year: number, courseId: string, studentId: string, field: CheckField): Promise<CheckStudent | null>
  /** 担当の割り振りを保存して、点検表に入れる。返り値は入れたあとの中身 */
  saveAssignment(year: number, courseId: string, assignment: Assignment): Promise<CheckView>
  getMembers(): Promise<Member[]>
  /** mustExist：一覧の役割を変えるとき（登録されていない人は書き足さない） */
  addMember(email: string, role: Member['role'], memo: string, mustExist?: boolean): Promise<Member[]>
  /** まとめて登録する（すでに登録されている人は、そのまま） */
  addMembers(entries: { email: string; memo: string }[], role: Member['role']): Promise<Member[]>
  removeMember(email: string): Promise<Member[]>
  /**
   * お試し（学生の画面を試す）の見本の原稿（管理者・先生だけ。学生には渡さない）。
   * 形は src/trial/protocol.ts の TrialSample（学生のツールが受け取るときに確かめる）
   */
  getTrialSample(): Promise<unknown>
  /**
   * 公開中の管理ページの版の印と場所（「新しい版があります」：AdminNewVersion.tsx）。
   * 前の版のサーバー（getVersion がない）では失敗する
   */
  getVersion(): Promise<{ id: string; url: string }>
  /** 届いた声の一覧（新しいものから。管理者・先生。gas/admin-project の getFeedback） */
  getFeedback(): Promise<FeedbackItem[]>
  /** 届いた声の状態・学生へのひとこと・先生のメモを変える。notify：学生に知らせる（「直しました」「使い方で解決」）。返り値は変えたあとの一覧 */
  updateFeedback(id: string, status: FeedbackStatus, reply: string, memo: string, notify: boolean): Promise<FeedbackItem[]>
}

/** 届いた声の状態（gas/admin-project/Code.js の FEEDBACK_STATUSES と同じ） */
export const FEEDBACK_STATUSES = ['受け付けた', '確かめ中', '直しました', '使い方で解決', '対応しない'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]
/** 学生に知らせる状態 */
export const FEEDBACK_NOTIFY: readonly FeedbackStatus[] = ['直しました', '使い方で解決']

/** 届いた声（学生のツールの「困ったこと・おかしいことを知らせる」。シート「届いた声」の1行） */
export interface FeedbackItem {
  id: string
  receivedAt: string
  kind: string
  text: string
  /** 送った人の大学のアドレス（ログインなしで送ったときは空） */
  email: string
  studentId: string
  name: string
  course: string
  version: string
  device: string
  page: string
  notice: string
  errors: string
  /** 画面の写真（ドライブのリンク。付けていなければ空） */
  screen: string
  status: FeedbackStatus
  reply: string
  memo: string
  changedAt: string
  notifiedAt: string
}

interface ScriptRun {
  withSuccessHandler(fn: (value: unknown) => void): ScriptRun
  withFailureHandler(fn: (error: Error) => void): ScriptRun
  [name: string]: unknown
}

declare global {
  interface Window {
    google?: { script: { run: ScriptRun; url?: { getLocation(cb: (loc: { parameter: Record<string, string> }) => void): void } } }
  }
}

function call<T>(name: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = window.google!.script.run.withSuccessHandler((v) => resolve(v as T)).withFailureHandler(reject)
    ;(run[name] as (...a: unknown[]) => void)(...args)
  })
}

function appsScriptServer(): AdminServer {
  return {
    getState: () => call('getState'),
    saveYear: (config, expectedUpdatedAt) => call('saveYear', config, expectedUpdatedAt ?? null),
    publishYear: (year, expectedUpdatedAt) => call('publishYear', year, expectedUpdatedAt ?? null),
    createYear: (fromYear, newYear) => call('createYear', fromYear, newYear),
    deleteYear: (year, expectedUpdatedAt) => call('deleteYear', year, expectedUpdatedAt ?? null),
    getHistory: (year) => call('getHistory', year),
    saveTemplates: (year, templates) => call('saveTemplates', year, templates),
    saveWordChecks: (year, words) => call('saveWordChecks', year, words),
    saveNotices: (year, notices) => call('saveNotices', year, notices),
    saveTeacherEdits: (year, edits, expectedUpdatedAt) => call('saveTeacherEdits', year, edits, expectedUpdatedAt ?? null),
    setMyProfile: (name, courseId) => call('setMyProfile', name, courseId),
    setMemberProfile: (email, name, courseId) => call('setMemberProfile', email, name, courseId),
    getCheckView: (year, courseId) => call('getCheckView', year, courseId),
    setCheckCell: (year, courseId, studentId, field) => call('setCheckCell', year, courseId, studentId, field),
    saveAssignment: (year, courseId, assignment) => call('saveAssignment', year, courseId, assignment),
    getMembers: () => call('getMembers'),
    addMember: (email, role, memo, mustExist) => call('addMember', email, role, memo, !!mustExist),
    addMembers: (entries, role) => call('addMembers', entries, role),
    removeMember: (email) => call('removeMember', email),
    getTrialSample: () => call('getTrialSample'),
    getVersion: () => call('getVersion'),
    getFeedback: () => call('getFeedback'),
    updateFeedback: (id, status, reply, memo, notify) => call('updateFeedback', id, status, reply, memo, notify),
    ensureCheckSheet: (year, courseId) => call('ensureCheckSheet', year, courseId),
    listStudents: (year, courseId) => call('listStudents', year, courseId),
    saveStudentOrder: (year, courseId, studentIds, groups) => call('saveStudentOrder', year, courseId, studentIds, groups ?? {}),
    getPdfFolder: () => call('getPdfFolder'),
    setPdfFolder: (link) => call('setPdfFolder', link),
  }
}

export const server: AdminServer = window.google?.script ? appsScriptServer() : createMockServer()
export const isMockServer = !window.google?.script

// 開発中・自動テスト用にまとめた版の試験用サーバーだけ、自動テスト（scripts/e2e/admin.mjs）から試験用サーバーを直接呼べるようにする
// （画面では押せない操作＝公開した年度の削除が断られることなどを確かめるため）
if ((import.meta.env.DEV || import.meta.env.MODE === 'e2e') && isMockServer) Object.assign(window, { __adminServer: server })

/** 管理ページを開いたときのアドレスの印（?view=check：点検表の画面から。Apps Script では、ページの外のアドレスを google.script.url で読む） */
export function startParams(): Promise<Record<string, string>> {
  const url = window.google?.script?.url
  if (url) return new Promise((resolve) => url.getLocation((loc) => resolve(loc?.parameter ?? {})))
  return Promise.resolve(Object.fromEntries(new URLSearchParams(location.search)))
}
