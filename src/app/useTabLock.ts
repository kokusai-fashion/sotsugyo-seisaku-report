import { useEffect, useRef, useState } from 'react'
import { scoped } from '../model/scope'

/**
 * 同じパソコンで、ツールを2つのタブ（窓）で開いたときに、書けるタブを1つにする（mockups/v22 ③ 案A）。
 * 2つのタブで同じ原稿を書くと、後から保存した方が残り、新しく書いた内容が消えることがあるため。
 * ブラウザの「ロック」（Web Locks）を、書いているタブが持ち続ける。後から開いたタブは持てないので、書けない窓を出す。
 * 「こちらで続ける」を押すと、ロックを取り上げ（もう一方は書けない窓になり、書いた内容を保存する）、読み込み直して続ける。
 */

const LOCK_NAME = scoped('sotsugyo-seisaku-report-writer')
/** 空いたロックを取りに行くまで待つ時間（書いていたタブが読み込み直しているなら、その間にまた持つ） */
const RELOAD_GRACE_MS = 1500

/** このタブで書けるか。onLost：ほかのタブに取り上げられたとき（送っていない変更を保存する） */
export function useTabLock(onLost: () => void): { locked: boolean; takeOver: () => void } {
  const [locked, setLocked] = useState(false)
  const lost = useRef(onLost)
  /** ロックが空くのを待っている（「こちらで続ける」では、待つのをやめてから取り上げる） */
  const waitingRef = useRef<AbortController | null>(null)
  useEffect(() => {
    lost.current = onLost
  })
  useEffect(() => {
    if (!navigator.locks) return
    const locks = navigator.locks
    let release: (() => void) | undefined
    const waiting = new AbortController()
    waitingRef.current = waiting
    locks
      .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (!lock) {
          setLocked(true)
          // もう一方のタブが閉じたら（ロックが空いたら）、読み込み直して、このタブで書く（このタブでは書いていないので、読み込み直しても消えるものはない）。
          // タブを閉じてすぐ開き直すと、前のタブがまだ閉じ終わっておらず、ほかのタブがないのに書けない窓が出たまま消えなかった（学生の試し 4回目 2026-10-30）
          // 空いても、書いていたタブが読み込み直しただけなら、すぐまた持つ。少し待って、まだ空いていたら読み込み直す
          // （空いたとたんに読み込み直すと、読み込み直したタブより先にこちらが持ち、使っていたタブが書けない窓になった：学生の試し 5回目 2026-10-30）
          const waitThenTake = () => {
            locks
              .request(LOCK_NAME, { signal: waiting.signal }, () => undefined)
              .then(() => {
                if (waiting.signal.aborted) return
                window.setTimeout(() => {
                  if (waiting.signal.aborted) return
                  void locks.request(LOCK_NAME, { ifAvailable: true }, (free) => {
                    if (!free) return waitThenTake()
                    location.reload()
                    return new Promise<void>(() => {})
                  })
                }, RELOAD_GRACE_MS)
              })
              .catch(() => {})
          }
          waitThenTake()
          return
        }
        return new Promise<void>((resolve) => {
          release = resolve
        })
      })
      .catch(() => {
        // ほかのタブが「こちらで続ける」を押した：書けなくし、送っていない変更を保存する
        setLocked(true)
        lost.current()
      })
    return () => {
      waiting.abort()
      release?.()
    }
  }, [])
  const takeOver = () => {
    if (!navigator.locks) return
    waitingRef.current?.abort()
    // 取り上げて、もう一方のタブが保存し終えるのを少し待ってから、読み込み直す（最新の原稿で続けるため）。
    // 読み込み直したこのタブがロックを持てるよう、手放してから読み込み直す
    void navigator.locks
      .request(LOCK_NAME, { steal: true }, () => new Promise<void>((resolve) => setTimeout(resolve, 1200)))
      .finally(() => location.reload())
  }
  return { locked, takeOver }
}
