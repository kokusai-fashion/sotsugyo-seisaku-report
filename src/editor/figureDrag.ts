import type { Report } from '../model/types'
import { PAGE_W, TEXT_LEFT, TEXT_W } from './pageStage'
import { figureDrops, type FigureDrop } from './reportOps'

/**
 * 図をつかんで運ぶ（パソコン。依頼者の選択 2026-10-25：mockups/v60）。
 * - 図の写真を押したまま少し待つ（輪が一周する）か、押したまま動かすと、つかむ。ただ押して離せば、今までどおり図を選ぶ
 * - つかんでいる間：元の所は点線の枠で薄くし、つかんだ図の写しが矢印について動く。置ける所には本文の左の余白に短い印を出し、
 *   いちばん近い所に本文の幅いっぱいの金色の線（「ここに置く」）を出す。1枚だけの図の右では、縦の線（「横に並べる」）
 * - 置けない所（本文の（図n）がある段落より上・小見出しの外）では、線を光らせずにわけを出す。離しても動かさない
 * - 紙面の左右の「‹ ›」の上で少し待つと、つかんだままページをめくる（見開きなら2ページずつ）
 * - 離すと図を動かし、図が出たページを見せて光らせる（host.drop）。Esc でやめる
 * 置ける所の決まりは「上へ」「下へ」と同じ（reportOps の figureDrops）。スマホでは使わない（今までどおり「上へ」「下へ」）
 */
export interface FigureDragHost {
  /** つかめるか（パソコンで書いているとき） */
  enabled(): boolean
  report(): Report
  /** いま見えているページ（見開きなら2つ）の要素 */
  visiblePages(): HTMLElement[]
  /** 図の番号（わけの言葉に使う） */
  numberOf(figureId: string): number | undefined
  /** つかむ前に：書いている欄を閉じる・選んだ文の帯を隠す */
  beforeLift(): void
  /** つかんだままページをめくる（見開きなら2ページずつ） */
  turn(dir: 1 | -1): Promise<void>
  /** 置く：図を動かし、図が出たページを見せて光らせる */
  drop(figureId: string, drop: FigureDrop): void
}

/** 押したまま待つと、つかむまでの時間（ms）・押したまま動かすと、つかむ距離（px） */
const HOLD_MS = 450
const MOVE_PX = 6
/** 「‹ ›」の上で待つと、ページをめくるまでの時間（ms） */
const TURN_MS = 800

type Box = { top: number; bottom: number; left: number; right: number; page: HTMLElement }
type Target = { drop: FigureDrop; y: number; left: number; right: number; page: HTMLElement } | { drop: FigureDrop; join: DOMRect; page: HTMLElement }

export class FigureDrag {
  private pending: { figureId: string; x: number; y: number; timer: number; ring: number } | null = null
  private drag: {
    figureId: string
    plan: NonNullable<ReturnType<typeof figureDrops>>
    ghost: HTMLElement
    off: { x: number; y: number }
    pos: { x: number; y: number }
    active: FigureDrop | null
    turning: boolean
    turnTimer: number
    turnDir: 0 | 1 | -1
  } | null = null
  private layer: HTMLElement | null = null
  private parts: HTMLElement[] = []
  private ring: HTMLElement | null = null
  private readonly host: FigureDragHost

