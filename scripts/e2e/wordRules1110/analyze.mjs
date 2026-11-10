// 読み込んだ原稿（Report）を、調べやすい形にまとめる（単体の読み込みと、ブラウザの原稿の両方で使う）。wordRules1110
const UPPER = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ']
const LOWER = ['ⅰ', 'ⅱ', 'ⅲ', 'ⅳ', 'ⅴ', 'ⅵ', 'ⅶ', 'ⅷ', 'ⅸ', 'ⅹ', 'ⅺ', 'ⅻ']

export function analyze(report, findings = []) {
  // 図・表の番号（紙面の順）
  const num = new Map()
  let fn = 0
  let tn = 0
  for (const c of report.body) for (const b of c.blocks) {
    if (b.type === 'figureRow') for (const f of b.figures) num.set(f.id, `図${++fn}`)
    else if (b.type === 'table') num.set(b.id, `表${++tn}`)
  }
  const kindOf = new Map()
  const sectionOf = new Map()
  const orderOf = new Map()
  const refs = [] // { target, section, order, block }
  const textRefs = [] // 文字のまま残った「図n」
  let order = 0
  const chapters = report.body.map((c, ci) => {
    let sub = -1
    let minor = -1
    let section = UPPER[ci] ?? `#${ci}`
    const items = []
    for (const b of c.blocks) {
      order++
      kindOf.set(b.id, b.type)
      if (b.type === 'subheading') {
        if (b.level === 3) {
          minor++
          section = `${UPPER[ci]}-${LOWER[sub] ?? '?'}-(${minor + 1})`
        } else {
          sub++
          minor = -1
          section = `${UPPER[ci]}-${LOWER[sub]}`
        }
        sectionOf.set(b.id, section)
        items.push(`== ${section} ${b.title}`)
        continue
      }
      sectionOf.set(b.id, section)
      orderOf.set(b.id, order)
      if (b.type === 'paragraph') {
        let text = ''
        for (const n of b.content) {
          if (n.type === 'text') text += n.text
          else {
            const label = num.get(n.targetId) ?? '?'
            text += n.withParens ? `［（${label}）］` : `［${label}］`
            refs.push({ target: n.targetId, section, order, block: b.id })
          }
        }
        for (const n of b.content) if (n.type === 'text') for (const m of n.text.matchAll(/[図表][\s　]*[0-9０-９]+/g)) textRefs.push({ text: m[0], section, block: b.id })
        items.push(`p  ${text.length > 70 ? `${text.slice(0, 34)}…${text.slice(-34)}` : text || '(空)'}${b.hint ? ' [hint]' : ''}`)
      } else if (b.type === 'figureRow') {
        for (const f of b.figures) {
          sectionOf.set(f.id, section)
          orderOf.set(f.id, order)
          kindOf.set(f.id, 'figure')
        }
        items.push(`FIG ${b.figures.map((f) => `${num.get(f.id)}「${f.caption}」${f.imageId ? '' : '(画像なし)'}`).join(' | ')}`)
      } else if (b.type === 'table') {
        items.push(`TBL ${num.get(b.id)}「${b.caption}」 ${b.rows.length}行×${b.rows[0]?.cells.length ?? 0}列 頭=[${b.rows[0]?.cells.map((x) => x.text).join('|')}]${b.rows.some((r) => r.cells.some((x) => x.imageId)) ? ' 画像あり' : ''}`)
        for (const r of b.rows) for (const x of r.cells) {
          kindOf.set(x.id, 'tableCell')
          sectionOf.set(x.id, section)
        }
      } else if (b.type === 'pageBreak') items.push('-- 改ページ --')
    }
    return { title: `${UPPER[ci]}．${c.title}`, items }
  })
  const objects = [...num.entries()].map(([id, label]) => {
    const mine = refs.filter((r) => r.target === id)
    const first = mine[0]
    const fig = label.startsWith('図')
    return {
      label,
      section: sectionOf.get(id),
      refs: mine.map((r) => r.section),
      firstRefSection: first?.section ?? null,
      sameSection: !!first && first.section === sectionOf.get(id),
      refBefore: !!first && first.order < (orderOf.get(id) ?? 0),
      ...(fig ? {} : {}),
    }
  })
  const label = (f) => (f.blockId ? `${num.get(f.blockId) ?? kindOf.get(f.blockId) ?? f.blockId.split('-')[0]}@${sectionOf.get(f.blockId) ?? f.area}` : f.area)
  const counts = {}
  for (const f of findings) counts[f.ruleId] = (counts[f.ruleId] ?? 0) + 1
  return {
    chapters,
    objects,
    textRefs,
    findingCounts: counts,
    findings: findings.map((f) => `${f.severity === 'error' ? 'E' : 'W'} ${f.ruleId} | ${f.title}${f.detail ? ` — ${f.detail}` : ''} | ${label(f)}`),
  }
}

/** 図・表と参照の位置の食い違い（見出しをまたぐ・参照より前） */
export function placementIssues(a) {
  return a.objects.flatMap((o) => {
    const out = []
    if (!o.firstRefSection) out.push(`${o.label}: 参照なし`)
    else {
      if (!o.sameSection) out.push(`${o.label}: 参照は ${o.firstRefSection}、${o.label.slice(0, 1)}は ${o.section}`)
      if (!o.refBefore) out.push(`${o.label}: 参照より前に置かれている`)
    }
    return out
  })
}
