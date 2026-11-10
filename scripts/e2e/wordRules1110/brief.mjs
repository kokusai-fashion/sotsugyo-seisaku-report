// 単体の結果（poc-output/wordRules1110/unit/*.json）を短く並べる。基準（B0）と同じ指摘（表紙・抄録・作品写真）は省く。
// node scripts/e2e/wordRules1110/brief.mjs [ID,ID...] [--full]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OUT } from './cases.mjs'

const [ids, flag] = process.argv.slice(2)
const want = ids && ids !== '--full' ? new Set(ids.split(',')) : null
const full = flag === '--full' || ids === '--full'
const dir = join(OUT, 'unit')
const BASE = new Set(['required-field', 'abstract-not-started', 'photos-required'])
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const r = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  if (want && !want.has(r.id)) continue
  console.log(`\n### ${r.id} ${r.title}`)
  if (!r.ok) {
    console.log(`  !! ${r.errorName}: ${r.error}${r.stack ? `\n${r.stack}` : ''}`)
    continue
  }
  console.log(`  counts ${JSON.stringify(r.counts)} skipped=${r.skippedPlaceholders}`)
  for (const p of r.problems) console.log(`  [窓] ${p.length > 160 ? `${p.slice(0, 160)}…` : p}`)
  if (r.placement.length) console.log(`  [位置] ${r.placement.join(' / ')}`)
  if (r.textRefs.length) console.log(`  [文字の参照] ${r.textRefs.map((t) => `${t.text}@${t.section}`).join(' ')}`)
  for (const x of r.findings.filter((x) => !BASE.has(x.split(' ')[1]))) console.log(`  [チェック] ${x.length > 200 ? `${x.slice(0, 200)}…` : x}`)
  if (full) for (const ch of r.chapters) console.log(`  # ${ch.title}\n${ch.items.map((i) => `     ${i}`).join('\n')}`)
  if (r.builtinConfig !== 'same') console.log(`  ** 組み込みの設定では違う: ${JSON.stringify(r.builtinConfig.ok ? { counts: r.builtinConfig.counts, problems: r.builtinConfig.problems, placement: r.builtinConfig.placement } : r.builtinConfig.error).slice(0, 400)}`)
}
