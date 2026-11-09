import type { Course } from '../config'
import type { CheckRound, CheckStudent, CheckView } from './server'

/**
 * 点検表の画面（依頼者の選択 2026-11-09 mockups/v126）の計算。サーバー（gas/admin-project/Code.js の roundCell_・effectiveGroups_・splitGroups_）と同じ決め方
 */

/** 点検表の画面で、最後に開いたコース（管理者。この端末に覚える） */
export const CHECK_COURSE_KEY = 'sotsugyo-admin-check-course'

/** 点検表に直接入るリンク（?view=check&course=…）から開いたとき：そのコースを開く（管理者） */
export function rememberCheckCourse(id: string): void {
  try {
    localStorage.setItem(CHECK_COURSE_KEY, id)
  } catch {
    // 覚えられなければ、いちばん上のコースから
  }
}

/** 氏名の名字（最初の空白（半角・全角）の前。空白がなければ全部） */
export function surnameOf(name: string): string {
  const text = String(name ?? '').trim()
  const m = /^(\S+)\s/.exec(text)
  return m ? m[1] : text
}

/** 回の欄の中身を読む（「山本 済み」「山本 予定」。名字だけ・ほかの字は済み） */
export function roundCell(value: unknown): CheckRound {
  if (value === true) return { teacher: '', state: 'done' }
  const text = String(value === undefined || value === null || value === false ? '' : value).trim()
  if (!text) return { teacher: '', state: '' }
  const m = /^(.+?)\s+(済み|予定)$/.exec(text)
  if (m) return { teacher: m[1].trim(), state: m[2] === '済み' ? 'done' : 'plan' }
  return { teacher: text, state: 'done' }
}

/** まとまりの名前（所属。所属がなく並び順で等分するコースは 1班〜。どちらでもなければ []） */
export function effectiveGroups(course: Pick<Course, 'groups' | 'checkSplit'>): string[] {
  const groups = (course.groups ?? []).filter((g) => g.trim())
  if (groups.length) return groups
  const n = course.checkSplit ?? 0
  return Number.isInteger(n) && n >= 2 && n <= 6 ? Array.from({ length: n }, (_, i) => `${i + 1}班`) : []
}

/** 並べた学生を、上から n 等分して班を付ける（割り切れなければ、前の班から1人ずつ多く） */
export function splitGroups<T extends { group: string }>(ordered: T[], n: number): T[] {
  const base = Math.floor(ordered.length / n)
  const extra = ordered.length % n
  const out: T[] = []
  let at = 0
  for (let k = 0; k < n; k++) {
    const size = base + (k < extra ? 1 : 0)
    for (let j = 0; j < size; j++) out.push({ ...ordered[at++], group: `${k + 1}班` })
  }
  return out
}

/** その回が始まっているか（だれか1人でも「済み」になっている） */
export function roundStarted(view: CheckView, r: number): boolean {
  return view.students.some((s) => s.rounds[r]?.state === 'done')
}

/** その回で済んだ人数（list：数える学生） */
export function doneCount(list: CheckStudent[], r: number): number {
  return list.filter((s) => s.rounds[r]?.state === 'done').length
}

/** その回で、その先生の担当の学生 */
export function assigned(view: CheckView, r: number, teacher: string): CheckStudent[] {
  return view.students.filter((s) => s.rounds[r]?.teacher === teacher)
}

/**
 * 自分の担当で、まだ済んでいないもの（回ごと）。kind：left＝始まっている回の残り、now＝まだ始まっていない最初の回、later＝その先の回（たたむ）
 */
export function myBlocks(view: CheckView, me: string): { r: number; label: string; kind: 'left' | 'now' | 'later'; list: CheckStudent[] }[] {
  const firstUpcoming = view.rounds.findIndex((_, r) => !roundStarted(view, r))
  return view.rounds
    .map((label, r) => {
      const list = view.students.filter((s) => s.rounds[r]?.teacher === me && s.rounds[r]?.state !== 'done')
      const kind: 'left' | 'now' | 'later' = roundStarted(view, r) ? 'left' : r === firstUpcoming ? 'now' : 'later'
      return { r, label, kind, list }
    })
    .filter((b) => b.list.length > 0)
}

/** 前の回で、まだ済んでいない自分の担当の人数（「まだの分」の数） */
export function leftCount(view: CheckView, me: string): number {
  return myBlocks(view, me)
    .filter((b) => b.kind === 'left')
    .reduce((n, b) => n + b.list.length, 0)
}

/**
 * 「1回ずつずらして埋める」：1回目の割り振りから、2回目からは1つずつずらして回す（1回目に1班の先生は、2回目は2班へ）。
 * groups：まとまりの並び。first：1回目の先生（まとまりごと）。rounds：回の数
 */
export function rotate(groups: string[], first: string[], rounds: number): Record<string, string[]> {
  const n = groups.length
  const out: Record<string, string[]> = {}
  groups.forEach((g, i) => {
    out[g] = Array.from({ length: rounds }, (_, r) => first[(((i - r) % n) + n) % n] ?? '')
  })
  return out
}
