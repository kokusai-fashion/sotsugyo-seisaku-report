import type { Course } from '../config'
import type { AbstractGate } from '../layout/document'
import type { Report } from '../model/types'
import { nameParts, namePartsDone } from '../model/personName'

/**
 * 先生の許可の仕組み（点検表）の、学科の窓口とのやりとり（依頼者の選択 2026-11-04。docs/設計_許可の仕組み.md）。
 * 窓口は PDF の控えと同じ（gas/api-project/Code.js の doPost）。誰が送ったかは、ログインの許可（アクセストークン）で窓口が Google に確かめる。
 * - register：学生の名簿に、コースと氏名（姓・名・ふりがな）を入れる。先生の点検表は、この名簿から作る
 * - checkStatus：自分の点検表の行（回ごとの先生と「済み・予定」、抄録の許可、最終提出の許可）を読む。ほかの学生のことは届かない
 * - touchAfterFinal：最終提出の許可のあとに、原稿を書き換えた（点検表の「知らせ」に出る）
 */

export type RoundState = 'done' | 'plan' | ''
export interface CheckRound {
  /** 点検表の列の見出し（「1回目」「抄録」など。コースで違う） */
  label: string
  /** 先生の名字（空なら、まだ決まっていない） */
  teacher: string
  state: RoundState
}
/** 許可が出た日時と先生（先生が分からなければ by は空） */
export interface PermissionMark {
  at: string
  by: string
}
export interface CheckRow {
  rounds: CheckRound[]
  abstractOk: PermissionMark | null
  finalOk: PermissionMark | null
}
export interface CheckStatus {
  /** 点検表の自分の行（点検表がまだない・まだ載っていなければ null） */
  row: CheckRow | null
  /** 窓口に聞いた時刻（ISO） */
  at: string
}

/** 窓口に送る。ok でなければ投げる（理由は error）。Google のログインの情報（cookie）は送らない */
export async function postStudentApi<T>(url: string, payload: Record<string, unknown>, options: { fetch?: typeof fetch } = {}): Promise<T> {
  const send = options.fetch ?? fetch
  const res = await send(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), credentials: 'omit', redirect: 'follow' })
  if (!res.ok) throw new Error(`窓口の答え：${res.status}`)
  const answer = (await res.json()) as T & { ok?: boolean; error?: string }
  if (answer?.ok !== true) throw new Error(answer?.error || '窓口が受け取りませんでした')
  return answer
}

/** 名簿に入れる中身。コースと、氏名の4つの欄がそろっていなければ null（まだ送らない） */
export function registerPayload(token: string, report: Report): Record<string, unknown> | null {
  const b = report.basicInfo
  const parts = nameParts(b)
  if (!b.courseId || !b.studentId.trim() || !namePartsDone(parts)) return null
  // 所属（コースに所属があるときに選ぶ。先生の点検表を所属ごとに並べる：依頼者の選択 2026-11-09 mockups/v119）。選んでいなければ ''
  return { action: 'register', token, year: report.fiscalYear, courseId: b.courseId, studentId: b.studentId.trim(), ...parts, group: b.group ?? '', groupAt: b.group ? (b.groupAt ?? '') : '' }
}

/** 名簿に送った中身が同じかを見る印（変わったときだけ送り直す） */
export function registerKey(report: Report): string {
  const b = report.basicInfo
  const p = nameParts(b)
  return [report.fiscalYear, b.courseId, b.studentId.trim(), p.familyName, p.givenName, p.familyKana, p.givenKana, b.group ?? ''].join('\t')
}

/** 窓口の答えを、学生のツールで使う形にする（形の崩れた答えは、なかったことにする） */
export function readCheckRow(value: unknown): CheckRow | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const mark = (m: unknown): PermissionMark | null => {
    if (!m || typeof m !== 'object') return null
    const at = (m as Record<string, unknown>).at
    const by = (m as Record<string, unknown>).by
    return typeof at === 'string' ? { at, by: typeof by === 'string' ? by : '' } : null
  }
  const rounds = Array.isArray(v.rounds)
    ? v.rounds.flatMap((r): CheckRound[] => {
        if (!r || typeof r !== 'object') return []
        const x = r as Record<string, unknown>
        const state = x.state === 'done' || x.state === 'plan' ? x.state : ''
        return typeof x.label === 'string' ? [{ label: x.label, teacher: typeof x.teacher === 'string' ? x.teacher : '', state }] : []
      })
    : []
  return { rounds, abstractOk: mark(v.abstractOk), finalOk: mark(v.finalOk) }
}

/** 「12/15　小川先生」の形（許可の知らせに添える） */
export function markText(mark: PermissionMark): string {
  const d = new Date(mark.at)
  const date = Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`
  return [date, mark.by ? `${mark.by}先生` : ''].filter(Boolean).join('　')
}

/** 最終提出の許可の状態（PDF の印・ファイル名・PDF の窓の知らせ。mockups/v108 ②） */
export type FinalGate =
  /** 許可を使わないコース（今のまま） */
  | { kind: 'off' }
  /** 許可の前：PDF に「点検用」の印、ファイル名は「〜_点検用.pdf」 */
  | { kind: 'before' }
  /** 許可が出た：印のない提出用の PDF。editedAfter：許可のあとに書き換えた日（M/D。なければ null） */
  | { kind: 'granted'; by: string; editedAfter: string | null }

/** 抄録を書き始める前の案内の形（許可を使わないコースは今のまま、学生が押す） */
export function abstractGateOf(course: Course | undefined, status: CheckStatus | null): AbstractGate {
  if (!course?.permission?.abstract) return { kind: 'self' }
  const ok = status?.row?.abstractOk
  return ok ? { kind: 'granted', by: markText(ok) } : { kind: 'waiting' }
}

/** 最終提出の許可の状態。窓口にまだ聞けていない（ログインしていないなど）ときは、許可の前として扱う */
export function finalGateOf(course: Course | undefined, status: CheckStatus | null, updatedAt: string): FinalGate {
  if (!course?.permission?.final) return { kind: 'off' }
  const ok = status?.row?.finalOk
  if (!ok) return { kind: 'before' }
  const edited = new Date(updatedAt).getTime() > new Date(ok.at).getTime() ? new Date(updatedAt) : null
  return { kind: 'granted', by: markText(ok), editedAfter: edited ? `${edited.getMonth() + 1}/${edited.getDate()}` : null }
}
