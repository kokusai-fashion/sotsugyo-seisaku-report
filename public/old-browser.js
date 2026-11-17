/*
 * 古いブラウザ（古い macOS の Safari・古い iPhone など）で開いたとき、真っ白にせずに知らせる（依頼者の選択 2026-11-17 mockups/v136 案B）。
 * 他コースの学生が、Mac の Safari で開くと真っ白で読み込めなかった。ツールは Safari 16.4（2023年3月）より古いブラウザでは、
 * 読み込みの最初で止まり、何も出ない（「(?<=…)」の書き方などを、古い Safari が読めない）。
 * index.html・check.html の、プログラムより前に読み込む。古いブラウザでも動くよう、この中は古い書き方（ES5）だけで書く。
 * 古いと分かったら、#root の中身（「読み込んでいます…」）を知らせに入れ替え、window.sotsugyoOldBrowser を立てる
 * （プログラムが動けるブラウザでも、その上に画面を作らない。main.tsx・check/main.tsx）。
 * 見分ける所は、ツールが使っていて、古いブラウザにはないもの。どれかがなければ古い
 */
;(function () {
  function lacksFeatures() {
    try {
      // 「図3」を見つけるときなどに使う、前を見る書き方（Safari 16.4・Chrome 62・Firefox 78 から）
      new RegExp('(?<=a)b')
    } catch (e) {
      return true
    }
    return (
      typeof structuredClone !== 'function' ||
      typeof Array.prototype.at !== 'function' ||
      typeof AbortSignal === 'undefined' ||
      typeof AbortSignal.timeout !== 'function' ||
      typeof Intl === 'undefined' ||
      typeof Intl.Segmenter !== 'function'
    )
  }
  if (!lacksFeatures()) return
  window.sotsugyoOldBrowser = true

  var script = document.currentScript
  var toolName = (script && script.getAttribute('data-name')) || '卒業制作報告書 作成ツール'
  var ua = navigator.userAgent
  var ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  var ios = ipad || /iPhone|iPod/.test(ua)
  var mac = !ios && /Macintosh/.test(ua)
  var android = /Android/.test(ua)

  function version(re) {
    var m = re.exec(ua)
    return m ? m[1].replace(/_/g, '.') : ''
  }
  function named(name, v) {
    return v ? name + '（' + v + '）' : name
  }
  var browser
  if (ios) browser = named(ipad ? 'iPad' : 'iPhone', version(/OS (\d+(?:_\d+)?)/) ? 'iOS ' + version(/OS (\d+(?:_\d+)?)/) : '')
  else if (/Edg\//.test(ua)) browser = named('Edge', version(/Edg\/(\d+)/))
  else if (/Firefox\//.test(ua)) browser = named('Firefox', version(/Firefox\/(\d+)/))
  else if (/Chrome\//.test(ua)) browser = named('Chrome', version(/Chrome\/(\d+)/))
  else if (/Safari\//.test(ua)) browser = named('Safari', version(/Version\/(\d+(?:\.\d+)?)/))
  else browser = 'ブラウザ'

  // 端末ごとの、新しくする手順。「|」は句の切れ目（句の途中では折り返さない）
  var device = ipad ? 'iPad' : 'iPhone'
  var info = mac
    ? {
        update: 'Mac を新しくすると、|開けるようになります。',
        steps: ['画面の左上の|りんごのマーク →|「システム設定」|（古い Mac では|「システム環境設定」）', '「ソフトウェアアップデート」で、|新しい macOS を入れる'],
        other: '新しくできない Mac のときは、|スマホか|大学のパソコンで|開いてください。',
      }
    : ios
      ? {
          update: device + ' を新しくすると、|開けるようになります。',
          steps: ['「設定」→|「一般」→|「ソフトウェアアップデート」', ipad ? '新しい iPadOS を入れる' : '新しい iOS を入れる'],
          other: '新しくできない ' + device + ' のときは、|パソコンで|開いてください。',
        }
      : android
        ? {
            update: 'Chrome を新しくすると、|開けるようになります。',
            steps: ['「Play ストア」で|「Chrome」を探す', '「更新」を押す'],
            other: '新しくできないときは、|パソコンで|開いてください。',
          }
        : {
            update: 'ブラウザを新しくすると、|開けるようになります。',
            steps: ['Chrome か Edge の|右上の「⋮」か「…」→|「設定」', '「Chrome について」|（Edge は|「Microsoft Edge について」）を開くと、|新しい版が入る'],
            other: '新しくできないときは、|スマホか|大学のパソコンで|開いてください。',
          }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  // 句ごとに、途中で折り返さない箱にする（古い Safari には、ことばの切れ目で折り返す CSS がない）
  function w(text) {
    var parts = text.split('|')
    var out = ''
    for (var i = 0; i < parts.length; i++) out += '<span style="display:inline-block">' + esc(parts[i]) + '</span>'
    return out
  }
  var C = { bg: '#ebe8e3', ink: '#23262b', muted: '#686b72', accent: '#2f3e75', soft: '#e8ebf5' }
  var steps = ''
  for (var i = 0; i < info.steps.length; i++) steps += '<li style="margin-top:4px">' + w(info.steps[i]) + '</li>'

  var html =
    '<div class="old-browser" role="alert" style="min-height:100vh;box-sizing:border-box;padding:12vh 16px 40px;background:' + C.bg + ';font:15px/1.7 sans-serif;color:' + C.ink + '">' +
    '<div style="max-width:30em;margin:0 auto;padding:22px 22px 20px;border-radius:14px;background:#fff;box-shadow:0 1px 4px rgba(30,25,20,0.12)">' +
    '<p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;color:' + C.muted + '">' + esc(toolName) + '</p>' +
    '<p style="margin:0 0 8px;font-size:19px;font-weight:700">' + w('このブラウザでは|開けません') + '</p>' +
    '<p style="margin:0;color:' + C.muted + '">' + w('お使いの ' + browser + 'は|古いため、|ツールが動きません。') + '</p>' +
    '<div style="margin-top:14px;padding:12px 14px;border-radius:10px;background:' + C.soft + '">' +
    '<p style="margin:0;font-weight:700;color:' + C.accent + '">' + w(info.update) + '</p>' +
    '<ol style="margin:8px 0 0;padding-left:1.5em">' + steps + '</ol></div>' +
    '<p style="margin:14px 0 0">' + w(info.other) + '</p>' +
    '</div></div>'

  var root = document.getElementById('root')
  if (root) root.innerHTML = html
  document.body.style.margin = '0'
  document.body.style.background = C.bg
})()
