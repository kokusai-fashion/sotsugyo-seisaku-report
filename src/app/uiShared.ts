import { useEffect, useRef, useState } from 'react'
import type { EditorSnapshot, ReportEditor } from '../editor/reportEditor'
import type { PageKind } from '../layout/measure'
import { photoPageAt, photoPageName } from '../model/photos'
import { BAND_SIDE_QUERY } from './bandText'

/** 画面の部品で共有する定数と、画面の幅・キーボード・指の動きを扱うフック */

/** ボタンを押しても入力欄から文字のカーソルが外れないようにする */
export const keepFocus = (e: React.MouseEvent) => e.preventDefault()

/**
 * 押してすぐのもう1回（ダブルクリックの2回目）を、しばらく受け止めて捨てる（押した所のまわりに透明な幕を置く）。
 * 押したメニューが閉じたあと、2回目が紙面に当たり、開いたばかりの書く欄が閉じていた（表の大きさのます目：学生の試し 3回目 2026-10-29）。
 * 幕は押した所のまわり（48px 四方）だけ。ほかの所をすぐ押したとき（表のマスなど）は、そのまま届く
 */
export function swallowSecondClick(at: { clientX: number; clientY: number }, ms = 450): void {
  const shield = document.createElement('div')
  shield.style.cssText = `position:fixed;left:${at.clientX - 24}px;top:${at.clientY - 24}px;width:48px;height:48px;z-index:2147483647;background:transparent`
  shield.addEventListener('mousedown', (e) => e.preventDefault())
  document.body.append(shield)
  window.setTimeout(() => shield.remove(), ms)
}

/** F6 で順に移る所（パソコン：ページの一覧・道具・紙面・右の欄。スマホの形：上の帯・紙面・下の帯。見えているものだけ） */
const REGIONS = ['.p-top', '.thumb-list', '.palette', '.stage', 'aside.side', '.p-nav']
const REGION_FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/** 区画の中で、F6 で移る先（見えているものだけ。ページの一覧は見ているページ、紙面は見えているページの欄） */
function regionTarget(region: HTMLElement): HTMLElement | null {
  const visible = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden'
  }
  if (region.matches('.stage')) {
    const keys = [...region.querySelectorAll<HTMLElement>('.page-viewport.front [data-paper-key]')].filter(visible)
    return keys.find((el) => el.tabIndex === 0) ?? keys[0] ?? null
  }
  if (region.matches('.thumb-list')) {
    const current = region.querySelector<HTMLElement>('[aria-current="page"]')
    if (current) return current
  }
  return [...region.querySelectorAll<HTMLElement>(REGION_FOCUSABLE)].find(visible) ?? null
}

/** 紙面（見えているページの欄）にフォーカスを置く（画面の案内・はじめての案内を閉じたあと、フォーカスがなくなっていた：学生の試し 5回目 2026-10-30） */
export function focusPaper(): void {
  const stage = document.querySelector<HTMLElement>('.stage')
  if (stage && !stage.contains(document.activeElement)) regionTarget(stage)?.focus({ preventScroll: true })
}

/**
 * F6・Shift+F6：ページの一覧・道具・紙面・右の欄を順に移る（キーボードで、右の欄の「PDFを書き出す」まで Tab で39回かかった：学生の試し 4回目 2026-10-30）。
 * 移る先のない区画（押せるボタンのない道具など）は飛ばす（止まっていた：学生の試し 5回目）
 */
export function moveRegion(step: 1 | -1): void {
  const regions = REGIONS.map((s) => document.querySelector<HTMLElement>(s)).filter((el): el is HTMLElement => !!el && el.getClientRects().length > 0)
  if (regions.length === 0) return
  const at = regions.findIndex((el) => el.contains(document.activeElement))
  for (let k = 1; k <= regions.length; k++) {
    const i = at < 0 ? (step > 0 ? k - 1 : regions.length - k) : (((at + step * k) % regions.length) + regions.length) % regions.length
    const target = regionTarget(regions[i])
    if (target) {
      target.focus()
      return
    }
  }
}

/**
 * ページの種類ごとの名前と、道具の上に出すひとこと。
 * 道具の幅（1行6字ほど）で、言葉の切れ目で行を分ける（1字だけ次の行に残らないように。目次は前の「見出しから／自動で作られる」が「る」だけの行になっていた：mockups/v41）
 */
