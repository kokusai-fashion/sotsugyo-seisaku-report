import { describe, expect, it } from 'vitest'
import type { StudentEntry } from './server'
import { byKana, isKanaOrder, movedFlags, studentIdLabel } from './studentOrder'

// 名前はすべて作り物
const s = (studentId: string, kana: string, name = studentId): StudentEntry => ({ studentId, name, kana, moved: false })
const ids = (list: StudentEntry[]) => list.map((x) => x.studentId)

describe('学生の並び（mockups/v103 案1）', () => {
  it('ふりがなの順（ひらがな・カタカナ・半角カナは同じ。セイが同じならメイ。ふりがなのない学生は後ろ）', () => {
    expect(ids(byKana([s('c', 'ウエノ ソラ'), s('x', ''), s('a2', 'アオキ ミサキ'), s('a1', 'あおき あや'), s('b', 'ｲｼﾀﾞ ﾊﾙｶ')]))).toEqual(['a1', 'a2', 'b', 'c', 'x'])
  })

  it('手で動かした学生だけに印（ほかの学生は、ずれてもふりがなの順のまま）', () => {
    const list = [s('a', 'アオキ ミサキ'), s('b', 'イシダ ハルカ'), s('h', 'ブンカ ハナコ'), s('c', 'ウエノ ソラ'), s('d', 'エンドウ リコ')]
    expect(movedFlags(list)).toEqual([false, false, true, false, false])
    expect(isKanaOrder(list)).toBe(false)
    expect(movedFlags(byKana(list))).toEqual([false, false, false, false, false])
    expect(isKanaOrder(byKana(list))).toBe(true)
    expect(movedFlags([])).toEqual([])
  })

  it('教職員の試しの行は、学籍番号の欄に「試し」', () => {
    expect(studentIdLabel('staff:sensei@example.ac.jp')).toBe('試し')
    expect(studentIdLabel('00ZZ0123')).toBe('00ZZ0123')
  })
})
