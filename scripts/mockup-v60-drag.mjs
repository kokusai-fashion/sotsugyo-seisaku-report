// mockups/v60：図を長押しでつかんで運ぶ（パソコン）見た目の案と、動かしている様子の動画（依頼者の相談 2026-10-25）。
// 本物のツール（開発サーバー）に見本の原稿を入れ、つかんだ図・置ける所の線・置けない所の知らせ・横に並べる線を、ページの上に重ねて描く
// （見た目の案。図を離したあとの移動だけは、原稿を本当に動かす）。マウスの矢印と字幕もページの上に描くので、そのまま録れる。
// 使い方：node scripts/mockup-v60-drag.mjs（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335）
//   できるもの：mockups/v60/shots/*.png（見本の絵）・poc-output/mockup-v60/drag-demo.mp4（動画。公開しない）
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'
import * as rec from './video/recorder.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const SHOTS = 'mockups/v60/shots'
const VIDEO = 'poc-output/mockup-v60'
const FFMPEG =
  process.env.FFMPEG ??
  `${process.env.LOCALAPPDATA}/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe`
mkdirSync(SHOTS, { recursive: true })
mkdirSync(VIDEO, { recursive: true })
const { sleep } = rec

/** ページの中で動く：見本の部品（矢印・字幕・つかんだ図・線・知らせ）を用意する（window.__mock） */
function installMock() {
  const css = document.createElement('style')
  css.textContent = `
    .m-shield { position: fixed; inset: 0; z-index: 9000; cursor: none; }
    .m-cursor { position: fixed; z-index: 9600; width: 26px; height: 26px; margin: -2px 0 0 -2px; pointer-events: none; }
    .m-cursor.grab { margin: -13px 0 0 -13px; }
    .m-ring { position: fixed; z-index: 9550; width: 46px; height: 46px; margin: -23px 0 0 -23px; pointer-events: none; }
    .m-ring circle { fill: none; stroke: #e0a000; stroke-width: 4; stroke-dasharray: 126; stroke-dashoffset: 126; transform: rotate(-90deg); transform-origin: 50% 50%; }
    .m-ring.go circle { transition: stroke-dashoffset .55s linear; stroke-dashoffset: 0; }
    .m-ghost { position: fixed; z-index: 9400; pointer-events: none; background: #fff; border-radius: 6px; box-shadow: 0 14px 34px rgba(20, 24, 50, .32); transform: scale(1.04) rotate(-1deg); opacity: .93; overflow: hidden; }
    .m-ghost img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .m-dim { position: fixed; z-index: 9300; pointer-events: none; border: 2px dashed #8a93b8; border-radius: 6px; background: rgba(244, 241, 234, .72); }
    .m-tick { position: fixed; z-index: 9350; width: 18px; height: 0; margin-top: -2px; border-top: 4px solid rgba(39, 54, 122, .55); border-radius: 2px; pointer-events: none; }
    .m-line { position: fixed; z-index: 9350; height: 0; pointer-events: none; display: none; }
    .m-line.on { display: block; border-top: 4px solid #d99a00; margin-top: -2px; }
    .m-line.on::after { content: 'ここに置く'; position: absolute; right: 0; top: -26px; padding: 2px 9px; border-radius: 6px; background: #d99a00; color: #fff; font: bold 12.5px "BIZ UDPGothic", sans-serif; }
    .m-vline { position: fixed; z-index: 9350; width: 0; border-left: 2px dashed rgba(39, 54, 122, .45); pointer-events: none; }
    .m-vline.on { border-left: 4px solid #d99a00; margin-left: -1px; }
    .m-vline.on::after { content: '横に並べる'; position: absolute; left: 8px; top: 0; padding: 2px 9px; border-radius: 6px; background: #d99a00; color: #fff; font: bold 12.5px "BIZ UDPGothic", sans-serif; white-space: nowrap; }
    .m-no { position: fixed; z-index: 9500; pointer-events: none; padding: 6px 11px; border-radius: 8px; background: #2b2e36; color: #fff; font: 13px "BIZ UDPGothic", sans-serif; white-space: nowrap; }
    .m-cap { position: fixed; z-index: 9700; left: 50%; bottom: 26px; transform: translateX(-50%); padding: 12px 26px; border-radius: 14px; background: rgba(22, 30, 70, .92); color: #fff; font: bold 21px "BIZ UDPGothic", sans-serif; white-space: nowrap; transition: opacity .2s; }
    .m-cap:empty { opacity: 0; }
    .m-no.m-hint { background: #d99a00; }
    .stage .arrow.next.m-arrow-on { box-shadow: 0 0 0 4px #d99a00, 0 0 0 10px rgba(217, 154, 0, .25); background: #fff7e0; }
    .m-glow { position: fixed; z-index: 9300; pointer-events: none; border: 3px solid #d99a00; border-radius: 6px; box-shadow: 0 0 0 6px rgba(217, 154, 0, .2); }
  `
  document.head.append(css)
  const el = (cls, html = '') => {
    const e = document.createElement('div')
    e.className = cls
    e.innerHTML = html
    document.body.append(e)
    return e
  }
  const ARROW = '<svg viewBox="0 0 20 28" width="22" height="30"><path d="M1 1 L1 23 L6.6 17.6 L10.6 26.4 L14.4 24.8 L10.4 16.2 L18.4 16.2 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  const HAND =
    '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M7 11V7.5a1.5 1.5 0 0 1 3 0V11 6a1.5 1.5 0 0 1 3 0v5-4a1.5 1.5 0 0 1 3 0v4.5-2a1.5 1.5 0 0 1 3 0V15c0 3.5-2.5 6-6 6h-1.5c-2 0-3.4-.9-4.5-2.4L4.6 15a1.5 1.5 0 0 1 2.4-1.8z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  const shield = el('m-shield')
  const cursor = el('m-cursor', ARROW)
  const cap = el('m-cap')
  let pos = { x: 0, y: 0 }
  let follow = null
  shield.addEventListener('mousemove', (e) => {
    pos = { x: e.clientX, y: e.clientY }
    cursor.style.left = `${pos.x}px`
    cursor.style.top = `${pos.y}px`
    follow?.(pos)
  })
  const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'
  const rectOf = (sel) => document.querySelector(sel)?.getBoundingClientRect()
  /** 現在のページの、ブロックの範囲（段落は id、図は図の要素） */
  const blockRect = (id) => {
    const els = [...document.querySelectorAll(`${CUR} [data-block-id="${id}"]`)]
    if (!els.length) return null
    const rs = els.map((e) => e.getBoundingClientRect())
    return { left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) }
  }
  const figRect = (id) => rectOf(`${CUR} figure[data-figure-id="${id}"]`)
  const imgRect = (id) => rectOf(`${CUR} figure[data-figure-id="${id}"] img`)
  let parts = []
  /** つかんでいる間、ページをめくっても残す部品（つかんだ図の写し・元の所の枠） */
  let kept = []
  let ghost = null
  let ghostOff = { x: 0, y: 0 }
  const clear = () => {
    parts.forEach((p) => p.remove())
    parts = []
  }
  window.__mock = {
    caption(text) {
      cap.textContent = text
    },
    grab(hand) {
      cursor.innerHTML = hand ? HAND : ARROW
      cursor.classList.toggle('grab', hand)
    },
    /** 長押しの輪（0.55秒で一周） */
    ring() {
      const r = el('m-ring go'.replace(' go', ''), '<svg viewBox="0 0 46 46" width="46" height="46"><circle cx="23" cy="23" r="20"/></svg>')
      r.style.left = `${pos.x}px`
      r.style.top = `${pos.y}px`
      requestAnimationFrame(() => requestAnimationFrame(() => r.classList.add('go')))
      parts.push(r)
      return r
    },
    /** 図をつかむ：元の所を薄くし、つかんだ図（写し）を矢印について動かす。置ける所などは retarget と同じ */
    lift(figureId, opts) {
      clear()
      const r = imgRect(figureId)
      const dim = el('m-dim')
      Object.assign(dim.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${figRect(figureId).bottom - r.top + 8}px` })
      ghost = el('m-ghost', `<img src="${document.querySelector(`${CUR} figure[data-figure-id="${figureId}"] img`).src}">`)
      const w = r.width * 0.62
      const h = r.height * 0.62
      Object.assign(ghost.style, { width: `${w}px`, height: `${h}px` })
      ghostOff = { x: -w * 0.3, y: -h * 0.3 }
      kept = [dim, ghost]
      this.retarget(opts)
    },
    /**
     * いまのページで、置ける所（lines：{ after: 段落の id か図の id }）・置けない所（no：{ above: ブロックの id, text }、
     * noBelow：{ below: ブロックの id, text }：小見出しの外など）・横に並べられる図（beside）を出す。ページをめくったあとにも使う（dim：false で元の所の枠を消す）
     */
    retarget({ lines = [], no = null, noBelow = null, beside = null, dim = true }) {
      clear()
      if (!dim) {
        kept.filter((k) => k !== ghost).forEach((k) => k.remove())
        kept = [ghost]
      }
      // 本文の幅（ページの中の段落の左右）
      const text = blockRect(no?.above) ?? blockRect(lines.find((l) => blockRect(l.after))?.after)
      const lineEls = lines.map((l) => {
        // 段落のすぐ下は段落の境目（次の段落の行に重ならない）、図の下は写真の説明の少し下
        const para = blockRect(l.after)
        const b = para ?? figRect(l.after)
        const top = `${b.bottom + (para ? 1 : 10)}px`
        // ふだんは本文の左の余白に短い印だけ（段落の間に線を引くと、字の取り消し線に見えるため）。いちばん近い所だけ、本文の幅いっぱいの金色の線
        const tick = el('m-tick')
        Object.assign(tick.style, { left: `${text.left - 30}px`, top })
        const e = el('m-line')
        Object.assign(e.style, { left: `${text.left}px`, width: `${text.right - text.left}px`, top })
        parts.push(tick, e)
        return e
      })
      let vline = null
      if (beside) {
        const b = imgRect(beside)
        vline = el('m-vline')
        Object.assign(vline.style, { left: `${b.right + 14}px`, top: `${b.top}px`, height: `${b.height}px` })
        parts.push(vline)
      }
      const noTip = el('m-no')
      noTip.style.display = 'none'
      parts.push(noTip)
      const noTop = no ? blockRect(no.above).top : -Infinity
      const noBottom = noBelow ? blockRect(noBelow.below).top - 4 : Infinity
      // 紙面の右の「›」：その上で待つと、次のページへ
      const next = document.querySelector('.stage .arrow.next')
      follow = (p) => {
        ghost.style.left = `${p.x + ghostOff.x}px`
        ghost.style.top = `${p.y + ghostOff.y}px`
        const nb = next?.getBoundingClientRect()
        const onNext = !!nb && p.x > nb.left - 10 && p.x < nb.right + 10 && p.y > nb.top - 10 && p.y < nb.bottom + 10
        next?.classList.toggle('m-arrow-on', onNext)
        // 置けない所（本文の（図n）がある段落より上・小見出しの外）：線を光らせず、わけを出す
        const why = onNext ? 'ここで少し待つと、次のページへ' : p.y < noTop ? no.text : p.y > noBottom ? noBelow.text : null
        const blocked = !!why
        noTip.style.display = blocked ? '' : 'none'
        noTip.classList.toggle('m-hint', onNext)
        if (blocked) {
          noTip.textContent = why
          noTip.style.left = `${onNext ? p.x - 250 : p.x + 22}px`
          noTip.style.top = `${p.y + 22}px`
        }
        // 横に並べる：図の右の線に近いとき
        const vb = vline?.getBoundingClientRect()
        const nearV = !!vb && !blocked && p.x > vb.left - 120 && p.y > vb.top - 20 && p.y < vb.bottom + 20
        vline?.classList.toggle('on', nearV)
        // いちばん近い線を光らせる
        let best = null
        // 線は光らせる所だけ見せるので、位置は書いておいた値で比べる
        const yOf = (e) => parseFloat(e.style.top)
        if (!blocked && !nearV) for (const e of lineEls) if (!best || Math.abs(yOf(e) - p.y) < Math.abs(yOf(best) - p.y)) best = e
        lineEls.forEach((e) => e.classList.toggle('on', e === best))
      }
      follow(pos)
    },
    drop() {
      follow = null
      clear()
      kept.forEach((k) => k.remove())
      kept = []
      document.querySelector('.stage .arrow.next')?.classList.remove('m-arrow-on')
    },
    glow(figureId) {
      const r = figRect(figureId)
      const g = el('m-glow')
      Object.assign(g.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` })
      setTimeout(() => g.remove(), 1600)
    },
    /** 位置（図の写真の真ん中・ブロックの下など） */
    at(kind, id) {
      const r = kind === 'img' ? imgRect(id) : blockRect(id)
      return r ? { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null
    },
  }
}

