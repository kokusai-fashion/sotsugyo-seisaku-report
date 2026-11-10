// Word の document.xml の本文を、いちばん上の段落・表に分ける（並べ替えた見本を作るため）。調べるための道具（wordRules1110）
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

/** w:body の中の、いちばん上の段落（w:p）・表（w:tbl）の位置（document.xml の中の文字の位置） */
export function topBlocks(doc) {
  const bodyStart = doc.indexOf('<w:body>') + 8
  const bodyEnd = doc.lastIndexOf('</w:body>')
  const blocks = []
  let i = bodyStart
  while (i < bodyEnd) {
    const lt = doc.indexOf('<', i)
    if (lt < 0 || lt >= bodyEnd) break
    if (doc.startsWith('<w:tbl>', lt) || doc.startsWith('<w:tbl ', lt)) {
      let depth = 0
      let j = lt
      for (;;) {
        const o = doc.slice(j).search(/<w:tbl[ >]/)
        const c = doc.indexOf('</w:tbl>', j)
        if (o >= 0 && j + o < c) {
          depth++
          j = j + o + 6
        } else {
          depth--
          j = c + 8
          if (depth === 0) break
        }
      }
      blocks.push({ kind: 'tbl', start: lt, end: j })
      i = j
      continue
    }
    if (/^<w:p[ >\/]/.test(doc.slice(lt, lt + 5))) {
      const close = doc.indexOf('>', lt)
      if (doc[close - 1] === '/') {
        blocks.push({ kind: 'p', start: lt, end: close + 1 })
        i = close + 1
        continue
      }
      let depth = 0
      let j = lt
      for (;;) {
        const rest = doc.slice(j)
        const o = rest.search(/<w:p[ >]/)
        const c = doc.indexOf('</w:p>', j)
        if (o >= 0 && j + o < c) {
          depth++
          j = j + o + 4
        } else {
          depth--
          j = c + 6
          if (depth === 0) break
        }
      }
      blocks.push({ kind: 'p', start: lt, end: j })
      i = j
      continue
    }
    // ほかの要素（しおり・w:sdt・w:sectPr）は飛ばす（w:sdt は中を探さない）
    const tag = /^<([\w:]+)/.exec(doc.slice(lt))?.[1]
    if (!tag || tag.startsWith('/')) {
      i = doc.indexOf('>', lt) + 1
      continue
    }
    const selfClose = doc.indexOf('>', lt)
    if (doc[selfClose - 1] === '/') {
      i = selfClose + 1
      continue
    }
    const end = doc.indexOf(`</${tag}>`, lt)
    i = end < 0 ? selfClose + 1 : end + tag.length + 3
  }
  return blocks
}

export const blockText = (xml) => [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')

/**
 * いちばん上のまとまり from..to（1 から数える。dump.mjs の番号）を切り取り、after 番目のまとまりのすぐ後ろに入れる（after は元の番号）
 */
export function moveBlocks(doc, from, to, after) {
  const blocks = topBlocks(doc)
  const a = blocks[from - 1].start
  const b = blocks[to - 1].end
  const piece = doc.slice(a, b)
  const at = blocks[after - 1].end
  if (at <= a) return doc.slice(0, at) + piece + doc.slice(at, a) + doc.slice(b)
  return doc.slice(0, a) + doc.slice(b, at) + piece + doc.slice(at)
}

/** zip（.docx）の word/document.xml を書き換えた写しを作る */
export function rewriteDocx(bytes, edit) {
  const entries = unzipSync(bytes)
  const doc = strFromU8(entries['word/document.xml'])
  entries['word/document.xml'] = strToU8(edit(doc))
  return zipSync(entries)
}
