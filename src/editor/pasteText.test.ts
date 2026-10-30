import { describe, expect, it } from 'vitest'
import { joinWrappedLines, listishLine, tidyPasted } from './pasteText'

describe('貼り付けた文をそろえる（学生の試し 5回目 2026-10-30）', () => {
  it('見えない字：Shift+Enter・行の区切りは改行、ノーブレークスペースは空白、ゼロ幅・BOM・ソフトハイフンは除く。分かれた濁点は1字に', () => {
    expect(tidyPasted('袖を\u000B縫った 糸 は​金﻿色­。が')).toBe('袖を\n縫った\n糸 は金色。が')
  })
  it('ウェブのふりがな（ルビ）を除く', () => {
    const html = '<p><ruby>刺繍<rp>(</rp><rt>ししゅう</rt><rp>)</rp></ruby>をした</p>'
    expect(tidyPasted('刺繍ししゅうをした', html)).toBe('刺繍をした')
    expect(tidyPasted('刺繍(ししゅう)をした', html)).toBe('刺繍をした')
    expect(tidyPasted('刺繍ししゅうをした')).toBe('刺繍ししゅうをした')
  })
  it('PDF の行の折り返しをつなぐ（文の途中の改行）。ふつうの段落の分かれ目・見出し・箇条はつながない', () => {
    const pdf = ['本制作では、旅立ちの場面の若々しさと帰還の場面の頼もしさの両方を、一着で見せることを目標と', 'した。前半は袖を軽く、後半は肩に重ねる布で頼もしさを出すように工夫して制作を', '進めた。', 'Ⅱ．制作過程', '仮縫いでは袖の膨らみが大きすぎたため、袖山を3cm下げて袖幅も細くするように直し', 'た。']
    expect(joinWrappedLines(pdf)).toEqual({
      joined: true,
      lines: ['本制作では、旅立ちの場面の若々しさと帰還の場面の頼もしさの両方を、一着で見せることを目標とした。前半は袖を軽く、後半は肩に重ねる布で頼もしさを出すように工夫して制作を進めた。', 'Ⅱ．制作過程', '仮縫いでは袖の膨らみが大きすぎたため、袖山を3cm下げて袖幅も細くするように直した。'],
    })
    const draft = ['最初に生地の色を確かめた。', '次に型紙を写した。', '最後に仮縫いをした。']
    expect(joinWrappedLines(draft)).toEqual({ lines: draft, joined: false })
  })
  it('箇条書きの番号の行', () => {
    expect(['1.　ミシン', '①シーチングで仮縫い', '（1）素材'].map(listishLine)).toEqual([true, true, true])
    expect(['Ⅱ．制作過程', 'ⅰ．素材', '最初に生地を選んだ。'].map(listishLine)).toEqual([false, false, false])
  })
})
