/**
 * 紙面を1ページずつ表示する台（ステージ）の大きさを決める。
 * - 全体：1ページ全体が収まる倍率にし、中央に置く
 * - 拡大：紙面の横幅を台の幅いっぱいにし、上下にスクロールする
 * - 見開き（PC だけ）：いまのページと次のページを左右に並べ、2ページが入る倍率にする
 * 紙面のまわりに空ける幅は CSS の変数（--inset-side・--inset-top・--inset-bottom）で決める（画面の幅で変えるため）。
 * 求めた倍率と位置は、台の要素の CSS 変数（--s・--page-w・--page-h・--page-top）に書き込む。
 */

/** A4 の大きさ（CSS の px） */
export const PAGE_W = 793.7
export const PAGE_H = 1122.52
const MAX_ZOOM = 1.4
/** パソコンの1ページの表示の左右の余白（index.css の .stage の --inset-side。道具と ‹ › の分）。台が狭いか（narrow・tight）を、この余白で決める */
const ROOMY_SIDE = 185
/**
 * 全体の表示の倍率の下限（台がとても低いとき（キーボードなど）に、紙面がつぶれないため）。
 * 前は 0.2 倍で、横向きのスマホ（844×390 など）では紙面が台に収まらず、紙面の下の端がページ送りに隠れていた（800×360 では 25px ほど）。
 * いまは、ふつうの横向きのスマホでは紙面がページ送りの上に収まる倍率になる
 */
const MIN_FIT = 0.1
/** 見開きを出せる台の幅（px）の下限。これより狭いと紙面がとても小さくなるので、見開きは出さない（全体にする） */
export const SPREAD_MIN_W = 640

/** スマホで指で広げられる大きさの上限（本文の幅を画面の幅に合わせる倍率の何倍まで。1字 30px ほど） */
export const PINCH_MAX = 3
/**
 * パソコンの表示の大きさの段（「1ページ」の大きさを 100% として。依頼者の選択 2026-10-26：mockups/v64 案B。
 * 前は「拡大」（本文の幅に合わせる大きさ）を 100% とし、それより小さくできず、「1ページ」との間の大きさにできなかった：mockups/v59 案A）。
 * 「拡大」のボタンは、本文の幅に合わせる大きさ（窓の大きさで 130〜150% ほど）。「－ ＋」は、そこから前後の段へ。
 * 紙面が台より広くなるときは、本文の版面を台の真ん中に置き（左右の余白は切れる）、本文も入らなければ横にも動かせるようにする
 */
export const ZOOM_STEPS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3]
/** 指で広げた倍率が、本文の幅に合わせる倍率にこれより近ければ、本文の幅に合わせる（そろえやすく。比で） */
const SNAP_TO_TEXT = 0.04

export class PageStage {
  scale = 1
  zoomed = false
  /** パソコンで拡大しているときの大きさ（「1ページ」の大きさの何倍か。ZOOM_STEPS の1つ）。null なら「拡大」（本文の幅に合わせる。スマホはいつも null） */
  zoomLevel: number | null = null
  /**
   * スマホ：指で広げた・縮めた倍率（拡大しているとき。null なら、本文の幅を画面の幅に合わせる：--zoom-to-text）。
   * このときは、紙面の左の端を台の左の端に置き（紙面が台より狭ければ真ん中）、横の位置は紙面の表示枠のスクロールで決める（editor/reportEditor.ts の applyPinch）
   */
  private free: number | null = null
  /** 1ページ全体の表示の倍率（拡大していても、1ページの表示の余白で求める。指で縮めるときの下限・「－ ＋」の 100%） */
  fitScale = 0.5
  /** 本文の幅を台の幅に合わせる倍率（スマホの拡大の基準） */
  textScale = 1
  /** 指で広げて、紙面が台より広い（横にも動かせる。台の印 pan-x：index.css） */
  panX = false
  /**
   * 見開き（mockups/v35 ③ 案A。PC だけ）：いまのページと次のページを並べる。道具は台の左端、←→は下（拡大のときと同じ）。
   * 2ページを左右に並べ、紙面の上の端に合わせる。右のページを左のページからずらす幅（縮小前の px）は --pair-dx に書き込む（index.css の「v35 見開き」）
   */
  spread = false
  private readonly stage: HTMLElement
  private readonly onChange: () => void

  constructor(stage: HTMLElement, onChange: () => void) {
    this.stage = stage
    this.onChange = onChange
    new ResizeObserver(() => this.fit()).observe(stage)
  }

