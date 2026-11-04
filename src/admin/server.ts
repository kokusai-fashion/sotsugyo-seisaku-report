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
}

export interface Member {
  email: string
  memo: string
  role: '管理者' | '先生'
}

/** コースごとの下書きのひな形（コースID → ひな形と抄録の書き出し例） */
export type TemplateSet = Record<string, { template: TemplateBlock[]; abstractExample: string }>

/** コースごとの先生の許可（コースID → 抄録・提出用の PDF。依頼者の選択 2026-11-04） */
export type PermissionSet = Record<string, { abstract: boolean; final: boolean }>

/** 「学生の並びを直す」の窓の1行（点検表の並び。moved：手で動かした。studentId が「staff:」で始まるのは教職員の試し） */
export interface StudentEntry {
  studentId: string
  /** 姓と名（全角の空白でつなぐ） */
  name: string
  /** セイ メイ */
  kana: string
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
  saveTeacherEdits(year: number, edits: { templates?: TemplateSet; notices?: Record<string, string>; words?: WordCheck[]; permissions?: PermissionSet }, expectedUpdatedAt?: string): Promise<AdminState>
  /**
   * コースの点検表を開く（管理者・先生）。なければ、PDF の控えのコースのフォルダに作る。名簿から写してから、場所を返す
   * （gas/admin-project の ensureCheckSheet。依頼者の選択 2026-11-04）
   */
  ensureCheckSheet(year: number, courseId: string): Promise<{ url: string }>
  /** 「学生の並びを直す」の窓の一覧（点検表の並び） */
  listStudents(year: number, courseId: string): Promise<StudentEntry[]>
  /** 「この並びにする」（studentIds が null なら、ふりがなの順に戻す）。返り値は直したあとの一覧 */
  saveStudentOrder(year: number, courseId: string, studentIds: string[] | null): Promise<StudentEntry[]>
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
    google?: { script: { run: ScriptRun } }
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
    saveStudentOrder: (year, courseId, studentIds) => call('saveStudentOrder', year, courseId, studentIds),
  }
}

export const server: AdminServer = window.google?.script ? appsScriptServer() : createMockServer()
export const isMockServer = !window.google?.script

// 開発中・自動テスト用にまとめた版の試験用サーバーだけ、自動テスト（scripts/e2e/admin.mjs）から試験用サーバーを直接呼べるようにする
// （画面では押せない操作＝公開した年度の削除が断られることなどを確かめるため）
if ((import.meta.env.DEV || import.meta.env.MODE === 'e2e') && isMockServer) Object.assign(window, { __adminServer: server })
