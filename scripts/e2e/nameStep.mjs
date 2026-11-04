// はじめての案内の「氏名」の段（姓・名・セイ・メイの4つの欄。2026-11-04 から。入れるまで閉じられない：mockups/v101）を入れて「次へ」を押す。
// 欄の中身は、打たずに入れる（打ち方の確かめは smoke・pcFixes1025 で、キーボードで行っている）
export async function fillGuideName(page, parts = ['文化', '花子', 'ブンカ', 'ハナコ']) {
  await page.waitForSelector('.guide.step-name .name-fields input', { timeout: 30000 })
  await page.evaluate((parts) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    ;[...document.querySelectorAll('.guide.step-name .name-fields input')].forEach((input, i) => {
      set.call(input, parts[i] ?? '')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }, parts)
  await new Promise((r) => setTimeout(r, 100))
  await page.evaluate(() => document.querySelector('.guide.step-name .g-actions .primary').click())
  await page.waitForFunction(() => !document.querySelector('.guide.step-name'), { timeout: 20000 })
}

/** 原稿の氏名を、姓・名・ふりがなまで入れた形にする（開き直したときに、ふりがなを聞かれないように） */
export const fullName = { name: '文化　花子', familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ' }

/**
 * Word から読み込んだあと：ふりがながまだなら、案内の氏名の段が出る（2026-11-04 から）。入れて、案内を最後まで済ませる
 * （「表紙ができました」の「本文へ進む」。そのあと、スマホは「つぎにすること」が開く）
 */
export async function finishGuideAfterImport(page) {
  const named = await page.waitForSelector('.guide.step-name .name-fields input', { timeout: 8000 }).then(() => true, () => false)
  if (!named) return false
  await fillGuideName(page)
  // ふりがなだけを聞いたときは、そのまま閉じる。ほかの項目もまだなら、最後まで済ませる
  await page.waitForFunction(() => !document.querySelector('.guide') || document.querySelector('.guide.step-done .g-actions .primary, .guide .g-later'), { timeout: 8000 }).catch(() => {})
  if (await page.$('.guide.step-done .g-actions .primary')) await page.evaluate(() => document.querySelector('.guide.step-done .g-actions .primary').click())
  else if (await page.$('.guide .g-later')) await page.evaluate(() => document.querySelector('.guide .g-later').click())
  return true
}

/**
 * 案内を「あとで入力する」で閉じる。氏名の段（ログインで学籍番号が入ると、案内は氏名から）は閉じられないので、入れてから次の段で閉じる
 */
export async function closeGuide(page) {
  await page.waitForSelector('.guide .g-later, .guide.step-name .name-fields input', { timeout: 30000 })
  if (await page.$('.guide.step-name')) {
    await fillGuideName(page)
    await page.waitForSelector('.guide .g-later, .guide.step-done .g-actions button', { timeout: 20000 })
  }
  if (await page.$('.guide .g-later')) await page.evaluate(() => document.querySelector('.guide .g-later').click())
  else await page.evaluate(() => [...document.querySelectorAll('.guide .g-actions button')].find((b) => b.textContent.includes('閉じる'))?.click())
}
