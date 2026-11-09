// 確かめ役（サブエージェント）が画面を操作して確かめるための、まとめた版の写し（dist-e2e2）を配るサーバー（http://localhost:4180）。
// 自動テストの run.mjs が dist-e2e を作り直しても、確かめている途中の版が変わらないように、別のフォルダの写しを配る。
// .claude/launch.json の「admin-check」から立てる（node app/scripts/e2e/serveCheck.mjs）
import { cpSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveBuilt } from './serveBuilt.mjs'

const app = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
process.chdir(app)
rmSync('dist-e2e2', { recursive: true, force: true })
cpSync('dist-e2e', 'dist-e2e2', { recursive: true })
await serveBuilt('dist-e2e2', 4180)
console.log('http://localhost:4180/admin.html')
