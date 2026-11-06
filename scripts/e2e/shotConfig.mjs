// 写真・動画を撮るときの年度の設定（使い方の写真・手引き・使い方の動画・学生向けスライド）。
// 自動テスト用の設定（config-fixture.json）の、コースの並びだけを本番の順にする。学生のはじめの案内のコースの並びは、
// 管理ページの「コースごとの設定」の順のまま出る（本番はスタイリスト → プロデューサー → 映画・舞台衣装：依頼者 2026-11-06）。
// 自動テストは「いちばん上のコース（映画・舞台衣装）」を押すものが多いので、テスト用の設定の順は変えない

/** 本番の、コースの並び（管理ページの「コースごとの設定」の順） */
export const LIVE_COURSE_ORDER = ['スタイリスト・コーディネーター', 'プロデューサー・ジャーナリスト', '映画・舞台衣装デザイナー']

/** 設定のコースを、本番の順に並べ替える（名前のないコースは後ろのまま）。config は直接書き換えて、そのまま返す */
export function withLiveCourseOrder(config) {
  const rank = (c) => {
    const i = LIVE_COURSE_ORDER.indexOf(c.name)
    return i < 0 ? LIVE_COURSE_ORDER.length : i
  }
  config.courses = [...config.courses].sort((a, b) => rank(a) - rank(b))
  return config
}
