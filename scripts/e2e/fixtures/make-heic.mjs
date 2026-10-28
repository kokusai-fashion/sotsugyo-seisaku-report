// 自動テスト用の HEIC の写真を作る（iPhone の写真と同じ形式。パソコンの Chrome・Edge はそのままでは読めない）。
// ffmpeg（libx265）で JPEG を HEVC の1枚の絵にし、HEIF の入れ物（ftyp・meta・mdat）に包む。
// 使い方：node scripts/e2e/fixtures/make-heic.mjs 元.jpg 出力.heic [長い辺の点の数]
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [src, out, size = '480'] = process.argv.slice(2)
if (!src || !out) {
  console.log('使い方：node scripts/e2e/fixtures/make-heic.mjs 元.jpg 出力.heic [長い辺の点の数]')
  process.exit(1)
}
const dir = mkdtempSync(join(tmpdir(), 'heic-'))
const hevcFile = join(dir, 'image.hevc')
// 長い辺を size にし、縦横を偶数にする（4:2:0 のため）
const scale = `scale='if(gt(iw,ih),${size},-2)':'if(gt(iw,ih),-2,${size})',scale=trunc(iw/2)*2:trunc(ih/2)*2`
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vf', scale, '-frames:v', '1', '-c:v', 'libx265', '-x265-params', 'log-level=error', '-pix_fmt', 'yuv420p', '-f', 'hevc', hevcFile])
const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', hevcFile]).toString().trim()
const [width, height] = probe.split(',').map(Number)
const stream = readFileSync(hevcFile)
rmSync(dir, { recursive: true, force: true })

// Annex B の NAL ユニットに分ける
const nals = []
for (let i = 0, start = -1; i <= stream.length; i++) {
  const at = i + 3 <= stream.length && stream[i] === 0 && stream[i + 1] === 0 && stream[i + 2] === 1
  if (at || i === stream.length) {
    if (start >= 0) {
      let end = i
      while (end > start && stream[end - 1] === 0) end--
      nals.push(stream.subarray(start, end))
    }
    if (at) {
      start = i + 3
      i += 2
    }
  }
}
const type = (n) => (n[0] >> 1) & 0x3f
const vps = nals.find((n) => type(n) === 32)
const sps = nals.find((n) => type(n) === 33)
const pps = nals.find((n) => type(n) === 34)
const slices = nals.filter((n) => type(n) < 32)
if (!vps || !sps || !pps || !slices.length) throw new Error('HEVC の中身が読めませんでした')

// SPS の profile_tier_level（エミュレーション防止の 0x03 を除いてから、NAL の頭 2 バイトと1バイトの後ろの 12 バイト）
const rbsp = []
for (let i = 2; i < sps.length; i++) {
  if (i >= 4 && sps[i] === 3 && sps[i - 1] === 0 && sps[i - 2] === 0) continue
  rbsp.push(sps[i])
}
const ptl = rbsp.slice(1, 13)

const u8 = (...v) => Buffer.from(v)
const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b }
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b }
const box = (name, ...parts) => { const body = Buffer.concat(parts); return Buffer.concat([u32(8 + body.length), Buffer.from(name, 'ascii'), body]) }
const full = (name, version, flags, ...parts) => box(name, u8(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...parts)

const arrays = [vps, sps, pps].map((n) => Buffer.concat([u8(0x80 | type(n)), u16(1), u16(n.length), n]))
const hvcC = box(
  'hvcC',
  u8(1),
  Buffer.from(ptl),
  u16(0xf000),
  u8(0xfc),
  u8(0xfc | 1),
  u8(0xf8),
  u8(0xf8),
  u16(0),
  u8(0x0f),
  u8(arrays.length),
  ...arrays,
)
const data = Buffer.concat(slices.flatMap((n) => [u32(n.length), n]))

const ftyp = box('ftyp', Buffer.from('heic', 'ascii'), u32(0), Buffer.from('mif1heic', 'ascii'))
const meta = (offset) =>
  full(
    'meta',
    0,
    0,
    full('hdlr', 0, 0, u32(0), Buffer.from('pict', 'ascii'), u32(0), u32(0), u32(0), u8(0)),
    full('pitm', 0, 0, u16(1)),
    full('iinf', 0, 0, u16(1), full('infe', 2, 0, u16(1), u16(0), Buffer.from('hvc1', 'ascii'), u8(0))),
    full('iloc', 0, 0, u8(0x44), u8(0x00), u16(1), u16(1), u16(0), u16(1), u32(offset), u32(data.length)),
    box('iprp', box('ipco', hvcC, full('ispe', 0, 0, u32(width), u32(height))), full('ipma', 0, 0, u32(1), u16(1), u8(2), u8(0x81), u8(0x02))),
  )
// mdat の中身の位置（meta の長さは位置の値によらない）
const offset = ftyp.length + meta(0).length + 8
writeFileSync(out, Buffer.concat([ftyp, meta(offset), box('mdat', data)]))
console.log(`できました：${out}（${width}×${height}・${Buffer.concat([ftyp, meta(offset), box('mdat', data)]).length} バイト）`)
