// ホーム画面のアイコンとブラウザのタブの印を作る（mockups/v40 案B：紺地に白い「卒」。依頼者の選択）。
// 「卒」は BIZ UD明朝（@fontsource。ツールの中の印と同じ書体）で描き、PNG にして public/icons/ に置く。
// 管理ページのアイコン（admin-icon-*.png）は、納戸色の地に白い「卒」と「管理」（mockups/v129 案C の形・v130 ③ 納戸色。依頼者の選択 2026-11-10）。
// 管理ページは Apps Script から出すので、ホーム画面用の指定（apple-touch-icon・manifest）は置けない。
// gas/admin-project/Code.js の doGet が setFaviconUrl で GitHub Pages の admin-icon-192.png を指す（パソコンのタブと、Android のホーム画面）
// 点検表のアイコン（check-icon-*.png）は、柿渋の地に白い「卒」と「点検」（mockups/v131 の形・v132 ⑤ 柿渋。依頼者の選択 2026-11-10）。
// 点検表に直接入るリンク（?view=check）で開いたときだけ、doGet がこちらを指す
// ホーム画面に置く入口のページ（public/kanri/・public/tenken/：scripts/make-home-entries.mjs）には、
// Android の丸い切り抜き用（*-maskable-512.png。字を小さめにして、切り抜いても欠けない）と iPhone 用（*-touch-icon-180.png）も作る（mockups/v133）
// 使い方：node scripts/make-icons.mjs（Edge を使う。EDGE_PORT でポートを変えられる）
import { mkdirSync, readFileSync } from 'node:fs'
import { withEdge } from './poc/edge.mjs'

const OUT = 'public/icons'
const ACCENT = '#2f3e75'
/** 管理ページのアイコンの地の色（納戸色） */
const ADMIN = '#1f6273'
/** 点検表のアイコンの地の色（柿渋） */
const CHECK = '#9a5434'
const font = readFileSync('node_modules/@fontsource/biz-udmincho/files/biz-udmincho-japanese-400-normal.woff2').toString('base64')
const gothic = readFileSync('node_modules/@fontsource/biz-udpgothic/files/biz-udpgothic-japanese-700-normal.woff2').toString('base64')

/**
 * 作る絵（size：一辺の点の数）。
 * 角は丸めない（iPhone・Android が自分の形に切り抜くため）。タブの小さな印だけは角を丸める。
 * 「卒」は真ん中の約半分の大きさ（Android の切り抜き〔maskable〕で切れない範囲に収まる）
 */
const ICONS = [
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-192.png', size: 192 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-48.png', size: 48, round: true },
  { file: 'favicon-32.png', size: 32, round: true },
  // 管理ページ（「卒」と「管理」）
  { file: 'admin-icon-512.png', size: 512, sub: { bg: ADMIN, label: '管理' } },
  { file: 'admin-icon-192.png', size: 192, sub: { bg: ADMIN, label: '管理' } },
  // 点検表（「卒」と「点検」）
  { file: 'check-icon-512.png', size: 512, sub: { bg: CHECK, label: '点検' } },
  { file: 'check-icon-192.png', size: 192, sub: { bg: CHECK, label: '点検' } },
  // 入口のページ用（Android の丸い切り抜き・iPhone）
  { file: 'admin-icon-maskable-512.png', size: 512, sub: { bg: ADMIN, label: '管理', scale: 0.8 } },
  { file: 'check-icon-maskable-512.png', size: 512, sub: { bg: CHECK, label: '点検', scale: 0.8 } },
  { file: 'admin-touch-icon-180.png', size: 180, sub: { bg: ADMIN, label: '管理' } },
  { file: 'check-touch-icon-180.png', size: 180, sub: { bg: CHECK, label: '点検' } },
]

const html = (size, round) => `<!doctype html><html><head><style>
@font-face { font-family: 'Mincho'; src: url(data:font/woff2;base64,${font}) format('woff2'); }
html, body { margin: 0; background: transparent; }
.icon { width: ${size}px; height: ${size}px; display: grid; place-items: center; background: ${ACCENT}; border-radius: ${round ? Math.round(size * 0.2) : 0}px; }
.k { color: #fff; font-family: 'Mincho'; font-size: ${Math.round(size * (round ? 0.72 : 0.53))}px; line-height: 1; transform: translateY(${round ? 0 : -size * 0.01}px); }
</style></head><body><div class="icon"><span class="k">卒</span></div></body></html>`

/** 管理ページ・点検表のアイコン：「卒」の下に「管理」「点検」（見本 v129 の 180px の絵と同じ割合。字は真ん中の約6割に収まる） */
const subHtml = (size, { bg, label, scale = 1 }) => `<!doctype html><html><head><style>
@font-face { font-family: 'Mincho'; src: url(data:font/woff2;base64,${font}) format('woff2'); }
@font-face { font-family: 'Gothic'; font-weight: 700; src: url(data:font/woff2;base64,${gothic}) format('woff2'); }
html, body { margin: 0; background: transparent; }
.icon { width: ${size}px; height: ${size}px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${bg}; }
.k { color: #fff; font-family: 'Mincho'; font-size: ${Math.round(size * 0.467 * scale)}px; line-height: 1; }
.s { color: #fff; font-family: 'Gothic'; font-weight: 700; font-size: ${Math.round(size * 0.167 * scale)}px; line-height: 1; letter-spacing: 0.12em; padding-left: 0.12em; margin-top: ${Math.round(size * 0.056 * scale)}px; }
</style></head><body><div class="icon"><span class="k">卒</span><span class="s">${label}</span></div></body></html>`

mkdirSync(OUT, { recursive: true })
await withEdge(async (browser) => {
  const page = await browser.newPage()
  for (const { file, size, round, sub } of ICONS) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
    await page.setContent(sub ? subHtml(size, sub) : html(size, round), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${OUT}/${file}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
    console.log(`${OUT}/${file}`)
  }
})
