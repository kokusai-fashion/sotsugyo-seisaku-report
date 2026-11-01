/**
 * 困ったこと・おかしいことを知らせる（依頼者の選択 2026-11-01：mockups/v85 入口A・B／窓A／知らせA）。
 * - 学生が書いた声を、学科の Apps Script の窓口（年度の設定と同じ VITE_CONFIG_API_URL。gas/api-project の feedback_）に送る。
 *   届いた声はスプレッドシート「届いた声」に残り、管理者にメールが届く。管理ページの「届いた声」で状態を変える
 * - いっしょに送るのは、ツールの版・端末・開いていたページ・直前の知らせ・ツールの中で起きたエラー。原稿の文や写真は送らない
 *   （開いていたページの写真だけ、学生が選んだときに付ける）
 * - 送ると受付番号と鍵が返る。この端末に覚えておき、開くたびに状態を問い合わせる（feedbackStatus_）。
 *   「直しました」「使い方で解決」になったら、右の欄の上に知らせる（× で閉じるまで）。ログインして送った声は、大学のメールにも届く
 * - ツールの中で起きたエラーは、学生が知らせなくても、自動で窓口に送る（errorLog_。原稿の文は送らない。同じものは送らない）
 */

/** 送り先：年度の設定と同じ、学科の Apps Script の窓口 */
export const FEEDBACK_API_URL = import.meta.env.VITE_CONFIG_API_URL as string | undefined

export const FEEDBACK_KINDS = ['うまく動かない', 'やり方が分からない', 'そのほか'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]
/** 学生に知らせる状態（管理ページで、この状態にして「知らせる」を押したもの） */
export const DONE_STATUSES = ['直しました', '使い方で解決']

/** 窓口が受け取る形（gas/api-project/Code.js の feedback_） */
export interface FeedbackPayload {
  action: 'feedback'
  /** ログインの許可（ログインしていれば。窓口が Google に確かめて、返事のメールの宛先にする。保存しない） */
  token?: string
  kind: FeedbackKind
  text: string
  version: string
  device: string
  page: string
  notice: string
  errors: string[]
  /** 開いていたページの写真（JPEG の base64。学生が選んだときだけ） */
  screen?: string
  year: number
  courseId: string
  studentId: string
  name: string
}

/** この端末に覚えておく、送った声 */
export interface FeedbackReceipt {
  id: string
  key: string
  /** 送った日時（ISO） */
  sentAt: string
  /** 書いた内容のはじめ（知らせに出す） */
  summary: string
  /** 最後に問い合わせた状態 */
  status?: string
  reply?: string
  /** 知らせを × で閉じた */
  dismissed?: boolean
}

const RECEIPTS_KEY = 'sotsugyo-seisaku-report-feedback'
/** 覚えておく数（古いものから忘れる） */
const RECEIPTS_MAX = 20
/** 知らせに出す、書いた内容のはじめの字数 */
export const SUMMARY_CHARS = 24

export function loadReceipts(): FeedbackReceipt[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(RECEIPTS_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((r): r is FeedbackReceipt => !!r && typeof r.id === 'string' && typeof r.key === 'string') : []
  } catch {
    return []
  }
}

export function saveReceipts(list: FeedbackReceipt[]): void {
  try {
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(list.slice(-RECEIPTS_MAX)))
  } catch {
    // 覚えておけなくても、送った声は届いている（知らせが出ないだけ。ログインしていればメールで届く）
  }
}

/** 書いた内容のはじめ（知らせ・メールに出す） */
export function summaryOf(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > SUMMARY_CHARS ? `${t.slice(0, SUMMARY_CHARS)}…` : t
}

/** 端末の説明（例「パソコン・Windows・Chrome（画面 1440×900）」）。名前などは入れない */
export function deviceText(ua: string, phone: boolean, width: number, height: number): string {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua)) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Macintosh/.test(ua) ? 'Mac' : 'そのほか'
  const browser = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'そのほか'
  return `${phone ? 'スマホの画面' : 'パソコンの画面'}・${os}・${browser}（画面 ${Math.round(width)}×${Math.round(height)}）`
}

/** 窓口に送る（JSON を text/plain で。Google のログインの情報（cookie）は送らない）。窓口の答えを返す */
async function post<T>(url: string, body: unknown, send: typeof fetch = fetch): Promise<T> {
  const res = await send(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), credentials: 'omit', redirect: 'follow' })
  if (!res.ok) throw new Error(`窓口の答え ${res.status}`)
  return (await res.json()) as T
}

