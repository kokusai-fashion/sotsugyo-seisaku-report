// 学生向けの説明のナレーションを Gemini で作る道具（場面の動画：narrate.mjs と、スライドの動画：../スライド/scripts/narration-gemini.mjs が使う）。
// 声：1つ前の型（gemini-2.5-flash-preview-tts）・Zephyr・落ち着いた読み方（依頼者の選択 2026-11-04 聞き比べ2の「2」。
//   新しい型は明るすぎ・軽すぎと言われた）。読み間違える言葉は声にするときだけ直す（../スライド/scripts/narration-readings.mjs の spoken）。
// 別々に作ると声色が変わる（依頼者 2026-11-04）→ いくつかの場面・スライドをまとめて1回で読ませ、文の切れ目の無音で切り分ける。
// キーは スライド/gemini-key.private.txt（画面には出さない）。無料の回数は型ごと・1日ごと（日本時間の17時ごろに戻る）
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const MODEL = process.env.TTS_MODEL ?? 'gemini-2.5-flash-preview-tts'
export const VOICE = 'Zephyr'
// 落ち着いた読み方（英語で書く。日本語で書くと、指示まで読み上げた）
const STYLE = 'Read the following Japanese narration aloud as a calm, clear female narrator of a tutorial video for university students. Warm and composed, with a natural, steady pace. Not too bright, not bubbly or overly cheerful. Keep the same voice and tone from beginning to end. Do not read this instruction.\n\n'
const KEY_FILE = fileURLToPath(new URL('../../../スライド/gemini-key.private.txt', import.meta.url))

export const duration = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
/** 字数（数えるのは字だけ。空白・句読点・かぎかっこは数えない） */
export const charCount = (text) => text.replace(/[\s、。「」『』・]/g, '').length

