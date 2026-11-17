// 古いブラウザで開いたときの知らせ（依頼者の選択 2026-11-17 mockups/v136 案B。public/old-browser.js）。これだけを流すときは node scripts/e2e/run.mjs oldBrowser1117
// - 他コースの学生が、Mac の Safari で開くと真っ白で読み込めなかった。ツールは Safari 16.4 より古いブラウザでは読み込みの最初で止まる。
//   そのときは真っ白にせず、「このブラウザでは開けません」と、端末ごとの新しくする手順・ほかの端末で開くことを知らせる
// - ここでは、ツールが使う機能（Intl.Segmenter・前を見る正規表現）を消して古いブラウザのふりをし、端末の名前（UA）を変えて確かめる
// - ふつうのブラウザでは、知らせは出ず、ツールがいつもどおり開く
import { mkdirSync } from 'node:fs'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/oldBrowser1117'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

const UA = {
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
  winChrome: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 7.0; SH-01J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36',
}

/**
 * ページを開く。old：'segmenter'（Intl.Segmenter を消す）・'lookbehind'（前を見る正規表現を読めないことにする）・なし（ふつう）。
 * 知らせの文・ツールが動き始めたか・横にはみ出していないかを返す
 */
async function open(browser, { path = '/?nodrive', ua, phone = false, old, touch = false } = {}) {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  if (ua) await page.setUserAgent(ua)
  if (phone) await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  else await page.setViewport({ width: 1280, height: 800 })
  if (touch) await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 }))
  if (old === 'segmenter') await page.evaluateOnNewDocument(() => { delete Intl.Segmenter })
  if (old === 'lookbehind')
    await page.evaluateOnNewDocument(() => {
      const R = window.RegExp
      window.RegExp = function (p, f) {
        if (String(p).includes('(?<=')) throw new SyntaxError('Invalid regular expression: invalid group specifier name')
        return new R(p, f)
      }
    })
  await stubConfig(page)
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle0', timeout: 90000 })
  await wait(old ? 1500 : 3000)
  const state = await page.evaluate(() => ({
    flag: !!window.sotsugyoOldBrowser,
    notice: document.querySelector('.old-browser')?.innerText ?? '',
    // ツールが動き始めると、#root の中身（「読み込んでいます…」か知らせ）がツールの画面に入れ替わる
    app: !!document.querySelector('#root > :not(p):not(.old-browser)'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))
  return { page, state, errors }
}

await withEdge(async (browser) => {
  // ふつうのブラウザ：知らせは出ない
  let r = await open(browser)
  check('ふつうのブラウザでは、知らせは出ず、ツールが開く', !r.state.flag && !r.state.notice && r.state.app, JSON.stringify(r.state))
  check('ふつうのブラウザで、読み込みの知らせのファイルがエラーを出さない', r.errors.length === 0, r.errors.join(' / '))
  await r.page.close()
  r = await open(browser, { path: '/check.html' })
  check('提出前チェックも、ふつうのブラウザでは知らせを出さずに開く', !r.state.flag && !r.state.notice && r.state.app, JSON.stringify(r.state))
  await r.page.close()

  // Mac の古い Safari
  r = await open(browser, { ua: UA.macSafari, old: 'segmenter' })
  const mac = r.state.notice
  check('古い Mac の Safari：知らせが出て、ツールの画面は作らない', r.state.flag && mac.includes('このブラウザでは開けません') && !r.state.app, JSON.stringify({ ...r.state, notice: undefined }))
  check('古い Mac の Safari：ツールの名前と、ブラウザの名前・番号', mac.includes('卒業制作報告書 作成ツール') && mac.includes('お使いの Safari（15.6）は古いため、ツールが動きません。'), mac.split('\n').slice(0, 3).join('｜'))
  check(
    '古い Mac の Safari：Mac を新しくする手順と、新しくできないとき',
    mac.includes('Mac を新しくすると、開けるようになります。') && mac.includes('りんごのマーク') && mac.includes('システム環境設定') && mac.includes('ソフトウェアアップデート') && mac.includes('新しくできない Mac のときは、スマホか大学のパソコンで開いてください。'),
  )
  await r.page.screenshot({ path: `${OUT}/mac-safari.png` })
  await r.page.close()

  // 前を見る正規表現が読めない（Safari 16.3 まで）
  r = await open(browser, { ua: UA.macSafari, old: 'lookbehind' })
  check('前を見る正規表現が読めないブラウザでも、知らせが出る', r.state.flag && r.state.notice.includes('このブラウザでは開けません') && !r.state.app)
  await r.page.close()

  // 古い iPhone
  r = await open(browser, { ua: UA.iphone, phone: true, old: 'segmenter' })
  const ip = r.state.notice
  check('古い iPhone：iOS の番号と、iPhone を新しくする手順', ip.includes('お使いの iPhone（iOS 15.8）は古いため') && ip.includes('「設定」→「一般」→「ソフトウェアアップデート」') && ip.includes('新しい iOS を入れる'), ip.split('\n').slice(0, 4).join('｜'))
  check('古い iPhone：新しくできないときは、パソコンで', ip.includes('新しくできない iPhone のときは、パソコンで開いてください。'))
  check('古い iPhone：スマホの幅で、横にはみ出さない', r.state.overflow <= 0, `${r.state.overflow}px`)
  await r.page.screenshot({ path: `${OUT}/iphone.png` })
  await r.page.close()

  // 古い iPad（Mac と同じ名前を名乗るが、指で触れる）
  r = await open(browser, { ua: UA.ipad, phone: true, touch: true, old: 'segmenter' })
  check('古い iPad：Mac ではなく iPad として知らせる', r.state.notice.includes('iPad を新しくすると') && r.state.notice.includes('iPadOS'), r.state.notice.split('\n').slice(2, 4).join('｜'))
  await r.page.close()

  // Windows の古い Chrome
  r = await open(browser, { ua: UA.winChrome, old: 'segmenter' })
  const win = r.state.notice
  check('Windows の古い Chrome：番号と、ブラウザを新しくする手順', win.includes('お使いの Chrome（109）は古いため') && win.includes('ブラウザを新しくすると') && win.includes('「Chrome について」'), win.split('\n').slice(2, 5).join('｜'))
  await r.page.close()

  // Android の古い Chrome
  r = await open(browser, { ua: UA.android, phone: true, old: 'segmenter' })
  check('Android の古い Chrome：Play ストアで更新する手順', r.state.notice.includes('「Play ストア」で「Chrome」を探す') && r.state.notice.includes('新しくできないときは、パソコンで開いてください。'))
  await r.page.close()

  // 提出前チェック
  r = await open(browser, { path: '/check.html', ua: UA.macSafari, old: 'segmenter' })
  check('提出前チェック：同じ知らせが、「提出前チェック」の名前で出る', r.state.flag && r.state.notice.startsWith('提出前チェック') && r.state.notice.includes('このブラウザでは開けません') && !r.state.app, r.state.notice.split('\n')[0])
  await r.page.close()

  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} 件 合格`)
  if (passed !== results.length) process.exitCode = 1
})