export const PAGE_CONTEXT: Record<PageKind, { name: string; hint: string }> = {
  cover: { name: '表紙', hint: '項目を\nクリックして\n入力' },
  abstract: { name: '抄録', hint: 'Enter で\n段落を分ける' },
  toc: { name: '目次', hint: '本文の\n見出しから\n自動で\n作ります' },
  body: { name: '本文', hint: 'クリックして\nその場で書く' },
  references: { name: '参考文献', hint: 'クリックして\n編集する' },
  photos: { name: '作品写真', hint: '枠を\nクリックして\n選ぶ' },
  unknown: { name: '', hint: '' },
}

/** 目次のページの、道具の上のもう一言（パソコン。目次の行を押すと、その見出しへ移れること：mockups/v41 案C。行は言葉の切れ目で分ける） */
export const TOC_PALETTE_NOTE = '直すときは、\n目次の行を\nクリック'

/** 表示しているページの名前（本文は「本文 2ページ」） */
export function pageName(snap: EditorSnapshot, index = snap.page): string {
  const kinds = snap.layout?.kinds ?? []
  const kind = kinds[index]
  if (!kind) return ''
  if (kind === 'body') return `本文 ${kinds.slice(0, index + 1).filter((k) => k === 'body').length}ページ`
  // 作品写真が何ページかあるときは「作品写真 2」（mockups/v38 案A）
  if (kind === 'photos') return photoPageName(photoPageAt(kinds, index) ?? 0, kinds.filter((k) => k === 'photos').length)
  return PAGE_CONTEXT[kind].name
}

