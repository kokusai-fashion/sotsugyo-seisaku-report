// 場面14：途中点検の PDF を作って印刷する（右の欄のいちばん下の「PDFを書き出す」→「PDF を保存する」→ できた PDF）
import { captionsOf, press, say } from './_common.mjs'

const sentences = [
  '途中点検の日には、右の欄のいちばん下の「PDFを書き出す」を押して、PDF を作ります。',
  'ファイルの名前も、自動で付きます。',
  'その PDF を印刷して、先生に見てもらいます。',
]
export const meta = { number: '14', label: '途中点検の PDF を作る', device: 'pc', sentences, captions: captionsOf(sentences) }

// 操作はゆっくり見せ、話している所だけを枠で囲む（依頼者 2026-11-04）。録画は速めない（声のほうを操作に合わせて置く：timeWarp.mjs）
export async function run({ page, rec, h }) {
  // 1 途中点検の日には、右の欄のいちばん下の「PDFを書き出す」を押して、PDF を作ります
  await say(page, rec, h, 's1', { focus: h.union(await h.rectOf(page, '.side button.export'), await h.rectOf(page, '.side .export-note')) })
  await h.box(page, '.side button.export')
  await h.sleep(1200)
  await h.unbox(page)
  await press(page, h, '.side button.export')
  await page.waitForSelector('.modal .pdf-file', { timeout: 30000 })
  // 開いた窓へ寄る（寄らないと、窓が画面の端に半分だけ映った）
  rec.mark('s1b', { focus: await h.rectOf(page, '.modal') })
  await h.sleep(900)
  // 2 ファイルの名前も、自動で付きます
  await say(page, rec, h, 's2', { focus: await h.rectOf(page, '.modal') })
  await h.box(page, '.modal .pdf-file')
  await h.sleep(1600)
  // 3 その PDF を印刷して、先生に見てもらいます（直すところが残っていれば「このまま保存する」、なければ「PDF を保存する」。どちらも .pdf-start）
  await say(page, rec, h, 's3', { focus: await h.rectOf(page, '.modal') })
  await press(page, h, '.modal .pdf-start')
  // PDF を作っている間は、待つだけなので切る
  rec.mark('_cut')
  await page.waitForFunction(() => document.querySelector('.modal .pdf-open, .modal .pdf-save'), { timeout: 180000 })
  // 「保存しました」になるまで待つ（「保存の画面を開いています…」のままの絵で終わっていた）
  await page.waitForFunction(() => document.querySelector('.modal')?.textContent.includes('保存しました'), { timeout: 15000 }).catch(() => console.log('  （「保存しました」になりませんでした）'))
  await h.sleep(300)
  rec.mark('_cutEnd')
  // できた窓（ページの絵が並んで大きくなる）へ寄り、「PDF を開く」を囲む（印刷するときは、ここから開く）
  rec.mark('s3b', { focus: await h.rectOf(page, '.modal') })
  await h.sleep(700)
  await h.box(page, '.modal .pdf-open')
  await h.sleep(2000)
}
