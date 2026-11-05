import type { Report } from '../model/types'

/**
 * 書き出した PDF の控えを、先生のドライブのフォルダ（学科の Apps Script「卒業制作報告書_配信」が置く。学生からは見えない）に送る。
 * 学生が「PDFを書き出す」で PDF を作るたびに、同じ PDF を後ろで送る（学生の画面には何も出さない。決まったこと。送れなかったら、開発ツールのコンソールにだけ書く）。
 * - 送り先は年度の設定と同じ窓口（VITE_CONFIG_API_URL）。中身は JSON を text/plain で送る（ブラウザの事前の問い合わせ（CORS の preflight）が要らない形）
 * - 誰が送ったかは、ログインの許可（アクセストークン）で窓口が Google に確かめる（gas/api-project/Code.js の doPost）
 * - フォルダには、学生ごとに1つのファイル（送るたびに中身を新しくする。前の版はドライブの「版の管理」に残る）
 */

/** 窓口が受け取る形（gas/api-project/Code.js の pdfCopy_） */
export interface PdfCopyPayload {
  action: 'pdfCopy'
  /** ログインの許可（アクセストークン）。窓口が Google に確かめるだけで、保存しない */
  token: string
  /** 原稿の年度 */
  year: number
  courseId: string
  /** 表紙の学籍番号（学生のアカウントなら、窓口がアカウントの学籍番号と同じかを確かめる） */
  studentId: string
  /** 表紙の氏名（ファイル名では、空白を詰める） */
  name: string
  /** PDF の中身（base64） */
  pdf: string
}

/** 送れる PDF の大きさの上限（窓口の上限と同じ 40MB。ふつうは数 MB） */
export const PDF_COPY_MAX_BYTES = 40 * 1024 * 1024

/** ファイルの中身を base64 の文字にする（少しずつ文字にして、大きな PDF でも止まらないように） */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunks: string[] = []
  const size = 0x8000
  for (let i = 0; i < bytes.length; i += size) chunks.push(String.fromCharCode(...bytes.subarray(i, i + size)))
  return btoa(chunks.join(''))
}

/** 窓口に送る中身を作る（原稿の年度・コース・表紙の学籍番号と氏名、PDF） */
export async function pdfCopyPayload(token: string, report: Report, pdf: Blob): Promise<PdfCopyPayload> {
  const { courseId, studentId, name } = report.basicInfo
  return { action: 'pdfCopy', token, year: report.fiscalYear, courseId: courseId ?? '', studentId: studentId.trim(), name: name.trim(), pdf: await blobToBase64(pdf) }
}

/** 送れなかった（窓口が断った・送り直しても届かなかった）。理由は message */
export class PdfCopyError extends Error {}

/** 送り直せば届くかもしれない失敗（つながらない・窓口が混んで別の答えを返した・ドライブの一時的なエラー） */
class Transient extends Error {}

/**
 * 混んでいる・つながらないときに送り直すまでの待ち時間（ミリ秒）。窓口の Apps Script は、同時に動けるのが持ち主のアカウント1つにつき30まで
 * なので、締切の直前に学生がいっせいに書き出すと断られることがある（前は、つながらなかったときに1回やり直すだけで、断られた控えは届かなかった）。
 * 待ちを少しずつ延ばし、ばらつき（JITTER）を足して、学生がいっせいに送り直さないようにする
 */
const RETRY_DELAYS_MS = [3000, 10000, 30000]
/** 待ち時間に足すばらつき（待ち時間の 0〜50%） */
const JITTER = 0.5

/**
 * 窓口に送る。送り直せば届くかもしれない失敗（Transient）は、待って送り直す（RETRY_DELAYS_MS の回数まで）。
 * 窓口がはっきり断ったとき（フォルダが未設定・大きすぎるなど）は送り直さない。届かなければ PdfCopyError を投げる（理由は message）。
 * Google のログインの情報（cookie）は送らない（誰かは、トークンで確かめる）
 */
export async function postPdfCopy(url: string, payload: PdfCopyPayload, options: { fetch?: typeof fetch; retryDelaysMs?: number[]; random?: () => number } = {}): Promise<void> {
  const send = options.fetch ?? fetch
  const delays = options.retryDelaysMs ?? RETRY_DELAYS_MS
  const random = options.random ?? Math.random
  const body = JSON.stringify(payload)
  const once = async (): Promise<void> => {
    let res: Response
    try {
      res = await send(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, credentials: 'omit', redirect: 'follow' })
    } catch (e) {
      throw new Transient(e instanceof Error ? e.message : String(e))
    }
    if (!res.ok) throw new Transient(`窓口の答え：${res.status}`)
    let answer: { ok?: boolean; error?: string }
    try {
      answer = await res.json()
    } catch {
      // 混んでいるときの Apps Script は、JSON ではなく案内の画面（HTML）を返す
      throw new Transient('窓口の答えを読めませんでした')
    }
    if (answer?.ok === true) return
    const reason = answer?.error || '窓口が受け取りませんでした'
    // ドライブの思いがけないエラー（混んでいるときにも出る）は送り直す。ほかの断りは、送り直しても変わらない
    if (reason.includes('ドライブのエラー')) throw new Transient(reason)
    throw new PdfCopyError(reason)
  }
  for (let attempt = 0; ; attempt++) {
    try {
      return await once()
    } catch (e) {
      if (!(e instanceof Transient)) throw e
      if (attempt >= delays.length) throw new PdfCopyError(e.message)
      await new Promise((resolve) => setTimeout(resolve, delays[attempt] * (1 + JITTER * random())))
    }
  }
}
