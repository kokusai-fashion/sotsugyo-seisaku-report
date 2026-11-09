// 管理ページ・点検表を、スマホのホーム画面に置くための「入口のページ」を作る（mockups/v133。依頼者の選択 2026-11-10）。
// 管理ページは Apps Script から出すので、ホーム画面用の設定（丸いアイコン・短い名前：manifest・apple-touch-icon）を書けない。
// そこで GitHub Pages に入口のページを置き、ホーム画面にはこちらを置いてもらう。置いたアイコンから開くと（?from=home）、すぐ管理ページへ移る。
//   public/kanri/  … 管理ページ用（納戸色の「卒・管理」）
//   public/tenken/ … 点検表用（柿渋の「卒・点検」。管理ページの ?view=check へ）
// 管理ページの URL は gas/deployments.json から読む。新しいデプロイを作って URL が変わったら、これを実行し直して公開する。
// 使い方：node scripts/make-home-entries.mjs（アイコンは scripts/make-icons.mjs）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const ADMIN_URL = JSON.parse(readFileSync('gas/deployments.json', 'utf8')).admin.url

/** 置き方の手順。ひとまとまりずつ折り返す（「Web アプリ」の途中などで切れないように） */
const steps = (list) => list.map((t) => `<span class="st">${t}</span>`).join(' → ')
const IOS = `<b>iPhone：</b>${steps(['共有', '「ホーム画面に追加」', '「Web アプリとして開く」はオフにして「追加」'])}`
const ANDROID = `<b>Android：</b>${steps(['右上の「⋮」', '「ホーム画面に追加」', '「追加」'])}`

const ENTRIES = [
  {
    dir: 'kanri',
    title: '管理ページ',
    name: '卒業制作報告書 管理ページ',
    short: '卒制 管理',
    icon: 'admin',
    color: '#1f6273',
    target: ADMIN_URL,
    lead: 'アイコンを押すだけで開けます。',
    other: { dir: 'tenken', text: '点検表を置くときは、こちら' },
  },
  {
    dir: 'tenken',
    title: '点検表',
    name: '卒業制作報告書 点検表',
    short: '卒制 点検表',
    icon: 'check',
    color: '#9a5434',
    target: `${ADMIN_URL}?view=check`,
    lead: 'アイコンを押すだけで点検表が開きます。',
    other: { dir: 'kanri', text: '管理ページを置くときは、こちら' },
  },
]

const page = (e) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<!-- scripts/make-home-entries.mjs が作る（手で直さない）。ホーム画面に置く入口のページ（${e.title}） -->
<title>${e.title}（ホーム画面に置く）｜卒業制作報告書</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="../icons/${e.icon}-icon-192.png">
<link rel="apple-touch-icon" href="../icons/${e.icon}-touch-icon-180.png">
<meta name="apple-mobile-web-app-title" content="${e.short}">
<meta name="theme-color" content="${e.color}">
<script>
  // ホーム画面のアイコンから開いたとき（?from=home）は、すぐ${e.title}へ（「戻る」や読み直しで来たときは移らない）
  ;(function () {
    var target = '${e.target}'
    var nav = window.performance && performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null
    var fresh = !nav || nav.type === 'navigate'
    if (/(^|[?&])from=home(&|$)/.test(location.search.slice(1)) && fresh) {
      document.documentElement.className = 'going'
      location.replace(target)
    } else if (!location.search && history.replaceState) {
      // iPhone は、今の URL をホーム画面に置く。置いたアイコンから開いたときに、すぐ移れる URL にしておく（Android は manifest の start_url）
      history.replaceState(null, '', '?from=home')
    }
  })()
</script>
<style>
  :root { --c: ${e.color}; --ink: #26262b; --muted: #6b6b73; }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: #fff; color: var(--ink); font-family: 'Hiragino Sans', 'Noto Sans JP', 'BIZ UDPGothic', 'Yu Gothic UI', 'Meiryo', sans-serif; }
  main { max-width: 420px; margin: 0 auto; padding: 28px max(18px, env(safe-area-inset-right)) 36px max(18px, env(safe-area-inset-left)); display: grid; gap: 16px; justify-items: center; text-align: center; }
  .kick { margin: 0; font-size: 13px; color: var(--muted); letter-spacing: 0.06em; }
  .icon { width: 96px; height: 96px; border-radius: 22px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15); }
  h1 { margin: 0; font-size: 24px; }
  p { margin: 0; font-size: 15px; line-height: 1.7; }
  .how { width: 100%; text-align: left; background: #f6f5f1; border-radius: 12px; padding: 14px 16px; font-size: 14px; line-height: 1.75; }
  .how h2 { margin: 0 0 4px; font-size: 15px; }
  .how p { font-size: 14px; }
  .how p + p { margin-top: 6px; }
  .how .st { display: inline-block; }
  .go { display: block; width: 100%; padding: 14px; border-radius: 12px; background: var(--c); color: #fff; font-size: 16px; font-weight: 700; text-decoration: none; }
  .other { font-size: 14px; color: #1e3a8a; }
  .opening { display: none; }
  .going .info, .going .other { display: none; }
  .going .opening { display: block; }
</style>
</head>
<body>
<main>
  <p class="kick">卒業制作報告書</p>
  <img class="icon" src="../icons/${e.icon}-icon-192.png" alt="" width="96" height="96">
  <h1>${e.title}</h1>
  <p class="opening">${e.title}を開いています…</p>
  <p class="info">このページをホーム画面に置くと、<br>${e.lead}</p>
  <section class="how info">
    <h2>ホーム画面への置き方</h2>
    <p>${IOS}</p>
    <p>${ANDROID}</p>
  </section>
  <a class="go" href="${e.target}">${e.title}を開く</a>
  <a class="other" href="../${e.other.dir}/">${e.other.text}</a>
</main>
</body>
</html>
`

const manifest = (e) =>
  JSON.stringify(
    {
      name: e.name,
      short_name: e.short,
      description: `${e.title}を開く入口（卒業制作報告書）`,
      lang: 'ja',
      start_url: './?from=home',
      scope: './',
      display: 'browser',
      theme_color: e.color,
      background_color: '#ffffff',
      icons: [
        { src: `../icons/${e.icon}-icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `../icons/${e.icon}-icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `../icons/${e.icon}-icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ) + '\n'

for (const e of ENTRIES) {
  mkdirSync(`public/${e.dir}`, { recursive: true })
  writeFileSync(`public/${e.dir}/index.html`, page(e))
  writeFileSync(`public/${e.dir}/manifest.webmanifest`, manifest(e))
  console.log(`public/${e.dir}/（${e.target}）`)
}
