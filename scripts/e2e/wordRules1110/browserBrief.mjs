// ブラウザの結果（poc-output/wordRules1110/browser/*.json）を短く並べる。node scripts/e2e/wordRules1110/browserBrief.mjs [ID,ID...] [--full]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OUT } from './cases.mjs'

const [ids, flag] = process.argv.slice(2)
const want = ids && ids !== '--full' ? new Set(ids.split(',')) : null
const full = flag === '--full' || ids === '--full'
const BASE = new Set(['required-field', 'abstract-not-started', 'photos-required'])
const dir = join(OUT, 'browser')
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const r = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  if (want && !want.has(r.id)) continue
  console.log(`\n### ${r.id} ${r.title}`)
  if (r.failure) console.log(`  !! 止まった: ${r.failure}`)
  if (r.pageErrors.length) console.log(`  !! pageerror: ${r.pageErrors.join(' | ')}`)
  if (r.consoleErrors.length) console.log(`  !! console.error: ${r.consoleErrors.slice(0, 5).join(' | ')}`)
  if (r.rowErrors?.length) console.log(`  [選ぶ窓] ${r.rowErrors.join(' / ')}`)
  if (r.readError) {
    console.log(`  [読めない] ${r.readError}`)
    continue
  }
  if (r.dialog) {
    console.log(`  [窓] ${r.dialog.counts}  読む ${r.readMs}ms・読み込む ${r.importMs}ms・組む ${r.layoutMs}ms`)
    for (const p of r.dialog.problems) console.log(`    ・${p.slice(0, 170)}`)
    if (r.dialog.lost) console.log(`    消える: ${r.dialog.lost}`)
    if (full) console.log(`    一覧: ${r.dialog.outline.join(' ／ ')}\n    図: ${r.dialog.figures.join(' ／ ')}\n    表: ${r.dialog.tables.join(' ／ ')}`)
  }
  if (!r.after) continue
  console.log(`  [紙面] ${r.after.pageCount}ページ（本文 ${r.after.bodyPages}）・つぎにすること ${r.after.todo ? 'あり' : 'なし'}・壊れた画像 ${r.after.images}`)
  if (r.after.overflow.length) console.log(`  [はみ出し] ${r.after.overflow.join(' / ')}`)
  console.log(`  [図表のページ] ${r.objectPages.join(' / ')}`)
  if (r.analysis.placement.length) console.log(`  [位置] ${r.analysis.placement.join(' / ')}`)
  for (const x of r.analysis.findings.filter((x) => !BASE.has(x.split(' ')[1]))) console.log(`  [チェック] ${x.slice(0, 190)}`)
  // 押したあとに開いた欄の種類（本文から指していない図表は、前の段落の終わりへ移るのが決まり：reportEditor.ts findingToFix）
  const kindOf = (id) => {
    for (const ch of r.after.report.body)
      for (const b of ch.blocks) {
        if (b.id === id) return b.type
        if (b.type === 'figureRow' && b.figures.some((f) => f.id === id)) return 'figure'
        if (b.type === 'table' && b.rows.some((row) => row.cells.some((c) => c.id === id))) return 'tableCell'
      }
    return id ? 'other' : 'none'
  }
  if (r.jumps?.length)
    console.log(
      `  [押すと移る] ${r.jumps
        .map((j) => {
          if (j.listed === false) return `${j.ruleId}:一覧になし`
          const opened = kindOf(j.editingId)
          const ok = j.ok || (/unreferenced/.test(j.ruleId) && opened === 'paragraph' && j.page >= 0)
          return `${j.ruleId}:${ok ? 'OK' : 'NG'}（p${j.page + 1}・開いた欄=${opened}）`
        })
        .join('、')}`,
    )
  if (r.pdf) console.log(`  [PDF] ${r.pdf.ok ? 'できた' : 'できない'} ${r.pdf.pages ?? '?'}ページ ${r.pdf.bytes ?? '?'}B ${r.pdfMs}ms ${r.pdf.ok ? '' : r.pdf.text}`)
  if (full) for (const ch of r.analysis.chapters) console.log(`  # ${ch.title}\n${ch.items.map((i) => `     ${i}`).join('\n')}`)
}
