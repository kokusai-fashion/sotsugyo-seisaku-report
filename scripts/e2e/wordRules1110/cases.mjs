// Word の読み込み（今年度だけ）の試し：書き方の決まりを破った Word・学生がよくする Word の使い方の見本を作る（wordRules1110）。
// 中身は架空（文化 花子・00ZZ0123）。SAMPLE を元にした見本は、../試し用_学生のWord/SAMPLE の 04_本文.docx を並べ替えたもの（poc-output にだけ置く）。
// node scripts/e2e/wordRules1110/cases.mjs で poc-output/wordRules1110/docx/ に書き出す（ほかのスクリプトは import して使う）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { strToU8, zipSync } from 'fflate'
import { br, emfHeader, esc, floatingImage, inlineImage, makeDocx, NS, numbered, p, pageBreak, png, rid, run, styled, tab, table, textBox } from '../fixtures/docx.mjs'
import { moveBlocks, rewriteDocx } from './docxParts.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const APP_DIR = join(HERE, '..', '..', '..')
export const OUT = join(APP_DIR, 'poc-output', 'wordRules1110')
const SAMPLE_BODY = join(APP_DIR, '..', '試し用_学生のWord', 'SAMPLE', '＜SAMPLE＞Wordデータ', '04_本文.docx')

// ---- 文 ----
const SENTENCES = [
  '衣装の色は、物語の場面に合わせて深い緑を基調にした。',
  '生地は動きやすさを考え、伸縮性のある綿を選んだ。',
  '仮縫いでは、身頃の丈と袖の長さを細かく確かめた。',
  '装飾には金色のブレードを使い、高貴な印象を出した。',
  '舞台の照明の下でも映えるよう、光沢のある糸で刺繍をした。',
  '着脱のしやすさを考え、背中にファスナーを付けた。',
  '本番までに三回の試着を行い、着心地を整えた。',
  '演出の先生と話し合い、裾の広がりを少し抑えた。',
  '縫い代は厚くならないよう、割って押さえた。',
  '小道具との色の重なりを避けるため、配色を見直した。',
  '役者の動きを妨げないよう、脇の下にまちを入れた。',
  '遠くの客席からも形が分かるよう、輪郭をはっきりさせた。',
  '衿の形は資料の肖像画を参考にして決めた。',
]
/** 段落（1字下げ）。ref は文末の「。」の前に入れる参照（「（図1）」など） */
export function para(i, ref = '', count = 5) {
  const list = Array.from({ length: count }, (_, k) => SENTENCES[(i * 3 + k) % SENTENCES.length])
  if (ref) list[list.length - 1] = list[list.length - 1].replace(/。$/, `${ref}。`)
  return `　${list.join('')}`
}

// ---- 画像 ----
const COLORS = [
  [47, 62, 117], [140, 60, 50], [40, 110, 70], [150, 120, 30], [90, 40, 120], [30, 120, 140], [160, 80, 120], [70, 70, 70],
]
export const img = (k, w = 240, h = 320) => png(w, h, { figure: COLORS[k % COLORS.length], background: [235 - (k % 5) * 6, 228, 214] })
const swatch = (k) => png(40, 40, { draw: () => COLORS[(k + 3) % COLORS.length] })

// ---- 部品 ----
const bold = (text) => `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
const W_NS = NS.w
let uid = 1000

/** 図形のグループ（画像と、文字の枠のタイトル）。Word で「グループ化」したもの */
function groupedFigure(imageRid, captionLines, { x = 1200000, cx = 2400000, cy = 3200000 } = {}) {
  uid++
  const wpg = 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup'
  const content = `<w:txbxContent>${[].concat(captionLines).map((l) => p(l)).join('')}</w:txbxContent>`
  return (
    `<w:r><mc:AlternateContent><mc:Choice Requires="wpg"><w:drawing>` +
    `<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="${251660000 + uid}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:posOffset>${x}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${cx}" cy="${cy + 500000}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapTopAndBottom/><wp:docPr id="${uid}" name="グループ化 ${uid}"/><wp:cNvGraphicFramePr/>` +
    `<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="${wpg}"><wpg:wgp xmlns:wpg="${wpg}"><wpg:cNvGrpSpPr/><wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy + 500000}"/><a:chOff x="0" y="0"/><a:chExt cx="${cx}" cy="${cy + 500000}"/></a:xfrm></wpg:grpSpPr>` +
    `<pic:pic xmlns:pic="${NS.pic}"><pic:nvPicPr><pic:cNvPr id="${uid + 1}" name="図 ${uid + 1}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${imageRid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `<wps:wsp><wps:cNvPr id="${uid + 2}" name="テキスト ボックス ${uid + 2}"/><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="${cy}"/><a:ext cx="${cx}" cy="500000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></wps:spPr>` +
    `<wps:txbx>${content}</wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square"/></wps:wsp></wpg:wgp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>` +
    `<mc:Fallback><w:pict><v:group id="g${uid}" style="position:absolute;width:189pt;height:290pt"><v:shape id="s${uid}" type="#_x0000_t75" style="width:189pt;height:252pt"><v:imagedata r:id="${imageRid}" o:title=""/></v:shape><v:shape id="t${uid}" type="#_x0000_t202" style="top:252pt;width:189pt;height:38pt" filled="f" stroked="f"><v:textbox>${content}</v:textbox></v:shape></v:group></w:pict></mc:Fallback></mc:AlternateContent></w:r>`
  )
}

/** 文字の枠の中に、画像（行内）とタイトルの行を入れたもの */
function imageInTextBox(imageRid, captionLine) {
  uid++
  const inner = `<w:txbxContent>${p(inlineImage(imageRid, { cx: 2000000, cy: 2600000 }))}${p(captionLine)}</w:txbxContent>`
  const shape =
    `<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">` +
    `<wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2200000" cy="3200000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></wps:spPr>` +
    `<wps:txbx>${inner}</wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square"/></wps:wsp></a:graphicData></a:graphic>`
  return (
    `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="${251670000 + uid}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:posOffset>1300000</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>100000</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="2200000" cy="3200000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapTopAndBottom/><wp:docPr id="${uid}" name="テキスト ボックス ${uid}"/><wp:cNvGraphicFramePr/>${shape}</wp:anchor></w:drawing></mc:Choice>` +
    `<mc:Fallback><w:pict><v:shape id="tb${uid}" type="#_x0000_t202" style="position:absolute;width:173pt;height:252pt"><v:textbox>${inner}</v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>`
  )
}

