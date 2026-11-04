// 録った操作の動画を、ナレーションの文の時刻に合わせる（依頼者の希望 2026-11-04：話している所で、その操作が見えるように）。
// 録画の印（mark）ごとに「ナレーションのこの時刻に始める」を決め（anchors）、その間の長さを合わせる：
// - 声のほうが長い：その操作をふつうの速さで見せたあと、終わりの絵のまま待つ（次の文まで。マウスがゆっくり動くより自然）
// - 声のほうが短い：その操作を速める（速さの上限を超えるときは、上限の速さで見せて、それより後の操作を同じだけ遅らせる）
// compose.mjs から使う（ページの中でも動くよう、この関数は外のものを使わない。toString して渡せる）

/**
 * @param {{ src: number, out: number }[]} anchors 録画の時刻 src（秒）の操作を、出来上がりの時刻 out（秒）に始める。src・out とも小さい順
 * @param {number} srcEnd 録画の終わり（秒）
 * @param {number} outEnd 出来上がりの終わり（秒。速さの上限でずれたら、その分だけ長くなる）
 * @param {number} [maxSpeed] 速める上限（ふつう 2.5 倍）
 * @returns {{ at: (T: number) => number, end: number }} at：出来上がりの時刻 T → 録画の時刻。end：出来上がりの長さ
 */
export function makeWarp(anchors, srcEnd, outEnd, maxSpeed = 2.5) {
  const points = [{ src: 0, out: 0 }, ...anchors.filter((a) => a.src > 0 && a.src < srcEnd), { src: srcEnd, out: outEnd }]
  const fixed = [{ src: 0, out: 0 }]
  let delay = 0
  for (let i = 1; i < points.length; i++) {
    const prev = fixed[i - 1]
    const s = points[i].src - points[i - 1].src
    let out = points[i].out + delay
    if (out - prev.out < s / maxSpeed) {
      delay += s / maxSpeed - (out - prev.out)
      out = prev.out + s / maxSpeed
    }
    fixed.push({ src: points[i].src, out })
  }
  const at = (T) => {
    if (T <= 0) return 0
    for (let i = 1; i < fixed.length; i++) {
      const a = fixed[i - 1]
      const b = fixed[i]
      if (T > b.out && i < fixed.length - 1) continue
      const s = b.src - a.src
      const o = b.out - a.out
      if (o <= 0 || s <= 0) return b.src
      const local = Math.min(T - a.out, o)
      return o >= s ? a.src + Math.min(local, s) : a.src + local * (s / o)
    }
    return srcEnd
  }
  return { at, end: fixed[fixed.length - 1].out }
}
