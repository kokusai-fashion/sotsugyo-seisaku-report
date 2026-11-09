import { describe, expect, it } from 'vitest'
import { effectiveGroups, leftCount, myBlocks, rotate, roundCell, splitGroups, surnameOf } from './checkView'
import type { CheckStudent, CheckView } from './server'

describe('点検表の画面の計算（checkView.ts。サーバーの roundCell_・effectiveGroups_・splitGroups_ と同じ決め方）', () => {
  it('名字は最初の空白（半角・全角）の前', () => {
    expect(['梶田　貴子', '深沢 祥代', '山本', '  加藤　淳之介 '].map(surnameOf)).toEqual(['梶田', '深沢', '山本', '加藤'])
  })

  it('回の欄：「名字 済み」「名字 予定」。名字だけ・ほかの字は済み。空は空', () => {
    expect(roundCell('梶田 済み')).toEqual({ teacher: '梶田', state: 'done' })
    expect(roundCell('佐藤　予定')).toEqual({ teacher: '佐藤', state: 'plan' })
    expect(roundCell('加藤')).toEqual({ teacher: '加藤', state: 'done' })
    expect(roundCell(true)).toEqual({ teacher: '', state: 'done' })
    expect(roundCell('')).toEqual({ teacher: '', state: '' })
    expect(roundCell(null)).toEqual({ teacher: '', state: '' })
  })

  it('まとまり：所属があれば所属。なければ並び順で等分（2〜6）の 1班〜。どちらでもなければなし', () => {
    expect(effectiveGroups({ groups: ['A', 'B'], checkSplit: 3 })).toEqual(['A', 'B'])
    expect(effectiveGroups({ checkSplit: 3 })).toEqual(['1班', '2班', '3班'])
    expect(effectiveGroups({ checkSplit: 7 })).toEqual([])
    expect(effectiveGroups({})).toEqual([])
  })

  it('等分：割り切れなければ、前の班から1人ずつ多く', () => {
    const list = Array.from({ length: 8 }, (_, i) => ({ id: i, group: '' }))
    expect(splitGroups(list, 3).map((s) => s.group)).toEqual(['1班', '1班', '1班', '2班', '2班', '2班', '3班', '3班'])
    expect(splitGroups(list.slice(0, 2), 3).map((s) => s.group)).toEqual(['1班', '2班'])
  })

  it('1回ずつずらして埋める：1回目に1班の先生は、2回目は2班へ', () => {
    expect(rotate(['1班', '2班', '3班'], ['梶田', '佐藤', '加藤'], 4)).toEqual({
      '1班': ['梶田', '加藤', '佐藤', '梶田'],
      '2班': ['佐藤', '梶田', '加藤', '佐藤'],
      '3班': ['加藤', '佐藤', '梶田', '加藤'],
    })
  })

  it('自分の担当：始まった回の残りは「まだの分」、まだ始まっていない最初の回が「今」、その先は「あと」', () => {
    const st = (key: string, cells: string[]): CheckStudent => ({ key, no: 0, name: key, group: '', pdf: null, note: '', rounds: cells.map(roundCell), abstractOk: false, finalOk: false, kyomu: false })
    const view: CheckView = {
      exists: true,
      rounds: ['1回目', '2回目', '3回目'],
      teachers: ['梶田', '佐藤'],
      groups: [],
      split: 0,
      assignment: null,
      students: [st('a', ['梶田 済み', '佐藤 予定', '梶田 予定']), st('b', ['梶田 予定', '梶田 予定', '佐藤 予定']), st('c', ['佐藤 予定', '梶田 予定', '梶田 予定'])],
    }
    const blocks = myBlocks(view, '梶田')
    expect(blocks.map((b) => [b.label, b.kind, b.list.map((s) => s.key).join('')])).toEqual([
      ['1回目', 'left', 'b'],
      ['2回目', 'now', 'bc'],
      ['3回目', 'later', 'ac'],
    ])
    expect(leftCount(view, '梶田')).toBe(1)
    expect(leftCount(view, '佐藤')).toBe(1)
  })
})
