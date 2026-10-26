import type { Report } from '../model/types'
import { PAGE_W, TEXT_LEFT, TEXT_W } from './pageStage'
import { figureDrops, type FigureDrop } from './reportOps'

/**
 * 図をつかんで運ぶ（パソコン。依頼者の選択 2026-10-25：mockups/v60）。
 * - 図の写真を押したまま少し待つ（輪が一周する）か、押したまま動かすと、つかむ。ただ押して離せば、今までどおり図を選ぶ
 * - つかんでいる間：元の所は点線の枠で薄くし、つかんだ図の写しが矢印について動く（2枚並びなら2枚とも）。置ける所には本文の左の余白に
 *   短い印を出し、いちばん近い所に金色の線（「ここに置く」）を出す。1枚だけの図の右では、縦の線（「横に並べる」）
 * - 矢印が、つかんだ図の上にある間は「元の所」（動かさない）。ゆっくり押したり、押した手が少し動いたりしただけで、
 *   図が1段落下へ動いていた（試し 2026-10-26）
 * - 置けない所（本文の（図n）がある段落より上・小見出しの外）ではわけを出し、紙面の外では「ここで離すと、やめます」。どちらも離しても動かさない
 * - 紙面の左右の「‹ ›」の上で少し待つと、つかんだままページをめくる（見開きなら2ページずつ）
 * - 拡大して紙面を上下に送れるとき：台の上・下の端に近づくと、自動で送る。送ったら（ホイールでも）描き直す
 * - 離すと図を動かし、図が出たページを見せて光らせる（host.drop）。Esc・Ctrl+Z でやめる（やめたあとのクリックも紙面に届けない）
 * 置ける所の決まりは「上へ」「下へ」と同じ（reportOps の figureDrops）。スマホでは使わない（今までどおり「上へ」「下へ」）
 */
