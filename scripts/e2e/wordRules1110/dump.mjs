// Word（.docx）の本文の段落・表・図をざっと書き出す（調べるため）。node scripts/e2e/wordRules1110/dump.mjs <file.docx> [--xml]
import { readFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'

const [file, flag] = process.argv.slice(2)
const zip = unzipSync(new Uint8Array(readFileSync(file)))
console.log('entries:', Object.keys(zip).map((k) => `${k}(${zip[k].length})`).join(' '))
const doc = strFromU8(zip['word/document.xml'])
if (flag === '--xml') {
  console.log(doc)
  process.exit(0)
}
const body = doc.slice(doc.indexOf('<w:body>') + 8)
// トップレベルの段落・表を順に
let i = 0
let n = 0
const top = []
while (i < body.length) {
  const p = body.indexOf('<w:p', i)
  const t = body.indexOf('<w:tbl>', i)
  const next = [p, t].filter((x) => x >= 0).sort((a, b) => a - b)[0]
  if (next === undefined) break
  if (next === t) {
    // 入れ子を数えて表の終わり
    let depth = 0
    let j = t
    for (;;) {
      const o = body.indexOf('<w:tbl>', j)
      const c = body.indexOf('</w:tbl>', j)
      if (o >= 0 && o < c) {
        depth++
        j = o + 7
      } else {
        depth--
        j = c + 8
        if (depth === 0) break
      }
    }
    top.push({ kind: 'tbl', xml: body.slice(t, j) })
    i = j
  } else {
    if (!/^<w:p[ >]/.test(body.slice(p, p + 5))) {
      i = p + 4
      continue
    }
    const end = body.indexOf('</w:p>', p)
    const self = body.indexOf('/>', p)
    const close = body.indexOf('>', p)
    if (self >= 0 && self < close + 1 && self === close - 1) {
      top.push({ kind: 'p', xml: body.slice(p, close + 1) })
      i = close + 1
      continue
    }
    // 段落の中に段落（文字の枠）があるときも、外の </w:p> まで
    let depth = 0
    let j = p
    for (;;) {
      const o = body.slice(j).search(/<w:p[ >]/)
      const c = body.indexOf('</w:p>', j)
      if (o >= 0 && j + o < c) {
        depth++
        j = j + o + 4
      } else {
        depth--
        j = c + 6
        if (depth === 0) break
      }
    }
    top.push({ kind: 'p', xml: body.slice(p, j) })
    i = j
  }
}
const text = (xml) => [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
for (const b of top) {
  n++
  const style = /<w:pStyle w:val="([^"]+)"/.exec(b.xml)?.[1] ?? ''
  const imgs = (b.xml.match(/<a:blip /g) ?? []).length
  const boxes = (b.xml.match(/<w:txbxContent>/g) ?? []).length
  const anchors = (b.xml.match(/<wp:anchor /g) ?? []).length
  const brk = /w:type="page"/.test(b.xml) ? ' [pagebreak]' : ''
  const num = /<w:numPr>/.test(b.xml) ? ' [num]' : ''
  console.log(`${String(n).padStart(3)} ${b.kind}${style ? `(${style})` : ''}${imgs ? ` img×${imgs}` : ''}${anchors ? ` anchor×${anchors}` : ''}${boxes ? ` box×${boxes}` : ''}${brk}${num}  ${text(b.xml).slice(0, 80)}`)
}
