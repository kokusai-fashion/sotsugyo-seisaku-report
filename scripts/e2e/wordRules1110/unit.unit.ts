// 決まりを破った Word を、ブラウザの外で読み込み（readWordFiles → applyWordImport）、セルフチェック（checkReportDetailed）にかける。
// 結果は poc-output/wordRules1110/unit/（1件ずつの JSON と、まとめの unit-summary.txt）。src/ は変えない
import { DOMParser } from '@xmldom/xmldom'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { it } from 'vitest'
import { currentConfig, type YearConfig } from '../../../src/config'
import { checkReportDetailed } from '../../../src/checker/reportChecks'
import { applyWordImport, readWordFiles } from '../../../src/import/wordImport'
import { createReport } from '../../../src/model/newReport'
import { analyze, placementIssues } from './analyze.mjs'
import { cases, OUT } from './cases.mjs'
;(globalThis as { DOMParser?: unknown }).DOMParser = DOMParser

const fixture = JSON.parse(readFileSync('scripts/e2e/config-fixture.json', 'utf8')) as YearConfig
const COURSE = 'film-stage-costume'
const only = process.env.CASES ? new Set(process.env.CASES.split(',')) : null

async function runOne(c: { id: string; body: Uint8Array }, config: YearConfig) {
  const file = new File([c.body.slice()], `${c.id}.docx`)
  try {
    const r = await readWordFiles({ body: file }, { config, courseId: COURSE })
    const report = applyWordImport(createReport(config, COURSE), r)
    const { findings } = checkReportDetailed(report, config)
    const a = analyze(report, findings)
    return {
      ok: true,
      counts: r.counts,
      skippedPlaceholders: r.skippedPlaceholders,
      problems: r.problems.map((p) => `${p.message}${p.where ? ` ＠${p.where}` : ''}${p.detail ? ` — ${p.detail}` : ''}`),
      outline: r.outline.map((o) => `${'  '.repeat(o.level - 1)}${o.title || '(名前なし)'}${o.fromTemplate ? ' [ひな形]' : ''}${o.fromToc ? ' [目次]' : ''} ${o.paragraphs}p ${o.figures.join(',')} ${o.tables.join(',')}${o.problem ? ' ◆' : ''}`),
      figures: r.figures.map((f) => `${f.label}「${f.caption}」${f.imageId ? '' : '(画像なし)'}`),
      tables: r.tables.map((t) => `${t.label}「${t.caption}」${t.rows}行`),
      images: r.images.map((i) => `${i.widthPx}x${i.heightPx}`),
      placement: placementIssues(a),
      ...a,
    }
  } catch (e) {
    const err = e as Error
    return { ok: false, errorName: err?.name, error: err?.message, stack: err?.name === 'WordImportError' ? undefined : err?.stack?.split('\n').slice(0, 6).join('\n') }
  }
}

it('wordRules1110: 決まりを破った Word を読み込む', async () => {
  const dir = join(OUT, 'unit')
  mkdirSync(dir, { recursive: true })
  const lines: string[] = []
  for (const c of cases()) {
    if (only && !only.has(c.id)) continue
    const res = await runOne(c, fixture)
    // ツールに入っている設定（コースのひな形あり）でも読み、数・知らせが違うかだけを見る
    const alt = await runOne(c, currentConfig)
    const differs =
      res.ok !== alt.ok ||
      (res.ok && alt.ok && (JSON.stringify(res.counts) !== JSON.stringify(alt.counts) || JSON.stringify(res.problems) !== JSON.stringify(alt.problems) || JSON.stringify(res.placement) !== JSON.stringify(alt.placement)))
    const out = { id: c.id, title: c.title, ...res, builtinConfig: differs ? alt : 'same' }
    writeFileSync(join(dir, `${c.id}.json`), JSON.stringify(out, null, 1))
    lines.push(`################ ${c.id}  ${c.title}`)
    if (!res.ok) {
      lines.push(`  !! ${res.errorName}: ${res.error}`)
      if (res.stack) lines.push(res.stack)
    } else {
      lines.push(`  counts ${JSON.stringify(res.counts)} skipped=${res.skippedPlaceholders} images=${res.images.join(' ')}`)
      lines.push('  -- 確認の窓の知らせ:')
      for (const p of res.problems) lines.push(`    ・${p}`)
      lines.push('  -- 一覧:')
      for (const o of res.outline) lines.push(`    ${o}`)
      lines.push('  -- 原稿:')
      for (const ch of res.chapters) {
        lines.push(`    # ${ch.title}`)
        for (const it of ch.items) lines.push(`      ${it}`)
      }
      lines.push(`  -- 図表の位置: ${res.placement.join(' / ') || 'なし'}`)
      if (res.textRefs.length) lines.push(`  -- 文字のまま残った参照: ${res.textRefs.map((t) => `${t.text}@${t.section}`).join(' ')}`)
      lines.push('  -- セルフチェック:')
      for (const f of res.findings) lines.push(`    ${f}`)
    }
    if (differs) lines.push(`  ** ツールに入っている設定では違う: ${alt.ok ? JSON.stringify({ counts: alt.counts, problems: alt.problems, placement: alt.placement }) : alt.error}`)
    lines.push('')
  }
  writeFileSync(join(OUT, only ? 'unit-summary-partial.txt' : 'unit-summary.txt'), lines.join('\n'))
})
