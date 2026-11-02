/**
 * 先生用の AI の質問係（Gemini の Gem。管理ページの「？ 使い方」の「使い方を AI に聞く」）に読ませる資料を作る（依頼者 2026-11-03）。
 * 中身は、管理ページの「？ 使い方」の先生用の項目（src/help/helpTopics.ts の TEACHER_TOPICS）と、先生用の手引きのあらまし。
 * 先生は学生に操作を聞かれるので、Gem には学生用の資料（make-ai-source.mjs の出力の Google ドキュメント）も一緒に読ませる
 * （1つにまとめず2つに分ける：学生用を直したとき、学生用の Gem と先生用の Gem の両方に、同じドキュメントの直しが届く）。
 * 管理ページの URL・先生の名前・連絡先は入れない（先生用の手引きと同じ決まり）。
 * 管理ページの使い方を直したら、これを動かし直して、Google ドキュメント（Gem の資料）を差し替える。
 *   node scripts/make-ai-source-teacher.mjs
 * 出力：../AIの質問係/管理ページの使い方（AIの資料・先生用）.md
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEACHER_TOPICS } from '../src/help/helpTopics.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, '..', 'AIの質問係', '管理ページの使い方（AIの資料・先生用）.md')

/** 先生用の手引き（docs/手引き_先生用.html）のあらまし */
const OVERVIEW = `# 卒業制作報告書 作成ツール　管理ページの使い方（先生用・2026年度）

この資料は、文化学園大学 国際ファッション文化学科の「卒業制作報告書 作成ツール」の、先生が使う「管理ページ」の使い方をまとめたものです。
管理ページの「？ 使い方」と、先生用の手引きと同じ内容です。学生用ツールの使い方は、もう1つの資料「ツールの使い方（AIの資料）」にあります（学生に操作を聞かれたとき用）。

- 管理ページの URL は、管理者からメールで届きます（この資料には書きません）。大学の Google アカウントでログインして開きます。
- 管理ページを開けるのは、管理者が登録した先生と管理者だけです。役割は「先生」と「管理者」の2つです。

## 指導のしかたは、これまでと同じ

1. 学生がツールで書く（書式はツールが整える）
2. 学生が PDF を印刷して持ってくる
3. 先生が赤を入れて返す（これまでどおり紙で）
4. 学生が直す（直したら、また 2 へ）

先生がツールを操作する必要はありません。学生が書き出した PDF の控えは、先生のフォルダにも届きます（見たいときだけ）。

## 書式とルールの点検は、ツールが受け持ちます

- 書式は崩れない：決まった書式に書き込むので、学生は書式をいじれません。
- ルールの誤りは、学生が直してから出す：学科の執筆ルールに合わない所は、セルフチェックで学生が直します。
- そのため先生は、内容が適しているかの指導に力を注げます。

## 管理ページでできること（コースごと）

- 下書きのひな形：学生が最初に見る章立てと説明を作る（「ひな形を作る画面を開く」）。
- お知らせ：締切など、コースの学生への連絡を書く（個人の情報は書かない）。
- 「保存して学生に反映」を押すと、約1分で学生の画面に出ます。
- 「学生の画面を試す」で、見本の原稿を使って学生の画面を試せます。
- 学生に操作を聞かれたら：学生のツールのメニューの「使い方」か「使い方を AI に聞く」を案内します。
`

const DEVICE_NAME = { pc: 'パソコン', mac: 'Mac', iphone: 'iPhone・iPad', android: 'Android' }

function topicText(t) {
  const lines = [`### ${t.title}`, '']
  if (t.lead) lines.push(t.lead, '')
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
  if (t.words) lines.push(`（こんな言い方でも：${[...new Set(t.words.split(/\s+/))].join('、')}）`, '')
  return lines.join('\n')
}

const groups = [...new Set(TEACHER_TOPICS.map((t) => t.group))]
const topics = [
  '# 管理ページの「？ 使い方」の項目',
  '',
  `管理ページの見出しの横の「？ 使い方」で開く欄と同じ内容です（全${TEACHER_TOPICS.length}項目）。「（管理者だけ）」の項目は、管理者の画面にだけある操作です。`,
  '',
  ...groups.flatMap((g) => [`## ${g}`, '', ...TEACHER_TOPICS.filter((t) => t.group === g).map(topicText)]),
].join('\n')

const text = [OVERVIEW, topics].join('\n')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, text)
console.log(`${out}（${text.length}字）`)