  /** 拡大する（本文の幅に合わせる）・全体に戻す（どちらでも、見開きはやめる。指で広げた倍率・「－ ＋」で選んだ大きさもやめる） */
  setZoom(zoomed: boolean): void {
    this.zoomed = zoomed
    this.spread = false
    this.free = null
    this.zoomLevel = null
    this.fit()
  }

  /** パソコン：「1ページ」の大きさの level 倍で拡大する（「－ ＋」。ZOOM_STEPS の1つ） */
  zoomTo(level: number): void {
    this.zoomed = true
    this.spread = false
    this.free = null
    this.zoomLevel = level
    this.fit()
  }

  /** いまの大きさが「1ページ」の大きさの何倍か（「－ ＋」の間の数字。1ページ・見開きのときは 1） */
  get relativeZoom(): number {
    return this.zoomed && !this.spread ? this.scale / this.fitScale : 1
  }

  /** スマホで指で広げた・縮めた倍率の範囲（1ページ全体〜本文の幅に合わせる倍率の PINCH_MAX 倍） */
  clampPinch(scale: number): number {
    return Math.max(this.fitScale, Math.min(this.textScale * PINCH_MAX, scale))
  }

  /**
   * スマホ：指で広げた・縮めた倍率にする（拡大の表示。本文の幅に合わせる倍率に近ければ、それにそろえる）。
   * 横の位置（紙面の表示枠のスクロール）は、呼び出し側が決める
   */
  setFreeZoom(scale: number): void {
    const s = this.clampPinch(scale)
    this.zoomed = true
    this.spread = false
    this.free = Math.abs(s / this.textScale - 1) < SNAP_TO_TEXT ? null : s
    this.fit()
  }

  /** 指で広げた倍率で表示しているか（本文の幅に合わせる拡大・全体の表示なら false） */
  get freeZoom(): boolean {
    return this.zoomed && this.free !== null
  }

  /** 見開きにする・やめる（台が狭いときは、見開きにしない） */
  setSpread(on: boolean): void {
    this.spread = on && this.spreadFits
    if (this.spread) this.zoomed = false
    this.fit()
  }

  /** 台が、見開きを出せる広さか */
  get spreadFits(): boolean {
    return this.stage.clientWidth >= SPREAD_MIN_W
  }

  private inset(name: string, fallback: number): number {
    const value = parseFloat(getComputedStyle(this.stage).getPropertyValue(name))
    return Number.isFinite(value) ? value : fallback
  }

  /**
   * 1ページの表示の倍率（いま拡大していても、1ページの表示の余白で求める。拡大の大きさの基準：ZOOM_STEPS）。
   * 余白は台の印（zoomed・narrow・tight）で変わるので、いったん1ページの表示の印にして測り、元に戻す
   */
  private pageFitScale(w: number, h: number): number {
    const cl = this.stage.classList
    const saved = ['zoomed', 'spread', 'narrow', 'tight'].map((c) => [c, cl.contains(c)] as const)
    cl.remove('zoomed', 'spread')
    const top = this.inset('--inset-top', 18)
    const bottom = this.inset('--inset-bottom', 18)
    const tight = (w - ROOMY_SIDE * 2) / PAGE_W < ((h - top - bottom) / PAGE_H) * 0.9
    cl.toggle('narrow', tight)
    cl.toggle('tight', tight)
    const side = this.inset('--inset-side', 180)
    for (const [c, on] of saved) cl.toggle(c, on)
    return Math.max(MIN_FIT, Math.min((w - side * 2) / PAGE_W, (h - top - bottom) / PAGE_H))
  }

