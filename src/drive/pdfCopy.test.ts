// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { currentConfig } from '../config'
import { createReport } from '../model/newReport'
import { blobToBase64, PdfCopyError, pdfCopyPayload, postPdfCopy, type PdfCopyPayload } from './pdfCopy'

/** base64 を読み戻した中身（1文字が1バイト） */
const decoded = (base64: string) => [...atob(base64)].map((c) => c.charCodeAt(0))
const pdfBlob = (text = 'body') => new Blob([`%PDF-1.4\n${text}\n%%EOF`], { type: 'application/pdf' })

describe('PDF の控えの中身', () => {
  it('base64 にした中身は、元のファイルと同じ（大きいファイルも、少しずつ文字にして同じ）', async () => {
    const bytes = new Uint8Array(200_000).map((_, i) => (i * 7919) % 256)
    const base64 = await blobToBase64(new Blob([bytes]))
    expect(base64).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(decoded(base64)).toEqual([...bytes])
    expect(await blobToBase64(new Blob([]))).toBe('')
  })

  it('原稿の年度・コース・表紙の学籍番号と氏名（前後の空白を除く）と、ログインの許可を入れる', async () => {
    const report = createReport(currentConfig, currentConfig.courses[0].id)
    report.basicInfo = { ...report.basicInfo, studentId: ' 00ZZ0123 ', name: '文化　花子 ' }
    const payload = await pdfCopyPayload('token-1', report, pdfBlob())
    expect({ ...payload, pdf: undefined }).toEqual({ action: 'pdfCopy', token: 'token-1', year: currentConfig.fiscalYear, courseId: currentConfig.courses[0].id, studentId: '00ZZ0123', name: '文化　花子', pdf: undefined })
    expect(atob(payload.pdf)).toBe('%PDF-1.4\nbody\n%%EOF')
  })
})

describe('PDF の控えを送る', () => {
  const payload: PdfCopyPayload = { action: 'pdfCopy', token: 't', year: 2026, courseId: 'c', studentId: '00ZZ0123', name: '文化花子', pdf: 'JVBERg==' }
  const answer = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

  it('JSON を text/plain で1回送る（事前の問い合わせが要らない形。Google の cookie は送らない）', async () => {
    const fetch = vi.fn(async () => answer({ ok: true }))
    await postPdfCopy('https://script.google.com/macros/s/x/exec', payload, { fetch })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://script.google.com/macros/s/x/exec')
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
    expect(JSON.parse(init.body as string)).toEqual(payload)
  })

  const quick = { retryDelaysMs: [0, 0, 0] }

  it('つながらなかったときは、待って送り直す（3回まで。届けば終わり）', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(answer({ ok: true }))
    await postPdfCopy('u', payload, { fetch, ...quick })
    expect(fetch).toHaveBeenCalledTimes(2)
    const never = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(postPdfCopy('u', payload, { fetch: never, ...quick })).rejects.toThrow(new PdfCopyError('Failed to fetch'))
    expect(never).toHaveBeenCalledTimes(4)
  })

  it('混んでいるとき（答えが JSON でない・500・ドライブのエラー）も、送り直す（締切の直前に、学生がいっせいに書き出したとき）', async () => {
    const busy = vi.fn().mockResolvedValueOnce(answer('<html>混んでいます</html>')).mockResolvedValueOnce(answer({ ok: true }, 500)).mockResolvedValueOnce(answer({ ok: false, error: 'PDF の控えを保存できませんでした（ドライブのエラー）' })).mockResolvedValueOnce(answer({ ok: true }))
    await postPdfCopy('u', payload, { fetch: busy, ...quick })
    expect(busy).toHaveBeenCalledTimes(4)
    await expect(postPdfCopy('u', payload, { fetch: vi.fn(async () => answer('<html>')), ...quick })).rejects.toThrow('窓口の答えを読めませんでした')
    await expect(postPdfCopy('u', payload, { fetch: vi.fn(async () => answer({ ok: true }, 500)), ...quick })).rejects.toThrow('500')
  })

  it('送り直すまでの待ちは、少しずつ延ばし、ばらつかせる（学生がいっせいに送り直さないように）', async () => {
    vi.useFakeTimers()
    try {
      const never = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      const done = postPdfCopy('u', payload, { fetch: never, retryDelaysMs: [1000, 2000, 4000], random: () => 1 }).catch((e) => e)
      await vi.advanceTimersByTimeAsync(1499)
      expect(never).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(never).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(3000 + 6000)
      expect(never).toHaveBeenCalledTimes(4)
      expect(await done).toBeInstanceOf(PdfCopyError)
    } finally {
      vi.useRealTimers()
    }
  })

  it('窓口がはっきり断ったとき（フォルダが未設定など）は、送り直さずに理由を投げる', async () => {
    const refused = vi.fn(async () => answer({ ok: false, error: 'PDF の控えを置くフォルダが未設定' }))
    await expect(postPdfCopy('u', payload, { fetch: refused, ...quick })).rejects.toThrow(new PdfCopyError('PDF の控えを置くフォルダが未設定'))
    expect(refused).toHaveBeenCalledTimes(1)
  })
})
