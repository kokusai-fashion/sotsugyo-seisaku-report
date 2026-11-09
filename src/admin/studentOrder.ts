import type { Course } from '../config'
import type { StudentEntry } from './server'

/** 2人の学生の比べ方（前なら負） */
export type CompareStudents = (a: StudentEntry, b: StudentEntry) => number

/**
 * 「学生の並びを直す」の窓（mockups/v103 案1。依頼者の選択 2026-11-04）の並びの決め方。
 * サーバー（gas/admin-project/Code.js の kanaKey_・compareStudents_・movedFlags_）と同じ決め方にする
 */

/** ふりがなを比べる形（ひらがなはカタカナに、半角カナは全角に。続く空白は1つに） */
function kanaKey(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .replace(/\s+/g, ' ')
    .trim()
}

/** 「セイ メイ」を、セイとメイに分ける（最初の空白で） */
function splitKana(kana: string): [string, string] {
  const text = kanaKey(kana)
  const i = text.indexOf(' ')
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)]
}

/** ふりがなの順に比べる（セイ → メイ → 氏名 → 学籍番号。ふりがなのない学生は後ろ） */
export function compareStudents(a: StudentEntry, b: StudentEntry): number {
  const [fa, ga] = splitKana(a.kana)
  const [fb, gb] = splitKana(b.kana)
  if (!fa !== !fb) return fa ? -1 : 1
  return fa.localeCompare(fb, 'ja') || ga.localeCompare(gb, 'ja') || a.name.localeCompare(b.name, 'ja') || (a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0)
}

/** 学籍番号の順に比べる（学籍番号が同じことはないが、念のため、ふりがなの順で。教職員の試しの行は後ろ） */
export function compareById(a: StudentEntry, b: StudentEntry): number {
  const staff = (s: StudentEntry) => (s.studentId.startsWith('staff:') ? 1 : 0)
  return staff(a) - staff(b) || (a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0) || compareStudents(a, b)
}

/**
 * コースの点検表の並べ方（依頼者の選択 2026-11-09 mockups/v119）：所属があれば所属ごと（先生が登録した順。所属を選んでいない学生は後ろ）、
 * その中は五十音順（ふりがなの順）か学籍番号順。サーバー（gas/admin-project/Code.js の comparerFor_）と同じ決め方
 */
export function comparerFor(course: Pick<Course, 'groups' | 'checkById'> | undefined): CompareStudents {
  const groups = course?.groups ?? []
  const inner = course?.checkById ? compareById : compareStudents
  if (!groups.length) return inner
  const rank = (s: StudentEntry) => {
    const i = groups.indexOf(s.group)
    return i < 0 ? groups.length : i
  }
  return (a, b) => rank(a) - rank(b) || inner(a, b)
}

/**
 * 「手で動かした」学生：決まった順（compare。はじめはふりがなの順）に並んでいる、いちばん長いつながりに入らない学生。
 * 1人を動かすと、その1人だけに印が付く（ほかの学生は、ずれても決まった順のまま）
 */
export function movedFlags(list: StudentEntry[], compare: CompareStudents = compareStudents): boolean[] {
  const len = list.map(() => 1)
  const prev = list.map(() => -1)
  for (let i = 0; i < list.length; i++) {
    for (let j = 0; j < i; j++) {
      if (compare(list[j], list[i]) <= 0 && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1
        prev[i] = j
      }
    }
  }
  let best = -1
  for (let i = 0; i < list.length; i++) if (best < 0 || len[i] > len[best]) best = i
  const keep = list.map(() => false)
  for (let i = best; i >= 0; i = prev[i]) keep[i] = true
  return keep.map((k) => !k)
}

/** 決まった順（compare。はじめはふりがなの順）に並べ直した一覧（「五十音順に戻す」「学籍番号順に戻す」） */
export function byKana(list: StudentEntry[], compare: CompareStudents = compareStudents): StudentEntry[] {
  return [...list].sort(compare)
}

/** ふりがなの順のままか（このときは、名簿の並びを空にして保存する：あとから来た学生も、ふりがなの所に入る） */
export function isKanaOrder(list: StudentEntry[], compare: CompareStudents = compareStudents): boolean {
  return list.every((s, i) => i === 0 || compare(list[i - 1], s) <= 0)
}

/** 学籍番号の欄の字（教職員の試しの行は「試し」） */
export function studentIdLabel(id: string): string {
  return id.startsWith('staff:') ? '試し' : id
}
