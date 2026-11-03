/**
 * AI の質問係（NotebookLM）に読ませる資料を作る（依頼者 2026-11-01）。
 * 中身は、ツールの「？ 使い方」の学生用の項目（src/help/helpTopics.ts）と、学生用の手引き・Word からの移り方の案内（docs/）。
 * 使い方を直したら、これを動かし直して、NotebookLM の資料を入れ替える。
 *   node scripts/make-ai-source.mjs
 * 出力：../AIの質問係/ツールの使い方（AIの資料）.md
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STUDENT_TOPICS } from '../src/help/helpTopics.ts'
import { HELP_VIDEOS, lengthText } from '../src/help/videos.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, '..', 'AIの質問係', 'ツールの使い方（AIの資料）.md')
const URL = 'https://kokusai-fashion.github.io/sotsugyo-seisaku-report/'

/** 学生用の手引き（docs/手引き_学生用.html）の1枚目のあらまし */
const OVERVIEW = `# 卒業制作報告書 作成ツール　使い方（学生用・2026年度）

この資料は、文化学園大学 国際ファッション文化学科の「卒業制作報告書 作成ツール」の使い方をまとめたものです。
ツールの中の「？ 使い方」（右上の「メニュー」から開く）と、学生用の手引きと同じ内容です。

- ツールの URL：${URL}
- 大学の Google アカウント（@bunka-wu.ac.jp）でログインして使います。
- 書くのはパソコンがおすすめです（画面が広く、道具が分かりやすく、間違えにくい）。スマホでも書けます。
- 保存は自動です（この端末と、自分の Google ドライブ）。共用のパソコンでは、最後に「この端末から原稿を消す」を押します。

## 書く流れ

1. ログイン
2. コースを選ぶ（はじめて開くと、表紙の上に案内が出ます）
3. 書く
4. セルフチェックで、まだのところと × エラーを0にする
5. PDF を書き出して提出する

## 画面の地図（パソコン）

- 左はし：ページの一覧（押すと、そのページへ）
- 紙面の左：道具（書いている所に合わせて変わる）。いちばん下に「元に戻す」「やり直す」
- 真ん中：紙面（クリックして、その場で書く）。紙面の右下に「1ページ」「見開き」「拡大」と、大きさの「－ ＋」
- 右の欄の上：「メニュー」（使い方・バックアップ・Word の読み込みなど）、「ドライブに保存」（自動。ドライブとこの端末に）、締切までの日数
- 右の欄：セルフチェック（進み具合と、直すところの一覧）
- 右の欄の下：「PDFを書き出す」と「困ったこと・おかしいことを知らせる」

スマホでは、タップして書き、「完了」を押します。図・表・見出しの道具はキーボードの上に出ます。セルフチェックは画面の下の「チェック」、メニューは右上です。

## 自動で入るもの（自分で打たなくてよい）

- 表紙の年度・学科・学籍番号
- 目次とページ番号
- 見出しの番号（Ⅰ．ⅰ．）
- 図・表の番号（図1・表1）と、本文の「（図1）」
- 段落の書き出しの1字下げ
- 付け忘れた文末の「。」
- 章（大見出し）の前の改ページ
- 字の形（書体）・字の大きさ・余白

## やりたいこと → 押す所

| やりたいこと | 押す所 |
| --- | --- |
| 文を書く | 紙面の文をクリック（スマホはタップ） |
| 次の段落へ | Enter |
| 見出しを入れる | 道具の「大見出し」「中見出し」「小見出し」（小見出しは（1）の番号で、中見出しの下に使う） |
| 次のページから書く | 道具の「改ページ」（Ctrl+Enter でも） |
| 段落を消す | 道具の「この段落」の「削除」 |
| 間違えた | 左の道具の下の「元に戻す」（スマホは画面の上の「戻す」） |
| まとめて移す | 紙面をなぞって選ぶ →「切り取り」→ 入れたい所で「貼り付け」 |
| 図を2枚並べる | 図を押して「もう1枚」 |
| 作品写真を入れる | 作品写真のページの枠をクリック |
| 直すところへ行く | 右の欄（スマホは「チェック」）の項目を押す |
| 困った・おかしい | メニューの「困ったこと・おかしいことを知らせる」 |

## 図・表の入れ方（あらまし）

- 図：入れたい位置で「図を入れる」→ 写真を選んで、タイトルを打つ。「（図1）」と番号は自動。
- 表：入れたい位置で「表を入れる」→ 大きさを選ぶ → マスを押して書く。生地見本は「画像を入れる」。

## スマホのホーム画面に追加

- iPhone（Safari）：共有 →「ホーム画面に追加」→「Web アプリとして開く」はオフ →「追加」
- Android（Chrome）：右上の「⋮」→「ホーム画面に追加」→「追加」
- Classroom から開いたときは、Safari・Chrome に切り替えてから（iPhone は右下の方位磁針のボタン、Android は「⋮」→「Chrome で開く」）。
`