export interface FigureDragHost {
  /** つかめるか（パソコンで書いているとき） */
  enabled(): boolean
  report(): Report
  /** いま見えているページ（見開きなら2つ）の要素 */
  visiblePages(): HTMLElement[]
  /** 紙面のすべてのページの要素（ページをまたぐブロックの、始まり・終わりのページを調べる） */
  allPages(): HTMLElement[]
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
const MOVE_PX = 10
/** 「‹ ›」の上で待つと、ページをめくるまでの時間（ms） */
const TURN_MS = 800
/** 台の上・下の端からこの幅（px）の中に入ると、自動で紙面を送る（拡大しているとき） */
const EDGE_PX = 48

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
    scrollFrame: number
  } | null = null
  /** やめたあと（Esc・Ctrl+Z）、離したときのクリックを紙面に届けない */
  private swallowUp = false
  private layer: HTMLElement | null = null
  private parts: HTMLElement[] = []
  private ring: HTMLElement | null = null
  private readonly host: FigureDragHost
  private readonly scroller: HTMLElement

  constructor(scroller: HTMLElement, host: FigureDragHost) {
    this.host = host
    this.scroller = scroller
    scroller.addEventListener('pointerdown', (e) => this.onDown(e), true)
    // 紙面を送った（ホイール・自動）：印と線を、送った紙面に合わせて描き直す
    scroller.addEventListener('scroll', () => this.update())
    window.addEventListener('pointermove', (e) => this.onMove(e))
    window.addEventListener('pointerup', () => this.onUp())
    window.addEventListener('pointercancel', () => this.cancel())
    window.addEventListener('blur', () => this.cancel())
    document.addEventListener(
      'keydown',
      (e) => {
        if (!this.drag && !this.pending) return
        // Esc：やめる。Ctrl+Z・Ctrl+Y：つかんでいる間は元に戻さず、やめる（前は、直前に書いた字が消え、つかんだままになった）
        const undoKey = (e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())
        if (e.key !== 'Escape' && !undoKey) return
        e.preventDefault()
        e.stopPropagation()
        this.cancel()
      },
      true,
    )
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
    this.autoScroll()
  }

  private onUp(): void {
    if (this.pending) {
      // つかむ前に離した：今までどおり図を選ぶ（クリックは紙面に届く）
      this.clearPending()
      return
    }
    if (this.swallowUp) {
      this.swallowUp = false
      this.swallowClick()
      return
    }
    const drag = this.drag
    if (!drag) return
    const drop = drag.turning ? null : drag.active
    this.end()
    // 離したあとのクリックが、紙面の段落を開いたりしないように
    this.swallowClick()
    if (drop && !(drop.kind === 'gap' && drop.at === drag.plan.current)) this.host.drop(drag.figureId, drop)
  }

  private swallowClick(): void {
    const swallow = (ev: MouseEvent) => {
      ev.preventDefault()
      ev.stopPropagation()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400)
  }

  /** やめる（Esc・Ctrl+Z・窓を離れた）。つかんでいたら、離したときのクリックも紙面に届けない */
  cancel(): void {
    this.clearPending()
    if (this.drag) {
      this.end()
      this.swallowUp = true
    }
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
    this.layer = document.createElement('div')
    this.layer.className = 'fd-layer'
    this.layer.setAttribute('aria-hidden', 'true')
    document.body.append(this.layer)
    document.body.classList.add('fd-dragging')
    // つかんだ図の写し（2枚並びなら、2枚とも。「2枚いっしょに動きます」）
    const ghost = document.createElement('div')
    ghost.className = 'fd-ghost'
    const imgs = plan.figures.map((id) => this.figureImage(id)).filter((el): el is HTMLElement => !!el)
    const r = img.getBoundingClientRect()
    const h = Math.max(45, r.height * 0.6)
    let w = 0
    for (const el of imgs) {
      const er = el.getBoundingClientRect()
      const ew = Math.max(60, er.width * (h / Math.max(1, er.height)))
      w += ew
      const pic = document.createElement('div')
      pic.className = 'fd-pic'
      pic.style.width = `${ew}px`
      if (el instanceof HTMLImageElement) pic.append(Object.assign(document.createElement('img'), { src: el.currentSrc || el.src, alt: '' }))
      else pic.classList.add('empty')
      ghost.append(pic)
    }
    Object.assign(ghost.style, { width: `${w}px`, height: `${h}px` })
    if (imgs.length > 1) ghost.append(Object.assign(document.createElement('span'), { className: 'fd-ghost-note', textContent: `${imgs.length}枚いっしょに動きます` }))
    this.layer.append(ghost)
    this.drag = { figureId: pending.figureId, plan, ghost, off: { x: -w * 0.3, y: -h * 0.3 }, pos, active: null, turning: false, turnTimer: 0, turnDir: 0, scrollFrame: 0 }
    this.update()
  }

  private end(): void {
    const drag = this.drag
    if (drag) {
      clearTimeout(drag.turnTimer)
      cancelAnimationFrame(drag.scrollFrame)
    }
    this.drag = null
    this.parts = []
    this.layer?.remove()
    this.layer = null
    document.body.classList.remove('fd-dragging')
    document.querySelectorAll('.fd-arrow-on').forEach((a) => a.classList.remove('fd-arrow-on'))
  }

  /** 拡大して紙面を上下に送れるとき、台の上・下の端に近づいたら、自動で送り続ける */
  private autoScroll(): void {
    const drag = this.drag
    if (!drag || drag.scrollFrame) return
    const step = () => {
      drag.scrollFrame = 0
      if (this.drag !== drag || drag.turning) return
      const s = this.scroller.getBoundingClientRect()
      const { x, y } = drag.pos
      if (x < s.left || x > s.right) return
      const speed = y < s.top + EDGE_PX ? -Math.ceil((s.top + EDGE_PX - y) / 3) : y > s.bottom - EDGE_PX ? Math.ceil((y - (s.bottom - EDGE_PX)) / 3) : 0
      if (!speed) return
      const before = this.scroller.scrollTop
      this.scroller.scrollTop += speed
      if (this.scroller.scrollTop !== before) drag.scrollFrame = requestAnimationFrame(step)
    }
    drag.scrollFrame = requestAnimationFrame(step)
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

  /** ブロック（段落・見出し・図のまとまり・表・改ページ）の、pages にある部分の範囲（ページの順） */
  private boxesOf(id: string | null, pages = this.host.visiblePages()): Box[] {
    if (!id) return []
    const report = this.host.report()
    const block = report.body.flatMap((c) => c.blocks).find((b) => b.id === id)
    const chapter = !block ? report.body.find((c) => c.id === id) : undefined
    if (!block && !chapter) return []
    const out: Box[] = []
    for (const page of pages) {
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

  /** 紙面の見えている所（ページと台の重なり）。この外は「紙面の外」 */
  private paperArea(page: HTMLElement): { left: number; top: number; right: number; bottom: number } {
    const p = page.getBoundingClientRect()
    const s = this.scroller.getBoundingClientRect()
    return { left: Math.max(p.left, s.left), top: Math.max(p.top, s.top), right: Math.min(p.right, s.right), bottom: Math.min(p.bottom, s.bottom) }
  }

  /** 見えているページの、置ける所の位置 */
  private targets(): Target[] {
    const drag = this.drag!
    const out: Target[] = []
    const report = this.host.report()
    const visible = this.host.visiblePages()
    const isParagraph = (id: string | null) => report.body.some((c) => c.blocks.some((b) => b.id === id && (b.type === 'paragraph' || b.type === 'subheading')))
    for (const drop of drag.plan.drops) {
      if (drop.kind === 'join') {
        const img = this.figureImage(drop.figureId)
        const page = img && visible.find((p) => p.contains(img))
        if (img && page) out.push({ drop, join: img.getBoundingClientRect(), page })
        continue
      }
      // ブロックの後ろ：そのブロックが終わるページが見えているときだけ（ページをまたぐ表・段落の途中に出さない）。
      // ブロックの前：そのブロックが始まるページが見えているときだけ
      const after = drop.after ? this.boxesOf(drop.after, this.host.allPages()).at(-1) : undefined
      const before = drop.before ? this.boxesOf(drop.before, this.host.allPages())[0] : undefined
      const at =
        after && visible.includes(after.page)
          ? { y: after.bottom + (isParagraph(drop.after) ? 1 : 8), page: after.page }
          : !after && before && visible.includes(before.page)
            ? { y: before.top - 4, page: before.page }
            : null
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
    const arrow = drag.turning ? null : this.arrowAt(x, y)
    // 「‹ ›」の上では、写しをボタンの手前（台の内側）へずらす（写しがボタンを隠していた）
    const shift = arrow ? (arrow.dir > 0 ? -drag.ghost.offsetWidth - 30 : 40) - drag.off.x : 0
    drag.ghost.style.left = `${x + drag.off.x + shift}px`
    drag.ghost.style.top = `${y + drag.off.y}px`
    this.parts.forEach((p) => p.remove())
    this.parts = []
    const s = this.scroller.getBoundingClientRect()
    const add = (cls: string, style: Partial<CSSStyleDeclaration>, text = '') => {
      const el = document.createElement('div')
      el.className = cls
      Object.assign(el.style, style)
      // 線の言葉（「ここに置く」「横に並べる」）は線の札に、わけ・案内はそのまま
      if (text && /fd-(line|vline)/.test(cls)) el.append(Object.assign(document.createElement('span'), { className: 'fd-label', textContent: text }))
      else if (text) el.textContent = text
      // わけ・案内は、つかんだ図の写しより手前に。印・線は写しの奥に
      if (cls.startsWith('fd-tip')) layer.append(el)
      else layer.insertBefore(el, drag.ghost)
      this.parts.push(el)
      return el
    }
    /** 吹き出し：写しの右に出す。画面の右の端からはみ出すなら、写しの左に */
    const tip = (cls: string, text: string, left = false) => {
      const el = add(cls, { left: '0px', top: `${y + 22}px` }, text)
      const gx = x + drag.off.x + shift
      const right = gx + drag.ghost.offsetWidth + 10
      const toLeft = left || right + el.offsetWidth > window.innerWidth - 8
      el.style.left = `${toLeft ? Math.max(8, gx - 10 - el.offsetWidth) : right}px`
    }
    // 元の所（見えていれば）
    const own = this.boxesOf(drag.plan.rowId)
    for (const b of own) add('fd-dim', { left: `${b.left - 4}px`, top: `${b.top - 4}px`, width: `${b.right - b.left + 8}px`, height: `${b.bottom - b.top + 8}px` })
    if (drag.turning) return
    // 「‹ ›」の上：少し待つと、めくる
    document.querySelectorAll('.fd-arrow-on').forEach((a) => a !== arrow?.el && a.classList.remove('fd-arrow-on'))
    if (arrow) {
      arrow.el.classList.add('fd-arrow-on')
      tip('fd-tip hint', arrow.dir > 0 ? 'ここで少し待つと、次のページへ' : 'ここで少し待つと、前のページへ', arrow.dir > 0)
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
    // 矢印の下のページ（紙面の見えている所の中）。なければ紙面の外
    const page = pages.find((p) => {
      const a = this.paperArea(p)
      return x >= a.left && x <= a.right && y >= a.top && y <= a.bottom
    })
    // 印（いまの所は出さない。台の外の所は出さない）
    const inStage = (yy: number) => yy >= s.top && yy <= s.bottom
    const clip = (t: { left: number; right: number }) => ({ left: Math.max(t.left, s.left), right: Math.min(t.right, s.right) })
    for (const t of targets) {
      if ('join' in t) {
        if (inStage(t.join.top) || inStage(t.join.bottom)) add('fd-vline', { left: `${t.join.right + 12}px`, top: `${Math.max(t.join.top, s.top)}px`, height: `${Math.min(t.join.bottom, s.bottom) - Math.max(t.join.top, s.top)}px` })
      } else if (!(t.drop.kind === 'gap' && t.drop.at === drag.plan.current) && inStage(t.y)) add('fd-tick', { left: `${Math.max(t.left - 30, s.left + 2)}px`, top: `${t.y}px` })
    }
    let active: Target | null = null
    let why: string | null = null
    if (!page) why = 'ここで離すと、やめます'
    // 矢印が、つかんだ図の上にある間は「元の所」（ゆっくり押した・少し手が動いただけで、動かさない）
    else if (own.some((b) => x >= b.left - 4 && x <= b.right + 4 && y >= b.top - 4 && y <= b.bottom + 4)) active = targets.find((t) => t.drop.kind === 'gap' && t.drop.at === drag.plan.current) ?? null
    else {
      why = this.whyNot(y, page)
      if (!why) {
        const onPage = targets.filter((t) => t.page === page)
        active = onPage.find((t) => 'join' in t && x >= t.join.left + t.join.width * 0.5 && y >= t.join.top - 10 && y <= t.join.bottom + 10) ?? null
        if (!active) for (const t of onPage) if (!('join' in t) && inStage(t.y) && (!active || Math.abs(t.y - y) < Math.abs((active as { y: number }).y - y))) active = t
        // このページに置ける所がない：見開きで隣のページにあれば、そちらへ。なければ、ページをめくる案内（前は見開きでも、めくる案内を出していた）
        if (!active) why = targets.some((t) => t.page !== page) ? 'このページには置ける所がありません（隣のページなら置けます）' : 'このページには置ける所がありません（「‹」「›」の上で少し待つと、ページをめくれます）'
      }
    }
    drag.active = active?.drop ?? null
    if (active && 'join' in active) add('fd-vline on', { left: `${active.join.right + 12}px`, top: `${active.join.top}px`, height: `${active.join.height}px` }, '横に並べる')
    else if (active) {
      const c = clip(active)
      add('fd-line on', { left: `${c.left}px`, top: `${active.y}px`, width: `${Math.max(0, c.right - c.left)}px` }, active.drop.kind === 'gap' && active.drop.at === drag.plan.current ? '元の所' : 'ここに置く')
    }
    if (why) tip(page ? 'fd-tip' : 'fd-tip hint', why)
  }

  /** 置けない所のわけ（本文の（図n）がある段落より上・小見出しの外）。置ける所なら null */
  private whyNot(y: number, page: HTMLElement): string | null {
    const drag = this.drag!
    const n = this.host.numberOf(drag.figureId)
    const onPage = (boxes: Box[]) => boxes.filter((b) => b.page === page)
    const ref = onPage(this.boxesOf(drag.plan.ref)).at(-1)
    if (ref && y < ref.bottom) return `図は、本文の「（図${n ?? 'n'}）」がある段落より上には置けません`
    const from = onPage(this.boxesOf(drag.plan.section.from)).at(-1)
    if (from && y < from.bottom) return '図は、小見出しの外には置けません'
    const to = onPage(this.boxesOf(drag.plan.section.to))[0]
    if (to && y > to.top) return '図は、小見出しの外には置けません'
    return null
  }

  /** 矢印の下の「‹」「›」（押せるもの） */
  private arrowAt(x: number, y: number): { el: HTMLElement; dir: 1 | -1 } | null {
    // 紙面の「‹ ›」と、拡大しているときの右下の帯の「‹ ›」（紙面の方は隠している：mockups/v63 ① 案A）。見えているものだけ
    for (const [sel, dir] of [['.stage .arrow.next, .stage .bar-arrow.next', 1], ['.stage .arrow.prev, .stage .bar-arrow.prev', -1]] as const) {
      for (const el of document.querySelectorAll<HTMLButtonElement>(sel)) {
        if (el.disabled) continue
        const r = el.getBoundingClientRect()
        if (r.width && x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12) return { el, dir }
      }
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
