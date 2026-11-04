import { useCallback, useEffect, useRef, useState } from 'react'
import { postStudentApi, readCheckRow, registerKey, registerPayload, type CheckStatus } from '../drive/checkStatus'
import type { DriveSync } from '../drive/driveSync'
import { scoped } from '../model/scope'
import type { Report } from '../model/types'

/** 送り先：年度の設定・PDF の控えと同じ、学科の Apps Script の窓口 */
const API_URL = import.meta.env.VITE_CONFIG_API_URL as string | undefined

/** 開いたままのタブで、点検表を読み直す間（ほかのタブから戻ってきたとき。先生が点検表を書いたのを拾う） */
const STALE_MS = 10 * 60 * 1000

const statusKey = (report: Report) => scoped(`sotsugyo-seisaku-report-check-status:${report.fiscalYear}:${report.basicInfo.studentId.trim()}`)
const registeredKey = () => scoped('sotsugyo-seisaku-report-check-registered')
const touchedKey = () => scoped('sotsugyo-seisaku-report-check-touched')

function readCache(report: Report): CheckStatus | null {
  try {
    const raw = localStorage.getItem(statusKey(report))
    if (!raw) return null
    const v = JSON.parse(raw) as { row?: unknown; at?: unknown }
    return typeof v.at === 'string' ? { row: readCheckRow(v.row), at: v.at } : null
  } catch {
    return null
  }
}

/**
 * 先生の許可の仕組み（点検表）の、自分の行を読む（依頼者の選択 2026-11-04。docs/設計_許可の仕組み.md）。
 * - ログインして使っているときだけ聞く（この端末だけに保存するとき・?nodrive・ドライブ保存を止めているときは聞かない。前の答えを使う）
 * - 開いたとき（ログインできたとき）・学籍番号やコースが変わったとき・「確かめ直す」・ほかのタブから10分以上たって戻ったときに読み直す
 * - 学生の名簿：コースと氏名の4つの欄がそろったとき・変わったときに入れる（先生の点検表は、この名簿から作る）
 * - 最終提出の許可のあとに原稿を書き換えたら、1日1回まで知らせる（点検表の「知らせ」に出る）
 * 答えはこの端末に覚えておく（つながらないときは前の答え）
 */
export function useCheckStatus(drive: DriveSync | null, signedIn: boolean, enabled: boolean, report: Report | null) {
  const [status, setStatus] = useState<CheckStatus | null>(() => (report ? readCache(report) : null))
  const reportRef = useRef(report)
  useEffect(() => {
    reportRef.current = report
  })
  const ready = !!drive && signedIn && enabled && !!API_URL
  const who = report ? `${report.fiscalYear}:${report.basicInfo.studentId.trim()}:${report.basicInfo.courseId}` : ''

  // 学籍番号が変わったら、その学生の前の答えに替える
  useEffect(() => {
    if (reportRef.current) setStatus(readCache(reportRef.current))
  }, [who])

  /** 窓口に聞く。答えられなかったら null（前の答えのまま） */
  const refresh = useCallback(async (): Promise<CheckStatus | null> => {
    const r = reportRef.current
    if (!ready || !drive || !API_URL || !r || !r.basicInfo.studentId.trim()) return null
    const token = await drive.copyToken()
    if (!token) return null
    try {
      const answer = await postStudentApi<{ row?: unknown }>(API_URL, { action: 'checkStatus', token: token.accessToken, year: r.fiscalYear, studentId: r.basicInfo.studentId.trim() })
      const next = { row: readCheckRow(answer.row), at: new Date().toISOString() }
      setStatus(next)
      try {
        localStorage.setItem(statusKey(r), JSON.stringify(next))
      } catch {
        // 覚えられなくても、今の画面では使える
      }
      return next
    } catch (e) {
      console.warn('点検表を読めませんでした：', e instanceof Error ? e.message : e)
      return null
    }
  }, [ready, drive])

  // 開いたとき（ログインできたとき）・学生やコースが変わったとき
  useEffect(() => {
    if (ready && who) void refresh()
  }, [ready, who, refresh])

  // ほかのタブ・アプリから戻ってきたとき（前に聞いてから10分以上）
  useEffect(() => {
    if (!ready) return
    const back = () => {
      if (document.visibilityState !== 'visible') return
      const r = reportRef.current
      const last = r ? readCache(r)?.at : undefined
      if (!last || Date.now() - new Date(last).getTime() > STALE_MS) void refresh()
    }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [ready, refresh])

  // 学生の名簿に入れる（コースと氏名の4つの欄がそろったとき・変わったとき）
  const nameKey = report ? registerKey(report) : ''
  useEffect(() => {
    const r = reportRef.current
    if (!ready || !drive || !API_URL || !r) return
    let sent = ''
    try {
      sent = localStorage.getItem(registeredKey()) ?? ''
    } catch {
      // 覚えていなければ、送り直す
    }
    if (sent === nameKey) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const token = await drive.copyToken()
      const payload = token && reportRef.current ? registerPayload(token.accessToken, reportRef.current) : null
      if (!payload || cancelled) return
      try {
        await postStudentApi(API_URL, payload)
        localStorage.setItem(registeredKey(), nameKey)
        // 名簿に入ったら、点検表の行も読み直す（点検表に載るのは、管理側の仕掛けが写したあと）
        void refresh()
      } catch (e) {
        console.warn('学生の名簿に入れられませんでした：', e instanceof Error ? e.message : e)
      }
    }, 1500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ready, drive, nameKey, refresh])

  // 最終提出の許可のあとに書き換えた：1日1回まで知らせる
  const finalAt = status?.row?.finalOk?.at ?? ''
  const updatedAt = report?.updatedAt ?? ''
  useEffect(() => {
    const r = reportRef.current
    if (!ready || !drive || !API_URL || !r || !finalAt || !updatedAt) return
    if (new Date(updatedAt).getTime() <= new Date(finalAt).getTime()) return
    const today = new Date().toDateString()
    try {
      if (localStorage.getItem(touchedKey()) === today) return
    } catch {
      return
    }
    void (async () => {
      const token = await drive.copyToken()
      if (!token) return
      try {
        await postStudentApi(API_URL, { action: 'touchAfterFinal', token: token.accessToken, year: r.fiscalYear, studentId: r.basicInfo.studentId.trim(), at: updatedAt })
        localStorage.setItem(touchedKey(), today)
      } catch (e) {
        console.warn('書き換えたことを知らせられませんでした：', e instanceof Error ? e.message : e)
      }
    })()
  }, [ready, drive, finalAt, updatedAt])

  return { status, refresh, ready }
}
