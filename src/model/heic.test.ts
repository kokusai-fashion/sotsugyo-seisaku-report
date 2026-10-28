import { describe, expect, it } from 'vitest'
import { isHeif } from './heic'

const fs: { readFileSync(p: string): Uint8Array } = await import(/* @vite-ignore */ `node:${'fs'}`)

describe('HEIC のファイルか（中身の頭で見る）', () => {
  it('HEIC は true。JPEG・短いファイル・AVIF ではない ftyp は false', async () => {
    const heic = fs.readFileSync('scripts/e2e/fixtures/photo.heic')
    expect(await isHeif(new Blob([heic.slice()]))).toBe(true)
    const ftyp = (brand: string) => new Blob([new Uint8Array([0, 0, 0, 24]), new TextEncoder().encode(`ftyp${brand}`)])
    expect(await isHeif(ftyp('mif1'))).toBe(true)
    expect(await isHeif(ftyp('avif'))).toBe(false)
    expect(await isHeif(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1])]))).toBe(false)
    expect(await isHeif(new Blob([new Uint8Array([0, 0, 0])]))).toBe(false)
  })
})
