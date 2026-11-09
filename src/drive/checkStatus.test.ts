import { describe, expect, it } from 'vitest'
import type { Course } from '../config'
import type { Report } from '../model/types'
import { abstractGateOf, finalGateOf, markText, readCheckRow, registerKey, registerPayload } from './checkStatus'

const course = (permission?: Course['permission']): Course => ({ id: 'c1', name: 'テスト', advisors: [], subtitleTemplate: '{input}', ...(permission ? { permission } : {}) })
const status = (row: unknown) => ({ row: readCheckRow(row), at: '2027-01-14T00:00:00Z' })

describe('先生の許可の仕組み（点検表）', () => {
  it('窓口の答えを読む（形の崩れたものは捨てる）', () => {
    const row = readCheckRow({
      rounds: [{ label: '1回目', teacher: '山本', state: 'done' }, { label: '抄録', teacher: '小川', state: 'plan' }, { label: 3 }, { label: '4回目', state: 'x' }],
      abstractOk: { at: '2026-12-15T01:00:00Z', by: '小川' },
      finalOk: { by: '山本' },
    })
    expect(row).toEqual({
      rounds: [
        { label: '1回目', teacher: '山本', state: 'done' },
        { label: '抄録', teacher: '小川', state: 'plan' },
        { label: '4回目', teacher: '', state: '' },
      ],
      abstractOk: { at: '2026-12-15T01:00:00Z', by: '小川' },
      finalOk: null,
    })
    expect(readCheckRow(null)).toBeNull()
    expect(readCheckRow('x')).toBeNull()
  })

  it('許可の日付と先生（「12/15　小川先生」）', () => {
    expect(markText({ at: '2026-12-15T10:00:00+09:00', by: '小川' })).toBe('12/15　小川先生')
    expect(markText({ at: '2026-12-15T10:00:00+09:00', by: '' })).toBe('12/15')
  })

  it('抄録：許可を使わないコースは今のまま、使うコースは許可を待つ・許可が出た', () => {
    expect(abstractGateOf(course(), null)).toEqual({ kind: 'self' })
    expect(abstractGateOf(course({ abstract: true }), null)).toEqual({ kind: 'waiting' })
    expect(abstractGateOf(course({ abstract: true }), status({ rounds: [] }))).toEqual({ kind: 'waiting' })
    expect(abstractGateOf(course({ abstract: true }), status({ rounds: [], abstractOk: { at: '2026-12-15T10:00:00+09:00', by: '小川' } }))).toEqual({ kind: 'granted', by: '12/15　小川先生' })
  })

  it('最終提出：許可の前は点検用、許可のあとは提出用（そのあとに書き換えた日も）', () => {
    const ok = { rounds: [], finalOk: { at: '2027-01-13T10:00:00+09:00', by: '山本' } }
    expect(finalGateOf(course(), null, '2027-01-14T00:00:00Z')).toEqual({ kind: 'off' })
    expect(finalGateOf(course({ final: true }), null, '2027-01-14T00:00:00Z')).toEqual({ kind: 'before' })
    expect(finalGateOf(course({ final: true }), status(ok), '2027-01-13T00:00:00Z')).toEqual({ kind: 'granted', by: '1/13　山本先生', editedAfter: null })
    expect(finalGateOf(course({ final: true }), status(ok), '2027-01-14T12:00:00+09:00')).toEqual({ kind: 'granted', by: '1/13　山本先生', editedAfter: '1/14' })
  })

  it('学生の名簿：コースと氏名の4つの欄がそろうまで送らない。変わったら送り直す', () => {
    const r = { formatVersion: 2, fiscalYear: 2026, basicInfo: { studentId: '', name: '', courseId: 'c1', subtitleInput: '' }, abstract: { paragraphs: [] }, body: [], references: [], workPhotos: [], updatedAt: '' } as Report
    expect(registerPayload('t', r)).toBeNull()
    const named = { ...r, basicInfo: { ...r.basicInfo, studentId: '00ZZ0123', name: '文化　花子', familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ' } }
    expect(registerPayload('t', named)).toMatchObject({ action: 'register', courseId: 'c1', studentId: '00ZZ0123', familyKana: 'ブンカ', givenKana: 'ハナコ' })
    const renamed = { ...named, basicInfo: { ...named.basicInfo, familyKana: 'ブンカン' } }
    expect(registerKey(renamed)).not.toBe(registerKey(named))
    // 所属（mockups/v119）：所属と決めた日時を送る。所属を変えたら送り直す
    const grouped = { ...named, basicInfo: { ...named.basicInfo, group: '①班', groupAt: '2026-11-09T00:00:00.000Z' } }
    expect(registerPayload('t', named)).toMatchObject({ group: '', groupAt: '' })
    expect(registerPayload('t', grouped)).toMatchObject({ group: '①班', groupAt: '2026-11-09T00:00:00.000Z' })
    expect(registerKey(grouped)).not.toBe(registerKey(named))
  })
})
