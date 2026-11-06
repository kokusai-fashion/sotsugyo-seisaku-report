// 管理ページの「使い方」の動画（10 ひな形を作る・11 点検表と先生の許可）を、先生向けの動画のために撮った短い動画（字幕なし）から作る。
// 見た目は、学生用の使い方の動画にそろえる：はじめに題名の場面（最初の絵を紺で暗くして題名）、下に紺の帯の字幕（BIZ UDPゴシック）
// 使い方（app のフォルダで）：node scripts/video/admin-help-videos.mjs → poc-output/video/out/10_….mp4・11_….mp4（そのあと node scripts/video/publish.mjs 10 11）
// 元の短い動画は、スライドのフォルダの scripts/teacher-clips.mjs で録ったもの（assets/teacher/clips。git の外）
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'

const ROOT = 'C:/Users/bun121194/Documents/Claude/卒業制作報告書'
const CLIPS = `${ROOT}/スライド/assets/teacher/clips`
const OUT = `${ROOT}/app/poc-output/video/out`
const FFMPEG = `${process.env.LOCALAPPDATA}/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe`
const W = 1280
const H = 720
const TITLE = 2.2
// 字幕のファイルと書体を置く作業用のフォルダ（ffmpeg の字幕の書体の場所は、C: の「:」が使えないので、そこへ移って相対で指す）
const dir = `${ROOT}/app/poc-output/video/admin-help/`
mkdirSync(`${dir}fonts`, { recursive: true })
cpSync(`${ROOT}/app/poc-output/trial-sinbad-1106a/rec/fonts`, `${dir}fonts`, { recursive: true })

const VIDEOS = [
  {
    number: 10,
    title: 'ひな形を作る',
    clips: ['template-make.mp4'],
    // 字幕（その動画の中の秒。題名の場面の分は、あとで足す）
    captions: [
      [0, 2.0, 'ひな形を作る画面では、学生と同じ紙面に、章立てと説明を書きます'],
      [2.0, 9.5, '段落を押して、左の道具で「書き出しの文」にし、学生の本文のはじめに入る言葉を書きます'],
      [9.5, 18.0, '下の「続きの説明」の欄に書くと、学生には、書き出しのあとに薄い字で出ます'],
      [18.0, 29.5, '見出しは、左の道具の「中見出し」などで足し、その下に「ここに書くこと」を書きます'],
      [29.5, 33.0, '書き終えたら、「管理ページに戻して反映」を押します'],
      [33.0, 36.4, '「保存して学生に反映」を押すと、これからコースを選ぶ学生に届きます'],
    ],
  },
  {
    number: 11,
    title: '点検表と先生の許可',
    clips: ['sheet-round.mp4', 'sheet-abstract.mp4', 'admin-order.mp4'],
    captions: [
      [0, 2.0, '点検表（スプレッドシート）は、管理ページのコースの「点検表を開く」で開きます'],
      [2.0, 10.0, '回のマスで先生の名前を選ぶと、「予定」になります'],
      [10.0, 21.3, '見終わったら、同じマスで「済み」を選びます'],
      [21.3, 30.3, '「先生の許可」を使うコースは、「抄録許可」「最終提出可」に ✓ を入れます。学生の画面に許可が届きます'],
      [30.3, 34.5, '学生は、ふりがなの順に自動で並びます。直すときは、管理ページの「学生の並びを直す」'],
      [34.5, 49.2, '▲▼で動かして、「この並びにする」を押します'],
    ],
  },
]

const t = (s) => {
  const cs = Math.round(s * 100)
  return `${Math.floor(cs / 360000)}:${String(Math.floor((cs % 360000) / 6000)).padStart(2, '0')}:${String(Math.floor((cs % 6000) / 100)).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`
}

for (const v of VIDEOS) {
  // 字幕：紺の帯（BorderStyle 3）に白い字。題名は真ん中に大きく
  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,BIZ UDPGothic,30,&H00FFFFFF,&H00FFFFFF,&H00552A1C,&H00552A1C,1,0,0,0,100,100,0,0,3,12,0,2,120,120,34,1
Style: Head,BIZ UDPGothic,26,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1
Style: Big,BIZ UDPGothic,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,${t(0)},${t(TITLE)},Head,,0,0,0,,{\\pos(${W / 2},${H / 2 - 40})}卒業制作報告書 管理ページの使い方
Dialogue: 0,${t(0)},${t(TITLE)},Big,,0,0,0,,{\\pos(${W / 2},${H / 2 + 22})}${v.number}  ${v.title}
${v.captions.map(([a, b, text]) => `Dialogue: 0,${t(a + TITLE)},${t(b + TITLE)},Cap,,0,0,0,,${text}`).join('\n')}
`
  writeFileSync(`${dir}${v.number}.ass`, ass)
  // 動画をつなぐ（大きさは 1280×720 にそろえ、足りない所は紙面の台の色で埋める）
  const inputs = v.clips.flatMap((c) => ['-i', `${CLIPS}/${c}`])
  const norm = v.clips.map((_, i) => `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0xe9e6e0,fps=30,setsar=1[v${i}]`).join(';')
  const concat = `${v.clips.map((_, i) => `[v${i}]`).join('')}concat=n=${v.clips.length}:v=1:a=0[cat]`
  // 題名の場面：はじめの絵を止めて伸ばし、紺で暗くする
  const filter = `${norm};${concat};[cat]tpad=start_duration=${TITLE}:start_mode=clone,drawbox=x=0:y=0:w=iw:h=ih:color=0x1c2a55@0.82:t=fill:enable='lt(t,${TITLE})',ass=${v.number}.ass:fontsdir=fonts[out]`
  const out = `${OUT}/${v.number}_${v.title}.mp4`
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[out]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-an', out], { cwd: dir, stdio: 'inherit' })
  console.log(out)
}