/** SVG の画像（Word 2016 から。PNG の代わりの画像も一緒に入る：a:blip の r:embed は PNG、SVG は拡張の中） */
function svgImage(pngRid, svgRid) {
  uid++
  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1800000" cy="2400000"/><wp:docPr id="${uid}" name="グラフィックス ${uid}"/>` +
    `<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="${NS.pic}"><pic:nvPicPr><pic:cNvPr id="${uid}" name="g${uid}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${pngRid}"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${svgRid}"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1800000" cy="2400000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  )
}

const TC = (id) => `w:id="${id}" w:author="文化 花子" w:date="2026-11-01T10:00:00Z"`
const ins = (id, xml) => `<w:ins ${TC(id)}>${xml}</w:ins>`
const del = (id, text) => `<w:del ${TC(id)}><w:r><w:delText xml:space="preserve">${esc(text)}</w:delText></w:r></w:del>`
const fld = (instr, result) =>
  `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${esc(instr)} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run(result)}<w:r><w:fldChar w:fldCharType="end"/></w:r>`

// ---- 見本の原稿の組み立て（spec：まとまりの並び。k は場所の名前） ----
// { h }：見出しの行（そのまま段落）／{ p }：段落（文字か XML）／{ fig: { img, cap, style } }／{ pair: [{img,cap},{img,cap}], style }／{ table, cap, capBelow }／{ raw }
export function baseSpec() {
  return [
    { k: 'h1-1', h: 'Ⅰ．企画・立案' },
    { k: 'h2-1-1', h: 'ⅰ．担当衣装のキャラクター' },
    { k: 'p-1-1a', p: para(0) },
    { k: 'p-1-1b', p: para(1, '（図1）') },
    { k: 'p-1-1c', p: para(2) },
    { k: 'fig1', fig: { img: 1, cap: '図1　キャラクターのイメージ' } },
    { k: 'h2-1-2', h: 'ⅱ．デザイン説明' },
    { k: 'p-1-2a', p: para(3, '（図2）') },
    { k: 'p-1-2b', p: para(4) },
    { k: 'p-1-2c', p: para(5) },
    { k: 'fig2', fig: { img: 2, cap: '図2　デザイン画' } },
    { k: 'h2-1-3', h: 'ⅲ．使用素材' },
    { k: 'p-1-3a', p: '　使用した素材を表1にまとめる。生地は、動きやすさと見た目の両方を考えて選んだ。' },
    { k: 'tbl1', cap: '表1　使用素材表', table: [['名称', '使用箇所', '生地見本'], ['綿ブロード', 'シャツ', { images: [rid('sw1.png')] }], ['ウールフラノ', 'ジャケット', { images: [rid('sw2.png')] }]] },
    { k: 'pb1', raw: p(pageBreak) },
    { k: 'h1-2', h: 'Ⅱ．制作過程' },
    { k: 'h2-2-1', h: 'ⅰ．ジャケット' },
    { k: 'p-2-1a', p: para(6, '（図3）') },
    { k: 'p-2-1b', p: `${para(7, '', 4)}後ろ姿を図4に示す。` },
    { k: 'p-2-1c', p: para(8) },
    { k: 'fig34', pair: [{ img: 3, cap: '図3　ジャケット（前）' }, { img: 4, cap: '図4　ジャケット（後ろ）' }] },
    { k: 'h2-2-2', h: 'ⅱ．パンツ' },
    { k: 'p-2-2a', p: para(9, '（図5）') },
    { k: 'p-2-2b', p: para(10) },
    { k: 'p-2-2c', p: para(11) },
    { k: 'fig5', fig: { img: 5, cap: '図5　パンツ' } },
    { k: 'h2-2-3', h: 'ⅲ．帽子' },
    { k: 'p-2-3a', p: para(12) },
    { k: 'p-2-3b', p: para(0) },
    { k: 'p-2-3c', p: para(1) },
    { k: 'pb2', raw: p(pageBreak) },
    { k: 'h1-3', h: 'Ⅲ．まとめ' },
    { k: 'p-3a', p: para(2) },
    { k: 'p-3b', p: para(3) },
    { k: 'p-3c', p: para(4) },
  ]
}

const at = (spec, k) => {
  const i = spec.findIndex((b) => b.k === k)
  if (i < 0) throw new Error(`no block ${k}`)
  return i
}
/** k のまとまりを after の後ろへ動かす */
export function moveAfter(spec, k, after) {
  const s = [...spec]
  const [b] = s.splice(at(s, k), 1)
  s.splice(at(s, after) + 1, 0, b)
  return s
}
export function moveBefore(spec, k, before) {
  const s = [...spec]
  const [b] = s.splice(at(s, k), 1)
  s.splice(at(s, before), 0, b)
  return s
}
export const without = (spec, ...ks) => spec.filter((b) => !ks.includes(b.k))
export const replace = (spec, k, block) => spec.map((b) => (b.k === k ? { k, ...block } : b))
export const edit = (spec, k, fn) => spec.map((b) => (b.k === k ? fn(b) : b))
export const insertAfter = (spec, after, ...blocks) => {
  const s = [...spec]
  s.splice(at(s, after) + 1, 0, ...blocks)
  return s
}

const FLOAT_SINGLE = { x: 1580000, cx: 2237740, cy: 3162300 }
const PAIR_X = [702473, 3014508]
const PAIR_CAP_X = [53503, 2365538]

/** spec を document.xml の本文の XML と、画像にする */
export function render(spec, { style = 'float' } = {}) {
  const media = { 'sw1.png': swatch(1), 'sw2.png': swatch(2) }
  const name = (k) => {
    const n = `f${k}.png`
    if (!media[n]) media[n] = img(k)
    return n
  }
  const parts = []
  for (const b of spec) {
    if (b.h !== undefined) parts.push([].concat(b.h).map((x) => (x.startsWith('<w:p') ? x : p(x))).join(''))
    else if (b.p !== undefined) parts.push(b.p.startsWith('<w:p') ? b.p : p(b.p))
    else if (b.raw !== undefined) parts.push(b.raw)
    else if (b.media) Object.assign(media, b.media)
    else if (b.fig) {
      const f = b.fig
      const st = f.style ?? b.style ?? style
      if (typeof f.img === 'number') name(f.img)
      const imageRun = f.img === null ? '' : f.run ?? (st === 'float' ? floatingImage(rid(name(f.img)), FLOAT_SINGLE) : inlineImage(rid(name(f.img))))
      if (st === 'float') {
        const cap = f.cap ? p(textBox([f.cap])) : ''
        const image = imageRun ? [p(imageRun), p(), p()].join('') : ''
        parts.push(f.capAbove ? cap + image : image + cap)
      } else {
        const cap = f.cap ? p(f.cap) : ''
        const image = imageRun ? p(imageRun) : ''
        parts.push(f.capAbove ? cap + image : image + cap)
      }
    } else if (b.pair) {
      const st = b.style ?? style
      if (st === 'float') {
        parts.push(p(...b.pair.map((f, i) => floatingImage(rid(name(f.img)), { x: PAIR_X[i], cx: 1447165, cy: 2045000 }))), p(), p())
        parts.push(p(...b.pair.filter((f) => f.cap).map((f, i) => textBox([f.cap], { x: PAIR_CAP_X[i], cx: 2000000 }))))
      } else {
        parts.push(p(...b.pair.map((f) => inlineImage(rid(name(f.img)), { cx: 1447165, cy: 2045000 }))))
        parts.push(p(b.pair.map((f) => f.cap).join('　　')))
      }
    } else if (b.table) {
      const cap = b.cap ? p(b.cap) : ''
      const t = table(b.table, b.tableOptions ?? {})
      parts.push(b.capBelow ? t + cap : cap + (b.between ?? '') + t)
    }
  }
  return { body: parts.join(''), media }
}

export const docx = (spec, opts = {}) => {
  const { body, media } = render(spec, opts)
  const xml = (opts.before ?? '') + body + (opts.after ?? '')
  const all = { ...media, ...(opts.media ?? {}) }
  // 本文で指している fN.png の画像は、必ず入れる（表のセル・段落の中に直に書いた画像）
  for (const m of xml.matchAll(/rId_f(\d+)_png/g)) if (!all[`f${m[1]}.png`]) all[`f${m[1]}.png`] = img(Number(m[1]))
  return makeDocx({ body: xml, media: all, styles: opts.styles, numbering: opts.numbering, sectPr: opts.sectPr })
}

// ---- それぞれの見本 ----
/** browser：ブラウザ（まとめた版）でも読み込む。pdf：PDF も書き出す */
export function cases() {
  const list = []
  const add = (id, title, body, extra = {}) => list.push({ id, title, body, ...extra })
  const base = baseSpec()

  // ==== 基準 ====
  add('B0', '基準：決まりどおり（浮かせた画像・文字の枠のタイトル）', docx(base), { browser: true, pdf: true })
  add('B1', '基準：決まりどおり（行内の画像・段落のタイトル）', docx(base, { style: 'inline' }))

  // ==== 図と参照 ====
  add('F01', '（図2）は ⅱ の段落、図2 の画像とタイトルは次の ⅲ の見出しの直後（見出しをまたぐ：依頼者の例）', docx(moveAfter(base, 'fig2', 'h2-1-3')), { browser: true, pdf: true })
  add('F01b', '（図2）は ⅱ、図2 は ⅲ の終わり（表の後ろ）', docx(moveAfter(base, 'fig2', 'tbl1')))
  add('F02', '（図5）は Ⅱ-ⅱ、図5 は次の章「Ⅲ．まとめ」の見出しの直後（章をまたぐ）', docx(moveAfter(base, 'fig5', 'h1-3')), { browser: true })
  add('F03', '図2 を、図2 を初めて指す段落より前（ⅱ の見出しの直後）に置く', docx(moveAfter(base, 'fig2', 'h2-1-2')), { browser: true })
  add('F03b', '図2 を、前の見出し ⅰ の終わり（参照は ⅱ）に置く', docx(moveAfter(base, 'fig2', 'fig1')))
  add(
    'F04',
    'ない図（図9）を指す参照と、どこからも指していない図5',
    docx(edit(edit(base, 'p-1-1c', () => ({ k: 'p-1-1c', p: para(2, '（図9）') })), 'p-2-2a', () => ({ k: 'p-2-2a', p: para(9) }))),
  )
  add(
    'F05',
    'タイトルの番号が逆（ⅰ の図が「図2」、ⅱ の図が「図1」。本文も ⅰ で（図2）、ⅱ で（図1）＝あとから図を足して番号を直していない）',
    docx(
      edit(edit(edit(edit(base, 'fig1', (b) => ({ ...b, fig: { ...b.fig, cap: '図2　キャラクターのイメージ' } })), 'fig2', (b) => ({ ...b, fig: { ...b.fig, cap: '図1　デザイン画' } })), 'p-1-1b', (b) => ({ ...b, p: para(1, '（図2）') })), 'p-1-2a', (b) => ({ ...b, p: para(3, '（図1）') })),
    ),
  )
  add(
    'F05b',
    'タイトルの番号が逆（ⅰ の図が「図2」、ⅱ の図が「図1」）で、本文は ⅰ が（図1）、ⅱ が（図2）のまま＝タイトルの付け間違い',
    docx(edit(edit(base, 'fig1', (b) => ({ ...b, fig: { ...b.fig, cap: '図2　キャラクターのイメージ' } })), 'fig2', (b) => ({ ...b, fig: { ...b.fig, cap: '図1　デザイン画' } }))),
    { browser: true },
  )
  add(
    'F06',
    '同じ番号のタイトルが2つ（ジャケットの後ろが「図4」、パンツも「図4」。パンツの段落は（図4）。SAMPLE と同じ間違い）',
    docx(edit(edit(base, 'fig5', (b) => ({ ...b, fig: { ...b.fig, cap: '図4　パンツ' } })), 'p-2-2a', (b) => ({ ...b, p: para(9, '（図4）') }))),
    { browser: true },
  )
  add(
    'F07',
    '番号が飛ぶ（図1・図2・図4・図5・図6。本文の参照もその番号）',
    docx(
      edit(
        edit(edit(edit(base, 'fig34', (b) => ({ ...b, pair: [{ ...b.pair[0], cap: '図4　ジャケット（前）' }, { ...b.pair[1], cap: '図5　ジャケット（後ろ）' }] })), 'p-2-1a', (b) => ({ ...b, p: para(6, '（図4）') })), 'p-2-1b', (b) => ({ ...b, p: `${para(7, '', 4)}後ろ姿を図5に示す。` })),
        'fig5',
        (b) => ({ ...b, fig: { ...b.fig, cap: '図6　パンツ' } }),
      ).map((b) => (b.k === 'p-2-2a' ? { ...b, p: para(9, '（図6）') } : b)),
    ),
  )
  add('F08', '図2 の画像にタイトルがない', docx(edit(base, 'fig2', (b) => ({ ...b, fig: { ...b.fig, cap: null } }))))
  add('F09', '図2 のタイトルの行だけあり、画像がない', docx(edit(base, 'fig2', (b) => ({ ...b, fig: { ...b.fig, img: null } }))))
  add('F10', 'タイトルを画像の上に書く（行内の画像・段落のタイトル。全部の図）', docx(base.map((b) => (b.fig ? { ...b, fig: { ...b.fig, capAbove: true } } : b)), { style: 'inline' }))
  add('F10b', 'タイトルを画像の上に置く（浮かせた画像・文字の枠。全部の図）', docx(base.map((b) => (b.fig ? { ...b, fig: { ...b.fig, capAbove: true } } : b))))
  add(
    'F10c',
    '図1 にタイトルがなく、すぐ下の図2 はタイトルを上に書いた（間に文がない。行内の画像）',
    docx(without(edit(edit(moveAfter(base, 'fig2', 'fig1'), 'fig2', (b) => ({ ...b, fig: { ...b.fig, capAbove: true } })), 'fig1', (b) => ({ ...b, fig: { ...b.fig, cap: null } })), 'h2-1-2', 'p-1-2b', 'p-1-2c'), { style: 'inline' }),
  )
  add(
    'F11',
    'タイトルの書き方いろいろ（図１ 全角・図 2・図3:・図4．・Fig.5）',
    docx(
      edit(
        edit(edit(base, 'fig1', (b) => ({ ...b, fig: { ...b.fig, cap: '図１　キャラクターのイメージ' } })), 'fig2', (b) => ({ ...b, fig: { ...b.fig, cap: '図 2 デザイン画' } })),
        'fig34',
        (b) => ({ ...b, pair: [{ ...b.pair[0], cap: '図3:ジャケット（前）' }, { ...b.pair[1], cap: '図4．ジャケット（後ろ）' }] }),
      ).map((b) => (b.k === 'fig5' ? { ...b, fig: { ...b.fig, cap: 'Fig.5 パンツ' } } : b)),
      { style: 'inline' },
    ),
  )
  add('F11c', 'タイトルの終わりに「。」（図2　デザイン画。）', docx(edit(base, 'fig2', (b) => ({ ...b, fig: { ...b.fig, cap: '図2　デザイン画。' } })), { style: 'inline' }))
  add('F11d', '長いタイトル（41字以上）', docx(edit(base, 'fig2', (b) => ({ ...b, fig: { ...b.fig, cap: '図2　デザイン画（衿は三段にし、袖はパフスリーブにした。色は深い緑と金を合わせた案）' } })), { style: 'inline' }))
  add('F14b', '画像の段落の中で Shift+Enter して、その下にタイトルを書く', docx(edit(base, 'fig2', (b) => ({ k: 'fig2', p: p(inlineImage(rid('f2.png')), br, '図2　デザイン画') }))))
  add('F11b', 'タイトルを手順書の例どおり「図1.デザイン画」（半角の点）・「図2. デザイン画」', docx(edit(edit(base, 'fig1', (b) => ({ ...b, fig: { ...b.fig, cap: '図1.キャラクターのイメージ' } })), 'fig2', (b) => ({ ...b, fig: { ...b.fig, cap: '図2. デザイン画' } }))))
  add(
    'F12',
    '参照の書き方いろいろ（(図1) 半角・図2に示す・（図3・4）・（図5）（図4））',
    docx(
      edit(
        edit(edit(edit(base, 'p-1-1b', (b) => ({ ...b, p: para(1, '(図1)') })), 'p-1-2a', (b) => ({ ...b, p: `　デザイン画を図2に示す。${para(3).slice(1)}` })), 'p-2-1a', (b) => ({ ...b, p: para(6, '（図3・4）') })),
        'p-2-1b',
        (b) => ({ ...b, p: para(7) }),
      ).map((b) => (b.k === 'p-2-2a' ? { ...b, p: para(9, '（図5）（図4）') } : b)),
    ),
    { browser: true },
  )
  add(
    'F12b',
    '参照の書き方いろいろ２（（図3～5）・（図1、図2）・図１ 全角の数字）',
    docx(
      edit(edit(edit(edit(base, 'p-2-1a', (b) => ({ ...b, p: para(6, '（図3～5）') })), 'p-2-1b', (b) => ({ ...b, p: para(7) })), 'p-2-2a', (b) => ({ ...b, p: para(9) })), 'p-1-1b', (b) => ({ ...b, p: para(1, '（図１）') })).map((b) =>
        b.k === 'p-1-2a' ? { ...b, p: para(3, '（図1、図2）') } : b,
      ),
    ),
  )
  // 枠のない2列の表で、写真を横に並べる（タイトルはセルの中）
  add('F13', '2枚を枠のない2列の表に並べる（画像とタイトルを同じセルに）', tableFigureDoc(base, 'same-cell'), { browser: true, pdf: true })
  add('F13b', '2枚を表に並べる（1行目に画像、2行目にタイトル）', tableFigureDoc(base, 'caption-row'), { browser: true })
  add('F13c', '4枚を2×2の表に並べる（画像とタイトルを同じセルに）', tableFigureDoc(base, 'grid'), { browser: true })
  add('F13d', '2枚を表に並べ、タイトルの下に「（筆者撮影）」の行も書く', tableFigureDoc(base, 'with-note'), { browser: true })
  add('F14', '画像を文の段落の途中に置く（行内）', docx(edit(base, 'p-1-2a', (b) => ({ ...b, p: p('　デザイン画は、資料をもとに描いた。', inlineImage(rid('f2.png')), 'まず全体の形を決め、次に色を決めた（図2）。') })).map((b) => (b.k === 'fig2' ? { k: 'fig2', p: '図2　デザイン画' } : b))))
  add(
    'F15',
    '浮かせた画像を、離れた段落（ⅰ の段落）に付けたまま、ⅱ の位置まで動かした（タイトルの枠は ⅱ）',
    docx(edit(edit(base, 'p-1-1c', (b) => ({ ...b, p: p(para(2), floatingImage(rid('f2.png'), { ...FLOAT_SINGLE, y: 4800000 })) })), 'fig2', (b) => ({ ...b, fig: { ...b.fig, img: null } }))),
    { browser: true },
  )
  add('F16', '画像とタイトルの枠をグループ化した図', docx(replace(base, 'fig2', { p: p(groupedFigure(rid('f2.png'), ['図2　デザイン画'])) })))
  add('F16b', '文字の枠の中に、画像とタイトルの行を入れた図', docx(replace(base, 'fig2', { p: p(imageInTextBox(rid('f2.png'), '図2　デザイン画')) })))
  add('F16c', '行内の画像と、文字の枠のタイトル', docx(base.map((b) => (b.fig ? { ...b, fig: { ...b.fig, run: inlineImage(rid(`f${b.fig.img}.png`)) } } : b))))
  add('F17', '図が30枚（2枚ずつ横に並べる。タイトルと参照あり）', manyFigures(30), { browser: true, pdf: true })
  add('F18', 'とても大きな画像（6000×4000 の PNG）', docx(base, { media: { 'f2.png': bigPng() } }), { browser: true, pdf: true })
  add(
    'F19',
    '使えない形の画像（図1 EMF・図2 WMF・図3 SVG（PNG の代わりあり）・図4 TIFF）',
    docx(
      edit(
        edit(base, 'fig2', (b) => ({ ...b, fig: { ...b.fig, run: inlineImage(rid('wmf2.wmf')) } })),
        'fig34',
        (b) => ({ ...b, style: 'inline', pair: b.pair }),
      ).map((b) => (b.k === 'fig1' ? { ...b, fig: { ...b.fig, run: inlineImage(rid('emf1.emf')) } } : b.k === 'fig34' ? { k: 'fig34', raw: p(svgImage(rid('f3.png'), rid('svg3.svg')), inlineImage(rid('tif4.tif'))) + p('図3　ジャケット（前）　　図4　ジャケット（後ろ）') } : b)),
      { media: { 'emf1.emf': emfHeader(), 'wmf2.wmf': wmfHeader(), 'svg3.svg': strToU8('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'), 'tif4.tif': tiffHeader(), 'f3.png': img(3) } },
    ),
    { browser: true },
  )
  add('F20', 'Word で切り抜いた画像（左右を 25% ずつ切った）', docx(edit(base, 'fig1', (b) => ({ ...b, fig: { ...b.fig, run: floatingImage(rid('f1.png'), { ...FLOAT_SINGLE, crop: { l: 25000, r: 25000 } }) } }))), { browser: true })

  // ==== 表 ====
  add('T01', '表のタイトルを表の下に書く', docx(edit(base, 'tbl1', (b) => ({ ...b, capBelow: true }))))
  add('T02', 'タイトルも参照もない表', docx(edit(edit(base, 'tbl1', (b) => ({ ...b, cap: null })), 'p-1-3a', (b) => ({ ...b, p: '　生地は、動きやすさと見た目の両方を考えて選んだ。' }))))
  add(
    'T03',
    'セルを結合した表（見出しの横の結合・縦の結合）',
    docx(edit(base, 'tbl1', (b) => ({ ...b, table: [[{ text: '名称', span: 2 }, '生地見本'], [{ text: '綿ブロード', vMerge: 'restart' }, 'シャツ', { images: [rid('sw1.png')] }], [{ text: '', vMerge: 'cont' }, 'ズボン', { images: [rid('sw2.png')] }]] }))),
    { browser: true },
  )
  add('T04', '表の中に表', docx(edit(base, 'tbl1', (b) => ({ ...b, table: undefined, raw: undefined })).map((b) => (b.k === 'tbl1' ? { k: 'tbl1', raw: p('表1　使用素材表') + `<w:tbl><w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc>${p('名称')}</w:tc><w:tc>${p('内訳')}</w:tc></w:tr><w:tr><w:tc>${p('綿ブロード')}</w:tc><w:tc>${table([['色', '量'], ['白', '2m']])}${p('')}</w:tc></w:tr></w:tbl>` } : b))))
  add(
    'T05',
    'とても横に広い表（8列・長い語）',
    docx(edit(base, 'tbl1', (b) => ({ ...b, table: [['名称', '使用箇所', '色', '組成', '幅', '用尺', '購入先', '備考'], ['ポリエステルジャガード', 'ジャケットの身頃と衿', 'ディープグリーン', 'ポリエステル100%', '110cm', '3.5m', '布地の店（日暮里）', '光沢が強いので裏面を使った'], ['ウールフラノ', 'パンツ', 'チャコールグレー', 'ウール100%', '148cm', '2m', '布地の店（日暮里）', '']], tableOptions: { widths: [1000, 1000, 1000, 1000, 800, 800, 1200, 1500] } }))),
    { browser: true },
  )
  add('T06', '空の表（中身もタイトルも空）', docx(edit(base, 'tbl1', (b) => ({ ...b, table: [['', '', ''], ['', '', ''], ['', '', '']] }))))
  add('T07', '50行の長い表（ページをまたぐ）', docx(edit(base, 'tbl1', (b) => ({ ...b, table: [['工程', '日付', '内容'], ...Array.from({ length: 50 }, (_, i) => [`工程${i + 1}`, `10/${(i % 30) + 1}`, '型紙を直し、仮縫いで形を確かめた'])] }))), { browser: true, pdf: true })
  add('T08', '表のタイトルを表の下に書き、表とタイトルの間に段落がある', docx(insertAfter(edit(base, 'tbl1', (b) => ({ ...b, cap: null })), 'tbl1', { k: 'tblnote', p: '　表の生地は、どれも日暮里の店で買った。' }, { k: 'tblcap', p: '表1　使用素材表' })))

  // ==== 組み立て ====
  add(
    'S01',
    '見出しを番号なしの太字で書く（大見出し「企画・立案」、中見出し「担当衣装のキャラクター」「ジャケット」、大見出し「考察」）',
    docx(
      base.map((b) =>
        b.k === 'h1-1' ? { ...b, h: p(bold('企画・立案')) } : b.k === 'h2-1-1' ? { ...b, h: p(bold('担当衣装のキャラクター')) } : b.k === 'h2-2-1' ? { ...b, h: p(bold('ジャケット')) } : b.k === 'h1-3' ? { ...b, h: p(bold('考察')) } : b,
      ),
    ),
  )
  add(
    'S02',
    '見出しを算用数字などで書く（1．企画・立案／第2章 制作過程／(1) ジャケット／2. パンツ／第3章 考察）',
    docx(base.map((b) => (b.k === 'h1-1' ? { ...b, h: '1．企画・立案' } : b.k === 'h1-2' ? { ...b, h: '第2章　制作過程' } : b.k === 'h2-2-1' ? { ...b, h: '(1) ジャケット' } : b.k === 'h2-2-2' ? { ...b, h: '2. パンツ' } : b.k === 'h1-3' ? { ...b, h: '第3章　考察' } : b))),
  )
  add(
    'S03',
    'Word の段落番号で見出しの番号を付ける（大見出し：Ⅰ．の自動番号、中見出し：ⅰ．の自動番号、Ⅱ-ⅲ だけ「1.」の自動番号）',
    docx(
      base.map((b) => {
        if (/^h1-/.test(b.k)) return { ...b, h: numbered(1, 0, b.h.replace(/^[ⅠⅡⅢ]．/, '')) }
        if (b.k === 'h2-2-3') return { ...b, h: numbered(2, 0, b.h.replace(/^[ⅰⅱⅲ]．/, '')) }
        if (/^h2-/.test(b.k)) return { ...b, h: numbered(1, 1, b.h.replace(/^[ⅰⅱⅲ]．/, '')) }
        return b
      }),
      { numbering: NUMBERING },
    ),
  )
  add(
    'S04',
    '見出しのスタイル（見出し 1・見出し 2）で、番号なし・ひな形と違う名前',
    docx(
      base.map((b) => {
        if (b.k === 'h1-3') return { ...b, h: styled('1', '考察') }
        if (/^h1-/.test(b.k)) return { ...b, h: styled('1', b.h.replace(/^[ⅠⅡⅢ]．/, '')) }
        if (/^h2-/.test(b.k)) return { ...b, h: styled('2', b.h.replace(/^[ⅰⅱⅲ]．/, '')) }
        return b
      }),
      { styles: HEADING_STYLES },
    ),
  )
  add('S05', '中見出しの番号が飛ぶ・重なる（Ⅱ の中見出しが ⅰ・ⅲ・ⅲ）', docx(base.map((b) => (b.k === 'h2-2-2' ? { ...b, h: 'ⅲ．パンツ' } : b))))
  add('S06', '本文が大見出しなしで始まる（Ⅰ の前に段落が2つ）', docx([{ k: 'pre1', p: para(5) }, { k: 'pre2', p: para(6) }, ...base]))
  add('S06b', '大見出しがひとつもない（中見出しと段落だけ）', docx(without(base, 'h1-1', 'h1-2', 'h1-3', 'pb1', 'pb2')))
  add(
    'S07',
    'ひな形の仮の文字が残る（中見出し「ⅲ．〇〇〇〇」の下に書いた・段落の途中の〇〇〇〇・「～～～」の行）',
    docx(edit(edit(insertAfter(base, 'p-2-3c', { k: 'tilde', p: '～～～～～～～～～～～～～～～～～～～～' }), 'h2-2-3', (b) => ({ ...b, h: 'ⅲ．〇〇〇〇' })), 'p-1-1a', (b) => ({ ...b, p: '　筆者が担当したのは、〇〇〇〇という青年の役である。' + para(0).slice(1) }))),
  )
  add(
    'S08',
    '空の段落で間をあける・Shift+Enter で行を分ける（文の途中・段落の区切り）',
    docx(
      base
        .flatMap((b) => (b.p !== undefined && b.k.startsWith('p-') ? [b, { k: `${b.k}-e1`, p: '<w:p/>' }, { k: `${b.k}-e2`, p: p('　') }] : [b]))
        .map((b) => (b.k === 'p-2-1c' ? { ...b, p: p('　身頃の丈は、仮縫いで', br, '何度も確かめた。', br, '　袖は二枚袖にした。', br, '袖口には飾りのボタンを付けた。') } : b)),
    ),
  )
  add(
    'S09',
    'セクション区切りと、変な所の改ページ（段落の途中・段落ごと・図の段落）',
    docx(
      base.map((b) =>
        b.k === 'p-1-1b'
          ? { ...b, p: p(para(1, '（図1）').slice(0, 40), pageBreak, para(1, '（図1）').slice(40)) }
          : b.k === 'p-1-2b'
            ? { ...b, p: `<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:type w:val="nextPage"/></w:sectPr></w:pPr>${run(para(4))}</w:p>` }
            : /^p-2-1/.test(b.k)
              ? { ...b, p: p(b.p, pageBreak) }
              : b,
      ),
    ),
    { browser: true },
  )
  add('S10', '本文の最後に「参考文献」の行と文献の一覧', docx([...base, { k: 'ref', h: '参考文献' }, { k: 'r1', p: '1) 文化花子『衣装の歴史』架空出版、2020年' }, { k: 'r2', p: '2) 架空のサイト（https://example.com/costume）2026/10/1参照' }]))
  add('S10b', '「参考にしたサイト」の見出しで文献の一覧（決まった名前でない）', docx([...base, { k: 'ref', h: '参考にしたサイト' }, { k: 'r1', p: '・架空のサイト（https://example.com/costume）2026/10/1参照' }, { k: 'r2', p: '・架空の衣装資料館（https://example.com/museum）2026/10/2参照' }]))
  add(
    'S10c',
    'Ⅱ の途中に中見出し「ⅲ．参考文献」、その後ろにも中見出し「ⅳ．仮面」と段落と図',
    docx(insertAfter(base, 'p-2-3c', { k: 'refh', h: 'ⅳ．参考文献' }, { k: 'r1', p: '1) 文化花子『衣装の歴史』架空出版、2020年' }, { k: 'h2-2-5', h: 'ⅴ．仮面' }, { k: 'p-mask', p: para(7, '（図6）') }, { k: 'fig6', fig: { img: 6, cap: '図6　仮面' } })),
  )
  add(
    'S10d',
    'Ⅰ に中見出し「ⅱ．参考資料」（参考にした絵の写真と説明）を足し、その後ろにデザイン説明・使用素材が続く',
    docx(insertAfter(base, 'fig1', { k: 'refh', h: 'ⅱ．参考資料' }, { k: 'p-ref', p: para(6, '（図2）') }, { k: 'fig-ref', fig: { img: 6, cap: '図2　参考にした肖像画' } })),
    { browser: true },
  )
  add('S10e', 'まとめの後ろに「参考文献」と一覧、その後ろに「謝辞」と段落', docx([...base, { k: 'ref', h: '参考文献' }, { k: 'r1', p: '1) 文化花子『衣装の歴史』架空出版、2020年' }, { k: 'thanks', h: '謝辞' }, { k: 'tp', p: '　制作にあたり、指導してくださった先生方に感謝する。' }]))
  add('S11', '本文のファイルの頭に、表紙と抄録を貼り付けた', docx(base, { before: [table([['研究題目'], ['卒業イベント「シンドバッド」について'], ['―海の王子の衣装制作―'], ['学籍番号　00ZZ0123'], ['氏名　文化　花子']]), p('抄録'), p(para(3)), p(para(4)), p(pageBreak)].join('') }))
  add('S12', '本文のファイルの頭に「目次」と目次の行（手で打った）', docx(base, { before: [p('目次'), p('Ⅰ．企画・立案・・・・・・・・1'), p('Ⅱ．制作過程・・・・・・・・3'), p('Ⅲ．まとめ・・・・・・・・5'), p(pageBreak)].join('') }))
  add(
    'S12b',
    '本文のファイルの頭に、Word の自動の目次（フィールド。目次の題なし）',
    docx(base, {
      before:
        `<w:p>${'<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>'}<w:hyperlink w:anchor="_Toc1">${run('Ⅰ．企画・立案')}${tab}${fld('PAGEREF _Toc1 \\h', '1')}</w:hyperlink></w:p>` +
        `<w:p><w:hyperlink w:anchor="_Toc2">${run('ⅰ．担当衣装のキャラクター')}${tab}${fld('PAGEREF _Toc2 \\h', '1')}</w:hyperlink></w:p>` +
        `<w:p><w:hyperlink w:anchor="_Toc3">${run('Ⅱ．制作過程')}${tab}${fld('PAGEREF _Toc3 \\h', '3')}</w:hyperlink></w:p>` +
        `<w:p><w:hyperlink w:anchor="_Toc4">${run('Ⅲ．まとめ')}${tab}${fld('PAGEREF _Toc4 \\h', '5')}</w:hyperlink><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>` +
        p(pageBreak),
    }),
  )
  add('S13', '本文の中で ⅰ．ⅱ．を手順の番号に使う（「ⅰ．型紙を作った。」）', docx(insertAfter(base, 'p-2-1c', { k: 'l1', p: 'ⅰ．まず型紙を作り、トワルで形を確かめた。' }, { k: 'l2', p: 'ⅱ．次に本番の生地を裁断し、縫い合わせた。' })))

  // ==== 文字 ====
  add(
    'X01',
    '文の決まりを破る（です・ます／体言止め／半角カナ／①／Ⅲ 型／絵文字／全角英字・数字／1字下げなし／「。（図1）」）',
    docx(
      edit(
        edit(edit(edit(base, 'p-1-1a', () => ({ k: 'p-1-1a', p: '筆者が担当したのは、パリスという青年です。優しく高貴な人物でした。衣装の色は緑。' })), 'p-1-1b', () => ({ k: 'p-1-1b', p: '　ｼﾙｴｯﾄはⅢ型にし、①身頃②袖の順に作った😊。ＴＯＷＡＬは２回作った。（図1）' })), 'p-1-2a', (b) => ({ ...b, p: b.p.replace(/^　/, '') })),
        'p-1-2b',
        (b) => ({ ...b, p: '　私が描いたデザイン画を、先生に見ていただいた。' + para(4).slice(1) }),
      ),
    ),
    { browser: true },
  )

  // ==== Word の機能 ====
  add(
    'W01',
    '変更履歴が残ったまま（足した文・消した文・消した画像・消した中見出し・移動・消した表の行）',
    docx(
      base.map((b) => {
        if (b.k === 'p-1-1a') return { ...b, p: p(run('　筆者が担当したのは、'), del(1, '敵役の'), ins(2, run('主人公の')), run('王子である。'), del(3, 'この文は消した。'), run(para(0).slice(1))) }
        if (b.k === 'fig2') return { ...b, raw: undefined, fig: { ...b.fig, run: `<w:del ${TC(4)}>${floatingImage(rid('f7.png'), FLOAT_SINGLE)}</w:del>${floatingImage(rid('f2.png'), FLOAT_SINGLE)}` } }
        if (b.k === 'h2-1-3') return { ...b, h: `<w:p><w:pPr><w:rPr><w:del ${TC(5)}/></w:rPr></w:pPr>${del(6, 'ⅲ．古い中見出し')}</w:p>${p('ⅲ．使用素材')}` }
        if (b.k === 'p-2-2b')
          return { ...b, p: `<w:p><w:moveFrom ${TC(7)}><w:r><w:t>　この段落は、下へ移した段落である（移す前）。</w:t></w:r></w:moveFrom></w:p>${p(para(10))}<w:p><w:moveTo ${TC(8)}><w:r><w:t>　この段落は、下へ移した段落である。</w:t></w:r></w:moveTo></w:p>` }
        if (b.k === 'tbl1')
          return {
            ...b,
            table: undefined,
            raw:
              p('表1　使用素材表') +
              `<w:tbl><w:tblGrid><w:gridCol w:w="2900"/><w:gridCol w:w="2900"/></w:tblGrid><w:tr><w:tc>${p('名称')}</w:tc><w:tc>${p('使用箇所')}</w:tc></w:tr><w:tr><w:tc>${p('綿ブロード')}</w:tc><w:tc>${p('シャツ')}</w:tc></w:tr>` +
              `<w:tr><w:trPr><w:del ${TC(9)}/></w:trPr><w:tc><w:p>${del(10, '消した素材')}</w:p></w:tc><w:tc><w:p>${del(11, '消した箇所')}</w:p></w:tc></w:tr></w:tbl>`,
          }
        return b
      }),
      { media: { 'f7.png': img(7) } },
    ),
    { browser: true, pdf: true },
  )
  add(
    'W02',
    'コメント・脚注・ハイパーリンク・ふりがな・上付き',
    docx(
      base.map((b) =>
        b.k === 'p-1-1a'
          ? { ...b, p: p('<w:commentRangeStart w:id="0"/>', run(para(0).slice(0, 30)), '<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>', run(para(0).slice(30))) }
          : b.k === 'p-1-1c'
            ? { ...b, p: p(run('　衣装の参考にした資料がある'), '<w:r><w:footnoteReference w:id="1"/></w:r>', run('。資料は'), `<w:hyperlink r:id="rIdX" w:history="1">${run('https://example.com/costume')}</w:hyperlink>`, run('で見た。')) }
            : b.k === 'p-2-1c'
              ? { ...b, p: p(run('　生地は10m'), '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>2</w:t></w:r>', run('ほど使い、'), '<w:r><w:ruby><w:rubyPr/><w:rt><w:r><w:t>ぬの</w:t></w:r></w:rt><w:rubyBase><w:r><w:t>布</w:t></w:r></w:rubyBase></w:ruby></w:r>', run('を重ねた。')) }
              : b,
      ),
    ),
  )
  add(
    'W03',
    'Word の「図表番号」（SEQ フィールド）のタイトルと「相互参照」（REF）の参照',
    docx(
      base.map((b) =>
        b.k === 'fig1'
          ? { ...b, fig: { ...b.fig, style: 'inline', cap: null }, after: true }
          : b.k === 'p-1-1b'
            ? { ...b, p: p(run(para(1).slice(0, -1) + '（'), fld('REF _Ref1 \\h', '図 1'), run('）。')) }
            : b,
      ).flatMap((b) => (b.k === 'fig1' ? [b, { k: 'cap1', p: p(run('図 '), fld('SEQ 図 \\* ARABIC', '1'), run(' キャラクターのイメージ')) }] : [b])),
    ),
  )
  add('W04', '記号のフォントの字（w:sym。Wingdings の矢印）と、隠し文字', docx(edit(base, 'p-2-1c', (b) => ({ ...b, p: p(run('　身頃を中表に合わせ'), '<w:r><w:sym w:font="Wingdings" w:char="F0E0"/></w:r>', run('縫い合わせた。'), '<w:r><w:rPr><w:vanish/></w:rPr><w:t>隠した文。</w:t></w:r>', run(para(8).slice(1))) }))))
  add('W05', '図の横に、説明の文を文字の枠（吹き出し）で書く', docx(edit(base, 'fig2', (b) => ({ ...b, fig: { ...b.fig, run: floatingImage(rid('f2.png'), FLOAT_SINGLE) + textBox(['衿は三段にした', '袖はパフスリーブ'], { x: 4300000, y: 300000 }) } }))))

  // ==== ファイル ====
  add('FL01', '.doc（古い形）の名前を .docx に変えた', oleBytes(), { browser: true })
  add('FL02', '0 バイトの .docx', new Uint8Array(0))
  add('FL03', '壊れた .docx（途中で切れた zip）', docx(base).slice(0, 3000), { browser: true })
  add('FL03b', '壊れた .docx（document.xml の途中で切れた）', brokenXmlDocx())
  add('FL04', 'パスワードのかかった .docx（中身は暗号の入れ物）', oleBytes(true))
  add('FL05', 'PDF の名前を .docx に変えた', strToU8('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n'))
  add('FL06', 'Excel（.xlsx）の名前を .docx に変えた', xlsxBytes())

  // ==== SAMPLE を元に ====
  if (existsSync(SAMPLE_BODY)) {
    const sample = new Uint8Array(readFileSync(SAMPLE_BODY))
    add('SM0', 'SAMPLE の本文（そのまま）', sample, { browser: true, pdf: true, sample: true })
    // ⅰ．ジャケットの段落は（図2）、図2・図3 の画像とタイトル（19〜28）を、次の中見出し ⅱ．シャツ（31）の直後へ
    add('SM1', 'SAMPLE：ⅰ（ジャケット）の図2・図3 を、次の中見出し ⅱ（シャツ）の直後へ動かした', rewriteDocx(sample, (doc) => moveBlocks(doc, 19, 28, 31)), { browser: true, pdf: true, sample: true })
    // ⅷ．葬式用コートの図10・図11（110〜119）を、次の章「Ⅲ．まとめ」（122）の直後へ
    add('SM2', 'SAMPLE：Ⅱ-ⅷ の図10・図11 を、次の章「Ⅲ．まとめ」の見出しの直後へ動かした', rewriteDocx(sample, (doc) => moveBlocks(doc, 110, 119, 122)), { sample: true })
    // 図2・図3 のタイトルの枠が付いた空の段落（28）だけが、次の中見出し ⅱ（31）の後ろになった（間のあき段落に見出しを打った）
    add('SM3', 'SAMPLE：図2・図3 のタイトルの枠の段落だけが、次の中見出し ⅱ（シャツ）の後ろになった', rewriteDocx(sample, (doc) => moveBlocks(doc, 28, 28, 31)), { browser: true, sample: true })
  }
  return list.filter((c) => c.body)
}

// ---- 図を表に並べる（F13） ----
function tableFigureDoc(base, kind) {
  const cell = (k, cap) => ({ text: cap, images: [rid(`f${k}.png`)] })
  let rows
  if (kind === 'same-cell') rows = [[cell(3, '図3　ジャケット（前）'), cell(4, '図4　ジャケット（後ろ）')]]
  else if (kind === 'caption-row') rows = [[cell(3, ''), cell(4, '')], ['図3　ジャケット（前）', '図4　ジャケット（後ろ）']]
  else if (kind === 'grid') rows = [[cell(3, '図3　ジャケット（前）'), cell(4, '図4　ジャケット（後ろ）')], [cell(6, '図5　ジャケット（横）'), cell(7, '図6　ジャケット（裏）')]]
  else rows = [[cell(3, '図3　ジャケット（前）\n（筆者撮影）'), cell(4, '図4　ジャケット（後ろ）\n（筆者撮影）')]]
  let spec = replace(base, 'fig34', { raw: table(rows) })
  if (kind === 'grid') {
    // 図5・図6 が増えたので、パンツの図を図7 にし、参照も足す
    spec = edit(edit(spec, 'fig5', (b) => ({ ...b, fig: { ...b.fig, cap: '図7　パンツ' } })), 'p-2-2a', (b) => ({ ...b, p: para(9, '（図7）') }))
    spec = edit(spec, 'p-2-1c', (b) => ({ ...b, p: para(8, '（図5・図6）') }))
  }
  // 表に入れた画像の関係を足す（表のセルは render の画像の名前を通らない）
  return docx(spec, { media: { 'f3.png': img(3), 'f4.png': img(4), 'f6.png': img(6), 'f7.png': img(7) } })
}

/** 図が n 枚（2枚ずつ） */
function manyFigures(n) {
  const spec = [{ k: 'h1', h: 'Ⅰ．企画・立案' }, { k: 'h2', h: 'ⅰ．デザイン説明' }]
  for (let i = 0; i < n; i += 2) {
    if (i > 0 && i % 10 === 0) spec.push({ k: `h-${i}`, h: `${['ⅰ', 'ⅱ', 'ⅲ', 'ⅳ', 'ⅴ', 'ⅵ'][i / 10]}．アイテム${i / 10 + 1}` })
    spec.push({ k: `p${i}`, p: para(i, `（図${i + 1}）`, 4) + '' })
    spec.push({ k: `q${i}`, p: `　後ろ姿を図${i + 2}に示す。${para(i + 1, '', 2).slice(1)}` })
    spec.push({ k: `f${i}`, pair: [{ img: i + 1, cap: `図${i + 1}　アイテム（前）${i + 1}` }, { img: i + 2, cap: `図${i + 2}　アイテム（後ろ）${i + 2}` }] })
  }
  spec.push({ k: 'pb', raw: p(pageBreak) }, { k: 'h3', h: 'Ⅱ．まとめ' }, { k: 'z1', p: para(3) }, { k: 'z2', p: para(4) })
  return docx(spec)
}

/** 6000×4000 の PNG（なめらかな模様で、ファイルは小さめ） */
let big = null
function bigPng() {
  if (big) return big
  big = png(6000, 4000, { draw: (x, y) => [(x >> 4) & 255, (y >> 4) & 255, ((x + y) >> 5) & 255] })
  return big
}

function wmfHeader() {
  const out = new Uint8Array(40)
  const v = new DataView(out.buffer)
  v.setUint32(0, 0x9ac6cdd7, true)
  return out
}
function tiffHeader() {
  const out = new Uint8Array(16)
  out.set([0x49, 0x49, 0x2a, 0x00, 0x08, 0, 0, 0])
  return out
}
/** OLE の入れ物（.doc・パスワードのかかった .docx と同じ頭） */
function oleBytes(encrypted = false) {
  const out = new Uint8Array(1536)
  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  if (encrypted) out.set(strToU8('EncryptionInfo'), 600)
  return out
}
function brokenXmlDocx() {
  const good = docx(baseSpec())
  return rewriteDocx(good, (doc) => doc.slice(0, Math.floor(doc.length / 2)))
}
function xlsxBytes() {
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'),
    '_rels/.rels': strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1"/></sheets></workbook>'),
  })
}

const NUMBERING =
  '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="upperRoman"/><w:lvlText w:val="%1．"/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%2．"/></w:lvl></w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>'
const HEADING_STYLES =
  '<w:style w:type="paragraph" w:default="1" w:styleId="a"><w:name w:val="Normal"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="1"><w:name w:val="heading 1"/><w:basedOn w:val="a"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="2"><w:name w:val="heading 2"/><w:basedOn w:val="a"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>'

export const fileNameOf = (c) => `${c.id}.docx`

// これだけを動かす：見本を poc-output/wordRules1110/docx/ に書き出す
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = join(OUT, 'docx')
  mkdirSync(dir, { recursive: true })
  const all = cases()
  for (const c of all) writeFileSync(join(dir, fileNameOf(c)), c.body)
  writeFileSync(join(OUT, 'cases.json'), JSON.stringify(all.map(({ id, title, browser, pdf, sample }) => ({ id, title, browser: !!browser, pdf: !!pdf, sample: !!sample })), null, 1))
  console.log(`${all.length} 件を ${dir} に書き出しました（ブラウザ ${all.filter((c) => c.browser).length} 件）`)
}
