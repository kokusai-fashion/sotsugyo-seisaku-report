import { readFileSync } from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const doc = await getDocument({ data: new Uint8Array(readFileSync(process.argv[2])), verbosity: 0 }).promise
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n)
  const c = await page.getTextContent()
  const rows = new Map()
  for (const it of c.items) { if (!it.str.trim()) continue; const y = Math.round(it.transform[5]); rows.set(y, (rows.get(y) ?? '') + it.str) }
  console.log(`---- page ${n}`)
  for (const [y, t] of [...rows].sort((a, b) => b[0] - a[0])) console.log(t)
}
