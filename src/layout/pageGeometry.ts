import type { PageMargins, YearConfig } from '../config'

/**
 * 本文・抄録・目次のページの余白（mm）。管理ページの「詳細設定」の「ページの余白」で決める（依頼者の判断 2026-10-27：mockups/v69 案1・案A）。
 * データ提出になり綴じ代が要らないので、左右は同じ。はじめは 上下 25mm・左右 30mm（手順書の 上・下・右 25mm、左 35mm から、
 * 1行の長さ 150mm を変えずに真ん中へ寄せた）。余白を変えても 1ページ38字×38行のまま（字の間と行の間で合わせる：reportCss.ts）。
 * 表紙（20mm）と作品写真のページ（ふちなし）は、この余白によらない
 */

export type { PageMargins }

export const PAGE_WIDTH_MM = 210
export const PAGE_HEIGHT_MM = 297
export const DEFAULT_MARGINS: PageMargins = { top: 25, bottom: 25, side: 30 }
/**
 * 入れてよい範囲（mm）。左右は 30mm まで：本文は 11pt で38字、抄録は 10.5pt で40字が、字の間をつめずに1行に入る幅（約148mm）を残す。
 * 上下は、抄録の最多の行数が1ページに入るかも確かめる（validate.ts）
 */
export const MARGIN_RANGE: Record<keyof PageMargins, [number, number]> = { top: [15, 35], bottom: [15, 35], side: [20, 30] }

/** 設定の余白（ない・範囲の外の値は、はじめの値） */
export function marginsOf(config: Pick<YearConfig, 'margins'> | null | undefined): PageMargins {
  const m = config?.margins
  const pick = (key: keyof PageMargins) => {
    const v: unknown = m?.[key]
    const [min, max] = MARGIN_RANGE[key]
    return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : DEFAULT_MARGINS[key]
  }
  return { top: pick('top'), bottom: pick('bottom'), side: pick('side') }
}

let current: PageMargins = DEFAULT_MARGINS

/**
 * いま組んでいる報告書の余白にする（学生のツール：書く画面を作ったとき・設定が変わったとき・組むとき。管理ページ：見本を作るとき）。
 * 紙面の上の書く欄・図を運ぶ線・図の置き方など、設定を受け取らない所は pageMargins() で読む
 */
export function setPageMargins(margins: PageMargins): void {
  current = margins
}

/** いまの余白 */
export function pageMargins(): PageMargins {
  return current
}

/** 本文の1行の長さ（mm） */
export const textWidthMm = (m: PageMargins = current) => PAGE_WIDTH_MM - 2 * m.side
/** 本文の領域の高さ（mm） */
export const textHeightMm = (m: PageMargins = current) => PAGE_HEIGHT_MM - m.top - m.bottom
/** 本文の領域の下の端（紙の上からの mm） */
export const contentBottomMm = (m: PageMargins = current) => PAGE_HEIGHT_MM - m.bottom

const MM_TO_PX = 96 / 25.4
/** 画面の紙面（CSS px。A4 の幅 793.7px）での、本文の領域の左の端と幅 */
export const textLeftPx = (m: PageMargins = current) => m.side * MM_TO_PX
export const textWidthPx = (m: PageMargins = current) => textWidthMm(m) * MM_TO_PX
/** 紙の高さに対する、本文の領域の上の端・下の端の割合 */
export const contentTopRatio = (m: PageMargins = current) => m.top / PAGE_HEIGHT_MM
export const contentBottomRatio = (m: PageMargins = current) => contentBottomMm(m) / PAGE_HEIGHT_MM
