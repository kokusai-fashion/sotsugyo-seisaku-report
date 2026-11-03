import { describe, expect, it } from 'vitest'
import { buildBodyDocument, figureBoxSize } from '../layout/bodyHtml'
import { migrateReport } from '../model/migrate'
import { trimPhoto } from '../model/photos'
import { demoReport } from '../model/demoReport'
import { largestRect, photoRect, photoTrim } from './TrimDialog'

describe('トリミングの窓の計算（mockups/v94 案2）', () => {
  it('写真の中に入る、決めた形のいちばん大きい枠（割合）', () => {
    // 横長 4:3 の写真に、縦長 3:4 の枠：幅は (3/4)/(4/3) = 0.5625、高さ 1
    const r = largestRect(4 / 3, 3 / 4)
    expect(r.w).toBeCloseTo(0.5625, 4)
    expect(r.h).toBe(1)
    expect(r.x).toBeCloseTo((1 - 0.5625) / 2, 4)
    // 写真と同じ形なら全体
    expect(largestRect(4 / 3, 4 / 3)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })

  it('作品写真：枠（割合）と、中心の位置・倍率は、行き来しても同じ', () => {
    const trim = { x: 30, y: 70, zoom: 2 }
    const back = photoTrim(3 / 4, 1, photoRect(3 / 4, 1, trim))
    expect(back.x).toBeCloseTo(30, 0)
    expect(back.y).toBeCloseTo(70, 0)
    expect(back.zoom).toBeCloseTo(2, 2)
    // 等倍・中央なら倍率は付けない
    expect(photoTrim(3 / 4, 1, photoRect(3 / 4, 1, null))).toEqual({ x: 50, y: 50 })
  })
})

describe('紙面：トリミングした図・作品写真', () => {
  const size = { widthMm: 80, heightMm: 60 }
  it('本文の図は、範囲の形の枠になり、長い方の辺は全体のときと同じ', () => {
    // 4:3 の写真の左右を切って、縦長（範囲 0.5625×1）にした → 紙面の形は 3:4（縦 80mm、横 60mm）
    expect(figureBoxSize({ id: 'f', imageId: 'i', caption: '', crop: { x: 0.2, y: 0, w: 0.5625, h: 1 } }, { figureSize: () => size })).toEqual({ widthMm: 60, heightMm: 80 })
    expect(figureBoxSize({ id: 'f', imageId: 'i', caption: '' }, { figureSize: () => size })).toEqual(size)
  })

  it('本文の図は、枠（.fig-crop）の中に写真の全体を大きくして置く', () => {
    const chapters = [{ id: 'c', title: '企画', blocks: [{ type: 'figureRow' as const, id: 'r', figures: [{ id: 'f', imageId: 'i', caption: 'デザイン画', crop: { x: 0.25, y: 0, w: 0.5, h: 1 } }] }] }]
    const html = buildBodyDocument(chapters, { imageSrc: () => 'img/i', figureSize: () => size })
    expect(html).toContain('<span class="fig-crop" style="width:')
    expect(html).toMatch(/<img src="img\/i" style="width:[\d.]+mm;height:[\d.]+mm;left:-[\d.]+mm;top:0mm" alt="">/)
  })

  it('作品写真：トリミングは中心の位置と倍率で持ち、「全体を入れる」は外す', () => {
    const page = { layout: 1 as const, imageIds: ['a'], whole: [true] }
    const trimmed = trimPhoto(page, 0, { x: 40, y: 60, zoom: 1.8 })
    expect(trimmed.positions?.[0]).toEqual({ x: 40, y: 60, zoom: 1.8 })
    expect(trimmed.whole).toBeUndefined()
    expect(trimPhoto(trimmed, 0, null).positions?.[0]).toBeNull()
  })

  it('前の版から読み込んでも、図のトリミングと写真の倍率は残る（おかしな値は捨てる）', () => {
    const r = demoReport()
    const raw = JSON.parse(JSON.stringify({
      ...r,
      body: [{ id: 'c', title: '企画', blocks: [{ type: 'figureRow', id: 'r', figures: [{ id: 'f', imageId: 'i', caption: '', crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 } }, { id: 'g', imageId: 'j', caption: '', crop: { x: 0.8, y: 0, w: 0.5, h: 1 } }] }] }],
      workPhotos: [{ layout: 1, imageIds: ['a'], positions: [{ x: 40, y: 60, zoom: 1.8 }] }],
    }))
    const m = migrateReport(raw)
    const figs = m.body[0].blocks[0].type === 'figureRow' ? m.body[0].blocks[0].figures : []
    expect(figs[0].crop).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.6 })
    expect(figs[1].crop).toBeUndefined()
    expect(m.workPhotos[0].positions?.[0]).toEqual({ x: 40, y: 60, zoom: 1.8 })
  })
})
