import { describe, expect, it } from 'vitest'
import { captionWithoutNumber } from './captionText'

describe('図・表のタイトルに打った番号を外す（captionWithoutNumber）', () => {
  it('「図1 デザイン画」「図１．デザイン画」「表2:使用材料」などは、番号を外す', () => {
    expect(captionWithoutNumber('図', '図1 デザイン画')).toBe('デザイン画')
    expect(captionWithoutNumber('図', '図１．デザイン画')).toBe('デザイン画')
    expect(captionWithoutNumber('図', '図 3　完成写真')).toBe('完成写真')
    expect(captionWithoutNumber('図', '図12デザイン画')).toBe('デザイン画')
    expect(captionWithoutNumber('表', '表2:使用材料')).toBe('使用材料')
    expect(captionWithoutNumber('表', '表1. 使用材料表')).toBe('使用材料表')
    // 番号だけ：空にする（「タイトルを書く」と言われる）
    expect(captionWithoutNumber('図', '図1')).toBe('')
  })

  it('番号のない・ほかの字で始まる・助詞などが続くタイトルは、そのまま', () => {
    expect(captionWithoutNumber('図', 'デザイン画')).toBe('デザイン画')
    expect(captionWithoutNumber('表', '表面加工の様子')).toBe('表面加工の様子')
    expect(captionWithoutNumber('図', '図1に示した型紙')).toBe('図1に示した型紙')
    expect(captionWithoutNumber('図', '図2枚の比較')).toBe('図2枚の比較')
    // 図のタイトルの「表1」は外さない
    expect(captionWithoutNumber('図', '表1 使用材料')).toBe('表1 使用材料')
  })
})
