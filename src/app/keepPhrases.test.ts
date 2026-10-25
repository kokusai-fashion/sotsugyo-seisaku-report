import { describe, expect, it } from 'vitest'
import { keepParts } from './keepPhrases'

describe('折り返さないまとまり（keepParts）', () => {
  it('短いかっこ書きと、かぎかっこの語（すぐ後ろの助詞も）をまとめる。つなぐと元の文に戻る', () => {
    const text = '次のページの写真を詰めました（空いたページは消しました）'
    expect(keepParts(text)).toEqual([
      { text: '次のページの写真を詰めました', keep: false },
      { text: '（空いたページは消しました）', keep: true },
    ])
    const detail = '目次と PDF で二重になります。「2.」を消します'
    expect(keepParts(detail).filter((p) => p.keep).map((p) => p.text)).toEqual(['「2.」を'])
    expect(keepParts(detail).map((p) => p.text).join('')).toBe(detail)
    expect(keepParts('「もう1枚」（横に2枚まで）「横に並べる」').map((p) => p.keep)).toEqual([true, true, true])
  })

  it('長いかっこ書き・かぎかっこは、まとめない（狭い画面ではみ出さないように）', () => {
    expect(keepParts('（ログインしたアカウントは 00ZZ0123。読み込んだあと、直してください）').every((p) => !p.keep)).toBe(true)
    expect(keepParts('「とても長いボタンの名前がここに入るときの例」').every((p) => !p.keep)).toBe(true)
  })
})
