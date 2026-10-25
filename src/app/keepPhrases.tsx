/**
 * 画面の文の中で、折り返しで切れてほしくないまとまり：短いかっこ書き（「（横に2枚まで）」）と、ボタンの名前などのかぎかっこの語と
 * すぐ後ろの助詞（「「2.」を」）。まとまりの中では折り返さない（.nb）。
 * ことばの切れ目で折り返す auto-phrase でも、「（空いた｜ページは消しました）」「「横に｜並べる」」「「2.」｜を消します」のように切れていた（PC の試し 2026-10-24）。
 * 長いもの（かっこ書き16字・かぎかっこ14字より長い）は、狭い画面ではみ出さないよう、まとめない
 */
const KEEP = /（[^（）\n]{1,16}）|「[^「」\n]{1,14}」[をにでがはへとのもや]?/g

export function keepParts(text: string): { text: string; keep: boolean }[] {
  const parts: { text: string; keep: boolean }[] = []
  let at = 0
  for (const m of text.matchAll(KEEP)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index), keep: false })
    parts.push({ text: m[0], keep: true })
    at = m.index + m[0].length
  }
  if (at < text.length) parts.push({ text: text.slice(at), keep: false })
  return parts
}

/** 文を、まとまりを折り返さずに出す */
export function Keep({ text }: { text: string }) {
  return <>{keepParts(text).map((p, i) => (p.keep ? <span key={i} className="nb">{p.text}</span> : p.text))}</>
}
