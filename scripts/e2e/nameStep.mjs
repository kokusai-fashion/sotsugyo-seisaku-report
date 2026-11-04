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
