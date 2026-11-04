// 学生向けの動画を確かめる絵：文ごとに、始まり・真ん中・終わりの画面を切り出して、1枚に並べる（行＝文、列＝始まり・真ん中・終わり）。
// 枠が話している所に合っているか、枠が次の文まで残っていないかを、送る前に見る（依頼者 2026-11-04）
// 使い方（app のフォルダで）：node scripts/video/check.mjs <場面 …> → poc-output/student-video/check/<場面>.jpg
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'poc-output/student-video/check'
for (const name of process.argv.slice(2)) {
  const { end, clips } = JSON.parse(readFileSync(join('poc-output/video-narration', name, 'placed.json'), 'utf8'))
  const tmp = join(OUT, `_${name}`)
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  let n = 0
  clips.forEach((c, i) => {
    const next = clips[i + 1]?.at ?? end
    for (const t of [c.at + 0.25, (c.at + next) / 2, next - 0.25]) {
      n++
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', t.toFixed(2), '-i', join('poc-output/student-video', `${name}.mp4`), '-frames:v', '1', '-vf', 'scale=640:-1', join(tmp, `${String(n).padStart(3, '0')}.jpg`)])
    }
  })
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', join(tmp, '%03d.jpg'), '-vf', `tile=3x${clips.length}:padding=6:color=white`, '-frames:v', '1', join(OUT, `${name}.jpg`)])
  rmSync(tmp, { recursive: true, force: true })
  console.log(join(OUT, `${name}.jpg`))
}
