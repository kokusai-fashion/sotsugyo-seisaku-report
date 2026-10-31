/**
 * 図・表のすぐ下に出す「＋ ここに続きを書く」（mockups/v32 ① 案A）。
 * 図・表のあとに続きを書く場所が分からず、図の下の空いている所を押しても何も起きなかったため。
 * - 図・表を選んだとき（タイトルを書いているときも）、その図・表のすぐ下に出す
 * - 章の最後の図・表が、ページの最後で下が空いているときは、選ばなくても出す
 * - 見出し（大見出し・小見出し）が章のいちばん最後にあるときも、同じように、見出しのすぐ下に出す
 *   （足したばかりの小見出しの下の空いた所を押して書くと、見出しの続きになっていたため。見出しを書いている間も出す）
 * どれも、同じページで後ろに文などが続かないときだけ、そのすぐ下に出す（文の上に重ねない）。本文の範囲に空きがなければ、
 * ページの下の余白に、字の分の長さで出す（ページ番号に重ねない。mockups/v83 案A）。
 * 後ろに段落が続くときは、続きの段落を押せばよい（タイトル・見出しで Enter を押しても、その後ろに段落ができる）。
 * 押すと、図・表・見出しのすぐ後ろに新しい段落ができて、書き始める（編集の中核の continueAfter）。
 * 紙面に重ねる層（入力欄と同じ所）に置く、画面だけの部品。紙面の中には入れないので、PDF・印刷には出ず、ページの組み方も変えない
 */

/** A4 の幅（本文の版面・本文の領域の下端は、いまの余白から：layout/pageGeometry.ts） */
const PAGE_W = 793.7
/** 行の高さと、図・表との間（画面の px。図を選んだときの枠より下に出す）。スマホの行の高さは 44px（index.css。rowHeight で測る） */
const ROW_H = 30
const GAP = 12

/** 行の高さ（画面の px）。行の CSS の高さ（PC 30px・スマホ 44px）を読む。隠していても読める。行がなければ ROW_H */
function rowHeight(doc: Document): number {
  const row = doc.querySelector<HTMLElement>('.continue-row')
  const h = row ? parseFloat(getComputedStyle(row).height) : NaN
  return Number.isFinite(h) && h > 0 ? h : ROW_H
}

const PLUS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'

/** 行を出す図・表・見出し */
export interface ContinueTarget {
  /** 図の ID（まとまりの中のどれか）か、表の ID、小見出しの ID、大見出しの章の ID */
  objectId: string
  /** 紙面の図のまとまり・表（いま見ているページにある部分）・見出しの行 */
  element: HTMLElement
  /** その要素があるページ */
  page: HTMLElement
  /** 本文の範囲に空きがないので、ページの下の余白に出す（placeBelow の 'margin'） */
  margin?: boolean
}

/** 余白に出すときの、図・表との間（画面の px。余白は狭いので、ふつうより詰める） */
const MARGIN_GAP = 6

export class ContinueRow {
  readonly element: HTMLButtonElement
  private readonly layer: HTMLElement
  private target: ContinueTarget | null = null

  /** onPick：押された（図・表・見出しの後ろに段落を作って書き始める） */
  constructor(layer: HTMLElement, onPick: (objectId: string) => void) {
    this.layer = layer
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'continue-row'
    b.hidden = true
    b.title = 'この後ろに新しい段落を作って、続きを書きます'
    b.innerHTML = `${PLUS}<span>ここに続きを書く</span>`
    // 図のタイトルを書いている欄から、フォーカスを移さない（押したあとの処理で確定する）
    b.addEventListener('mousedown', (e) => e.preventDefault())
    b.addEventListener('click', () => {
      if (this.target) onPick(this.target.objectId)
    })
    layer.append(b)
    this.element = b
  }

  /** 図・表・見出しのすぐ下に出す（null なら隠す）。紙面の位置が変わったとき（組み直し・スクロール・倍率）も呼び直す */
  show(target: ContinueTarget | null): void {
    this.target = target
    const b = this.element
    if (!target) {
      b.hidden = true
      return
    }
    const page = target.page.getBoundingClientRect()
    const box = target.element.getBoundingClientRect()
    const layer = this.layer.getBoundingClientRect()
    const k = page.width / PAGE_W
    // ページの下の余白に出すとき（本文の範囲に空きがない）：字の分の長さで左に寄せ、ページ番号（下の真ん中）に重ねない（mockups/v83 案A）
    const margin = !!target.margin
    Object.assign(b.style, {
      left: `${page.left + textLeftPx() * k - layer.left}px`,
      top: `${box.bottom + (margin ? MARGIN_GAP : GAP) - layer.top}px`,
      width: margin ? 'auto' : `${textWidthPx() * k}px`,
    })
    b.classList.toggle('in-margin', margin)
    b.hidden = false
    // 紙面が小さいとき（スマホの横向き）は、本文の幅に言葉が入らず、枠の外にはみ出していた。
    // ページの幅いっぱいまで広げ、それでも入らなければ、字を少し詰める（tight。index.css）
    b.classList.remove('tight')
    if (!margin && b.scrollWidth > b.clientWidth + 1) {
      Object.assign(b.style, { left: `${page.left + 4 - layer.left}px`, width: `${Math.max(0, page.width - 8)}px` })
      if (b.scrollWidth > b.clientWidth + 1) b.classList.add('tight')
    }
  }
}

/**
 * el（図のまとまり・表・見出し）の下に行を出せるか。ページの本文の最後にあり（後ろに文字・段落・改ページの印がない）、
 * その下に行が入るだけ本文の範囲が空いていれば 'room'。空いていなければ、ページの下の余白に出す 'margin'
 * （表・図がページの下まで来ると行が出ず、続きを書く所が見つからなかった：学生の試し 3回目・4回目 2026-10-31。mockups/v83 案A）。
 * 後ろに文などが続くときは null（行は出さない。後ろの文に重ねないため。続きの段落を押せばよい）。
 * ページの中の本文の位置は、組んだ紙面の文字と要素の範囲から測る（figureFloat.ts と同じ）。改ページの印は高さがないので別に見る
 */
export function placeBelow(page: HTMLElement, el: HTMLElement): 'room' | 'margin' | null {
  const p = page.getBoundingClientRect()
  const bottom = el.getBoundingClientRect().bottom
  for (const section of page.querySelectorAll('section')) {
    const range = document.createRange()
    range.selectNodeContents(section)
    if ([...range.getClientRects()].some((r) => r.height > 0 && r.top >= bottom - 1)) return null
  }
  if ([...page.querySelectorAll('.page-break')].some((b) => b.getBoundingClientRect().top >= bottom - 1)) return null
  return p.top + p.height * contentBottomRatio() - bottom < GAP + rowHeight(page.ownerDocument) ? 'margin' : 'room'
}import { contentBottomRatio, textLeftPx, textWidthPx } from '../layout/pageGeometry'