/** Word からの移り方の案内（docs/案内_Wordからの移り方.html） */
const WORD_GUIDE = `# Word で書き始めた人へ：ツールへの移り方（今年度だけ）

学科の Word のひな形に書いた分をツールに写して、そこから先はツールで書き進めます。

## ここだけは守る

1. 本文の Word を選ぶ：.docx のまま。.doc と Google ドキュメントは読めません。
2. 図と改ページを必ず確かめる：図の大きさが Word と変わるためです。
3. 赤い「直すところ」を直す：Word では気づかなかった誤り（執筆ルールに合わない所）が、読み込んだあと右の欄（スマホは「チェック」）に出ることがあります。項目を押すと、その場所へ移ります。

## 移り方

1. ツールを開いて、大学の Google アカウント（@bunka-wu.ac.jp）でログインします。
2. はじめて開くと、表紙の上に案内が出ます。自分のコースを選びます。
3. 「Word で書き始めていますか？」と聞かれたら、「はい、Word から読み込む」を押します。
4. Word を選びます。本文（04_本文.docx）は必ず、表紙（01_表紙.docx）と目次（03_目次.docx）は書いていれば選びます。
5. 章立て・図・表の数と表紙の項目が出ます。読み取れなかった所は上に出ます。確かめて「読み込む」を押します。
6. 右の欄（スマホはチェックの欄の上）に出る「つぎにすること」を済ませます。図の大きさが変わるため、図と改ページの位置は必ず確かめます。

あとから読み込むときは、右上の「メニュー」の「Word で書いた分を読み込む（今年度だけ）」から。

## 気をつけること

- .doc（Word 97-2003）は読めません。Word の「名前を付けて保存」で「Word 文書（*.docx）」にします。
- Google ドキュメントに変えないでください。図のタイトルや位置が崩れることがあります。.docx のまま選びます。
- スマホでも選べます。OneDrive・Google ドライブ・iCloud Drive の中からも選べます（iPhone は「ファイル」アプリの「ブラウズ」）。読み込んだあとの見直し（図の位置など）は、パソコンで。
- 読み込んだあとは、ツールで書きます。ツールの原稿を Word に戻すことはできません。

## 知っておくと安心

- 目次は自動で作ります。目次にだけ書いた見出し（本文にまだない見出し）は、目次の Word を選ぶと本文に入ります（中身を確かめる窓に「目次から入れる」と出ます）。抄録は、先生の許可のあとツールで書きます。
- 写すのは中身だけです：見出し・段落・図（写真とタイトル）・表・改ページと、表紙の項目。見た目はツールの形に組み直します。
- 書いていない章は写しません。〇〇〇〇・～～～のままの章は、ツールのひな形で続けます。
- 元に戻せます。読み込む前の原稿は控えに残り、「読み込む前の原稿に戻す」で戻せます。
- 原稿はブラウザと自分の Google ドライブに保存します。Word のファイルはどこにも送りません。
- うまく読み込めないときは、担当の先生に相談してください。Word のファイルは消さずに残しておきます。
`

/** 使い方の画面のボタン（action）の説明 */
const ACTION_PLACE = { tour: '使い方の画面のこの項目にある', references: '使い方の画面のこの項目にある' }

const DEVICE_NAME = { pc: 'パソコン', mac: 'Mac', iphone: 'iPhone・iPad', android: 'Android' }

function topicText(t) {
  const lines = [`### ${t.title}`, '']
  if (t.lead) lines.push(t.lead, '')
  if (t.action) lines.push(`ボタン：${ACTION_PLACE[t.action.kind]}「${t.action.label}」を押します。`, '')
  if (t.steps?.length) {
    lines.push('手順：')
    t.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
    lines.push('')
  }
  if (t.devices?.length) {
    if (t.devicesTitle) lines.push(`${t.devicesTitle}（端末ごと）：`)
    for (const d of t.devices) lines.push(`- ${DEVICE_NAME[d.id] ?? d.label}：${d.lines.join('／')}`)
    lines.push('')
  }
  for (const item of t.items ?? []) lines.push(`- **${item.h}**：${item.t}`)
  if (t.items?.length) lines.push('')
  const videos = (t.videos ?? []).map((n) => HELP_VIDEOS.find((v) => v.number === n)).filter(Boolean)
  if (videos.length) lines.push(`動画：使い方の画面で ${videos.map((v) => `「${v.number}. ${v.title}」（${lengthText(v.seconds)}）`).join('・')} を見られます（音なし・字幕つき）。`, '')
  if (t.words) lines.push(`（こんな言い方でも：${[...new Set(t.words.split(/\s+/))].join('、')}）`, '')
  return lines.join('\n')
}

const groups = [...new Set(STUDENT_TOPICS.map((t) => t.group))]
const topics = [
  '# ツールの「？ 使い方」の項目',
  '',
  `ツールの右上の「メニュー」→「使い方」で開く画面と同じ内容です（全${STUDENT_TOPICS.length}項目）。`,
  '',
  ...groups.flatMap((g) => [`## ${g}`, '', ...STUDENT_TOPICS.filter((t) => t.group === g).map(topicText)]),
].join('\n')

const text = [OVERVIEW, topics, WORD_GUIDE].join('\n')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, text)
console.log(`${out}（${text.length}字）`)