  constructor(scroller: HTMLElement, host: FigureDragHost) {
    this.host = host
    scroller.addEventListener('pointerdown', (e) => this.onDown(e), true)
    window.addEventListener('pointermove', (e) => this.onMove(e))
    window.addEventListener('pointerup', (e) => this.onUp(e))
    window.addEventListener('pointercancel', () => this.cancel())
    window.addEventListener('blur', () => this.cancel())
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (this.drag || this.pending)) {
        e.preventDefault()
        e.stopPropagation()
        this.cancel()
      }
    }, true)
  }

  /** つかんでいる・つかもうとしているか */
  get active(): boolean {
    return !!this.drag || !!this.pending
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.shiftKey || !this.host.enabled()) return
    const target = e.target as HTMLElement
    const figure = target.closest<HTMLElement>('figure[data-figure-id]')
    // 図の写真（写真のない枠も）を押したとき。タイトルの字を押したときは、今までどおり書く
    if (!figure || !target.closest('figure > :is(img, .figure-slot)') || !this.host.visiblePages().some((p) => p.contains(figure))) return
    // 文を選び始めない・ブラウザの画像のドラッグを始めない（押して離したときのクリックは、今までどおり届く）
    e.preventDefault()
    const figureId = figure.dataset.figureId!
    const ring = window.setTimeout(() => this.showRing(e.clientX, e.clientY), 120)
    const timer = window.setTimeout(() => this.lift(), HOLD_MS)
    this.pending = { figureId, x: e.clientX, y: e.clientY, timer, ring }
  }

  private onMove(e: PointerEvent): void {
    if (this.pending && Math.hypot(e.clientX - this.pending.x, e.clientY - this.pending.y) > MOVE_PX) this.lift({ x: e.clientX, y: e.clientY })
    if (!this.drag) return
    this.drag.pos = { x: e.clientX, y: e.clientY }
    this.update()
  }

  private onUp(_e: PointerEvent): void {
    if (this.pending) {
      // つかむ前に離した：今までどおり図を選ぶ（クリックは紙面に届く）
      this.clearPending()
      return
    }
    const drag = this.drag
    if (!drag) return
    const drop = drag.turning ? null : drag.active
    this.end()
    // 離したあとのクリックが、紙面の段落を開いたりしないように
    const swallow = (ev: MouseEvent) => {
      ev.preventDefault()
      ev.stopPropagation()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400)
    if (drop) this.host.drop(drag.figureId, drop)
  }

  /** やめる（Esc・窓を離れた） */
  cancel(): void {
    this.clearPending()
    if (this.drag) this.end()
  }

  private clearPending(): void {
    if (!this.pending) return
    clearTimeout(this.pending.timer)
    clearTimeout(this.pending.ring)
    this.pending = null
    this.ring?.remove()
    this.ring = null
  }

  private showRing(x: number, y: number): void {
    this.ring?.remove()
    const ring = document.createElement('div')
    ring.className = 'fd-ring'
    ring.innerHTML = '<svg viewBox="0 0 46 46" width="46" height="46" aria-hidden="true"><circle cx="23" cy="23" r="20"/></svg>'
    ring.style.left = `${x}px`
    ring.style.top = `${y}px`
    document.body.append(ring)
    this.ring = ring
  }

  private lift(at?: { x: number; y: number }): void {
    const pending = this.pending
    if (!pending) return
    const pos = at ?? { x: pending.x, y: pending.y }
    this.clearPending()
    this.host.beforeLift()
    const plan = figureDrops(this.host.report(), pending.figureId)
    const img = this.figureImage(pending.figureId)
    if (!plan || !img) return
    const r = img.getBoundingClientRect()
    this.layer = document.createElement('div')
    this.layer.className = 'fd-layer'
    this.layer.setAttribute('aria-hidden', 'true')
    document.body.append(this.layer)
    document.body.classList.add('fd-dragging')
    const ghost = document.createElement('div')
    ghost.className = 'fd-ghost'
    const w = Math.max(60, r.width * 0.6)
    const h = Math.max(45, r.height * 0.6)
    Object.assign(ghost.style, { width: `${w}px`, height: `${h}px` })
    if (img instanceof HTMLImageElement) {
      const copy = document.createElement('img')
      copy.src = img.currentSrc || img.src
      copy.alt = ''
      ghost.append(copy)
    } else ghost.classList.add('empty')
    this.layer.append(ghost)
    this.drag = { figureId: pending.figureId, plan, ghost, off: { x: -w * 0.3, y: -h * 0.3 }, pos, active: null, turning: false, turnTimer: 0, turnDir: 0 }
    this.update()
  }

  private end(): void {
    const drag = this.drag
    if (drag) clearTimeout(drag.turnTimer)
    this.drag = null
    this.parts = []
    this.layer?.remove()
    this.layer = null
    document.body.classList.remove('fd-dragging')
    document.querySelectorAll('.arrow.fd-arrow-on').forEach((a) => a.classList.remove('fd-arrow-on'))
  }

  /** 見えているページにある、図の写真（写真のない枠） */
  private figureImage(figureId: string): HTMLElement | null {
    const sel = `figure[data-figure-id="${CSS.escape(figureId)}"] > :is(img, .figure-slot)`
    for (const page of this.host.visiblePages()) {
      const el = page.querySelector<HTMLElement>(sel)
      if (el) return el
    }
    return null
  }

  /** ブロック（段落・見出し・図のまとまり・表・改ページ）の、見えているページにある部分の範囲（ページの順） */
  private boxesOf(id: string | null): Box[] {
    if (!id) return []
    const report = this.host.report()
    const block = report.body.flatMap((c) => c.blocks).find((b) => b.id === id)
    const chapter = !block ? report.body.find((c) => c.id === id) : undefined
    if (!block && !chapter) return []
    const out: Box[] = []
    for (const page of this.host.visiblePages()) {
      let els: HTMLElement[]
      if (block?.type === 'figureRow') els = block.figures.flatMap((f) => [...page.querySelectorAll<HTMLElement>(`figure[data-figure-id="${CSS.escape(f.id)}"]`)])
      else if (block?.type === 'table') els = [...page.querySelectorAll<HTMLElement>(`.data-table[data-table-id="${CSS.escape(id)}"]`)]
      else els = [...page.querySelectorAll<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`)].map((el) => el.closest<HTMLElement>('p, h1, h2, .page-break') ?? el)
      for (const el of els) {
        const r = el.getBoundingClientRect()
        if (r.height === 0 && block?.type !== 'pageBreak') continue
        out.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, page })
      }
    }
    return out
  }

  /** ページの本文の左右（本文の版面） */
  private textColumn(page: HTMLElement): { left: number; right: number } {
    const p = page.getBoundingClientRect()
    const s = p.width / PAGE_W
    return { left: p.left + TEXT_LEFT * s, right: p.left + (TEXT_LEFT + TEXT_W) * s }
  }

  /** 見えているページの、置ける所の位置 */
  private targets(): Target[] {
    const drag = this.drag!
    const out: Target[] = []
    const report = this.host.report()
    const isParagraph = (id: string | null) => report.body.some((c) => c.blocks.some((b) => b.id === id && (b.type === 'paragraph' || b.type === 'subheading')))
    for (const drop of drag.plan.drops) {
      if (drop.kind === 'join') {
        const img = this.figureImage(drop.figureId)
        const page = img && this.host.visiblePages().find((p) => p.contains(img))
        if (img && page) out.push({ drop, join: img.getBoundingClientRect(), page })
        continue
      }
      const after = this.boxesOf(drop.after).at(-1)
      const before = this.boxesOf(drop.before)[0]
      const at = after ? { y: after.bottom + (isParagraph(drop.after) ? 1 : 8), page: after.page } : before ? { y: before.top - 4, page: before.page } : null
      if (!at) continue
      out.push({ drop, y: at.y, ...this.textColumn(at.page), page: at.page })
    }
    return out
  }

  /** つかんでいる図の写し・印・線・わけを、矢印の位置に合わせて描き直す */
  private update(): void {
    const drag = this.drag
    const layer = this.layer
    if (!drag || !layer) return
    const { x, y } = drag.pos
    drag.ghost.style.left = `${x + drag.off.x}px`
    drag.ghost.style.top = `${y + drag.off.y}px`
    this.parts.forEach((p) => p.remove())
    this.parts = []
    const add = (cls: string, style: Partial<CSSStyleDeclaration>, text = '') => {
      const el = document.createElement('div')
      el.className = cls
      Object.assign(el.style, style)
      // 線の言葉（「ここに置く」「横に並べる」）は線の上の札に、わけ・案内はそのまま
      if (text && /fd-(line|vline)/.test(cls)) el.append(Object.assign(document.createElement('span'), { className: 'fd-label', textContent: text }))
      else if (text) el.textContent = text
      // わけ・案内は、つかんだ図の写しより手前に。印・線は写しの奥に
      if (cls.startsWith('fd-tip')) layer.append(el)
      else layer.insertBefore(el, drag.ghost)
      this.parts.push(el)
      return el
    }
    // 元の所（見えていれば）
    for (const b of this.boxesOf(drag.plan.rowId)) add('fd-dim', { left: `${b.left - 4}px`, top: `${b.top - 4}px`, width: `${b.right - b.left + 8}px`, height: `${b.bottom - b.top + 8}px` })
    if (drag.turning) return
    // 「‹ ›」の上：少し待つと、めくる
    const arrow = this.arrowAt(x, y)
    document.querySelectorAll('.arrow.fd-arrow-on').forEach((a) => a !== arrow?.el && a.classList.remove('fd-arrow-on'))
    if (arrow) {
      arrow.el.classList.add('fd-arrow-on')
      add(arrow.dir > 0 ? 'fd-tip hint left' : 'fd-tip hint', { left: `${arrow.dir > 0 ? x + drag.off.x - 10 : this.tipRight(x)}px`, top: `${y + 22}px` }, arrow.dir > 0 ? 'ここで少し待つと、次のページへ' : 'ここで少し待つと、前のページへ')
      if (drag.turnDir !== arrow.dir) {
        clearTimeout(drag.turnTimer)
        drag.turnDir = arrow.dir
        drag.turnTimer = window.setTimeout(() => void this.turn(arrow.dir), TURN_MS)
      }
      drag.active = null
      return
    }
    if (drag.turnDir) {
      clearTimeout(drag.turnTimer)
      drag.turnDir = 0
    }
    const targets = this.targets()
    const pages = this.host.visiblePages()
    // 矢印の下のページ（見開きでは、矢印に近い方）
    const page = pages.find((p) => {
      const r = p.getBoundingClientRect()
      return x >= r.left && x <= r.right
    }) ?? pages.reduce<HTMLElement | null>((best, p) => {
      const r = p.getBoundingClientRect()
      const d = Math.min(Math.abs(x - r.left), Math.abs(x - r.right))
      if (!best) return p
      const b = best.getBoundingClientRect()
      return d < Math.min(Math.abs(x - b.left), Math.abs(x - b.right)) ? p : best
    }, null)
    // 印（いまの所は出さない）
    for (const t of targets) {
      if ('join' in t) add('fd-vline', { left: `${t.join.right + 12}px`, top: `${t.join.top}px`, height: `${t.join.height}px` })
      else if (!(t.drop.kind === 'gap' && t.drop.at === drag.plan.current)) add('fd-tick', { left: `${t.left - 30}px`, top: `${t.y}px` })
    }
    const why = this.whyNot(x, y, page)
    let active: Target | null = null
    if (!why) {
      const onPage = targets.filter((t) => t.page === page)
      active = onPage.find((t) => 'join' in t && x >= t.join.left + t.join.width * 0.5 && y >= t.join.top - 10 && y <= t.join.bottom + 10) ?? null
      if (!active) {
        for (const t of onPage) if (!('join' in t) && (!active || Math.abs(t.y - y) < Math.abs((active as { y: number }).y - y))) active = t
      }
    }
    drag.active = active?.drop ?? null
    if (active && 'join' in active) add('fd-vline on', { left: `${active.join.right + 12}px`, top: `${active.join.top}px`, height: `${active.join.height}px` }, '横に並べる')
    else if (active) add('fd-line on', { left: `${active.left}px`, top: `${active.y}px`, width: `${active.right - active.left}px` }, active.drop.kind === 'gap' && active.drop.at === drag.plan.current ? '元の所' : 'ここに置く')
    const tip = why ?? (targets.some((t) => t.page === page) ? null : 'このページには置ける所がありません（「‹」「›」の上で少し待つと、ページをめくれます）')
    if (tip) add('fd-tip', { left: `${this.tipRight(x)}px`, top: `${y + 22}px` }, tip)
  }

  /** わけ・案内の吹き出しの左の端（つかんだ図の写しの右。写しに隠れないように） */
  private tipRight(x: number): number {
    const drag = this.drag!
    return x + drag.off.x + drag.ghost.offsetWidth + 10
  }

  /** 置けない所のわけ（本文の（図n）がある段落より上・小見出しや大見出しの外）。置ける所なら null */
  private whyNot(x: number, y: number, page: HTMLElement | null): string | null {
    const drag = this.drag!
    if (!page) return null
    const n = this.host.numberOf(drag.figureId)
    const onPage = (boxes: Box[]) => boxes.filter((b) => b.page === page)
    const ref = onPage(this.boxesOf(drag.plan.ref)).at(-1)
    if (ref && y < ref.bottom) return `図は、本文の「（図${n ?? 'n'}）」がある段落より上には置けません`
    const from = onPage(this.boxesOf(drag.plan.section.from)).at(-1)
    if (from && y < from.bottom) return '図は、小見出しの外には置けません'
    const to = onPage(this.boxesOf(drag.plan.section.to))[0]
    if (to && y > to.top) return '図は、小見出しの外には置けません'
    void x
    return null
  }

  /** 矢印の下の「‹」「›」（押せるもの） */
  private arrowAt(x: number, y: number): { el: HTMLElement; dir: 1 | -1 } | null {
    for (const [sel, dir] of [['.stage .arrow.next', 1], ['.stage .arrow.prev', -1]] as const) {
      const el = document.querySelector<HTMLButtonElement>(sel)
      if (!el || el.disabled) continue
      const r = el.getBoundingClientRect()
      if (r.width && x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12) return { el, dir }
    }
    return null
  }

  private async turn(dir: 1 | -1): Promise<void> {
    const drag = this.drag
    if (!drag) return
    drag.turning = true
    drag.active = null
    this.update()
    try {
      await this.host.turn(dir)
    } finally {
      if (this.drag === drag) {
        drag.turning = false
        drag.turnDir = 0
        this.update()
      }
    }
  }
}
