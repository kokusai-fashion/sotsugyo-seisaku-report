// 動画 4：セルフチェックで直す（パソコン）
// 見本「シンドバッド」の「i．ブラウス」の袖の段落（p5。図表の参照のない段落）を、わざと誤り（「見頃」「記事」「です」）を入れた文に
// 置き換えてから録る（置き換える文は、この動画のために書いたもの。見本の文ではない）。
// 2026-10-20 の画面：右の欄の「直すところ」の項目を押すと、その場所へ移り、指摘の語のすぐ後ろにカーソルが来る。
// 学生は、そのまま Backspace で消して、正しい語を打つ（「直す」ボタンはない）。
// 「です」など文体の指摘は、項目を押すと語が選ばれた状態になる（2026-10-30 の画面。SELECT_ON_PICK）ので、そのまま「である」と打つ
export const meta = {
  number: '4',
  label: 'セルフチェックで直す',
  device: 'pc',
  captions: {
    panel: '右の「直すところ」に、書いた文の間違いが出ます',
    legend: '「エラー」は提出の前に必ず直します。「要確認」は、確かめて必要なら直します',
    go: '項目をクリックすると、その場所へ移ります。直し方は項目に書いてあります',
    fix: 'カーソルは、間違えた語のすぐ後ろに来ます。Backspace で消して、正しい語を入力します',
    warn: '「要確認」の「記事」は、ここでは布のことなので、「生地」に直します',
    edit: '「です」の項目では、語が選ばれた状態になります。そのまま「である」と入力します',
    zero: '直すところが0になりました。これで PDF を書き出せます',
  },
}

const CHECK_TEXT = '前見頃と袖は、すべて同じ向きに裁断した。光沢のある記事は、布目の向きによって色が違って見えるためです。'
const FIXED_TEXT = '前身頃と袖は、すべて同じ向きに裁断した。光沢のある生地は、布目の向きによって色が違って見えるためである。'

export async function prepare({ page, h }) {
  await h.setParagraph(page, 'p5', CHECK_TEXT)
  await h.sleep(500)
  await h.ready(page)
  // はじめは前のページ（使用素材の表）を見せておき、項目を押すと、その場所へ移ることを見せる
  await h.goToBlock(page, 'p3')
  const findings = await page.evaluate(() => window.__editor.getSnapshot().findings.map((f) => `${f.severity}:${f.title}`))
  console.log('  指摘：', findings.join('、'))
}

/** 「直すところ」の項目（見えているもの） */
const items = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.side .sec.check .issues li')].map((li) => {
      const r = li.getBoundingClientRect()
      return { text: li.textContent, x: r.left, y: r.top, w: r.width, h: r.height }
    }),
  )

/** 右の欄の「直すところ」の見出しから、項目の一覧の終わり（画面の下の端まで） */
const listArea = async (page, h) => {
  const sec = await h.rectOf(page, '.side .sec.check')
  const head = await h.rectOf(page, '.side .sec.check .check-sub.fix')
  const shown = (await items(page)).filter((i) => i.h > 0).at(-1)
  const top = head?.y ?? sec.y
  const bottom = Math.min(shown ? shown.y + shown.h + 8 : sec.y + sec.h, page.viewport().height - 4)
  return { x: sec.x, y: top - 8, w: sec.w, h: bottom - top + 8 }
}

/** 段落 p5 のまわり（上下に少しゆとり） */
const around = async (page, h) => {
  const p5 = await h.blockRect(page, 'p5')
  return { ...p5, y: p5.y - 30, h: p5.h + 60 }
}

/** 一覧の項目（text を含む）を押す */
async function pickItem(page, h, text) {
  const item = (await items(page)).find((i) => i.text.includes(text))
  if (!item) throw new Error(`「${text}」の項目が見つかりません`)
  await h.clickAt(page, item.x + 70, item.y + Math.min(24, item.h / 2), { pause: 700 })
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p5', { timeout: 30000 })
  await h.sleep(500)
}

/** カーソルの前の n 字を Backspace で消して、正しい語を打つ */
async function retype(page, h, n, right) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Backspace')
    await h.sleep(300)
  }
  await h.sleep(300)
  await h.typeSlow(page, right, 170)
  await h.sleep(900)
}

export async function run({ page, rec, h }) {
  // 1. 右の欄の「直すところ」
  rec.mark('panel', { focus: await listArea(page, h) })
  await h.sleep(3000)
  rec.mark('legend', { focus: await h.rectOf(page, '.side .sec.check .sev-legend') })
  await h.sleep(4300)

  // 2. 項目を押すと、その場所へ移り、「見頃」のすぐ後ろにカーソルが来る
  rec.mark('go', { focus: await listArea(page, h) })
  await h.sleep(2000)
  await pickItem(page, h, '見頃')
  await h.ready(page).catch(() => {})
  await h.sleep(300)
  // 打ち直す間は、段落に寄る（カーソルと打った字が見えるように）。項目を押すときは、右の一覧に戻る
  rec.mark('fix', { focus: await around(page, h) })
  await h.sleep(3300)
  await retype(page, h, 2, '身頃')

  // 3. 要確認：「記事」→「生地」
  rec.mark('warn', { focus: await listArea(page, h) })
  await h.sleep(1600)
  await pickItem(page, h, '記事')
  rec.mark('warnFix', { focus: await around(page, h) })
  await h.sleep(1300)
  await retype(page, h, 2, '生地')

  // 4. 「です」→「である」
  rec.mark('edit', { focus: await listArea(page, h) })
  await h.sleep(1500)
  await pickItem(page, h, 'です')
  rec.mark('editFix', { focus: await around(page, h) })
  await h.sleep(1300)
  await retype(page, h, 0, 'である')
  await page.keyboard.press('Escape')
  await h.ready(page)
  await h.sleep(400)

  // 書き直した文が思ったとおりか（違えば、録り直しが要る）
  const text = await h.paragraphText(page, 'p5')
  if (text !== FIXED_TEXT) throw new Error(`書き直した文が違います：${text}`)

  // 5. 0件
  const sec = await h.rectOf(page, '.side .sec.check')
  rec.mark('zero', { focus: { ...sec, h: Math.min(sec.h, 300) } })
  await h.sleep(2600)
  // 右下の「PDFを書き出す」（字幕はそのまま）
  rec.mark('pdfButton', { focus: await h.rectOf(page, '.side .side-foot') })
  const pdf = await h.centerOf(page, '.side .export')
  await h.moveTo(page, pdf.x, pdf.y)
  await h.sleep(2400)
}
