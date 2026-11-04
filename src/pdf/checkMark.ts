/**
 * 最終提出の許可の前の PDF に入れる「点検用」の印（依頼者の選択 2026-11-04 mockups/v102 案B）。
 * 全ページの右上の余白に、赤い枠の「点検用」（本文にはかからない。白黒で印刷すると灰色の枠）。
 * PDF にする紙面（editor.pdfPages）の各ページに置き、撮り終えたら外す。
 * 字間を空けると最後の字のうしろにも空きが付くので、左の内側の余白を、その分だけ広くする（字が枠のまん中に来るように。依頼者の指摘 2026-11-04）
 */
const MARK_STYLE = [
  'position:absolute',
  'top:22pt',
  'right:28pt',
  'z-index:10',
  'box-sizing:content-box',
  'padding:1.5pt 6pt 1.5pt calc(6pt + 0.15em)',
  'border:1.2pt solid #c62828',
  'background:#fff',
  'color:#c62828',
  "font-family:'BIZ UDPGothic',sans-serif",
  'font-size:10pt',
  'font-weight:700',
  'line-height:1.4',
  'letter-spacing:0.15em',
  'white-space:nowrap',
].join(';')

export const CHECK_MARK_TEXT = '点検用'

/** PDF に入れるページ（.print-skip でないページ）に印を置く。返す関数で外す */
export function addCheckMarks(pages: HTMLElement[]): () => void {
  const added: { mark: HTMLElement; page: HTMLElement; position: string }[] = []
  for (const page of pages) {
    if (page.classList.contains('print-skip')) continue
    const mark = document.createElement('div')
    mark.className = 'check-mark'
    mark.textContent = CHECK_MARK_TEXT
    mark.style.cssText = MARK_STYLE
    const position = page.style.position
    if (getComputedStyle(page).position === 'static') page.style.position = 'relative'
    page.append(mark)
    added.push({ mark, page, position })
  }
  return () => {
    for (const { mark, page, position } of added) {
      mark.remove()
      page.style.position = position
    }
  }
}
