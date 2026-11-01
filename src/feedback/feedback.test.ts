import { describe, expect, it } from 'vitest'
import { deviceText, ignorableError, summaryOf } from './feedback'

describe('困ったこと・おかしいことを知らせる', () => {
  it('端末の説明は、画面の種類・OS・ブラウザ・画面の大きさだけ', () => {
    expect(deviceText('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', false, 1440, 900)).toBe('パソコンの画面・Windows・Chrome（画面 1440×900）')
    expect(deviceText('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', true, 390, 844)).toBe('スマホの画面・iPhone・Safari（画面 390×844）')
    expect(deviceText('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0', false, 1366, 768)).toContain('Edge')
  })
  it('書いた内容のはじめ（知らせに出す）は 24字まで', () => {
    expect(summaryOf('表の写真の入れ方が分かりません')).toBe('表の写真の入れ方が分かりません')
    expect(summaryOf('あ'.repeat(30))).toBe(`${'あ'.repeat(24)}…`)
    expect(summaryOf(' 改行\nあり ')).toBe('改行 あり')
  })
  it('中身の分からないエラー・拡張機能のエラー・害のない知らせは送らない', () => {
    expect(ignorableError('Script error.', '')).toBe(true)
    expect(ignorableError('ResizeObserver loop completed with undelivered notifications.', '')).toBe(true)
    expect(ignorableError('x is undefined', 'at f (chrome-extension://abc/x.js:1:1)')).toBe(true)
    expect(ignorableError('TypeError: a is null', 'at render (index-abc.js:1:2)')).toBe(false)
  })
})
