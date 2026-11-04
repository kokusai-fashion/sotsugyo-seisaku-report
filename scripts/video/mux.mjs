// 学生向けの動画：場面の動画（compose.mjs）に、ナレーションの声を文ごとに置く（placed.json の時刻。録画を速めないので、文の声の時刻は場面ごとに違う）。
// 使い方（app のフォルダで）：node scripts/video/mux.mjs <場面 …>
//   → poc-output/student-video/<場面>.mp4。JOIN=<名前>.mp4 があれば、場面をつないだ動画も poc-output/student-video/ に作る
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'poc-output/student-video'
mkdirSync(OUT, { recursive: true })
const made = []
for (const name of process.argv.slice(2)) {
  const { meta } = await import(`./scenes-student/${name}.mjs`)
  const dir = join('poc-output/video-narration', name)
  const { end, clips } = JSON.parse(readFileSync(join(dir, 'placed.json'), 'utf8'))
  const parts = clips.map((c, i) => `[1:a]atrim=start=${c.from.toFixed(3)}:end=${c.to.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`)
  const mix = clips.length > 1 ? `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0[m]` : '[a0]anull[m]'
  const filter = [...parts, mix, `[m]apad,atrim=0:${end.toFixed(3)}[aout]`].join(';')
  const file = join(OUT, `${name}.mp4`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join('poc-output/video/out', `${meta.number}_${meta.label}.mp4`), '-i', join(dir, 'narration.mp3'), '-filter_complex', filter, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ac', '1', '-t', end.toFixed(3), '-movflags', '+faststart', file])
  console.log(file, `${end.toFixed(1)}秒`, clips.map((c) => c.at.toFixed(1)).join(' / '))
  made.push(file)
}
if (process.env.JOIN) {
  const list = join(OUT, '_list.txt')
  writeFileSync(list, made.map((f) => `file '${f.split(/[\\/]/).pop()}'`).join('\n'))
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', join(OUT, process.env.JOIN)])
  console.log(join(OUT, process.env.JOIN))
}
