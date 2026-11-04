// 録った操作の動画と、ナレーションの文を合わせる（依頼者 2026-11-04）。
// - 録画は速めない（前は声の長さに合わせて 2.5 倍まで速めていたが、「速すぎて何をしているか分からない」と言われた）
// - 文 i の声は、録画の印 s(i) の所で流し始める。その文の操作（印 s(i) から s(i+1) まで）は、ふつうの速さで見せる
//   - 声のほうが長い：操作の終わりの絵のまま、声が終わるまで待つ（次の印の手前で止める。次の文の字幕・拡大が先に出ないように）
//   - 操作のほうが長い：次の文の声を、その分だけ遅らせる
// - 待つだけの所（PDF を作っている間など。印 _cut から _cutEnd まで）と、始めの印より前・終わり（_end）より後は切る
// compose.mjs（動画のコマの時刻）と mux.mjs（声を置く時刻）が使う

/**
 * @param {object} o
 * @param {number[]} o.anchors 文ごとの印の、録画の時刻（秒。小さい順）
 * @param {number[]} o.durs 文ごとの声の長さ（秒。文のあとの自然な間を含む）
 * @param {number} o.srcEnd 録画の使う所の終わり（秒）
 * @param {{ from: number, to: number }[]} [o.cuts] 切る所（録画の時刻）
 * @param {number} [o.lead] 始めの印の前に見せる長さ（秒）
 * @param {number} [o.gap] 声と声の間に足す長さ（秒）
 * @param {number} [o.tail] 最後の声のあとの長さ（秒）
 * @returns {{ at: (T: number) => number, outs: number[], end: number }} at：出来上がりの時刻 T → 録画の時刻。outs：文 i の声を流し始める時刻。end：長さ
 */
export function planTimeline({ anchors, durs, srcEnd, cuts = [], lead = 0.6, gap = 0.3, tail = 0.9 }) {
  // 切る所（重なりはまとめる）。終わり（srcEnd）より後は、切る所にしない（at で srcEnd までにする。
  // 前は終わりの後を「無限に長い切る所」にしていて、最後のコマの時刻が数でなくなり、最初の字幕が出た：2026-11-04）
  const all = [{ from: 0, to: Math.max(0, anchors[0] - lead) }, ...cuts]
    .map((c) => ({ from: c.from, to: Math.min(c.to, srcEnd) }))
    .filter((c) => c.to > c.from)
    .sort((a, b) => a.from - b.from)
  const merged = []
  for (const c of all) {
    const last = merged.at(-1)
    if (last && c.from <= last.to) last.to = Math.max(last.to, c.to)
    else merged.push({ ...c })
  }
  /** 録画の時刻 → 切ったあとの時刻 */
  const squeeze = (src) => src - merged.reduce((sum, c) => sum + Math.max(0, Math.min(src, c.to) - c.from), 0)
  /** 切ったあとの時刻 → 録画の時刻 */
  const expand = (c) => {
    let src = c
    for (const m of merged) {
      if (m.from <= src) src += m.to - m.from
      else break
    }
    return src
  }
  const ca = anchors.map(squeeze)
  const cEnd = squeeze(srcEnd)
  const outs = []
  let out = ca[0]
  for (let i = 0; i < ca.length; i++) {
    outs.push(out)
    const seg = (i + 1 < ca.length ? ca[i + 1] : cEnd) - ca[i]
    out += Math.max(seg, durs[i] + (i + 1 < ca.length ? gap : tail))
  }
  const end = out
  const at = (T) => Math.min(srcEnd, atRaw(T))
  const atRaw = (T) => {
    if (T < outs[0]) return expand(Math.max(0, T))
    let i = outs.length - 1
    while (i > 0 && T < outs[i]) i--
    const last = i + 1 >= ca.length
    const seg = (last ? cEnd : ca[i + 1]) - ca[i]
    // 次の印の少し手前で止める（最後の文は、終わりの絵で止める）
    return expand(ca[i] + Math.min(T - outs[i], last ? seg : Math.max(0, seg - 0.05)))
  }
  return { at, outs, end }
}
