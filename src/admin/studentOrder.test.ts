import { describe, expect, it } from 'vitest'
import type { StudentEntry } from './server'
import { byKana, comparerFor, isKanaOrder, movedFlags, studentIdLabel } from './studentOrder'

// 名前はすべて作り物
const s = (studentId: string, kana: string, name = studentId, group = ''): StudentEntry => ({ studentId, name, kana, group, moved: false })
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

  it('点検表の並べ方（mockups/v119）：学籍番号順（教職員の試しは後ろ）・所属ごと（登録した順。選んでいない学生は後ろ）', () => {
    const list = [s('00ZZ0131', 'イシダ ハルカ', 'i', '②班'), s('staff:t@example.ac.jp', 'アオキ ミサキ', 'a', '①班'), s('00ZZ0107', 'ウエノ ソラ', 'u', '①班'), s('00ZZ0103', 'エンドウ リコ', 'e', ''), s('00ZZ0112', 'オオタ ユイ', 'o', '②班')]
    expect(ids(byKana(list, comparerFor({ checkById: true })))).toEqual(['00ZZ0103', '00ZZ0107', '00ZZ0112', '00ZZ0131', 'staff:t@example.ac.jp'])
    expect(ids(byKana(list, comparerFor({ groups: ['①班', '②班'] })))).toEqual(['staff:t@example.ac.jp', '00ZZ0107', '00ZZ0131', '00ZZ0112', '00ZZ0103'])
    expect(ids(byKana(list, comparerFor({ groups: ['②班', '①班'], checkById: true })))).toEqual(['00ZZ0112', '00ZZ0131', '00ZZ0107', 'staff:t@example.ac.jp', '00ZZ0103'])
    // 所属の中で動かした学生だけに印
    const sorted = byKana(list, comparerFor({ groups: ['①班', '②班'] }))
    const swapped = [sorted[1], sorted[0], ...sorted.slice(2)]
    expect(movedFlags(swapped, comparerFor({ groups: ['①班', '②班'] })).filter(Boolean)).toHaveLength(1)
    expect(isKanaOrder(sorted, comparerFor({ groups: ['①班', '②班'] }))).toBe(true)
  })

  it('教職員の試しの行は、学籍番号の欄に「試し」', () => {
    expect(studentIdLabel('staff:sensei@example.ac.jp')).toBe('試し')
    expect(studentIdLabel('00ZZ0123')).toBe('00ZZ0123')
  })
})