/** 画面の幅がスマホ（・縦長のタブレット）ほどか */
export function useNarrow(): boolean {
  const query = '(max-width: 999px)'
  const [narrow, setNarrow] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

/**
 * 横向きのスマホほどの形の画面か（帯と、作品写真のページの道具を、紙面の右に出す。bandText.ts の BAND_SIDE_QUERY。mockups/v33 案A）。
 * 画面の向きを変えると描き直す
 */
export function useBandSide(): boolean {
  const [side, setSide] = useState(() => matchMedia(BAND_SIDE_QUERY).matches)
  useEffect(() => {
    const mq = matchMedia(BAND_SIDE_QUERY)
    const onChange = () => setSide(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return side
}

/**
 * 指で操作する端末（スマホ・タブレット）を横向きに持っているか。キーボードで画面の見える所が変わっても変わらないよう、
 * 画面の縦横の比ではなく、端末の向き（screen.orientation）で見る。パソコンの狭い窓では false
 */
export function useTouchLandscape(): boolean {
  const read = () => {
    if (!matchMedia('(pointer: coarse)').matches) return false
    const type = screen.orientation?.type
    return type ? type.startsWith('landscape') : matchMedia('(orientation: landscape)').matches
  }
  const [land, setLand] = useState(read)
  useEffect(() => {
    const onChange = () => setLand(read())
    screen.orientation?.addEventListener('change', onChange)
    window.addEventListener('orientationchange', onChange)
    return () => {
      screen.orientation?.removeEventListener('change', onChange)
      window.removeEventListener('orientationchange', onChange)
    }
  }, [])
  return land
}

/** スマホのキーボードの高さを CSS 変数 --kb に入れる（書く欄をキーボードのすぐ上に置くため） */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => document.documentElement.style.setProperty('--kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`)
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
}

/** これより間が空いたら、ホイールの別の操作とみなす（ミリ秒） */
const WHEEL_GESTURE_GAP_MS = 200
/** ページを送るのに必要な回転の量（px。マウスのホイールなら1目盛りで届く） */
const WHEEL_TURN_PX = 50
/** 紙面の大きさを1段変えるのに必要な回転の量（px。マウスのホイールは1目盛りで1段。タッチパッドの2本の指は、広げた分だけ少しずつ） */
const WHEEL_ZOOM_PX = 30

/**
 * マウスのホイール（タッチパッドの2本指）でページを送る。下（右）へ回すと次のページ、上（左）へ回すと前のページ。
 * 1回の操作（間が空くまでの一続きの回転）で1ページ。めくっている間の回転と、タッチパッドの指を離したあとの惰性では続けて送らない。
 * 紙面をスクロールできるとき（拡大など）は、ふつうにスクロールし、端まで来てから改めて回したときだけ送る。
 * Ctrl を押しながら回す（タッチパッドの2本の指で広げる・狭める）と、紙面の大きさを1段ずつ変える（右下の「－ ＋」と同じ。依頼者の選択 2026-10-28）。
 * 紙面の外（右の欄など）では、今までどおりブラウザの拡大・縮小
 */
export function useWheelPaging(target: React.RefObject<HTMLElement | null>, scroller: React.RefObject<HTMLElement | null>, editor: ReportEditor | null, enabled: boolean): void {
  useEffect(() => {
    const el = target.current
    const sc = scroller.current
    if (!el || !sc || !editor || !enabled) return
    let last = 0
    let sum = 0
    let mode: 'turn' | 'scroll' | 'done' = 'turn'
    // Ctrl＋ホイールで回した量（一続きの操作の中で、同じ向きに回した分）
    let zoomLast = 0
    let zoomSum = 0
    // めくっている間の回転は、そのめくりの続き（惰性など）とみなして使わない
    let busy = false
    const turn = async (dir: 1 | -1) => {
      busy = true
      try {
        // 見開きのときは2ページずつ（editor の turnBy）
        await editor.turnBy(dir)
      } finally {
        busy = false
      }
    }
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey && editor.wheelZoomable) {
        // 紙面の大きさを変える（ブラウザの拡大・縮小はしない）。上へ回す・指を広げると大きく。1回の回転で変えるのは1段まで
        e.preventDefault()
        const d = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? sc.clientHeight : 1)
        if (!d) return
        if (e.timeStamp - zoomLast > WHEEL_GESTURE_GAP_MS || Math.sign(d) !== Math.sign(zoomSum)) zoomSum = 0
        zoomLast = e.timeStamp
        zoomSum += d
        if (Math.abs(zoomSum) < WHEEL_ZOOM_PX) return
        editor.wheelZoom(zoomSum < 0 ? 1 : -1, { x: e.clientX, y: e.clientY })
        zoomSum = 0
        return
      }
      if (e.ctrlKey || e.metaKey) return // 画面の拡大・縮小（スマホ・Mac の ⌘）
      // 道具の中を上下に動かせるとき（表を選んでいて、道具が画面に入りきらない）は、道具を動かす
      const palette = e.target instanceof Element ? e.target.closest('.palette') : null
      if (palette && palette.scrollHeight > palette.clientHeight) return
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? sc.clientHeight : 1
      const dx = e.deltaX * unit
      const dy = e.deltaY * unit
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy
      if (!d) return
      // 回した時刻（画面の処理が混んで遅れて届いても、回した間隔で判断する）
      const now = e.timeStamp
      if (now - last > WHEEL_GESTURE_GAP_MS) {
        // 新しい操作：縦にスクロールできる余地があれば、ふつうにスクロールする
        const atEdge = d > 0 ? sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2 : sc.scrollTop <= 1
        sum = 0
        mode = busy || editor.getSnapshot().turning ? 'done' : Math.abs(dy) >= Math.abs(dx) && !atEdge ? 'scroll' : 'turn'
      }
      last = now
      if (mode === 'scroll') return
      e.preventDefault()
      if (mode === 'done') return
      sum += d
      if (Math.abs(sum) < WHEEL_TURN_PX) return
      mode = 'done'
      void turn(sum > 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [target, scroller, editor, enabled])
}

/** 置いてから動き始めるまでが、これより長い指は、はらいとみなさない（長押し。図を選ぶ長押しは約 0.5 秒） */
const SWIPE_HOLD_MS = 400

/**
 * 紙面を指で左右・上下にはらうと、ページをめくる（スマホ。上下は、拡大していないときだけ）。
 * 2本の指で紙面を広げる・縮めるときは、めくらない（指を離すまで。広げ終えた直後も：editor/pinchZoom.ts）。
 * 長く押してから動かした指（図を長押しで選んでから、そのまま動かした など）も、めくらない（SWIPE_HOLD_MS）
 */
export function useSwipe(target: React.RefObject<HTMLElement | null>, editor: ReportEditor | null, enabled: boolean): void {
  // t：置いた時刻。movedAt：動き始めた（10px 動いた）時刻
  const start = useRef<{ x: number; y: number; t: number; movedAt?: number } | null>(null)
  useEffect(() => {
    const el = target.current
    if (!el || !editor || !enabled) return
    // 置いている指（2本になったら、離し終えるまで、はらいとみなさない）
    const fingers = new Set<number>()
    let multi = false
    // 押して選んだ作品写真・切り抜いた表の画像をつかんで動かすときは、ページを送らない（選んでいない写真・「全体を入れる（切らない）」の写真の上で、はらうとページを送る）
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') fingers.add(e.pointerId)
      if (fingers.size >= 2) multi = true
      start.current = e.pointerType === 'mouse' || multi || (e.target as HTMLElement).closest?.('[data-photo-slot].is-selected:not(.whole) img, .data-table img.crop.is-selected') ? null : { x: e.clientX, y: e.clientY, t: e.timeStamp }
    }
    const move = (e: PointerEvent) => {
      const s = start.current
      if (s && s.movedAt === undefined && Math.hypot(e.clientX - s.x, e.clientY - s.y) >= 10) s.movedAt = e.timeStamp
    }
    const release = (e: PointerEvent) => {
      fingers.delete(e.pointerId)
      const wasMulti = multi
      if (fingers.size === 0) multi = false
      return wasMulti
    }
    const up = (e: PointerEvent) => {
      const s = start.current
      start.current = null
      if (release(e) || !s || editor.pinching) return
      // 長く押してから動かした：はらいではない（Android で図を長押しで選び、そのまま指を動かすと、前のページへめくれていた：試し 2026-10-26b）
      if ((s.movedAt ?? e.timeStamp) - s.t > SWIPE_HOLD_MS) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      const snap = editor.getSnapshot()
      if (snap.editingId || snap.zoomed) return
      // 左右にはらう：左へで次のページ。上下にはらう（拡大していないときだけ。拡大中は上下に動かす）：上へで次のページ
      if (Math.abs(dx) >= 60 && Math.abs(dx) >= Math.abs(dy) * 2) {
        if (dx < 0) editor.nextPage()
        else editor.prevPage()
      } else if (Math.abs(dy) >= 60 && Math.abs(dy) >= Math.abs(dx) * 2) {
        if (dy < 0) editor.nextPage()
        else editor.prevPage()
      }
    }
    // ブラウザがスクロールに使った指（拡大中に紙面を動かした）など：はらいとみなさない
    const cancel = (e: PointerEvent) => {
      start.current = null
      release(e)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
    }
  }, [target, editor, enabled])
}

/**
 * 拡大した紙面を、キーで上下に動かす（↓↑：少し、Space・Shift+Space：ほぼ1画面、Home・End：いちばん上・下）。動かしたら true。
 * 道具・右の欄・ページの一覧のボタンを押すキーは横取りしない。Space・Home・End は、どこにもフォーカスがないときだけ
 */
export function scrollPaperKey(e: KeyboardEvent, scroller: HTMLElement | null): boolean {
  if (!scroller || scroller.scrollHeight <= scroller.clientHeight + 1 || e.ctrlKey || e.metaKey) return false
  const target = e.target instanceof Element ? e.target : null
  if (target?.closest('.side, .palette, .thumb-list, .view-bar, select, input, textarea')) return false
  const free = !target || target === document.body || target === document.documentElement
  const step = e.key === 'ArrowDown' ? 60 : e.key === 'ArrowUp' ? -60 : free && e.key === ' ' ? scroller.clientHeight * 0.85 * (e.shiftKey ? -1 : 1) : 0
  if (step) scroller.scrollTop += step
  else if (free && e.key === 'Home') scroller.scrollTop = 0
  else if (free && e.key === 'End') scroller.scrollTop = scroller.scrollHeight
  else return false
  return true
}

/** 指で触る端末（おもに指で操作する：スマホ・iPad）。言葉の「クリック」を「タップ」にする（パソコンの形のときも：学生の試し 4回目 2026-10-30） */
export const touchPrimary = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