/** 送る。受け付けられたら、受付番号と鍵をこの端末に覚えて返す。断られた・つながらないときは理由を投げる */
export async function sendFeedback(url: string, payload: FeedbackPayload, send?: typeof fetch): Promise<FeedbackReceipt> {
  const body = await post<{ ok: boolean; id?: string; key?: string; error?: string }>(url, payload, send)
  if (!body.ok || typeof body.id !== 'string' || typeof body.key !== 'string') throw new Error(body.error || '受け付けられませんでした')
  const receipt: FeedbackReceipt = { id: body.id, key: body.key, sentAt: new Date().toISOString(), summary: summaryOf(payload.text) }
  saveReceipts([...loadReceipts(), receipt])
  return receipt
}

/**
 * 送った声の状態を問い合わせ、覚えている状態を新しくする。知らせる（「直しました」「使い方で解決」で、まだ閉じていない）ものを返す。
 * つながらないときは、覚えている状態のまま
 */
export async function checkFeedback(url: string, send?: typeof fetch): Promise<FeedbackReceipt[]> {
  const list = loadReceipts()
  const asking = list.filter((r) => !r.dismissed && !DONE_STATUSES.includes(r.status ?? ''))
  if (asking.length) {
    try {
      const body = await post<{ ok: boolean; items?: { id: string; status: string; reply: string }[] }>(url, { action: 'feedbackStatus', items: asking.map(({ id, key }) => ({ id, key })) }, send)
      if (body.ok && Array.isArray(body.items)) {
        for (const item of body.items) {
          const r = list.find((x) => x.id === item.id)
          if (r) Object.assign(r, { status: item.status, reply: item.reply })
        }
        saveReceipts(list)
      }
    } catch {
      // つながらない：次に開いたときに、また問い合わせる
    }
  }
  return list.filter((r) => !r.dismissed && DONE_STATUSES.includes(r.status ?? ''))
}

/** 知らせを閉じる（もう出さない） */
export function dismissFeedback(id: string): void {
  saveReceipts(loadReceipts().map((r) => (r.id === id ? { ...r, dismissed: true } : r)))
}

// ---- ツールの中で起きたエラー（直前のものを覚え、窓口にも自動で送る） ----

/** 直前に起きたエラー（送る窓の「ツールの中で起きたエラー」に入れる） */
const recent: string[] = []
/** この画面で送ったエラー（同じものは1回だけ。多すぎるときは送らない） */
const sent = new Set<string>()
const SEND_MAX = 10

/** 送らないエラー（ブラウザの拡張機能・よその場所のスクリプト・害のない知らせ） */
export function ignorableError(message: string, stack: string): boolean {
  return /^Script error\.?$/.test(message.trim()) || /ResizeObserver loop|chrome-extension:\/\/|moz-extension:\/\/|safari-(web-)?extension:\/\//.test(`${message}\n${stack}`)
}

export function recentErrors(): string[] {
  return [...recent]
}

/**
 * エラーを見張る（main.tsx から1回）。context：開いていたページなど。url がなければ（開発中）、覚えるだけで送らない
 */
export function watchErrors(context: () => { version: string; device: string; page: string }, url = FEEDBACK_API_URL, send?: typeof fetch): () => void {
  const record = (message: string, stack: string) => {
    if (!message || ignorableError(message, stack)) return
    recent.push(message.slice(0, 300))
    if (recent.length > 5) recent.shift()
    if (!url || sent.has(message) || sent.size >= SEND_MAX) return
    sent.add(message)
    let ctx: { version: string; device: string; page: string }
    try {
      ctx = context()
    } catch {
      ctx = { version: '', device: '', page: '' }
    }
    void post(url, { action: 'errorLog', ...ctx, message: message.slice(0, 500), stack: stack.slice(0, 2000) }, send).catch(() => {})
  }
  const onError = (e: ErrorEvent) => record(e.message || String(e.error ?? ''), e.error instanceof Error ? (e.error.stack ?? '') : `${e.filename}:${e.lineno}`)
  const onRejection = (e: PromiseRejectionEvent) => {
    const reason = e.reason
    record(reason instanceof Error ? reason.message : String(reason ?? ''), reason instanceof Error ? (reason.stack ?? '') : '')
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

// ---- 直前の知らせ（送る窓の「直前に出た知らせ」に入れる。知らせが消えたあとに開いても分かるように） ----

let last = ''
export function rememberNotice(text: string): void {
  if (text) last = text.slice(0, 300)
}
export function lastNotice(): string {
  return last
}
