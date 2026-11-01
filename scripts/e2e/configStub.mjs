// 自動テストでは、学科の設定を配信の窓口（Apps Script）から読み込まず、決まった設定（config-fixture.json）を返す。
// 窓口の返事の速さに左右されず、テストのたびに窓口を呼ばないようにするため。
// config-fixture.json は、公開中の設定の写し（コースを足すなどしたら取り直す）。
// 窓口に送るもの（POST）のうち、届いた声（feedback・feedbackStatus）とエラーの記録（errorLog）は、ここでまねて答え、送られた中身を posted に残す
// （gas/api-project/Code.js の feedback_ などと同じ形。テストは feedbackStub で状態を決める）
import { readFileSync } from 'node:fs'

const config = JSON.parse(readFileSync(new URL('./config-fixture.json', import.meta.url), 'utf8'))

/** 窓口に送られたもの（届いた声・状態の問い合わせ・エラーの記録） */
export const posted = []
/** 届いた声の状態（受付番号 → { status, reply }。テストが決める） */
export const feedbackStub = { statuses: new Map(), seq: 0 }

function answerPost(body) {
  let request = {}
  try {
    request = JSON.parse(body ?? '{}')
  } catch {
    request = {}
  }
  posted.push(request)
  if (request.action === 'feedback') {
    const id = `1101-${String(++feedbackStub.seq).padStart(3, '0')}`
    return { ok: true, id, key: `key-${id}` }
  }
  if (request.action === 'feedbackStatus') {
    const items = (request.items ?? [])
      .filter((x) => x.key === `key-${x.id}` && feedbackStub.statuses.has(x.id))
      .map((x) => ({ id: x.id, changedAt: '2026-11-05 10:00', ...feedbackStub.statuses.get(x.id) }))
    return { ok: true, items }
  }
  if (request.action === 'errorLog') return { ok: true }
  return null
}

export async function stubConfig(page) {
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (/script\.google(usercontent)?\.com/.test(request.url())) {
      const answer = request.method() === 'POST' ? answerPost(request.postData()) : null
      return request.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(answer ?? { ok: true, year: config.fiscalYear, config }),
      })
    }
    return request.continue()
  })
}