/** 原稿：図のまとまりを、ブロック after のすぐ後ろへ動かす */
const moveRow = (page, rowId, after) =>
  page.evaluate(
    (rowId, after) =>
      window.__editor.update((r) => ({
        ...r,
        body: r.body.map((c) => {
          const row = c.blocks.find((b) => b.id === rowId)
          if (!row) return c
          const rest = c.blocks.filter((b) => b.id !== rowId)
          rest.splice(rest.findIndex((b) => b.id === after) + 1, 0, row)
          return { ...c, blocks: rest }
        }),
      })),
    rowId,
    after,
  )

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => {
    const Real = window.WebSocket
    window.WebSocket = function (url, protocols) {
      if (String(protocols).includes('vite-hmr')) return { readyState: 0, addEventListener() {}, removeEventListener() {}, send() {}, close() {} }
      return new Real(url, protocols)
    }
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done')
    } catch {}
  })
  await stubConfig(page)
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready()
  await page.evaluate(setupWriting)
  await sleep(600)
  await ready()
  if (process.argv[2] === 'pages') {
    const t = await pagesScene(page, ready)
    await context.close()
    makeVideo(t, 'rec-pages', 'drag-pages.mp4')
    return
  }
  // 見本用に原稿を短くする：2章は「袖の刺繍」だけにして（図2枚が同じページに入るように）、段落 p9 の下にもう1枚の図（1枚だけの段）を置く。
  // その図のことは、段落 p8 の終わりに書く（図3・図4の順）
  await page.evaluate(() =>
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c) => {
        if (!c.blocks.some((b) => b.id === 'p8')) return c
        const blocks = c.blocks.filter((b) => !['s4', 'p6', 'p7', 's6', 'p11', 'p12', 's7', 'p13'].includes(b.id))
        blocks.splice(blocks.findIndex((b) => b.id === 'p9') + 1, 0, { type: 'figureRow', id: 'r9', figures: [{ id: 'f9', imageId: 'g-mood', caption: '図案の参考にした資料' }] })
        const p8 = blocks.findIndex((b) => b.id === 'p8')
        blocks[p8] = { ...blocks[p8], content: [...blocks[p8].content, { type: 'text', text: '図案は、海の写真や布を集めた資料をもとに考えた' }, { type: 'ref', targetId: 'f9', withParens: true }, { type: 'text', text: '。' }] }
        return { ...c, blocks }
      }),
    })),
  )
  await sleep(600)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p8'), 'none'))
  await sleep(600)
  await ready()
  await page.evaluate(() => document.activeElement?.blur())
  await page.evaluate(installMock)
  await rec.moveTo(page, 1000, 700)
  await sleep(300)
  const at = (kind, id) => page.evaluate((k, i) => window.__mock.at(k, i), kind, id)
  const mock = (fn, ...args) => page.evaluate((fn, args) => window.__mock[fn](...args), fn, args)

  const recording = await rec.startRecording(page, join(VIDEO, 'rec'), { quality: 90 })
  await sleep(600)

  // ---- 場面1：図4を長押しでつかみ、段落 p10 の下へ運ぶ（途中で、置けない所も見せる） ----
  await mock('caption', '図を長押しすると、つかめます')
  const f9 = await at('img', 'f9')
  await rec.moveTo(page, f9.x, f9.y)
  await sleep(700)
  await page.mouse.down()
  await mock('ring')
  await sleep(650)
  await mock('grab', true)
  await mock('lift', 'f9', {
    lines: [{ after: 'f3' }, { after: 'p10' }],
    no: { above: 'p8', text: '図は、本文の「（図4）」がある段落より上には置けません' },
  })
  await mock('caption', '置ける所に印が出て、いちばん近い所に線が出ます')
  await sleep(1400)
  const p10 = await at('block', 'p10')
  await rec.moveTo(page, f9.x, p10.bottom + 14)
  await sleep(1500)
  await page.screenshot({ path: `${SHOTS}/1-lift.png` })
  // 置けない所（（図4）がある段落より上）
  const p8 = await at('block', 'p8')
  await mock('caption', '置けない所では、わけが出ます')
  await rec.moveTo(page, f9.x, p8.top - 30)
  await sleep(1800)
  await page.screenshot({ path: `${SHOTS}/2-no.png` })
  await mock('caption', '置きたい所で離します')
  await rec.moveTo(page, f9.x, p10.bottom + 14)
  await sleep(1100)
  await page.mouse.up()
  await mock('drop')
  await mock('grab', false)
  await moveRow(page, 'r9', 'p10')
  await ready()
  await sleep(200)
  await mock('glow', 'f9')
  await mock('caption', '図が動きます（戻すときは「元に戻す」）')
  await sleep(2300)
  await page.screenshot({ path: `${SHOTS}/3-moved.png` })

  // ---- 場面2：図4（1枚だけ）を、図3の横へ運んで横に並べる ----
  await mock('caption', '1枚だけの図の横に運ぶと、横に並べられます')
  const f9b = await at('img', 'f9')
  await rec.moveTo(page, f9b.x, f9b.y)
  await sleep(900)
  await page.mouse.down()
  await mock('ring')
  await sleep(650)
  await mock('grab', true)
  await mock('lift', 'f9', { lines: [{ after: 'f3' }, { after: 'p9' }], beside: 'f3', no: { above: 'p8', text: '図は、本文の「（図4）」がある段落より上には置けません' } })
  await sleep(900)
  const f3b = await at('img', 'f3')
  await rec.moveTo(page, f3b.right + 60, f3b.y)
  await sleep(1600)
  await page.screenshot({ path: `${SHOTS}/4-beside.png` })
  await page.mouse.up()
  await mock('drop')
  await mock('grab', false)
  await page.evaluate(() =>
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c) => {
        const i = c.blocks.findIndex((b) => b.id === 'r3')
        if (i < 0) return c
        const f9 = c.blocks.find((b) => b.id === 'r9').figures[0]
        const blocks = c.blocks.filter((b) => b.id !== 'r9')
        blocks[blocks.findIndex((b) => b.id === 'r3')] = { ...c.blocks[i], figures: [...c.blocks[i].figures, f9] }
        return { ...c, blocks }
      }),
    })),
  )
  await ready()
  await sleep(200)
  await mock('glow', 'f9')
  await mock('caption', '横に並びました（図の番号は、本文で出てくる順のまま）')
  await sleep(2600)
  await page.screenshot({ path: `${SHOTS}/5-joined.png` })
  await mock('caption', '')
  await sleep(500)
  const t = await recording.stop()
  console.log(`録画：${t.duration.toFixed(1)}秒・写真 ${t.frames.length}枚`)
  await context.close()
  makeVideo(t, 'rec', 'drag-demo.mp4')
})

