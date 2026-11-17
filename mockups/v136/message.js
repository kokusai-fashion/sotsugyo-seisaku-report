// デザイン案 v136：古いブラウザ（古い macOS の Safari など）で開いたとき、真っ白にせずに知らせる（依頼者 2026-11-17）。
// 案ごとの見え方を、ページいっぱいに出す（?v=a|b|c&p=mac|iphone）。古いブラウザでも動くよう、ES5 で書く（本物も同じ書き方にする）
;(function () {
  var q = location.search
  var v = (/v=([abc])/.exec(q) || [])[1] || 'b'
  var p = (/p=(mac|iphone)/.exec(q) || [])[1] || 'mac'
  // 句ごとに折り返す（古い Safari には、ことばの切れ目で折り返す CSS がない）。「|」で区切った句を、途中で折り返さない箱にする
  function w(text) {
    return text
      .split('|')
      .map(function (s) {
        return '<span style="display:inline-block">' + s + '</span>'
      })
      .join('')
  }
  var C = { bg: '#ebe8e3', ink: '#23262b', muted: '#686b72', accent: '#2f3e75', soft: '#e8ebf5', line: '#e6e2dc' }
  var info =
    p === 'mac'
      ? {
          browser: 'Safari（15.6）',
          update: 'Mac を新しくすると、|開けるようになります。',
          steps: ['画面の左上の|りんごのマーク →|「システム設定」|（古い Mac では|「システム環境設定」）', '「ソフトウェアアップデート」で、|新しい macOS を入れる'],
          other: '新しくできない Mac のときは、|スマホか|大学のパソコンで|開いてください。',
        }
      : {
          browser: 'iPhone の Safari（15.8）',
          update: 'iPhone を新しくすると、|開けるようになります。',
          steps: ['「設定」→|「一般」→|「ソフトウェアアップデート」', '新しい iOS を入れる'],
          other: '新しくできない iPhone のときは、|パソコンで|開いてください。',
        }
  var title = 'このブラウザでは、|作成ツールを|開けません'
  var lead = 'お使いの ' + info.browser + 'は|古いため、|ツールが動きません。'
  var steps = '<ol style="margin:8px 0 0;padding-left:1.5em">' + info.steps.map(function (s) { return '<li style="margin-top:4px">' + w(s) + '</li>' }).join('') + '</ol>'
  var html
  if (v === 'a') {
    // 案A：文字だけ（今の「読み込んでいます…」と同じく、まん中に文だけ）
    html =
      '<div style="max-width:30em;margin:0 auto;padding:28vh 20px 40px;text-align:center;color:' + C.ink + '">' +
      '<p style="margin:0 0 10px;font-size:18px;font-weight:700">' + w(title) + '</p>' +
      '<p style="margin:0 0 14px;color:' + C.muted + '">' + w(lead) + '</p>' +
      '<div style="display:inline-block;text-align:left"><p style="margin:0">' + w(info.update) + '</p>' + steps + '</div>' +
      '<p style="margin:14px 0 0">' + w(info.other) + '</p></div>'
  } else {
    // 案B：カード。新しくする方法を先に／案C：カード。スマホ・大学のパソコンで開くことを先に
    var updateBlock =
      '<div style="margin-top:14px;padding:12px 14px;border-radius:10px;background:' + C.soft + '">' +
      '<p style="margin:0;font-weight:700;color:' + C.accent + '">' + w(info.update) + '</p>' + steps + '</div>'
    var otherBlock = '<p style="margin:14px 0 0">' + w(info.other) + '</p>'
    var otherFirst =
      '<div style="margin-top:14px;padding:12px 14px;border-radius:10px;background:' + C.soft + '">' +
      '<p style="margin:0;font-weight:700;color:' + C.accent + '">' + w(p === 'mac' ? 'スマホか|大学のパソコンで|開いてください。' : 'パソコンで|開いてください。') + '</p></div>' +
      '<p style="margin:14px 0 0;color:' + C.muted + '">' + w(p === 'mac' ? 'この Mac で使いたいときは、|Mac を新しくします。' : 'この iPhone で使いたいときは、|iPhone を新しくします。') + '</p>' +
      '<div style="color:' + C.muted + '">' + steps + '</div>'
    html =
      '<div style="min-height:100vh;box-sizing:border-box;padding:12vh 16px 40px;background:' + C.bg + '">' +
      '<div style="max-width:30em;margin:0 auto;padding:22px 22px 20px;border-radius:14px;background:#fff;box-shadow:0 1px 4px rgba(30,25,20,0.12);color:' + C.ink + '">' +
      '<p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;color:' + C.muted + '">卒業制作報告書 作成ツール</p>' +
      '<p style="margin:0 0 8px;font-size:19px;font-weight:700">' + w('このブラウザでは|開けません') + '</p>' +
      '<p style="margin:0;color:' + C.muted + '">' + w(lead) + '</p>' +
      (v === 'b' ? updateBlock + otherBlock : otherFirst) +
      '</div></div>'
  }
  document.body.style.margin = '0'
  document.body.style.font = '15px/1.7 sans-serif'
  document.body.style.background = v === 'a' ? '#fff' : C.bg
  document.body.innerHTML = html
})()
