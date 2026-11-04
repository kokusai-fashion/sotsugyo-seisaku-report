// 学生向けの動画（依頼者の希望 2026-11-04：動画として伝わるもの）：場面のナレーションを Gemini で作り、文ごとの時刻を測る。
// 場面の台本は scripts/video/scenes-student/<場面>.mjs の meta.sentences（字幕も同じ文。依頼者の選択：字幕は声と同じ）。
// 声の作り方（型・声・読み方・まとめて読ませて切り分ける・読み飛ばしの確かめ）は geminiNarration.mjs。
// 使い方（app のフォルダで）：node scripts/video/narrate.mjs <場面 …>（1回で読ませる場面。多すぎると長くなるので、10場面くらいまで）
//   FROM=<wav か mp3>：Gemini を使わず、作ってある声（同じ場面を同じ順に読んだもの）を切り分ける
//   → poc-output/video-narration/_groups/<はじめの場面>〜<終わりの場面>.wav（まとめて読んだ声）
//   → poc-output/video-narration/<場面>/narration.mp3・narration.json（文ごとの、声の始まりと終わりの秒）
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spoken } from '../../../スライド/scripts/narration-readings.mjs'
import { MODEL, VOICE, duration, speakToWav, splitSentences } from './geminiNarration.mjs'

// 録画（record.mjs）は場面のフォルダを空にしてから録るので、声は別のフォルダに置く
const ROOT = 'poc-output/video-narration'

const names = process.argv.slice(2)
if (!names.length) throw new Error('場面の名前を書いてください')
const scenes = []
for (const name of names) scenes.push({ name, meta: (await import(`./scenes-student/${name}.mjs`)).meta })
const texts = scenes.flatMap((s) => s.meta.sentences)
mkdirSync(join(ROOT, '_groups'), { recursive: true })
const group = join(ROOT, '_groups', `${names[0]}〜${names.at(-1)}.wav`)
if (process.env.FROM) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', process.env.FROM, '-ac', '1', '-ar', '24000', group])
// 場面の間は空行（少し長い間になる）
else await speakToWav(spoken(scenes.map((s) => s.meta.sentences.join('')).join('\n\n')), group, texts.length)
const { starts, ends, rates, odd } = splitSentences(group, texts.map(spoken))
console.log(`まとめた声：${duration(group).toFixed(1)}秒（${MODEL}・${VOICE}）`)
let at = 0
for (const { name, meta } of scenes) {
  const n = meta.sentences.length
  const from = starts[at]
  const to = ends[at + n - 1]
  const dir = join(ROOT, name)
  mkdirSync(dir, { recursive: true })
  const mp3 = join(dir, 'narration.mp3')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', from.toFixed(3), '-to', to.toFixed(3), '-i', group, '-b:a', '160k', mp3])
  const local = (t) => Number((t - from).toFixed(3))
  const info = { model: MODEL, voice: VOICE, seconds: duration(mp3), starts: starts.slice(at, at + n).map(local), ends: ends.slice(at, at + n).map(local) }
  writeFileSync(join(dir, 'narration.json'), JSON.stringify(info, null, 2))
  console.log(name, `${info.seconds.toFixed(1)}秒`)
  // 1秒あたりの字数が、ほかの文とかけ離れていれば、切れ目がずれているかもしれない
  for (let i = 0; i < n; i++) console.log(`  ${info.starts[i].toFixed(1)}〜${info.ends[i].toFixed(1)}秒（${rates[at + i].toFixed(1)}字/秒）${meta.sentences[i]}${odd[at + i] ? '　← 速さがほかと違います（切れ目を確かめる）' : ''}`)
  at += n
}