/** 録った写真を時刻どおりに並べて、30コマ/秒の MP4 にする */
function makeVideo(t, dir, name) {
  const list = t.frames.map((f, i) => {
    const next = t.frames[i + 1]?.t ?? t.duration
    return `file '${resolve(VIDEO, dir, 'frames', f.file).replaceAll('\\', '/')}'\nduration ${Math.max(0.01, next - f.t).toFixed(3)}`
  })
  writeFileSync(join(VIDEO, `${dir}.txt`), `${list.join('\n')}\nfile '${resolve(VIDEO, dir, 'frames', t.frames.at(-1).file).replaceAll('\\', '/')}'\n`)
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(VIDEO, `${dir}.txt`), '-vf', 'fps=30,scale=1440:-2', '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(VIDEO, name)])
  if (r.status !== 0) throw new Error(String(r.stderr))
  console.log(join(VIDEO, name))
}

/**
 * 場面3（node scripts/mockup-v60-drag.mjs pages）：小見出しのまとまりが2ページにわたるとき、図をつかんだまま「›」の上で待つと、
 * 次のページへめくれて、そのページで置ける所に線が出る。小見出しの外（次の小見出しより下）では、わけを出す
 */
async function pagesScene(page, ready) {
  // 「袖の刺繍」の終わりに段落を3つ足して、まとまりを次のページまで続ける（2章のほかの小見出しは残す）
  const more = [
    ['pa', '刺繍の糸は、照明の下での見え方を比べて選んだ。金の糸は光りすぎると波の形がつぶれて見えるため、つやを抑えたものと強いものを交互に使い、波の重なりが分かるようにした。'],
    ['pb', '刺繍枠は、袖の丸みに合わせて大小二つを使い分けた。袖口に近い所は布が細く、大きな枠では張れないため、小さな枠に替えて刺した。枠の跡が残らないよう、刺し終えるたびに当て布をしてアイロンをかけた。'],
    ['pc', '両袖を刺し終えたあと、舞台の上で腕を動かし、客席から刺繍がどう見えるかを確かめた。腕を下ろしたときにも波の模様が見えるよう、袖の下側にも小さな波を足した。'],
  ]
  await page.evaluate((more) => {
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c) => {
        const i = c.blocks.findIndex((b) => b.id === 'p10')
        if (i < 0) return c
        const blocks = [...c.blocks]
        blocks.splice(i + 1, 0, ...more.map(([id, text]) => ({ type: 'paragraph', id, content: [{ type: 'text', text }] })))
        return { ...c, blocks }
      }),
    }))
  }, more)
  await sleep(600)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('r3') >= 0 ? window.__editor.pageOfBlock('f3') : window.__editor.pageOfBlock('p8'), 'none'))
  await sleep(600)
  await ready()
  await page.evaluate(() => document.activeElement?.blur())
  await page.evaluate(installMock)
  await rec.moveTo(page, 1000, 700)
  await sleep(300)
  const at = (kind, id) => page.evaluate((k, i) => window.__mock.at(k, i), kind, id)
  const mock = (fn, ...args) => page.evaluate((fn, args) => window.__mock[fn](...args), fn, args)
  const onPage = (id) => page.evaluate((id) => !!window.__mock.at('block', id), id)
  const recording = await rec.startRecording(page, join(VIDEO, 'rec-pages'), { quality: 90 })
  await sleep(600)

  await mock('caption', '別のページへ運ぶときは、図をつかんだまま…')
  const f3 = await at('img', 'f3')
  await rec.moveTo(page, f3.x, f3.y)
  await sleep(700)
  await page.mouse.down()
  await mock('ring')
  await sleep(650)
  await mock('grab', true)
  // このページで置ける所（「（図3）」の段落より下で、このページにある段落の下）
  const here = []
  for (const id of ['p9', 'p10', 'pa', 'pb']) if (await onPage(id)) here.push({ after: id })
  console.log('このページ：', JSON.stringify(here))
  await mock('lift', 'f3', { lines: here, no: { above: 'p8', text: '図は、本文の「（図3）」がある段落より上には置けません' } })
  await sleep(1300)
  // 紙面の右の「›」の上で待つ
  await mock('caption', '紙面の右の「›」の上で、少し待ちます')
  const next = await page.evaluate(() => {
    const r = document.querySelector('.stage .arrow.next').getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await rec.moveTo(page, next.x, next.y)
  await sleep(300)
  await page.screenshot({ path: `${SHOTS}/6-next-arrow.png` })
  await sleep(700)
  await page.evaluate(() => window.__editor.goToPage(window.__editor.getSnapshot().page + 1))
  await ready()
  await sleep(200)
  // めくった先のページで置ける所（まとまりの終わりまで）。次の小見出し（帯とズボン）より下は、わけを出す
  const there = []
  for (const id of ['pa', 'pb', 'pc']) if (await onPage(id)) there.push({ after: id })
  console.log('次のページ：', JSON.stringify(there), await onPage('s6'))
  await mock('retarget', { lines: there, noBelow: { below: 's6', text: '図は、小見出しの外には置けません' }, dim: false })
  await mock('caption', '次のページへめくれます。置ける所に印が出ます')
  await sleep(600)
  const last = there.at(-1).after
  const lastAt = await at('block', last)
  await rec.moveTo(page, lastAt.x - 60, lastAt.bottom + 6)
  await sleep(1400)
  await page.screenshot({ path: `${SHOTS}/7-next-page.png` })
  // 小見出しの外
  const s6 = await at('block', 's6')
  await rec.moveTo(page, lastAt.x - 60, s6.bottom + 40)
  await sleep(1500)
  await page.screenshot({ path: `${SHOTS}/8-outside.png` })
  await mock('caption', '置きたい所で離します')
  await rec.moveTo(page, lastAt.x - 60, lastAt.bottom + 6)
  await sleep(1000)
  await page.mouse.up()
  await mock('drop')
  await mock('grab', false)
  await moveRow(page, 'r3', last)
  await ready()
  // 図が出たページを見せる（今の「上へ」「下へ」と同じ。ページの下に入りきらない図は、次のページの頭に送られる）
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('f3')))
  await ready()
  await sleep(300)
  await mock('glow', 'f3')
  await mock('caption', '図が、その場所へ動きます（図が出たページを見せます）')
  await sleep(2400)
  await page.screenshot({ path: `${SHOTS}/9-moved-page.png` })
  await mock('caption', '')
  await sleep(500)
  const t = await recording.stop()
  console.log(`録画：${t.duration.toFixed(1)}秒・写真 ${t.frames.length}枚`)
  return t
}