  fit(): void {
    const w = this.stage.clientWidth
    const h = this.stage.clientHeight
    if (w === 0 || h === 0) return
    const pageFit = this.pageFitScale(w, h)
    // 台が狭くなったら（欄の幅を広げた・画面を小さくした）、見開きをやめて全体にする
    if (this.spread && !this.spreadFits) this.spread = false
    // 拡大しているか・見開きかで余白の幅を変えられるよう、先にクラスを付ける
    this.stage.classList.toggle('zoomed', this.zoomed)
    this.stage.classList.toggle('spread', this.spread)
    const top = this.inset('--inset-top', 18)
    // スマホの紙面の下の案内の帯は、紙面に重ねる（帯の分は空けない。どのページも紙面が同じ位置に出る。app/PageBand.tsx・mockups/v46 案B）
    const bottom = this.inset('--inset-bottom', 18)
    // 台が狭く、紙面の大きさが台の幅で決まるとき（ブラウザの窓が小さい）：narrow を付ける。パソコンは ‹ › を右下に移し、その分の左右の余白を
    // 空けない（--inset-side を小さくする。index.css。1100×700 で紙面の幅 266px → 412px：PC の試し 2026-10-24、依頼者の選択 mockups/v55 ④ 案A）
    // （1440×900 などは、幅と高さのどちらで決まってもほぼ同じ大きさなので付けない。幅で決まる大きさが、高さで決まる大きさの9割より小さいときだけ）。
    // 拡大のときも tight を付け、本文の幅を台に合わせて広げる（前は拡大の余白と narrow の余白がほぼ同じで、「拡大」を押しても大きくならなかった：PC の試し 2026-10-25）
    const tight = (w - ROOMY_SIDE * 2) / PAGE_W < ((h - top - bottom) / PAGE_H) * 0.9
    this.stage.classList.toggle('narrow', tight && !this.zoomed && !this.spread)
    this.stage.classList.toggle('tight', tight)
    const side = this.inset('--inset-side', 180)
    // スマホで拡大するときは、余白を外して本文の幅を画面の幅に合わせる（--zoom-to-text: 1）
    const toText = this.zoomed && this.inset('--zoom-to-text', 0) === 1
    // 本文の版面（左右の余白の内側。いまの余白から：layout/pageGeometry.ts）
    const TEXT_LEFT = textLeftPx()
    const TEXT_W = textWidthPx()
    const byWidth = (w - side * 2) / (toText ? TEXT_W : PAGE_W)
    this.textScale = (w - side * 2) / TEXT_W
    // 指で広げた倍率（スマホ）：紙面の左の端を台の左の端に（台より狭ければ真ん中に）置き、横の位置はスクロールで決める
    const free = this.zoomed && this.free !== null ? this.clampPinch(this.free) : null
    this.fitScale = pageFit
    // 「拡大」の大きさ（本文の幅に合わせる）。「－ ＋」で選んだ大きさは、1ページの大きさの zoomLevel 倍
    const base = toText ? byWidth : Math.min(MAX_ZOOM, byWidth)
    const stepped = this.zoomed && free === null && !toText && this.zoomLevel !== null
    let scale = free ?? (this.zoomed ? (stepped ? pageFit * this.zoomLevel! : base) : pageFit)
    // 「拡大」より大きい（紙面の幅が台に入りきらないことがある）
    const over = stepped && scale > base * 1.001
    let pageTop = this.zoomed ? top : top + (h - top - bottom - PAGE_H * scale) / 2
    let pageLeft = free !== null ? Math.max(0, (w - PAGE_W * scale) / 2) : toText ? side - TEXT_LEFT * scale : (w - PAGE_W * scale) / 2
    // 「拡大」の倍率を上げて紙面が台より広い：本文の版面を台の真ん中に。真ん中に入らなければ、本文の左を台の左の余白に置く。
    // それでも本文の右の端が台からはみ出すときだけ、横にも動かせるようにする（左右の余白は切れる）
    const wideText = over && TEXT_W * scale > w - side * 2
    if (over && PAGE_W * scale > w - side * 2) pageLeft = wideText ? side - TEXT_LEFT * scale : (w - TEXT_W * scale) / 2 - TEXT_LEFT * scale
    // 本文の右の端が台の右（縦のスクロールバーの分を除く）からはみ出すなら、横にも動かす（小さい窓では 125% から少し切れていた：試し 2026-10-26）
    this.panX = (free !== null && PAGE_W * scale > w) || (over && pageLeft + (TEXT_LEFT + TEXT_W) * scale > w - 24)
    this.stage.classList.toggle('pan-x', this.panX)
    const s = this.stage.style
    if (this.spread) {
      // 見開き：左は道具の分、右は少し、2ページの間は gap、下は←→と「全体／見開き／拡大」の分を空けて、2ページが入る倍率にする
      const left = this.inset('--spread-left', 110)
      const right = this.inset('--spread-right', 24)
      const gap = this.inset('--spread-gap', 14)
      const below = this.inset('--spread-bottom', 72)
      scale = Math.max(MIN_FIT, Math.min((w - left - right - gap) / 2 / PAGE_W, (h - top - below) / PAGE_H))
      pageTop = top
      pageLeft = left + (w - left - right - (PAGE_W * scale * 2 + gap)) / 2
      s.setProperty('--pair-dx', `${PAGE_W + gap / scale}px`)
    }
    s.setProperty('--s', String(scale))
    s.setProperty('--page-w', `${PAGE_W * scale}px`)
    s.setProperty('--page-h', `${PAGE_H * scale}px`)
    s.setProperty('--page-top', `${pageTop}px`)
    s.setProperty('--page-left', `${pageLeft}px`)
    this.scale = scale
    this.onChange()
  }
}import { textLeftPx, textWidthPx } from '../layout/pageGeometry'

