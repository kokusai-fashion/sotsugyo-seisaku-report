// ホーム画面に置く入口のページ（public/kanri/・public/tenken/：scripts/make-home-entries.mjs）が、今の管理ページへ移り、
// アイコンの画像がそろっているか（新しいデプロイで管理ページの URL が変わったのに、作り直し忘れていないか）
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import deployments from './deployments.json'

const ADMIN_URL = deployments.admin.url

describe('ホーム画面に置く入口のページ', () => {
  for (const [dir, target] of [
    ['kanri', `'${ADMIN_URL}'`],
    ['tenken', `'${ADMIN_URL}?view=check'`],
  ] as const) {
    it(`${dir}：今の管理ページへ移り、manifest とアイコンがある`, () => {
      const html = readFileSync(`public/${dir}/index.html`, 'utf8')
      expect(html).toContain(`var target = ${target}`)
      const manifest = JSON.parse(readFileSync(`public/${dir}/manifest.webmanifest`, 'utf8')) as { start_url: string; icons: { src: string; purpose: string }[] }
      expect(manifest.start_url).toBe('./?from=home')
      expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
      const files = [...manifest.icons.map((i) => i.src), ...[...html.matchAll(/(?:href|src)="(\.\.\/icons\/[^"]+)"/g)].map((m) => m[1])]
      for (const f of files) expect(existsSync(`public/${dir}/${f}`), f).toBe(true)
    })
  }
})
