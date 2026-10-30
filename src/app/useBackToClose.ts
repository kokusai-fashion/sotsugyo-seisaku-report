import { useEffect, useRef } from 'react'

/**
 * スマホの下から出る欄（追加・メニュー・チェックなど）・使い方を開いている間、ブラウザの「戻る」（Android の戻る・iPhone の左端からなぞる）で、
 * その欄を閉じる（前は欄が閉じずに、ツールから出ていた。依頼者の判断 2026-10-30：学生の試し 6回目）。
 * 開いたときに履歴を1つ足し、「戻る」でそれが外れたら閉じる。
 * ×・後ろを押す・Esc で閉じたときは、足した履歴を外さずに残し、次に欄を開くときに使い回す（自分で history.back() すると、
 * すぐ別の欄を開いたときに戻る先がずれて、ツールの外へ出てしまった）。そのため、残っているときは「戻る」を1回多く押してツールを出る
 */

/** 開いている欄を閉じるもの（あとに開いたものが上） */
const opened: (() => void)[] = []
let listening = false

function listen(): void {
  if (listening) return
  listening = true
  window.addEventListener('popstate', () => opened.at(-1)?.())
}

function forget(close: () => void): void {
  const i = opened.indexOf(close)
  if (i >= 0) opened.splice(i, 1)
}

/** active の間、「戻る」で onClose を呼ぶ */
export function useBackToClose(onClose: () => void, active = true): void {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    if (!active) return
    listen()
    const close = () => {
      forget(close)
      closeRef.current()
    }
    // ほかの欄が開いておらず、いまの履歴が前に足して残したものなら、それを使う（足していくと、ツールを出るまでに「戻る」を何度も押すことになる）
    const spare = opened.length === 0 && (window.history.state as { backToClose?: boolean } | null)?.backToClose === true
    if (!spare) window.history.pushState({ backToClose: true }, '')
    opened.push(close)
    return () => forget(close)
  }, [active])
}
