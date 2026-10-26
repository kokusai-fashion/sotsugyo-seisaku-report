/**
 * ことばの切れ目で折り返す（ことばの切れ目に「幅のない空白」を入れる。BudouX：Google の、日本語の文をことばの区切りに分ける仕組み。Apache-2.0）。
 * Chrome・Edge は CSS の word-break: auto-phrase で同じことをするので、何もしない（auto-phrase がないブラウザ＝iPhone・Mac の Safari だけで動く）。
 * 前は Safari で、窓・使い方・知らせなどの文が「残しま／す」のように1字だけ次の行に落ちたり、語の途中で切れたりしていた
 * （スマホの試し 2026-10-25。依頼者の選択）。
 * 画面の文（index.css の UI_PHRASE と同じ所）の字だけを変える。紙面・書く欄・入力欄の字は変えない（PDF・原稿の字は今までどおり）
 */

/** ことばの切れ目で折り返す所（index.css の「@supports not (word-break: auto-phrase)」と同じ） */
const UI_PHRASE = '.modal, .sheet, .help, .notice, .undo-toast, .login-over, .guide, .tour, .word-todo, .pinch-tip, .land-tip, .page-band, .side, .course-notice, .direct-bar, .tpl-panel, .tpl-wait'
/** 字を変えない所（紙面・書く欄・入力欄） */
const SKIP = '.page-viewport, .overlay-clip, .edit-sheet .sheet-input, input, textarea, select, [contenteditable], script, style, code, pre'
const ZWSP = '​'
const JAPANESE = /[぀-ヿ㐀-鿿]/

export function startPhraseWrap(): void {
  if (typeof CSS === 'undefined' || CSS.supports('word-break', 'auto-phrase')) return
  void import('budoux').then(({ loadDefaultJapaneseParser }) => {
    const parser = loadDefaultJapaneseParser()
    const wrap = (node: Text) => {
      const parent = node.parentElement
      const value = node.nodeValue ?? ''
      if (!parent || !JAPANESE.test(value) || !parent.closest(UI_PHRASE) || parent.closest(SKIP)) return
      const next = parser.parse(value.replaceAll(ZWSP, '')).join(ZWSP)
      if (next !== value) node.nodeValue = next
    }
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return wrap(root as Text)
      if (root.nodeType !== Node.ELEMENT_NODE) return
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) wrap(n as Text)
    }
    walk(document.body)
    // 画面の文は、開くたび・変わるたびに入れ直す（React が字を入れ替えると、空白はなくなる）
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') wrap(r.target as Text)
        else r.addedNodes.forEach(walk)
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  })
}
