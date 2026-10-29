import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 窓（ダイアログ）をキーボードでも使えるようにする。
 * - 開いたら、窓の中の最初の操作できるもの（閉じる「×」を除く。data-autofocus があればそれ）に移る
 * - Tab で窓の外に出ない（最後の次は最初に戻る）
 * - onEscape を渡すと、Esc で閉じる（書きかけの内容が消える窓や、必ず選んでもらう窓には渡さない）
 * - 閉じたら、開く前に操作していた場所に戻る
 * - 窓の上に別の窓（確認の窓など）が開いているあいだは、上の窓だけがキーを受け取る（下の窓が Tab で操作の場所を取り戻したり、Esc で一緒に閉じたりしない）
 */
const openDialogs: HTMLElement[] = []

/**
 * 最後にフォーカスがあった所。窓を開く前に、押したボタンが押せなくなって（「PDFを書き出す」の「確かめています…」）フォーカスが外れていたら、
 * 閉じたときはここへ戻す（PDF の窓を閉じたあと、フォーカスが行方不明になっていた：学生の試し 4回目 2026-10-30）
 */
let lastFocused: HTMLElement | null = null
if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    (e) => {
      if (e.target instanceof HTMLElement) lastFocused = e.target
    },
    true,
  )
}

export function useDialogFocus(ref: RefObject<HTMLElement | null>, onEscape?: () => void): void {
  const escape = useRef(onEscape)
  useEffect(() => {
    escape.current = onEscape
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    const previous = active ?? (lastFocused?.matches('button, a[href]') ? lastFocused : null)
    const focusables = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement)
    const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? focusables().find((x) => !x.classList.contains('close')) ?? focusables()[0]
    first?.focus()
    openDialogs.push(el)
    const onKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== el) return
      if (e.key === 'Escape' && escape.current) {
        e.preventDefault()
        e.stopPropagation()
        escape.current()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const head = list[0]
      const tail = list[list.length - 1]
      if (!el.contains(document.activeElement)) {
        e.preventDefault()
        head.focus()
      } else if (e.shiftKey && document.activeElement === head) {
        e.preventDefault()
        tail.focus()
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault()
        head.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      const at = openDialogs.indexOf(el)
      if (at >= 0) openDialogs.splice(at, 1)
      if (previous?.isConnected) previous.focus()
    }
  }, [ref])
}
