// 新しい見本の原稿「シンドバッド」（2026-11-01。パリスの報告書の組み立てに合わせたもの）を、資料（使い方の画像・手引き・使い方の動画・スライド）を撮るために読み込む。
// 原稿の中身は、git に入れないファイル gas/trial-sample.private.json（管理ページの「学生の画面を試す」と同じもの）から読む。写真は public/trial/ のもの（公開してよいもの）。
// 自動テストの見本（sampleReport.mjs の setupWriting）は、テストが段落の名前（p3・p7 など）を使うので、そのまま残す。
//
// 使い方：
//   import { sinbadSample, setupSinbad, sampleText } from './e2e/sampleSinbad.mjs'
//   await page.evaluate(setupSinbad, sinbadSample())   // ログインしてコースを選んだあとの学生用ツールで
// 開発サーバーでも、自動テスト用にまとめた版（dist-e2e。scripts/e2e/serveBuilt.mjs で出す）でも動く（ツールのモジュールは読まない）。
//
// 見本の組み立て（段落などの名前）：
//   企画・立案：s1 担当衣装のキャラクター → p1 ／ s2 デザイン説明 → p2（図1）→ r1 図1 デザイン画 → 改ページ pb1 ／ s3 使用素材 → p3（表1）→ t1 使用材料表（6行）
//   制作過程：s4 ブラウス → p4（図2・図3）・p5・p6（図4）→ r2 図2 ブラウス前＋図3 ブラウス後ろ → r3 図4 袖の刺繍 ／ s5 サルエルパンツ → p7（図5）→ r4
//             s6 サッシュベルト → p8（図6）→ r5 ／ s7 ターバン → p9（図7）→ r6 ／ s8 靴 → p10（図8）→ r7
//   まとめ：p11〜p14
//   抄録：a1〜（started）。作品写真：g-photo1 を1枚
//   写真の名前：g-design・g-photo1・w-back・w-sleeve・w-pants・w-sash・w-turban・w-shoes（図）、g-satin・g-chiffon・g-broad・g-shantung・g-georgette・g-leather（生地）
import { readFileSync } from 'node:fs'

/** 見本の原稿（{ report, images }）。images は { id, file, maxPx }（file は public/trial/ の中の名前） */
export function sinbadSample() {
  return JSON.parse(readFileSync('gas/trial-sample.private.json', 'utf8'))
}

/** 見本の段落（p5 など）の文。見本の文は git に入れないので、資料を撮るスクリプトは、ここから実行のときに読む */
export function sampleText(sample, id) {
  const find = (o) => {
    if (!o || typeof o !== 'object') return null
    if (o.id === id) return o
    for (const v of Object.values(o)) {
      const r = find(v)
      if (r) return r
    }
    return null
  }
  return (find(sample.report)?.content ?? []).map((c) => c.text ?? '').join('')
}

/**
 * ページの中で動かす：見本の写真を入れ、原稿を見本に置き換える（コースと年度は、いま開いているツールのまま）。
 * 見本の写真は、どれも maxPx 以下の JPEG なので、縮めずにそのまま入れる
 */
export async function setupSinbad(sample) {
  const made = []
  for (const { id, file } of sample.images) {
    const blob = await (await fetch(`trial/${file}`)).blob()
    const bitmap = await createImageBitmap(blob)
    made.push({ id, blob, widthPx: bitmap.width, heightPx: bitmap.height })
    bitmap.close()
  }
  window.__editor.addImages(made)
  const r0 = window.__editor.getSnapshot().report
  window.__editor.replace({ ...sample.report, fiscalYear: r0.fiscalYear, basicInfo: { ...sample.report.basicInfo, courseId: r0.basicInfo.courseId || sample.report.basicInfo.courseId }, updatedAt: new Date().toISOString() })
}