async function speak(text) {
  const key = readFileSync(KEY_FILE, 'utf8').replace(/^﻿/, '').trim()
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: STYLE + text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${json.error?.status ?? ''} ${String(json.error?.message ?? '').slice(0, 160)}`)
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
  return { pcm: Buffer.from(part.inlineData.data, 'base64'), rate: Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? '')?.[1] ?? 24000) }
}

/** 無音の所（ffmpeg silencedetect。結果は stderr に出る） */
export function silences(file) {
  const text = String(spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '')
  const list = []
  let start = null
  for (const line of text.split(/\r?\n/)) {
    const s = /silence_start: (-?[\d.]+)/.exec(line)
    if (s) start = Math.max(0, Number(s[1]))
    const e = /silence_end: ([\d.]+) \| silence_duration/.exec(line)
    if (e && start !== null) {
      list.push({ start, end: Number(e[1]) })
      start = null
    }
  }
  if (start !== null) list.push({ start, end: Infinity })
  // ごく短い音（0.15 秒より短い）をはさんだ無音は、1つにまとめる（声のあとの長い無音が、小さな音で分かれていると、
  // 声の終わりを見誤って、文の切れ目がずれた：2026-11-04 の声は、あとに 28 秒の無音が付いていた）
  const merged = []
  for (const s of list) {
    const last = merged.at(-1)
    if (last && s.start - last.end < 0.15) last.end = s.end
    else merged.push({ ...s })
  }
  return merged
}

/**
 * 読ませた声がおかしくないか。おかしければ、その理由（なければ null）。
 * Gemini は、ときどき次のような声を返した（2026-11-04）：
 * - 終わりの文を読まずに無音で埋めた（13文のうち3文が読まれず、あとに28秒の無音）→ 字数から見込んだ長さ（1秒に 6.5 字）より大きく短い
 * - 途中に36秒の無音と、言葉でない音が入った → 途中に4秒より長い無音がある
 * - 文と文の間がまったくない（79秒で、0.4秒以上の無音が1つもなかった）→ 0.4秒以上の間が、文の切れ目の数の半分もない
 */
function problemOf(wav, chars, sentences) {
  const sil = silences(wav)
  const total = duration(wav)
  const edge = (s) => s.start < 0.05 || s.end >= total - 0.05
  const speech = total - sil.filter(edge).reduce((sum, s) => sum + (Math.min(s.end, total) - s.start), 0)
  if (speech < (chars / 6.5) * 0.75) return `声が短すぎます（${speech.toFixed(1)}秒。見込みは約${(chars / 6.5).toFixed(0)}秒）。読み飛ばしがあるかもしれません`
  const inner = sil.filter((s) => !edge(s))
  const long = inner.find((s) => s.end - s.start > 4)
  if (long) return `途中に長い無音があります（${long.start.toFixed(1)}秒から ${(long.end - long.start).toFixed(1)}秒）`
  const pauses = inner.filter((s) => s.end - s.start >= 0.4).length
  if (sentences > 1 && pauses < (sentences - 1) / 2) return `文と文の間が足りません（0.4秒以上の間が ${pauses}、文の切れ目は ${sentences - 1}）`
  return null
}

/**
 * text をまとめて1回で読ませ、wav に書く。おかしな声（problemOf）なら作り直す（3回まで）。sentences：文の数
 */
export async function speakToWav(text, wav, sentences = 1) {
  const chars = charCount(text)
  for (let tries = 1; ; tries++) {
    const { pcm, rate } = await speak(text)
    const raw = `${wav}.pcm`
    writeFileSync(raw, pcm)
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw, wav])
    unlinkSync(raw)
    const problem = problemOf(wav, chars, sentences)
    if (!problem) return
    console.log(`  ${problem}`)
    if (tries >= 3) throw new Error('3回作っても、声がおかしいままです')
    console.log('  もう一度作ります')
  }
}

/**
 * 文の切れ目を決める：文の字数から見込んだ時刻の近くで、長い無音を選ぶ（文の数 − 1 個。順番どおり）。
 * 長い順に選ぶだけでは、文の中の「、」の間を選んでしまうことがあるため、見込みの時刻との近さも見る。
 * 返すのは、文ごとの声の始まりと終わりの秒、字数、1秒あたりの字数と、ほかの文とかけ離れているか（切れ目がずれているかもしれない）
 */
export function splitSentences(file, texts) {
  const total = duration(file)
  const sil = silences(file)
  const first = sil[0] && sil[0].start < 0.05 ? sil[0].end : 0
  const lastSil = sil.at(-1)
  const last = lastSil && lastSil.end >= total - 0.05 ? lastSil.start : total
  const inner = sil.filter((s) => s.start > first + 0.1 && s.end < last - 0.1).map((s) => ({ ...s, len: s.end - s.start, mid: (s.start + s.end) / 2 }))
  const chars = texts.map(charCount)
  const sum = chars.reduce((a, b) => a + b, 0)
  const n = texts.length
  const expect = []
  for (let k = 1, acc = 0; k < n; k++) {
    acc += chars[k - 1]
    expect.push(first + ((last - first) * acc) / sum)
  }
  if (inner.length < n - 1) throw new Error(`文の切れ目の無音が足りません（無音 ${inner.length}・文 ${n}）`)
  // dp[k][j]：k 番目の切れ目に無音 j を選んだときの、いちばん小さい点
  // 文の切れ目の間（この声では 0.9〜1.2 秒）は、文の中の「、」の間（0.5 秒まで）よりはっきり長いので、長さを重く見る。
  // 字数からの見込みは、間の長さの分だけずれていくので、軽く見る（2026-11-04：見込みを重く見て、文の途中で切った）
  const cost = (k, j) => ((inner[j].mid - expect[k]) / 3) ** 2 - 10 * Math.min(inner[j].len, 1.5)
  const dp = expect.map(() => inner.map(() => Infinity))
  const back = expect.map(() => inner.map(() => -1))
  for (let j = 0; j < inner.length; j++) dp[0][j] = cost(0, j)
  for (let k = 1; k < expect.length; k++) {
    for (let j = k; j < inner.length; j++) {
      for (let i = k - 1; i < j; i++) {
        const v = dp[k - 1][i] + cost(k, j)
        if (v < dp[k][j]) {
          dp[k][j] = v
          back[k][j] = i
        }
      }
    }
  }
  const pick = []
  if (expect.length) {
    let j = dp.at(-1).indexOf(Math.min(...dp.at(-1)))
    for (let k = expect.length - 1; k >= 0; k--) {
      pick.unshift(inner[j])
      j = back[k][j]
    }
  }
  const starts = [first, ...pick.map((s) => s.end)].map((t) => Math.max(0, t - 0.05))
  const ends = [...pick.map((s) => s.start), last].map((t) => Math.min(total, t + 0.05))
  const rates = starts.map((s, i) => chars[i] / (ends[i] - s))
  const median = [...rates].sort((a, b) => a - b)[Math.floor(rates.length / 2)]
  const odd = rates.map((r) => Math.abs(r - median) / median > 0.35)
  return { starts, ends, chars, rates, odd }
}
