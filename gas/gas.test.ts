// Apps Script のプログラム（gas/*/Code.js）を、Google のサービスをまねた簡易版の上で動かして確かめる。
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { beforeEach, describe, expect, it } from 'vitest'
import * as rules from '../src/admin/serverRules'
import initialConfig from '../src/config/2026.json'

type Cell = string | number | boolean | Date
/** 入力規則（✓ の箱・プルダウン）の簡易版 */
type Validation = { kind: 'checkbox' } | { kind: 'list'; list: string[]; allowInvalid: boolean }
/** セルの見た目（確かめるものだけ） */
interface CellFormat {
  validation?: Validation | null
  background?: string | null
  bold?: boolean
  numberFormat?: string
  fontSize?: number
  color?: string
  wrap?: boolean
  /** 上の線（所属の境の太い線。null・なしは線なし） */
  borderTop?: string | null
}
/** 守った範囲（Protection の簡易版） */
interface FakeProtection {
  description: string
  editors: string[]
  domainEdit: boolean
  range: { row: number; col: number; rows: number; cols: number }
}
/** 条件付き書式の簡易版 */
interface FakeRule {
  when: string
  text: string
  background?: string
  color?: string
  bold?: boolean
  ranges: { row: number; col: number; rows: number }[]
}
class FakeSheet {
  rows: Cell[][] = []
  /** 数式として書かれてしまった値（先頭が = + - @ で、' が付いていないもの） */
  formulas: string[] = []
  /** セルの見た目（rows と同じ並び。列を足す・消すと一緒に動く） */
  fmts: CellFormat[][] = []
  /** 列の幅と、隠しているか（列を足す・消すと一緒に動く） */
  cols: { hidden?: boolean; width?: number }[] = []
  rules: FakeRule[] = []
  protections: FakeProtection[] = []
  frozen = 0
  constructor(
    public name: string,
    public parent: FakeSpreadsheet | null = null,
  ) {}
  /** スプレッドシートと同じく、先頭の ' は「文字として書く」印として外す */
  private written = (v: Cell): Cell => {
    if (typeof v !== 'string') return v
    if (v.startsWith("'")) return v.slice(1)
    if (/^[=+\-@]/.test(v)) this.formulas.push(v)
    return v
  }
  private cell = (r: number, c: number): Cell => this.rows[r]?.[c] ?? ''
  private put = (r: number, c: number, v: Cell) => {
    while (this.rows.length <= r) this.rows.push([])
    const row = this.rows[r]
    while (row.length < c) row.push('')
    row[c] = v
  }
  fmtAt = (r: number, c: number): CellFormat => {
    while (this.fmts.length <= r) this.fmts.push([])
    const row = this.fmts[r]
    while (row.length <= c) row.push({})
    return row[c]
  }
  colAt = (c: number) => {
    while (this.cols.length <= c) this.cols.push({})
    return this.cols[c]
  }
  width = () => Math.max(0, ...this.rows.map((r) => r.length))
  getLastRow = () => this.rows.length
  getLastColumn = () => this.width()
  getMaxRows = () => Math.max(1000, this.rows.length)
  /** 守りの操作（本物の Protection と同じ呼び方） */
  private protection = (p: FakeProtection) => {
    const api = {
      setDescription: (d: string) => ((p.description = d), api),
      getDescription: () => p.description,
      addEditor: (u: string | { getEmail: () => string }) => {
        const email = typeof u === 'string' ? u : u.getEmail()
        if (!p.editors.includes(email)) p.editors.push(email)
        return api
      },
      removeEditors: (list: (string | { getEmail: () => string })[]) => {
        const out = list.map((u) => (typeof u === 'string' ? u : u.getEmail()))
        p.editors = p.editors.filter((e) => !out.includes(e))
        return api
      },
      getEditors: () => p.editors.map((e) => ({ getEmail: () => e })),
      canDomainEdit: () => p.domainEdit,
      setDomainEdit: (on: boolean) => ((p.domainEdit = on), api),
      remove: () => void (this.protections = this.protections.filter((x) => x !== p)),
    }
    return api
  }
  getProtections = () => this.protections.map(this.protection)
  appendRow = (row: Cell[]) => void this.rows.push(row.map(this.written))
  deleteRow = (row: number) => void this.rows.splice(row - 1, 1)
  setFrozenRows = (n: number) => void (this.frozen = n)
  setRowHeight = () => {}
  setColumnWidth = (c: number, w: number) => void (this.colAt(c - 1).width = w)
  /** 幅を決めていない列は 100（スプレッドシートの初めの幅） */
  getColumnWidth = (c: number) => this.colAt(c - 1).width ?? 100
  isColumnHiddenByUser = (c: number) => !!this.colAt(c - 1).hidden
  getMaxColumns = () => Math.max(26, this.width())
  hideColumns = (c: number) => void (this.colAt(c - 1).hidden = true)
  showColumns = (c: number) => void (this.colAt(c - 1).hidden = false)
  setName = (n: string) => {
    this.name = n
    return this
  }
  getName = () => this.name
  getParent = () => this.parent
  insertColumnsAfter = (after: number, n: number) => {
    for (const row of this.rows) {
      while (row.length < after) row.push('')
      row.splice(after, 0, ...Array.from({ length: n }, () => ''))
    }
    for (const row of this.fmts) {
      while (row.length < after) row.push({})
      row.splice(after, 0, ...Array.from({ length: n }, () => ({})))
    }
    while (this.cols.length < after) this.cols.push({})
    this.cols.splice(after, 0, ...Array.from({ length: n }, () => ({})))
  }
  insertColumnAfter = (after: number) => this.insertColumnsAfter(after, 1)
  deleteColumn = (pos: number) => this.deleteColumns(pos, 1)
  deleteColumns = (pos: number, n: number) => {
    for (const row of this.rows) row.splice(pos - 1, n)
    for (const row of this.fmts) row.splice(pos - 1, n)
    this.cols.splice(pos - 1, n)
  }
  setConditionalFormatRules = (rules: FakeRule[]) => void (this.rules = rules)
  getConditionalFormatRules = () => this.rules
  /** 本物と同じく、書いてある範囲の四角（足りないセルは ''。何もなければ A1 だけ） */
  getDataRange = () => this.getRange(1, 1, Math.max(1, this.rows.length), Math.max(1, this.width()))
  getRange = (row: number, col: number, numRows = 1, numCols = 1) => {
    const each = (fn: (f: CellFormat) => void) => {
      for (let i = 0; i < numRows; i++) for (let j = 0; j < numCols; j++) fn(this.fmtAt(row - 1 + i, col - 1 + j))
    }
    const grid = <T,>(fn: (v: Cell) => T) => Array.from({ length: numRows }, (_, i) => Array.from({ length: numCols }, (_, j) => fn(this.cell(row - 1 + i, col - 1 + j))))
    const range = {
      sheet: this,
      row,
      col,
      numRows,
      getSheet: () => this,
      getRow: () => row,
      getColumn: () => col,
      getNumRows: () => numRows,
      getNumColumns: () => numCols,
      setFontWeight: (w: string | null) => (each((f) => (f.bold = w === 'bold')), range),
      setFontSize: (n: number) => (each((f) => (f.fontSize = n)), range),
      setFontColor: (c: string) => (each((f) => (f.color = c)), range),
      setWrap: (on: boolean) => (each((f) => (f.wrap = on)), range),
      // 上の線だけを覚える（true：引く、false：消す、null：そのまま）
      setBorder: (top: boolean | null, ..._rest: unknown[]) => {
        const style = (_rest[6] as string | undefined) ?? 'SOLID'
        if (top !== null) each((f) => (f.borderTop = top ? style : null))
        return range
      },
      setHorizontalAlignment: () => range,
      setVerticalAlignment: () => range,
      // 守ると、はじめは共有している人（先生）も書ける（本物と同じ。ツールが外す）
      protect: () => {
        const p: FakeProtection = { description: '', editors: [owner, 'shared-teacher@example.ac.jp'], domainEdit: true, range: { row, col, rows: numRows, cols: numCols } }
        this.protections.push(p)
        return this.getProtections().at(-1)!
      },
      setBackground: (b: string | null) => (each((f) => (f.background = b)), range),
      setBackgrounds: (bs: (string | null)[][]) => {
        for (let i = 0; i < numRows; i++) for (let j = 0; j < numCols; j++) this.fmtAt(row - 1 + i, col - 1 + j).background = bs[i][j]
        return range
      },
      setFontColors: (cs: string[][]) => {
        for (let i = 0; i < numRows; i++) for (let j = 0; j < numCols; j++) this.fmtAt(row - 1 + i, col - 1 + j).color = cs[i][j]
        return range
      },
      setDataValidation: (v: Validation | null) => (each((f) => (f.validation = v)), range),
      setNumberFormat: (n: string) => (each((f) => (f.numberFormat = n)), range),
      setValue: (v: Cell) => (this.put(row - 1, col - 1, this.written(v)), range),
      setValues: (values: Cell[][]) => {
        for (let i = 0; i < numRows; i++) for (let j = 0; j < numCols; j++) this.put(row - 1 + i, col - 1 + j, this.written(values[i][j]))
        return range
      },
      getValue: () => this.cell(row - 1, col - 1),
      getValues: () => grid((v) => v),
      getFormulas: () => grid((v) => (typeof v === 'string' && v.startsWith('=') ? v : '')),
    }
    return range
  }
}

class FakeSpreadsheet {
  sheets: FakeSheet[]
  constructor(
    public id = 'sheet-id',
    public name = '卒業制作報告書_管理',
  ) {
    this.sheets = [new FakeSheet('シート1', this)]
  }
  getSheetByName = (name: string) => this.sheets.find((s) => s.name === name) ?? null
  insertSheet = (name: string) => {
    const s = new FakeSheet(name, this)
    this.sheets.push(s)
    return s
  }
  getSheets = () => this.sheets
  deleteSheet = (s: FakeSheet) => void (this.sheets = this.sheets.filter((x) => x !== s))
  getId = () => this.id
  getName = () => this.name
  rename = (name: string) => void (this.name = name)
  getUrl = () => `https://docs.google.com/spreadsheets/d/${this.id}/edit`
}

let spreadsheet: FakeSpreadsheet
/** 管理ページが作ったスプレッドシート（点検表。ID → スプレッドシート） */
let books: Map<string, FakeSpreadsheet>
/** スクリプト プロパティに書いた値（読み込み直しても残る） */
let stored: Map<string, string>
/** 仕掛け（ScriptApp のトリガー） */
interface FakeTrigger {
  handler: string
  kind: 'time' | 'edit'
  minutes?: number
  source?: string
}
let triggers: FakeTrigger[]
/** ログイン中の人（管理ページを開いている人、またはエディタで実行した人） */
let user = 'kato@example.ac.jp'
/** プログラムを動かしている人（デプロイした人。エディタで実行したときは、実行した人） */
let owner = 'kato@example.ac.jp'
/** 配信の窓口がスプレッドシートを開いた回数 */
let opened = 0
/** 鍵を待つあいだに、ほかの人の操作が終わったことにする（同時に操作したときの確かめ） */
let whileWaiting: (() => void) | null = null

const FOLDER = 'application/vnd.google-apps.folder'
interface DriveItem {
  id: string
  name: string
  mimeType: string
  parents: string[]
  trashed: boolean
  appProperties?: Record<string, string>
  description?: string
  /** 中身（文字にしたもの） */
  content?: string
  /** 中身の版の数（新しく作ると1、中身を新しくするたびに増える） */
  versions: number
  /** ログイン中の人が見るだけのフォルダ（DriveApp の getAccess が VIEW） */
  viewOnly?: boolean
}

/** ドライブの高度なサービス（Drive API v3）の簡易版。先生のフォルダ（root-folder）だけがある */
class FakeDrive {
  items = new Map<string, DriveItem>([['root-folder', { id: 'root-folder', name: '先生のフォルダ', mimeType: FOLDER, parents: ['my-drive'], trashed: false, versions: 0 }]])
  seq = 0
  private match(item: DriveItem, q: string) {
    const unquote = (s: string) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\')
    const name = q.match(/name = '((?:\\.|[^'])*)'/)
    const mime = q.match(/mimeType = '((?:\\.|[^'])*)'/)
    const parents = [...q.matchAll(/'([^']+)' in parents/g)].map((m) => m[1])
    const app = q.match(/appProperties has \{ key='([^']*)' and value='((?:\\.|[^'])*)' \}/)
    return (
      (!name || item.name === unquote(name[1])) &&
      (!mime || item.mimeType === unquote(mime[1])) &&
      (!parents.length || parents.some((p) => item.parents.includes(p))) &&
      (!/trashed = false/.test(q) || !item.trashed) &&
      (!app || item.appProperties?.[app[1]] === unquote(app[2]))
    )
  }
  private text = (blob: { bytes: number[] } | null) => (blob ? Buffer.from(blob.bytes).toString('latin1') : undefined)
  api = {
    Files: {
      get: (id: string) => {
        const f = this.items.get(id)
        if (!f) throw new Error(`File not found: ${id}`)
        return { id: f.id, name: f.name, mimeType: f.mimeType, trashed: f.trashed }
      },
      list: (o: { q: string }) => ({ files: [...this.items.values()].filter((f) => this.match(f, o.q)).map((f) => ({ id: f.id, name: f.name, parents: [...f.parents] })) }),
      create: (r: Partial<DriveItem>, blob: { bytes: number[] } | null) => {
        const item: DriveItem = { id: `d${++this.seq}`, name: r.name!, mimeType: r.mimeType!, parents: r.parents ?? [], trashed: false, appProperties: r.appProperties, description: r.description, content: this.text(blob), versions: blob ? 1 : 0 }
        this.items.set(item.id, item)
        return { id: item.id }
      },
      update: (r: Partial<DriveItem>, id: string, blob: { bytes: number[] } | null, o: { addParents?: string; removeParents?: string } = {}) => {
        const f = this.items.get(id)
        if (!f) throw new Error(`File not found: ${id}`)
        Object.assign(f, { name: r.name ?? f.name, description: r.description ?? f.description, appProperties: { ...f.appProperties, ...r.appProperties } })
        if (blob) {
          f.content = this.text(blob)
          f.versions++
        }
        if (o.addParents) f.parents = [...f.parents.filter((p) => !(o.removeParents ?? '').split(',').includes(p)), o.addParents]
        return { id }
      },
    },
  }
  pdfs = () => [...this.items.values()].filter((f) => f.mimeType === 'application/pdf')
  folders = () => [...this.items.values()].filter((f) => f.mimeType === FOLDER && f.id !== 'root-folder')
  nameOf = (id: string) => this.items.get(id)?.name
}

let drive: FakeDrive
/** Google に確かめたときのログインの許可（トークン → tokeninfo の答え）。ないトークンは期限切れ（400） */
let tokens: Map<string, Record<string, string>>
/** 外部につないだ先（URL） */
let fetched: string[]
/** 配信の窓口が書いた記録（console） */
let logs: string[]
/** 送ったメール */
let mails: { to: string; subject: string; body: string }[]
let uuids = 0

/**
 * プログラムを読み込む。values：ビルド時に入る値（Code.js の「名前を囲んだコメントと ''」の場所。scripts/build-gas.mjs と同じ）、
 * props：スクリプト プロパティ（SHEET_ID は、いつも sheet-id）、trialSample：お試しの見本の原稿（ビルド時に gas/trial-sample.private.json から入るもの）
 */
function load(project: 'admin-project' | 'api-project', { values = {}, props = {}, trialSample = null }: { values?: Record<string, string>; props?: Record<string, string>; trialSample?: unknown } = {}) {
  let source = readFileSync(`gas/${project}/Code.js`, 'utf8').replace('/*INITIAL_CONFIG*/ null', JSON.stringify(initialConfig)).replace('/*TRIAL_SAMPLE*/ null', () => JSON.stringify(trialSample))
  for (const [name, value] of Object.entries(values)) source = source.replace(`/*${name}*/ ''`, JSON.stringify(value))
  const cache = new Map<string, string>()
  /** ドライブのフォルダ（DriveApp の簡易版。高度なサービスの簡易版と同じ中身を見る） */
  const folderOf = (id: string): Record<string, (...a: never[]) => unknown> => {
    const item = drive.items.get(id)
    if (!item || item.mimeType !== FOLDER) throw new Error(`Folder not found: ${id}`)
    return {
      getId: () => id,
      getName: () => item.name,
      isTrashed: () => item.trashed,
      getFoldersByName: (name: string) => {
        const list = [...drive.items.values()].filter((f) => f.mimeType === FOLDER && f.name === name && f.parents.includes(id))
        return { hasNext: () => list.length > 0, next: () => folderOf(list.shift()!.id) }
      },
      createFolder: (name: string) => folderOf(drive.api.Files.create({ name, mimeType: FOLDER, parents: [id] }, null).id),
      getAccess: () => (item.viewOnly ? 'VIEW' : 'EDIT'),
    }
  }
  /** 入力規則・条件付き書式を組み立てる部品（本物と同じ呼び方。中身は確かめられる形で残す） */
  const validationBuilder = () => {
    let v: Validation = { kind: 'checkbox' }
    const b = {
      requireCheckbox: () => ((v = { kind: 'checkbox' }), b),
      requireValueInList: (list: string[]) => ((v = { kind: 'list', list: [...list], allowInvalid: false }), b),
      setAllowInvalid: (on: boolean) => (v.kind === 'list' && (v.allowInvalid = on), b),
      build: () => v,
    }
    return b
  }
  const ruleBuilder = () => {
    const r: FakeRule = { when: '', text: '', ranges: [] }
    const b = {
      whenTextEqualTo: (t: string) => ((r.when = 'equal'), (r.text = t), b),
      whenTextContains: (t: string) => ((r.when = 'contains'), (r.text = t), b),
      whenTextStartsWith: (t: string) => ((r.when = 'startsWith'), (r.text = t), b),
      setBackground: (c: string) => ((r.background = c), b),
      setFontColor: (c: string) => ((r.color = c), b),
      setBold: (on: boolean) => ((r.bold = on), b),
      setRanges: (ranges: { row: number; col: number; numRows: number }[]) => ((r.ranges = ranges.map((x) => ({ row: x.row, col: x.col, rows: x.numRows }))), b),
      build: () => r,
    }
    return b
  }
  const context = createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: (id: string) => {
        opened++
        if (id === 'sheet-id') return spreadsheet
        const book = books.get(id)
        if (!book) throw new Error(`Spreadsheet not found: ${id}`)
        return book
      },
      create: (name: string) => {
        const id = `book${books.size + 1}`
        const book = new FakeSpreadsheet(id, name)
        books.set(id, book)
        drive.items.set(id, { id, name, mimeType: 'application/vnd.google-apps.spreadsheet', parents: ['my-drive'], trashed: false, versions: 0 })
        return book
      },
      newDataValidation: validationBuilder,
      newConditionalFormatRule: ruleBuilder,
      ProtectionType: { RANGE: 'RANGE', SHEET: 'SHEET' },
      BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'SOLID_MEDIUM' },
    },
    DriveApp: {
      Permission: { OWNER: 'OWNER', EDIT: 'EDIT', VIEW: 'VIEW' },
      getFolderById: folderOf,
      getFileById: (id: string) => {
        const item = drive.items.get(id)
        if (!item) throw new Error(`File not found: ${id}`)
        return { getId: () => id, isTrashed: () => item.trashed, moveTo: (folder: { getId: () => string }) => void (item.parents = [folder.getId()]) }
      },
    },
    Session: { getActiveUser: () => ({ getEmail: () => user }), getEffectiveUser: () => ({ getEmail: () => owner }) },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {
          const other = whileWaiting
          whileWaiting = null
          other?.()
        },
        releaseLock: () => {},
      }),
      getDocumentLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }),
    },
    Logger: { log: (m: string) => void logs.push(m) },
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => void cache.set(k, v) }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => (k === 'SHEET_ID' ? 'sheet-id' : (stored.get(k) ?? props[k] ?? null)),
        setProperty: (k: string, v: string) => void stored.set(k, v),
      }),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text: string) => ({ text, setMimeType() { return this } }) },
    HtmlService: { createHtmlOutputFromFile: () => ({ setTitle() { return this }, addMetaTag() { return this } }) },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/admin/exec' }),
      getProjectTriggers: () => triggers.map((t) => ({ trigger: t, getHandlerFunction: () => t.handler, getTriggerSourceId: () => t.source ?? null })),
      deleteTrigger: (t: { trigger: FakeTrigger }) => void (triggers = triggers.filter((x) => x !== t.trigger)),
      newTrigger: (handler: string) => ({
        timeBased: () => ({ everyMinutes: (minutes: number) => ({ create: () => void triggers.push({ handler, kind: 'time', minutes }) }) }),
        forSpreadsheet: (source: string) => ({ onEdit: () => ({ create: () => void triggers.push({ handler, kind: 'edit', source }) }) }),
      }),
    },
    UrlFetchApp: {
      fetch: (url: string) => {
        fetched.push(url)
        const token = new URL(url).searchParams.get('access_token') ?? ''
        const info = tokens.get(token)
        return { getResponseCode: () => (info ? 200 : 400), getContentText: () => JSON.stringify(info ?? { error: 'invalid_token' }) }
      },
    },
    Drive: drive.api,
    MailApp: { sendEmail: (m: { to: string; subject: string; body: string }) => void mails.push(m), getRemainingDailyQuota: () => 100 },
    Utilities: {
      base64Decode: (s: string) => [...Buffer.from(s, 'base64')],
      newBlob: (bytes: number[], type: string, name: string) => ({ bytes, type, name }),
      // 日時は、いつも 2026-10-19 12:00（形に合わせて）
      formatDate: (_d: Date, _tz: string, pattern = 'yyyy-MM-dd HH:mm') => pattern.replace('yyyy', '2026').replace('MM', '10').replace('dd', '19').replace('HH', '12').replace('mm', '00'),
      getUuid: () => `${(++uuids).toString(16).padStart(8, '0')}-0000-4000-8000-${'0'.repeat(12)}`,
    },
    console: { log: () => {}, warn: (m: string) => void logs.push(m), error: (m: string) => void logs.push(m) },
    JSON,
    Date,
    Number,
    String,
    Error,
  })
  runInContext(source, context)
  return context as unknown as Record<string, (...args: unknown[]) => any>
}

beforeEach(() => {
  spreadsheet = new FakeSpreadsheet()
  books = new Map()
  stored = new Map()
  triggers = []
  user = 'kato@example.ac.jp'
  owner = 'kato@example.ac.jp'
  opened = 0
  whileWaiting = null
  drive = new FakeDrive()
  tokens = new Map()
  fetched = []
  logs = []
  mails = []
  uuids = 0
})

const sheetRows = (name: string) => spreadsheet.getSheetByName(name)!.rows
/** 変更履歴のシートのうち、登録の変更の行（年度が空）の操作 */
const memberHistory = () =>
  sheetRows('変更履歴')
    .slice(1)
    .filter((r) => r[2] === '')
    .map((r) => `${r[1]}:${r[3]}`)

describe('管理ページ（admin-project）', () => {
  it('setup でシートができ、実行した人が管理者になり、初期値が公開中で入る', () => {
    const gas = load('admin-project')
    gas.setup()
    expect(spreadsheet.sheets.map((s) => s.name)).toEqual(['年度設定', '変更履歴', '管理者'])
    const state = gas.getState()
    expect(state).toMatchObject({ user: 'kato@example.ac.jp', isAdmin: true })
    expect(state.years).toHaveLength(1)
    expect(state.years[0]).toMatchObject({ year: 2026, status: '公開中', config: { commonTitle: initialConfig.commonTitle } })
  })

  it('お試しの見本の原稿は、登録された先生と管理者にだけ渡す（入っていなければ、そう知らせる）', () => {
    const sample = { report: { body: [] }, images: [{ id: 'g-photo1', file: 'g-photo1.jpg', maxPx: 1200 }] }
    const gas = load('admin-project', { trialSample: sample })
    gas.setup()
    expect(gas.getTrialSample()).toEqual(sample)
    gas.addMember('sensei@example.ac.jp', '先生', '')
    user = 'sensei@example.ac.jp'
    expect(gas.getTrialSample()).toEqual(sample)
    user = '00zz0123@example.ac.jp'
    expect(() => gas.getTrialSample()).toThrow(/登録された先生だけ/)
    user = 'kato@example.ac.jp'
    expect(() => load('admin-project').getTrialSample()).toThrow(/見本の原稿が入っていません/)
  })

  it('公開中の管理ページの版の印と場所を返す（開いたままの画面の「新しい版があります」。だれでも呼べる）', () => {
    user = 'someone@example.ac.jp'
    expect(load('admin-project', { values: { BUILD_ID: 'abc1234-x' } }).getVersion()).toEqual({ id: 'abc1234-x', url: 'https://script.google.com/macros/s/admin/exec' })
    // まとめずに送ったとき（印がない）は空。画面は知らせを出さない
    expect(load('admin-project').getVersion().id).toBe('')
  })

  it('先生向けのリンク（資料一式・AI に聞く）は、登録された先生と管理者にだけ渡す（スクリプト プロパティがあれば、そちらを使う）', () => {
    const values = { MATERIALS_URL: 'https://example.com/materials', TEACHER_AI_URL: 'https://example.com/ai' }
    const gas = load('admin-project', { values })
    gas.setup()
    expect(gas.getState().links).toEqual({ materials: 'https://example.com/materials', ai: 'https://example.com/ai' })
    user = 'student@example.ac.jp'
    expect(gas.getState().links).toEqual({})
    user = owner
    expect(load('admin-project', { values, props: { TEACHER_AI_URL: 'https://example.com/ai-2' } }).getState().links.ai).toBe('https://example.com/ai-2')
    // まとめずに送ったとき（値がない）は、リンクを出さない
    expect(load('admin-project').getState().links).toEqual({})
  })

  it('管理者でない人には年度設定を見せず、保存もさせない', () => {
    const gas = load('admin-project')
    gas.setup()
    user = 'student@example.ac.jp'
    expect(gas.getState()).toMatchObject({ isAdmin: false, years: [] })
    expect(() => gas.saveYear(initialConfig)).toThrow(/管理者だけ/)
  })

  it('保存・新年度の作成・公開・変更履歴', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.saveYear({ ...initialConfig, commonTitle: '新しい題目' })
    expect(gas.getState().years[0].config.commonTitle).toBe('新しい題目')

    const created = gas.createYear(2026, 2027)
    expect(created.years.map((y: { year: number; status: string }) => `${y.year}:${y.status}`)).toEqual(['2027:準備中', '2026:公開中'])
    expect(() => gas.createYear(2026, 2027)).toThrow(/すでにあります/)

    const published = gas.publishYear(2027)
    expect(published.years.map((y: { year: number; status: string }) => `${y.year}:${y.status}`)).toEqual(['2027:公開中', '2026:終了'])

    const history = gas.getHistory(2026)
    expect(history.map((h: { action: string }) => h.action)).toEqual(['保存', '初期設定'])
  })

  it('先生を登録すると、下書きのひな形だけを保存できる（ほかの設定は変えられない）', () => {
    const gas = load('admin-project')
    gas.setup()
    const members = gas.addMember('sensei@example.ac.jp', '先生', '衣装の先生')
    expect(members.map((m: { email: string; role: string }) => `${m.email}:${m.role}`)).toEqual(['kato@example.ac.jp:管理者', 'sensei@example.ac.jp:先生'])

    user = 'sensei@example.ac.jp'
    const state = gas.getState()
    expect(state).toMatchObject({ isAdmin: false, role: 'teacher' })
    expect(state.years).toHaveLength(1)
    expect(() => gas.saveYear({ ...initialConfig, commonTitle: '先生が変えた題目' })).toThrow(/管理者だけ/)
    expect(() => gas.addMember('x@example.ac.jp', '先生')).toThrow(/管理者だけ/)

    const template = [{ type: 'chapter', title: '概要' }, { type: 'paragraph', hint: '概要を書く' }]
    const saved = gas.saveTemplates(2026, { 'film-stage-costume': { template, abstractExample: '本制作報告書は、' }, 'no-such-course': { template } })
    const course = saved.years[0].config.courses[0]
    expect(course).toMatchObject({ template, abstractExample: '本制作報告書は、' })
    expect(saved.years[0].config.commonTitle).toBe(initialConfig.commonTitle)
    expect(gas.getHistory(2026)[0].action).toContain('下書きのひな形を保存')
  })

  it('先生の画面の保存は、ひな形・お知らせ・語の一覧をまとめて1回で保存する', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.addMember('sensei@example.ac.jp', '先生')
    user = 'sensei@example.ac.jp'
    const template = [{ type: 'chapter', title: '概要' }]
    const saved = gas.saveTeacherEdits(2026, {
      templates: { 'film-stage-costume': { template, abstractExample: '本制作報告書は、' } },
      notices: { 'film-stage-costume': 'お知らせ' },
      words: [{ wrong: '見頃', right: '身頃', severity: 'error' }],
    })
    const config = saved.years[0].config
    expect(config.courses[0]).toMatchObject({ template, notice: 'お知らせ' })
    expect(config.wordChecks).toEqual([{ wrong: '見頃', right: '身頃', note: '', severity: 'error' }])
    const history = gas.getHistory(2026)
    expect(history[0].action).toBe('下書きのひな形を保存（映画・舞台衣装デザイナー）・お知らせを保存（映画・舞台衣装デザイナー）・書き間違えやすい語を保存（1語）')
    expect(history).toHaveLength(2)
    // 形が正しくないものがあれば、何も保存しない
    expect(() => gas.saveTeacherEdits(2026, { notices: { 'film-stage-costume': '別の' }, templates: { 'film-stage-costume': { template: 'x' } } })).toThrow(/形が正しくありません/)
    expect(gas.getState().years[0].config.courses[0].notice).toBe('お知らせ')
  })

  it('管理者の保存：画面を開いたあとにほかの人が保存していたら、保存せずに知らせる', () => {
    const gas = load('admin-project')
    gas.setup()
    // 管理者が、少し前に画面を開いた（そのときの更新日時）
    const opened = { ...gas.getState().years[0], updatedAt: '2026-10-01T00:00:00.000Z' }
    gas.addMember('sensei@example.ac.jp', '先生')
    user = 'sensei@example.ac.jp'
    gas.saveNotices(2026, { 'film-stage-costume': '先生のお知らせ' })
    user = 'kato@example.ac.jp'
    expect(() => gas.saveYear({ ...opened.config, deadline: '2027-01-21' }, opened.updatedAt)).toThrow(/ほかの人（sensei@example.ac.jp）/)
    expect(gas.getState().years[0].config.courses[0].notice).toBe('先生のお知らせ')
    // 読み込み直した更新日時なら保存できる
    const fresh = gas.getState().years[0]
    expect(gas.saveYear({ ...fresh.config, deadline: '2027-01-21' }, fresh.updatedAt).years[0].config.deadline).toBe('2027-01-21')
  })

  it('別のタブで公開・削除・登録を外したあとの、古い画面からの操作は断る（管理ページの試し 2026-10-27）', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.createYear(2026, 2027)
    // 2027年度を、少し前に開いていた（そのときの更新日時）
    const years = sheetRows('年度設定')
    const row2027 = years.findIndex((r) => Number(r[0]) === 2027)
    years[row2027][3] = new Date('2026-10-01T00:00:00.000Z')
    const opened = gas.getState().years.find((y: { year: number }) => y.year === 2027)
    // 別のタブで公開した：公開した年度と、終了にした年度の更新日時が変わる
    const published = gas.publishYear(2027, opened.updatedAt)
    expect(published.years.find((y: { year: number }) => y.year === 2027).updatedAt).not.toBe(opened.updatedAt)
    // 公開の前から開いていた画面の保存は、学生に届けずに断る
    expect(() => gas.saveYear({ ...opened.config, commonTitle: '下書きの題目' }, opened.updatedAt)).toThrow(/この画面を開いたあとに/)
    expect(gas.getState().years.find((y: { year: number }) => y.year === 2027).config.commonTitle).toBe(opened.config.commonTitle)
    // 削除された年度は、古い画面から保存しても作り直さない（はじめての保存＝更新日時なしは、今までどおり作る）
    gas.createYear(2027, 2028)
    const draft = gas.getState().years.find((y: { year: number }) => y.year === 2028)
    gas.deleteYear(2028, draft.updatedAt)
    expect(() => gas.saveYear(draft.config, draft.updatedAt)).toThrow(/2028年度は、この画面を開いたあとに削除されています/)
    expect(gas.getState().years.map((y: { year: number }) => y.year)).toEqual([2027, 2026])
    // 外した人の役割を、古い一覧から変えても登録し直さない（一覧の外からの登録は、今までどおり）
    gas.addMember('tanaka@example.ac.jp', '先生')
    gas.removeMember('tanaka@example.ac.jp')
    expect(() => gas.addMember('tanaka@example.ac.jp', '管理者', '', true)).toThrow(/外されています/)
    expect(gas.getMembers().map((m: { email: string }) => m.email)).toEqual(['kato@example.ac.jp'])
    gas.addMember('sato@example.ac.jp', '先生')
    expect(gas.addMember('sato@example.ac.jp', '管理者', '', true).find((m: { email: string }) => m.email === 'sato@example.ac.jp').role).toBe('管理者')
  })

  it('先生もコースのお知らせを保存できる（指定したコースだけ書き換える）', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.addMember('sensei@example.ac.jp', '先生')
    user = 'sensei@example.ac.jp'
    const saved = gas.saveNotices(2026, { 'film-stage-costume': '中間発表の準備をしてください', 'no-such-course': 'x' })
    const course = saved.years[0].config.courses[0]
    expect(course.notice).toBe('中間発表の準備をしてください')
    expect(saved.years[0].config.commonTitle).toBe(initialConfig.commonTitle)
    expect(gas.getHistory(2026)[0].action).toContain('お知らせを保存')
    user = 'student@example.ac.jp'
    expect(() => gas.saveNotices(2026, {})).toThrow(/登録された先生だけ/)
  })

  it('先生も書き間違えやすい語を保存できる（空の行・同じ語の行は捨てる）', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.addMember('sensei@example.ac.jp', '先生')
    user = 'sensei@example.ac.jp'
    const words = [
      { wrong: ' 見頃 ', right: '身頃', note: '服の胴の部分', severity: 'error' },
      { wrong: '記事', right: '生地', severity: 'warning' },
      { wrong: '', right: '空', severity: 'error' },
      { wrong: '同じ', right: '同じ', severity: 'error' },
      { wrong: '芯地', right: '芯', severity: 'what' },
    ]
    const saved = gas.saveWordChecks(2026, words)
    expect(saved.years[0].config.wordChecks).toEqual([
      { wrong: '見頃', right: '身頃', note: '服の胴の部分', severity: 'error' },
      { wrong: '記事', right: '生地', note: '', severity: 'warning' },
      { wrong: '芯地', right: '芯', note: '', severity: 'error' },
    ])
    expect(saved.years[0].config.commonTitle).toBe(initialConfig.commonTitle)
    expect(gas.getHistory(2026)[0].action).toBe('書き間違えやすい語を保存（3語）')
    expect(() => gas.saveWordChecks(2026, 'x')).toThrow(/形が正しくありません/)
    user = 'student@example.ac.jp'
    expect(() => gas.saveWordChecks(2026, [])).toThrow(/登録された先生だけ/)
  })

  it('管理者は、まとめて登録できる（登録済みの人はそのまま。先生はまとめて登録できない）', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.addMember('sensei@example.ac.jp', '先生', '前からの先生')
    const list = gas.addMembers(
      [
        { email: ' a@example.ac.jp ', memo: '文化 太郎' },
        { email: 'SENSEI@example.ac.jp', memo: '上書きしない' },
        { email: 'b@example.ac.jp', memo: '' },
        { email: 'not-an-address', memo: '' },
      ],
      '先生',
    )
    expect(list.map((m: { email: string; role: string; memo: string }) => `${m.email}:${m.role}:${m.memo}`)).toEqual([
      'kato@example.ac.jp:管理者:初期設定で登録',
      'sensei@example.ac.jp:先生:前からの先生',
      'a@example.ac.jp:先生:文化 太郎',
      'b@example.ac.jp:先生:',
    ])
    expect(() => gas.addMembers([], '学生')).toThrow(/役割が正しくありません/)
    user = 'sensei@example.ac.jp'
    expect(() => gas.addMembers([{ email: 'c@example.ac.jp' }], '先生')).toThrow(/管理者だけ/)
  })

  it('登録していない人はひな形を保存できない。自分の登録は外せない', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.addMember('sensei@example.ac.jp', '先生')
    expect(() => gas.removeMember('kato@example.ac.jp')).toThrow(/外せません/)
    expect(gas.removeMember('sensei@example.ac.jp')).toHaveLength(1)
    user = 'student@example.ac.jp'
    expect(gas.getState()).toMatchObject({ role: null, years: [] })
    expect(() => gas.saveTemplates(2026, {})).toThrow(/登録された先生だけ/)
  })

  it('setup は、デプロイした本人が実行したときだけ通る（管理ページから呼ばれても、ほかの人は管理者にならない）', () => {
    const gas = load('admin-project')
    gas.setup()
    user = 'student@example.ac.jp'
    expect(() => gas.setup()).toThrow(/デプロイした人/)
    expect(gas.getState()).toMatchObject({ role: null, years: [] })
    user = 'kato@example.ac.jp'
    expect(gas.getMembers().map((m: { email: string }) => m.email)).toEqual(['kato@example.ac.jp'])
    // デプロイした本人は、何度実行してもよい
    expect(() => gas.setup()).not.toThrow()
    // ほかの管理者も、管理ページからは呼べない（エディタで実行する）
    gas.addMember('admin2@example.ac.jp', '管理者')
    user = 'admin2@example.ac.jp'
    expect(() => gas.setup()).toThrow(/デプロイした人/)
  })

  it('有効な管理者が0人になっても（役割の書き間違い・シート名の変更）、ほかの人は setup で管理者になれない', () => {
    const gas = load('admin-project')
    gas.setup()
    // 役割を手で書き間違えた
    sheetRows('管理者')[1][2] = '管理社'
    user = 'student@example.ac.jp'
    expect(() => gas.setup()).toThrow(/デプロイした人/)
    expect(gas.getState()).toMatchObject({ role: null })
    // シート名を変えた
    spreadsheet.getSheetByName('管理者')!.name = '管理者（古い）'
    expect(() => gas.setup()).toThrow(/デプロイした人/)
    expect(spreadsheet.getSheetByName('管理者')).toBeNull()
    // デプロイした本人がエディタで実行すると、管理者に戻れる
    user = 'kato@example.ac.jp'
    gas.setup()
    expect(gas.getState()).toMatchObject({ role: 'admin' })
    // エディタで実行した人がデプロイした人と同じなら通る（ログインしていない＝アドレスが空のときは通さない）
    user = ''
    owner = ''
    expect(() => gas.setup()).toThrow(/デプロイした人/)
  })

  it('役割の確かめは鍵の中で行う（2人の管理者が同時にお互いを先生にしても、管理者は0人にならない）', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.addMember('sato@example.ac.jp', '管理者')
    // 加藤さんが佐藤さんを先生にする。鍵を待つあいだに、佐藤さんが加藤さんを先生にし終えた
    whileWaiting = () => {
      user = 'sato@example.ac.jp'
      gas.addMember('kato@example.ac.jp', '先生')
      user = 'kato@example.ac.jp'
    }
    expect(() => gas.addMember('sato@example.ac.jp', '先生')).toThrow(/管理者だけ/)
    user = 'sato@example.ac.jp'
    expect(gas.getState()).toMatchObject({ role: 'admin' })
    // 先生の保存も、鍵の中で役割を確かめる（待つあいだに登録を外された）
    gas.addMember('sensei@example.ac.jp', '先生')
    whileWaiting = () => {
      user = 'sato@example.ac.jp'
      gas.removeMember('sensei@example.ac.jp')
      user = 'sensei@example.ac.jp'
    }
    user = 'sensei@example.ac.jp'
    expect(() => gas.saveTeacherEdits(2026, { notices: { 'film-stage-costume': 'x' } })).toThrow(/登録された先生だけ/)
  })

  it('有効な管理者が0人になる変更は断る', () => {
    const gas = load('admin-project')
    gas.setup()
    const header = ['メールアドレス', 'メモ', '役割']
    expect(() => gas.keepAdmin_([header, ['a@example.ac.jp', '', '先生'], ['b@example.ac.jp', '', '管理社']])).toThrow(/管理者が1人もいなくなる/)
    // 同じアドレスの行がいくつかあれば、最初の行の役割で数える（roleOf_ と同じ）
    expect(() => gas.keepAdmin_([header, ['a@example.ac.jp', '', '先生'], ['A@example.ac.jp', '', '管理者']])).toThrow(/管理者が1人もいなくなる/)
    expect(() => gas.keepAdmin_([header, ['a@example.ac.jp', '', ''], ['b@example.ac.jp', '', '先生']])).not.toThrow()
    // 自分を外す・先生にすることはできない
    expect(() => gas.addMember('kato@example.ac.jp', '先生')).toThrow(/自分を管理者から外す/)
    expect(() => gas.removeMember('KATO@example.ac.jp')).toThrow(/外せません/)
    expect(gas.getState()).toMatchObject({ role: 'admin' })
  })

  it('登録の変更（setup・登録・まとめて登録・役割の変更・外す）を変更履歴に残す', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.addMember('sensei@example.ac.jp', '先生', '衣装の先生')
    gas.addMember('sensei@example.ac.jp', '管理者')
    gas.addMembers([{ email: 'a@example.ac.jp' }, { email: 'b@example.ac.jp' }, { email: 'sensei@example.ac.jp' }], '先生')
    gas.addMembers([{ email: 'a@example.ac.jp' }], '先生')
    gas.removeMember('a@example.ac.jp')
    gas.removeMember('nobody@example.ac.jp')
    expect(memberHistory()).toEqual([
      'kato@example.ac.jp:初期設定（setup）を実行：kato@example.ac.jp を管理者に登録',
      'kato@example.ac.jp:登録：sensei@example.ac.jp（先生）',
      'kato@example.ac.jp:役割を変更：sensei@example.ac.jp（先生→管理者）',
      'kato@example.ac.jp:まとめて登録：a@example.ac.jp、b@example.ac.jp（先生）',
      'kato@example.ac.jp:登録を外す：a@example.ac.jp',
    ])
    // 年度の変更履歴には混ざらない
    expect(gas.getHistory(2026).map((h: { action: string }) => h.action)).toEqual(['初期設定'])
  })

  it('管理者の入力は、数式としてではなく文字としてスプレッドシートに書く', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.addMember('+sensei@example.ac.jp', '先生', '=HYPERLINK("https://example.com","見て")')
    gas.addMembers([{ email: '-a@example.ac.jp', memo: '@名前' }], '先生')
    const all = spreadsheet.sheets.flatMap((s) => s.formulas)
    expect(all).toEqual([])
    // 読み出すと、入力したとおりの文字になる
    expect(gas.getMembers().map((m: { email: string; memo: string }) => `${m.email}:${m.memo}`)).toEqual([
      'kato@example.ac.jp:初期設定で登録',
      '+sensei@example.ac.jp:=HYPERLINK("https://example.com","見て")',
      '-a@example.ac.jp:@名前',
    ])
  })

  it('新年度は、西暦4桁の整数だけ作れる', () => {
    const gas = load('admin-project')
    gas.setup()
    for (const bad of ['=1+1', '20x7', 99999, 2027.5, '', '0999']) expect(() => gas.createYear(2026, bad)).toThrow(/西暦4桁/)
    expect(gas.createYear(2026, '2027').years.map((y: { year: number }) => y.year)).toEqual([2027, 2026])
    user = 'student@example.ac.jp'
    expect(() => gas.createYear(2026, 2028)).toThrow(/管理者だけ/)
  })

  it('年度設定の壊れた行（設定の JSON・更新日時の書き損じ）は飛ばし、ほかの年度は使える', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.createYear(2026, 2027)
    gas.createYear(2026, 2028)
    const years = sheetRows('年度設定')
    years[2][2] = '{壊れた JSON'
    years[3][3] = '日時ではない'
    expect(gas.getState().years.map((y: { year: number }) => y.year)).toEqual([2026])
    // 壊れた年度を書き換えようとすると、分かる言葉で断る
    expect(() => gas.publishYear(2027)).toThrow(/壊れていて読めません/)
    expect(() => gas.saveTeacherEdits(2027, { notices: {} })).toThrow(/壊れていて読めません/)
    expect(sheetRows('年度設定')[1][1]).toBe('公開中')
    // 変更履歴の壊れた行も飛ばす
    sheetRows('変更履歴').push([new Date(), 'x', 2026, '壊れた行', '{'], ['日時ではない', 'x', 2026, '壊れた行', '{}'])
    expect(gas.getHistory(2026).map((h: { action: string }) => h.action)).toEqual(['初期設定'])
  })

  it('先生の保存：崩れたひな形・お知らせ・語の一覧は保存せずにエラーで返す', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.addMember('sensei@example.ac.jp', '先生')
    user = 'sensei@example.ac.jp'
    const id = 'film-stage-costume'
    const save = (edits: object) => () => gas.saveTeacherEdits(2026, edits)
    const template = (blocks: unknown) => ({ templates: { [id]: { template: blocks, abstractExample: '' } } })
    const chapter = { type: 'chapter', title: '概要' }
    // 行は、番号と種類と書き出しで示す（どの行か見つけやすいように）
    expect(save(template([{ type: 'chapter' }]))).toThrow(/1行目の大見出しの形が正しくありません/)
    expect(save(template([{ type: 'chapter', title: ' ' }]))).toThrow(/1行目の大見出しの名前が空です/)
    expect(save(template([{ type: 'paragraph', hint: '説明' }, chapter]))).toThrow(/大見出しから始めて/)
    expect(save(template([chapter, { type: 'figure', caption: 3 }]))).toThrow(/2行目の図の枠の形が正しくありません/)
    expect(save(template([chapter, { type: 'paragraph' }]))).toThrow(/2行目の説明の形が正しくありません/)
    expect(save(template([chapter, { type: 'image', caption: '写真' }]))).toThrow(/2行目の形が正しくありません/)
    expect(save(template([chapter, null]))).toThrow(/2行目の形が正しくありません/)
    expect(save(template([chapter, { type: 'subheading', title: 'あ'.repeat(101) }]))).toThrow('「映画・舞台衣装デザイナー」のひな形の2行目の中見出し「ああああああああああああ…」が長すぎます（100字まで。今は101字）')
    expect(save(template([chapter, { type: 'paragraph', hint: 'あ'.repeat(301) }]))).toThrow(/2行目の説明「あ+…」が長すぎます（300字まで。今は301字）/)
    expect(save(template(Array.from({ length: 101 }, () => chapter)))).toThrow(/多すぎます/)
    expect(save({ templates: { [id]: { template: [chapter], abstractExample: 1 } } })).toThrow(/抄録の書き出し例の形が正しくありません/)
    expect(save({ templates: { [id]: 'x' } })).toThrow(/形が正しくありません/)
    expect(save({ notices: { [id]: 5 } })).toThrow(/お知らせの形が正しくありません/)
    expect(save({ notices: { [id]: 'あ'.repeat(1200) } })).toThrow('「映画・舞台衣装デザイナー」のお知らせが長すぎます（1000字まで。今は1200字）')
    expect(save({ words: 'x' })).toThrow(/書き間違えやすい語の形が正しくありません/)
    expect(save({ words: [{ wrong: 1, right: '身頃' }] })).toThrow(/1行目の形が正しくありません/)
    expect(save({ words: [null] })).toThrow(/1行目の形が正しくありません/)
    expect(save({ words: [{ wrong: 'あ'.repeat(51), right: '身頃' }] })).toThrow(/長すぎます/)
    expect(save({ words: Array.from({ length: 301 }, () => ({ wrong: '見頃', right: '身頃' })) })).toThrow(/多すぎます/)
    // 何も保存されていない
    expect(gas.getState().years[0].config).toEqual(initialConfig)
    expect(gas.getHistory(2026)).toHaveLength(1)
    // 正しい形なら保存でき、決まった項目だけが残る（段落の説明は空でもよい）
    const saved = gas.saveTeacherEdits(2026, template([{ ...chapter, extra: 'x' }, { type: 'paragraph', hint: '' }, { type: 'materialTable', caption: '使用素材表' }]))
    expect(saved.years[0].config.courses[0].template).toEqual([chapter, { type: 'paragraph', hint: '' }, { type: 'materialTable', caption: '使用素材表' }])
    // 改ページ・ふつうの表（mockups/v44）も保存でき、決まった項目だけが残る
    const table = { type: 'table', caption: '寸法表', header: ['部位', '寸法'], rows: 3, widths: 'auto', heights: 'equal', labelColumn: true }
    const withNew = gas.saveTeacherEdits(2026, template([chapter, { type: 'pageBreak', title: 'x' }, { ...table, extra: 1 }]))
    expect(withNew.years[0].config.courses[0].template).toEqual([chapter, { type: 'pageBreak' }, table])
    // 行の高さ「写真が入る高さ」（映画・舞台衣装デザイナーコースの素材表）も保存できる
    const photo = { type: 'table', caption: '使用材料表', header: ['名称', '使用箇所', '生地見本'], rows: 6, heights: 'photo' }
    expect(gas.saveTeacherEdits(2026, template([chapter, photo])).years[0].config.courses[0].template).toEqual([chapter, photo])
    expect(save(template([chapter, { ...table, header: ['a', 1] }]))).toThrow(/2行目の表「寸法表」の見出しの行の形が正しくありません/)
    expect(save(template([chapter, { ...table, rows: 12 }]))).toThrow(/2行目の表「寸法表」の行の数が正しくありません/)
  })

  it('管理者の保存も、崩れたひな形は保存しない', () => {
    const gas = load('admin-project')
    gas.setup()
    const course = { ...initialConfig.courses[0], template: [{ type: 'paragraph' }] }
    expect(() => gas.saveYear({ ...initialConfig, courses: [course] })).toThrow(/ひな形の1行目の説明の形が正しくありません/)
    expect(() => gas.saveYear({ ...initialConfig, courses: [{ ...initialConfig.courses[0], advisors: [1] }] })).toThrow(/形が正しくありません/)
    expect(() => gas.saveYear({ ...initialConfig, fiscalYear: 20260 })).toThrow(/年度が正しくありません/)
    // コースの「表の空の行」は、true・false（ない）だけ
    expect(() => gas.saveYear({ ...initialConfig, courses: [{ ...initialConfig.courses[0], blankRowsOk: 'yes' }] })).toThrow(/表の空の行の設定が正しくありません/)
    // 準備中の年度は、題目が空などの途中の状態でも保存できる（細かい確認は画面で行う）
    gas.createYear(2026, 2027)
    expect(gas.saveYear({ ...initialConfig, fiscalYear: 2027, commonTitle: '' }).years[0].config.commonTitle).toBe('')
  })

  it('先生の保存と公開も、画面を開いたあとにほかの人が保存していたら、保存・公開せずに知らせる', () => {
    const gas = load('admin-project')
    gas.setup()
    gas.addMember('sensei@example.ac.jp', '先生')
    gas.addMember('sensei2@example.ac.jp', '先生')
    gas.createYear(2026, 2027)
    // 2人の先生と管理者が、少し前に画面を開いた（そのときの更新日時。同じミリ秒の保存と区別するため、前の日時にしておく）
    const opened = '2026-10-01T00:00:00.000Z'
    for (const row of sheetRows('年度設定').slice(1)) row[3] = new Date(opened)
    const yearOf = (y: number) => gas.getState().years.find((r: { year: number }) => r.year === y)
    // 先生2が先に保存した
    user = 'sensei2@example.ac.jp'
    gas.saveTeacherEdits(2026, { notices: { 'film-stage-costume': '先生2のお知らせ' } }, opened)
    // 先生1は、古い画面のまま保存しようとする
    user = 'sensei@example.ac.jp'
    expect(() => gas.saveTeacherEdits(2026, { notices: { 'film-stage-costume': '先生1のお知らせ' } }, opened)).toThrow(/ほかの人（sensei2@example.ac.jp）/)
    expect(yearOf(2026).config.courses[0].notice).toBe('先生2のお知らせ')
    // 管理者が2027年度を開いたあとに、先生が2027年度を保存した → 古い画面のままでは公開しない
    gas.saveTeacherEdits(2027, { notices: { 'film-stage-costume': '2027年度のお知らせ' } }, opened)
    user = 'kato@example.ac.jp'
    expect(() => gas.publishYear(2027, opened)).toThrow(/ほかの人（sensei@example.ac.jp）/)
    expect(yearOf(2027).status).toBe('準備中')
    // 読み込み直した更新日時なら公開できる
    expect(gas.publishYear(2027, yearOf(2027).updatedAt).years.map((y: { year: number; status: string }) => `${y.year}:${y.status}`)).toEqual(['2027:公開中', '2026:終了'])
  })

  it('役割の書き間違いは、管理者にも先生にもしない', () => {
    const gas = load('admin-project')
    gas.setup()
    const sheet = spreadsheet.getSheetByName('管理者')!
    sheet.rows.push(['typo@example.ac.jp', '', '管理社'], ['teacher@example.ac.jp', '', ' 先生 '])
    user = 'typo@example.ac.jp'
    expect(gas.getState()).toMatchObject({ role: null })
    user = 'teacher@example.ac.jp'
    expect(gas.getState()).toMatchObject({ role: 'teacher' })
  })

  it('役割の列がない古い管理者シートは、管理者として扱う', () => {
    const gas = load('admin-project')
    gas.setup()
    const sheet = spreadsheet.getSheetByName('管理者')!
    sheet.rows = [['メールアドレス', 'メモ'], ['kato@example.ac.jp', '']]
    expect(gas.getState()).toMatchObject({ isAdmin: true, role: 'admin' })
  })

  it('間違えて作った準備中の年度は削除できる（一度でも公開した年度・先生は削除できない）', () => {
    const gas = load('admin-project')
    gas.setup()
    const years = () => gas.getState().years.map((y: { year: number; status: string }) => `${y.year}:${y.status}`)
    /** 年度ごとの、削除できるか（管理ページは、削除できる年度にだけ「この年度を削除」を出す） */
    const deletable = () => gas.getState().years.map((y: { year: number; deletable: boolean }) => `${y.year}:${y.deletable}`)
    expect(deletable()).toEqual(['2026:false'])
    gas.createYear(2026, 2028)
    expect(deletable()).toEqual(['2028:true', '2026:false'])
    expect(() => gas.deleteYear(2026)).toThrow('2026年度は、学生に公開したことがあるため削除できません（削除できるのは、一度も公開していない「準備中」の年度だけです）')
    gas.addMember('sensei@example.ac.jp', '先生')
    user = 'sensei@example.ac.jp'
    expect(() => gas.deleteYear(2028)).toThrow(/管理者だけ/)
    user = 'kato@example.ac.jp'
    // 画面を開いたあとにほかの人が保存していたら、消さない
    expect(() => gas.deleteYear(2028, '2026-10-01T00:00:00.000Z')).toThrow(/この画面を開いたあとに/)
    expect(gas.deleteYear(2028).years.map((y: { year: number }) => y.year)).toEqual([2026])
    expect(years()).toEqual(['2026:公開中'])
    // 変更履歴には「削除」を残す（消した内容は、その行から写せる）
    expect(gas.getHistory(2028).map((h: { action: string }) => h.action)).toEqual(['削除', '2026年度からコピーして作成'])
    expect(() => gas.deleteYear(2028)).toThrow(/2028年度の設定がありません/)
    // 公開して「終了」になった年度も、公開したことがあるので消さない（状態を手で準備中に戻しても）
    gas.createYear(2026, 2027)
    gas.publishYear(2027)
    sheetRows('年度設定').find((r) => r[0] === 2026)![1] = '準備中'
    expect(() => gas.deleteYear(2026)).toThrow(/公開したことがある/)
    expect(() => gas.deleteYear(2027)).toThrow(/公開したことがある/)
    expect(deletable()).toEqual(['2027:false', '2026:false'])
    // 削除した年度をもう一度作ると、また削除できる（変更履歴の「削除」「作成」は、公開ではない）
    gas.createYear(2027, 2028)
    expect(deletable()).toEqual(['2028:true', '2027:false', '2026:false'])
  })

  it('画面を開いたあとに保存したのが自分（別のタブ）なら、そう伝える', () => {
    const gas = load('admin-project')
    gas.setup()
    const opened = '2026-10-01T00:00:00.000Z'
    sheetRows('年度設定')[1][3] = new Date(opened)
    gas.saveYear({ ...initialConfig, deadline: '2027-01-21' }, opened)
    expect(() => gas.saveYear({ ...initialConfig, deadline: '2027-01-22' }, opened)).toThrow('この画面を開いたあとに、別のタブかウィンドウで（kato@example.ac.jp で）この年度の設定を保存しました。')
    gas.addMember('sensei@example.ac.jp', '先生')
    user = 'sensei@example.ac.jp'
    expect(() => gas.saveTeacherEdits(2026, { notices: {} }, opened)).toThrow('この画面を開いたあとに、ほかの人（kato@example.ac.jp）がこの年度の設定を保存しました。')
  })

  it('試験用サーバー（src/admin/serverRules.ts）は、保存の前の確かめとエラーの言葉が本番と同じ', () => {
    const gas = load('admin-project')
    /** 投げたエラーの言葉か、返した値（JSON） */
    const outcome = (fn: () => unknown) => {
      try {
        return JSON.stringify(fn())
      } catch (e) {
        return `エラー：${(e as Error).message}`
      }
    }
    const chapter = { type: 'chapter', title: '概要' }
    const templates: unknown[] = [
      'x',
      [],
      [chapter, { type: 'paragraph', hint: '' }, { type: 'materialTable', caption: '使用素材表', extra: 1 }],
      [{ type: 'chapter' }],
      [{ type: 'chapter', title: ' ' }],
      [{ type: 'paragraph', hint: '説明' }, chapter],
      [chapter, { type: 'figure', caption: 3 }],
      [chapter, { type: 'image', caption: '写真' }],
      [chapter, null],
      [chapter, { type: 'subheading', title: 'あ'.repeat(101) }],
      [chapter, { type: 'paragraph', hint: `  ${'い'.repeat(320)}` }],
      [chapter, { type: 'figure', caption: '図'.repeat(5) + 'x'.repeat(100) }],
      Array.from({ length: 101 }, () => chapter),
      // 改ページ・ふつうの表（mockups/v44）
      [chapter, { type: 'pageBreak', extra: 1 }, { type: 'table', caption: '寸法表', header: ['部位', ''], rows: 2, widths: 'custom', colWidths: [40, 60], heights: 'equal', labelColumn: false, extra: 1 }],
      [chapter, { type: 'table', caption: '表', header: [] }],
      [chapter, { type: 'table', caption: '表', header: ['a', 2] }],
      [chapter, { type: 'table', caption: '表', header: Array(7).fill('a') }],
      [chapter, { type: 'table', caption: '表', header: ['a', 'b'], rows: 10 }],
      [chapter, { type: 'table', caption: '表', header: ['a'], rows: 0 }],
      [chapter, { type: 'table', caption: '表', header: ['a'], colWidths: [1, 2] }],
      [chapter, { type: 'table', caption: '表', header: ['a'], colWidths: ['x'] }],
      [chapter, { type: 'table', caption: '表', header: ['あ'.repeat(101)] }],
      [chapter, { type: 'table', caption: '表', header: ['a'], widths: 'x' }],
      [chapter, { type: 'table', caption: '表', header: ['a'], heights: 'x' }],
      [chapter, { type: 'table', caption: '表', header: ['a'], labelColumn: 1 }],
      [chapter, { type: 'table', caption: ' ', header: ['a'] }],
      [chapter, { type: 'table', caption: 3, header: ['a'] }],
      [{ type: 'pageBreak' }, chapter],
      // 段落の書き出しの文（mockups/v70）
      [chapter, { type: 'paragraph', hint: '説明', text: '本報告書は、衣装の制作をまとめたものである。' }],
      [chapter, { type: 'paragraph', hint: '説明', text: '  ' }],
      [chapter, { type: 'paragraph', hint: '', text: 3 }],
      [chapter, { type: 'paragraph', hint: '', text: 'あ'.repeat(501) }],
    ]
    for (const t of templates) expect(outcome(() => rules.cleanTemplate(t, '衣装'))).toBe(outcome(() => gas.cleanTemplate_(t, '衣装')))
    const words: unknown[] = [
      'x',
      [{ wrong: ' 見頃 ', right: '身頃', note: '説明', severity: 'error' }, { wrong: '', right: '空' }, { wrong: '同じ', right: '同じ' }, { wrong: '記事', right: '生地', severity: 'what' }],
      [{ wrong: 1, right: '身頃' }],
      [null],
      [{ wrong: 'あ'.repeat(51), right: '身頃' }],
      [{ wrong: '見頃', right: '身頃', note: 'あ'.repeat(201) }],
      Array.from({ length: 301 }, () => ({ wrong: '見頃', right: '身頃' })),
    ]
    for (const w of words) expect(outcome(() => rules.cleanWords(w))).toBe(outcome(() => gas.cleanWords_(w)))
    const course = initialConfig.courses[0]
    const configs: unknown[] = [
      null,
      [],
      initialConfig,
      { ...initialConfig, fiscalYear: 20260 },
      { ...initialConfig, courses: 'x' },
      { ...initialConfig, courses: [{ ...course, advisors: [1] }] },
      { ...initialConfig, courses: [{ ...course, name: '', id: '' }] },
      { ...initialConfig, courses: [{ ...course, abstractExample: 'あ'.repeat(600) }] },
      { ...initialConfig, courses: [{ ...course, notice: 'あ'.repeat(1200) }] },
      { ...initialConfig, courses: [{ ...course, notice: 5 }] },
      { ...initialConfig, courses: [{ ...course, template: [{ type: 'paragraph' }] }] },
      { ...initialConfig, wordChecks: [{ wrong: 1 }] },
      { ...initialConfig, commonTitle: 'あ'.repeat(46000) },
      // 先生の許可（依頼者の選択 2026-11-04）
      { ...initialConfig, courses: [{ ...course, permission: { abstract: true, final: false } }] },
      { ...initialConfig, courses: [{ ...course, permission: { abstract: 'yes' } }] },
      { ...initialConfig, courses: [{ ...course, permission: [] }] },
      { ...initialConfig, courses: [{ ...course, permission: 'x' }] },
      // サブタイトルを使わないコース（依頼者の選択 2026-11-09）
      { ...initialConfig, courses: [{ ...course, noSubtitle: true }] },
      { ...initialConfig, courses: [{ ...course, noSubtitle: 'yes' }] },
      // 標準のひな形（管理者が詳細設定で直す：mockups/v116 案B）
      { ...initialConfig, standardTemplate: [{ type: 'chapter', title: '概要' }, { type: 'paragraph', hint: '概要を書く' }] },
      { ...initialConfig, standardTemplate: [{ type: 'chapter', title: '' }] },
      { ...initialConfig, standardTemplate: 'x' },
      { ...initialConfig, standardTemplate: null },
    ]
    for (const c of configs) expect(outcome(() => rules.checkConfig(c))).toBe(outcome(() => gas.checkConfig_(c)))
    expect(outcome(() => gas.checkConfig_({ ...initialConfig, standardTemplate: [{ type: 'chapter', title: '' }] }))).toContain('標準のひな形の')
    for (const p of [{ [course.id]: { abstract: true } }, { [course.id]: { abstract: false, final: false } }, { [course.id]: null }, { [course.id]: { final: 1 } }, { [course.id]: 'x' }, { nothing: { abstract: true } }]) {
      const a = JSON.parse(JSON.stringify(initialConfig))
      const b = JSON.parse(JSON.stringify(initialConfig))
      expect(outcome(() => rules.applyPermissions(a, p))).toBe(outcome(() => gas.applyPermissions_(b, p)))
      expect(a).toEqual(b)
    }
    for (const s of [{ [course.id]: true }, { [course.id]: false }, { [course.id]: 'x' }, { [course.id]: null }, { nothing: true }]) {
      const a = JSON.parse(JSON.stringify(initialConfig))
      const b = JSON.parse(JSON.stringify(initialConfig))
      expect(outcome(() => rules.applySubtitles(a, s))).toBe(outcome(() => gas.applySubtitles_(b, s)))
      expect(a).toEqual(b)
    }
    // コースのひな形・お知らせを書き換える（書き換えたあとの設定も同じ）
    const edits: [unknown, unknown][] = [
      [{ [course.id]: { template: [chapter], abstractExample: '本制作報告書は、' }, nothing: { template: [] } }, { [course.id]: 'お知らせ', nothing: 'x' }],
      [{ [course.id]: { template: [chapter], abstractExample: 'あ'.repeat(600) } }, { [course.id]: null }],
      [{ [course.id]: 'x' }, { [course.id]: 'あ'.repeat(1200) }],
      [{ [course.id]: { template: [chapter] } }, { [course.id]: 7 }],
    ]
    for (const [t, n] of edits) {
      const a = JSON.parse(JSON.stringify(initialConfig))
      const b = JSON.parse(JSON.stringify(initialConfig))
      expect(outcome(() => rules.applyTemplates(a, t as never))).toBe(outcome(() => gas.applyTemplates_(b, t)))
      expect(outcome(() => rules.applyNotices(a, n as never))).toBe(outcome(() => gas.applyNotices_(b, n)))
      expect(a).toEqual(b)
    }
    expect(rules.changedMessage('Kato@example.ac.jp', 'kato@example.ac.jp')).toBe(gas.changedMessage_('Kato@example.ac.jp', 'kato@example.ac.jp'))
    expect(rules.changedMessage('sensei@example.ac.jp', 'kato@example.ac.jp')).toBe(gas.changedMessage_('sensei@example.ac.jp', 'kato@example.ac.jp'))
    expect(rules.deletedMessage(2028)).toBe(gas.deletedMessage_(2028))
    expect(rules.removedMemberMessage('tanaka@example.ac.jp')).toBe(gas.removedMemberMessage_('tanaka@example.ac.jp'))
  })
})

describe('配信（api-project）', () => {
  it('公開中の年度設定を返す。準備中の年度は返さない', () => {
    const admin = load('admin-project')
    admin.setup()
    admin.createYear(2026, 2027)
    const api = load('api-project')
    const published = JSON.parse(api.doGet({ parameter: {} }).text)
    expect(published).toMatchObject({ ok: true, year: 2026, config: { fiscalYear: 2026 } })
    const draft = JSON.parse(api.doGet({ parameter: { year: '2027' } }).text)
    expect(draft.ok).toBe(false)
  })

  it('年度の指定は西暦4桁の数字だけ。それ以外は、シートを読まずに ok: false を返す', () => {
    load('admin-project').setup()
    const api = load('api-project')
    for (const year of ['abc', '20261', '', '2026 ', '=1+1', 'x'.repeat(300)]) {
      expect(JSON.parse(api.doGet({ parameter: { year } }).text)).toEqual({ ok: false, error: '年度の指定が正しくありません' })
    }
    expect(opened).toBe(0)
    expect(JSON.parse(api.doGet({ parameter: { year: '2026' } }).text)).toMatchObject({ ok: true, year: 2026 })
    expect(opened).toBe(1)
  })

  it('公開中の行が壊れていたら（設定の JSON の書き損じ）、止まらずに ok: false を返す（返事は1分控える）', () => {
    load('admin-project').setup()
    sheetRows('年度設定')[1][2] = '{壊れた JSON'
    const api = load('api-project')
    const body = JSON.parse(api.doGet({ parameter: {} }).text)
    expect(body).toEqual({ ok: false, error: '2026年度の設定が壊れていて読めません。管理者に知らせてください' })
    api.doGet({ parameter: {} })
    expect(opened).toBe(1)
    // 更新日時が読めないだけなら、設定は返す
    sheetRows('年度設定')[1][2] = JSON.stringify(initialConfig)
    sheetRows('年度設定')[1][3] = '日時ではない'
    expect(JSON.parse(load('api-project').doGet({ parameter: {} }).text)).toMatchObject({ ok: true, year: 2026, updatedAt: null })
  })

  it('公開中の年度がなければ ok: false を返す', () => {
    load('admin-project').setup()
    spreadsheet.getSheetByName('年度設定')!.rows[1][1] = '終了'
    const body = JSON.parse(load('api-project').doGet({ parameter: {} }).text)
    expect(body).toEqual({ ok: false, error: '公開中の年度設定がありません' })
  })
})

describe('PDF の控え（api-project の doPost）', () => {
  const CLIENT = 'client-1.apps.googleusercontent.com'
  /** ビルド時に入る値（フォルダ・OAuth クライアント ID・大学のドメイン） */
  const values = { PDF_FOLDER_ID: 'root-folder', CLIENT_ID: CLIENT, DOMAIN: 'example.ac.jp' }
  const FILM = initialConfig.courses[0]
  const pdfBase64 = (text = '1') => Buffer.from(`%PDF-1.4\n${text}\n%%EOF`).toString('base64')
  /** Google に確かめると、このツールのログインの許可（確かめ済みの大学のアドレス）と答えるトークン */
  const tokenOf = (email: string, info: Record<string, string> = {}) => {
    const token = `tok-${email}-${tokens.size}`
    tokens.set(token, { aud: CLIENT, azp: CLIENT, email, email_verified: 'true', expires_in: '3500', scope: 'openid email https://www.googleapis.com/auth/drive.file', ...info })
    return token
  }
  const request = (token: string, patch: Record<string, unknown> = {}) => ({ action: 'pdfCopy', token, year: 2026, courseId: FILM.id, studentId: '00ZZ0123', name: '文化　花子', pdf: pdfBase64(), ...patch })
  const post = (api: ReturnType<typeof load>, body: unknown) => JSON.parse(api.doPost({ postData: { type: 'text/plain', contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text)
  const setup = (options: Parameters<typeof load>[1] = { values }) => {
    load('admin-project').setup()
    return load('api-project', options)
  }

  it('フォルダが未設定なら、ログインも確かめずに「未設定」と返す（ドライブには何も置かない）', () => {
    const api = setup({ values: { CLIENT_ID: CLIENT, DOMAIN: 'example.ac.jp' } })
    const body = post(api, request(tokenOf('00zz0123@example.ac.jp')))
    expect(body.ok).toBe(false)
    expect(body.error).toContain('未設定')
    expect(fetched).toEqual([])
    expect(drive.pdfs()).toEqual([])
    // OAuth クライアント ID が未設定でも、送った人を確かめられないので断る
    expect(post(setup({ values: { PDF_FOLDER_ID: 'root-folder', DOMAIN: 'example.ac.jp' } }), request(tokenOf('00zz0123@example.ac.jp'))).error).toContain('未設定')
  })

  it('フォルダ・クライアント ID・ドメインは、スクリプト プロパティからでもよい', () => {
    const api = setup({ props: { PDF_FOLDER_ID: 'root-folder', GOOGLE_CLIENT_ID: CLIENT, GOOGLE_DOMAIN: 'example.ac.jp' } })
    expect(post(api, request(tokenOf('00zz0123@example.ac.jp')))).toEqual({ ok: true })
    expect(drive.pdfs()).toHaveLength(1)
  })

  it('送った人を Google に確かめる：期限切れ・ほかのツールのログイン・大学でないアカウント・確かめていないアドレスは断る', () => {
    const api = setup()
    const rejected = [
      'expired-token',
      tokenOf('00zz0123@example.ac.jp', { aud: 'other-client' }),
      tokenOf('00zz0123@example.ac.jp', { azp: 'other-client' }),
      tokenOf('00zz0123@gmail.com'),
      tokenOf('00zz0123@example.ac.jp.evil.com'),
      tokenOf('00zz0123@example.ac.jp', { email_verified: 'false' }),
      tokenOf('00zz0123@example.ac.jp', { expires_in: '0' }),
    ]
    for (const token of rejected) expect(post(api, request(token)).ok, token).toBe(false)
    // トークンは Google の確かめ（tokeninfo）にだけ渡す
    expect(fetched.every((url) => url.startsWith('https://oauth2.googleapis.com/tokeninfo?access_token='))).toBe(true)
    expect(fetched).toHaveLength(rejected.length)
    expect(drive.pdfs()).toEqual([])
    // 窓口の記録には、トークンを書かない
    expect(logs.some((l) => rejected.some((t) => l.includes(t)))).toBe(false)
  })

  it('学生：年度のフォルダの中にコースのフォルダを作り、提出の決まりと同じ「学籍番号_氏名（空白を詰める）.pdf」で置く。2回目からは同じファイルの新しい版（ファイルは1つ）', () => {
    const api = setup()
    const token = tokenOf('00zz0123@example.ac.jp')
    expect(post(api, request(token))).toEqual({ ok: true })
    // 年度 → コースの順（依頼者 2026-11-05：年度ごとに分ける）
    expect(drive.folders().map((f) => `${f.name}<${drive.nameOf(f.parents[0])}`)).toEqual(['2026年度<先生のフォルダ', `${FILM.name}<2026年度`])
    const [first] = drive.pdfs()
    expect(first).toMatchObject({ name: '00ZZ0123_文化花子.pdf', parents: [drive.folders()[1].id], appProperties: { reportKey: '2026:00ZZ0123' }, versions: 1 })
    expect(first.content).toContain('%PDF-1.4\n1\n')
    expect(first.description).toContain('送った人：00zz0123@example.ac.jp')
    // もう一度書き出した（氏名も直した）：同じファイルの中身を新しい版にし、名前も今のものにする
    expect(post(api, request(token, { name: '文化 花子子', pdf: pdfBase64('2') }))).toEqual({ ok: true })
    expect(drive.pdfs()).toHaveLength(1)
    expect(drive.pdfs()[0]).toMatchObject({ id: first.id, name: '00ZZ0123_文化花子子.pdf', versions: 2 })
    expect(drive.pdfs()[0].content).toContain('%PDF-1.4\n2\n')
    // 同じコースの別の学生：同じコースのフォルダに、別のファイル
    expect(post(api, request(tokenOf('00zz0456@example.ac.jp'), { studentId: '00zz0456', name: '衣装　次郎' }))).toEqual({ ok: true })
    expect(drive.folders()).toHaveLength(2)
    expect(drive.pdfs().map((f) => f.name)).toEqual(['00ZZ0123_文化花子子.pdf', '00ZZ0456_衣装次郎.pdf'])
  })

  it('学生のアカウントで、表紙の学籍番号が違えば断る（表紙が空なら、アカウントの学籍番号で置く）', () => {
    const api = setup()
    const token = tokenOf('00zz0123@example.ac.jp')
    expect(post(api, request(token, { studentId: '00ZZ0999' }))).toEqual({ ok: false, error: '表紙の学籍番号が、ログインしたアカウントと違います' })
    expect(drive.pdfs()).toEqual([])
    expect(post(api, request(token, { studentId: '', name: '' }))).toEqual({ ok: true })
    expect(drive.pdfs()[0].name).toBe('00ZZ0123.pdf')
  })

  it('学生のアドレスは「wu」＋学籍番号（提出ガイド）：先頭の wu を除いて学籍番号と比べ、学生のファイルとして置く', () => {
    const api = setup()
    const token = tokenOf('wu00zz0123@example.ac.jp')
    expect(post(api, request(token))).toEqual({ ok: true })
    expect(drive.pdfs()[0]).toMatchObject({ name: '00ZZ0123_文化花子.pdf', appProperties: { reportKey: '2026:00ZZ0123' } })
    expect(post(api, request(token, { studentId: '00ZZ0999' }))).toEqual({ ok: false, error: '表紙の学籍番号が、ログインしたアカウントと違います' })
  })

  it('教職員のアカウント（学籍番号の形でない）は、見本の原稿で試せる。学生のファイルとは別のファイルで、説明に送った人のアドレス', () => {
    const api = setup()
    post(api, request(tokenOf('00zz0123@example.ac.jp')))
    expect(post(api, request(tokenOf('Sensei.A@Example.ac.jp'), { name: '見本　花子', pdf: pdfBase64('staff') }))).toEqual({ ok: true })
    const [student, staff] = drive.pdfs()
    expect(student.content).toContain('\n1\n')
    expect(student.versions).toBe(1)
    expect(staff).toMatchObject({ name: '試し_00ZZ0123_見本花子.pdf', appProperties: { reportKey: '2026:staff:sensei.a@example.ac.jp' } })
    expect(staff.description).toContain('送った人：sensei.a@example.ac.jp')
  })

  it('教職員の試しの控えは、頭に「試し_」。先に試しの控えがあっても、同じ表紙の学生は自分のファイルを作る（試しの控えを取らない）', () => {
    const api = setup()
    expect(post(api, request(tokenOf('sensei.a@example.ac.jp')))).toEqual({ ok: true })
    expect(post(api, request(tokenOf('00zz0123@example.ac.jp')))).toEqual({ ok: true })
    expect(drive.pdfs().map((f) => `${f.name}|${f.appProperties?.reportKey}|${f.versions}`)).toEqual(['試し_00ZZ0123_文化花子.pdf|2026:staff:sensei.a@example.ac.jp|1', '00ZZ0123_文化花子.pdf|2026:00ZZ0123|1'])
  })

  it('学籍番号も氏名も空なら（教職員の試し）、報告書の名前（年度の設定の reportName）。教職員が直して送り直すと、同じファイルを今の名前にする', () => {
    const api = setup()
    sheetRows('年度設定')[1][2] = JSON.stringify({ ...initialConfig, reportName: '卒業研究報告書' })
    const token = tokenOf('sensei.a@example.ac.jp')
    expect(post(api, request(token, { studentId: '', name: '' }))).toEqual({ ok: true })
    expect(drive.pdfs()[0].name).toBe('試し_卒業研究報告書.pdf')
    expect(post(api, request(token, { studentId: '', name: '見本 花子' }))).toEqual({ ok: true })
    expect(drive.pdfs()).toHaveLength(1)
    expect(drive.pdfs()[0]).toMatchObject({ name: '試し_見本花子.pdf', versions: 2 })
  })

  it('前の形の名前（氏名_学籍番号_年度卒業制作報告書.pdf）で置いた控えも、印（reportKey）で見つけて新しい版にし、今の名前に直す（ファイルは1つのまま）', () => {
    const api = setup()
    const yearFolder = drive.api.Files.create({ name: '2026年度', mimeType: FOLDER, parents: ['root-folder'] }, null)
    const course = drive.api.Files.create({ name: FILM.name, mimeType: FOLDER, parents: [yearFolder.id] }, null)
    const old = drive.api.Files.create({ name: '文化花子_00ZZ0123_2026年度卒業制作報告書.pdf', mimeType: 'application/pdf', parents: [course.id], appProperties: { reportKey: '2026:00ZZ0123' } }, { bytes: [...Buffer.from('%PDF-old')] })
    expect(post(api, request(tokenOf('00zz0123@example.ac.jp')))).toEqual({ ok: true })
    expect(drive.pdfs()).toHaveLength(1)
    expect(drive.pdfs()[0]).toMatchObject({ id: old.id, name: '00ZZ0123_文化花子.pdf', versions: 2 })
  })

  it('PDF でない中身・形の正しくない内容・大きすぎる中身は断る（Google にも確かめない）', () => {
    const api = setup()
    const token = tokenOf('00zz0123@example.ac.jp')
    const before = fetched.length
    expect(post(api, request(token, { pdf: Buffer.from('<html>not a pdf</html>').toString('base64') }))).toEqual({ ok: false, error: '送られたファイルが PDF ではありません' })
    expect(post(api, request(token, { pdf: '%PDF-1.4 base64 ではない' }))).toEqual({ ok: false, error: '送られたファイルが PDF ではありません' })
    expect(post(api, request(token, { pdf: '' })).ok).toBe(false)
    for (const patch of [{ year: '20x6' }, { year: 20261 }, { pdf: 5 }, { token: '' }, { name: 'あ'.repeat(101) }, { courseId: { id: 'x' } }]) expect(post(api, request(token, patch)), JSON.stringify(patch)).toMatchObject({ ok: false, error: '送られた内容の形が正しくありません' })
    expect(post(api, 'JSON ではない')).toEqual({ ok: false, error: '知らない操作です' })
    expect(post(api, { action: 'other' })).toEqual({ ok: false, error: '知らない操作です' })
    // 40MB を超える PDF（base64 の文字数で、読む前に断る）
    const limit = Math.ceil((40 * 1024 * 1024) / 3) * 4
    expect(post(api, request(token, { pdf: 'A'.repeat(limit + 4) }))).toEqual({ ok: false, error: 'PDF が大きすぎます（40MB まで）' })
    expect(post(api, 'A'.repeat(limit + 200_000))).toEqual({ ok: false, error: 'PDF が大きすぎます（40MB まで）' })
    expect(fetched.length).toBe(before)
    expect(drive.pdfs()).toEqual([])
  })

  it('コースを変えた学生のファイルは、新しいコースのフォルダへ移す（ファイルは1つのまま）。コースが分からなければ「コース未設定」', () => {
    const api = setup()
    // 2つめのコースがある年度
    const other = { ...FILM, id: 'stylist', name: 'スタイリスト・コーディネーター' }
    sheetRows('年度設定')[1][2] = JSON.stringify({ ...initialConfig, courses: [FILM, other] })
    const token = tokenOf('00zz0123@example.ac.jp')
    post(api, request(token))
    expect(post(api, request(token, { courseId: other.id }))).toEqual({ ok: true })
    expect(drive.pdfs()).toHaveLength(1)
    expect(drive.nameOf(drive.pdfs()[0].parents[0])).toBe(other.name)
    expect(drive.pdfs()[0].parents).toHaveLength(1)
    post(api, request(token, { courseId: 'no-such-course' }))
    expect(drive.nameOf(drive.pdfs()[0].parents[0])).toBe('コース未設定')
    expect(drive.folders().map((f) => f.name).sort()).toEqual(['2026年度', FILM.name, other.name, 'コース未設定'].sort())
  })

  it('同じ名前のファイルが前からあれば（印がない）、そのファイルを新しい版にする。フォルダが見つからなければ、くわしいこと（ID）は返さない', () => {
    const api = setup()
    const yearFolder = drive.api.Files.create({ name: '2026年度', mimeType: FOLDER, parents: ['root-folder'] }, null)
    const course = drive.api.Files.create({ name: FILM.name, mimeType: FOLDER, parents: [yearFolder.id] }, null)
    drive.api.Files.create({ name: '00ZZ0123_文化花子.pdf', mimeType: 'application/pdf', parents: [course.id] }, { bytes: [...Buffer.from('%PDF-old')] })
    expect(post(api, request(tokenOf('00zz0123@example.ac.jp')))).toEqual({ ok: true })
    expect(drive.pdfs()).toHaveLength(1)
    expect(drive.pdfs()[0]).toMatchObject({ versions: 2, appProperties: { reportKey: '2026:00ZZ0123' } })
    // フォルダが消えていた
    drive.items.delete('root-folder')
    const body = post(api, request(tokenOf('00zz0123@example.ac.jp')))
    expect(body).toEqual({ ok: false, error: 'PDF の控えを保存できませんでした（ドライブのエラー）' })
    expect(JSON.stringify(body)).not.toContain('root-folder')
  })

  it('もとのフォルダは管理ページ（詳細設定。管理者だけ）で変えられる：変えると、控えは新しいフォルダの年度・コースに入る。リンクでない・開けない・編集できないフォルダは断る（mockups/v112 案A）', () => {
    const api = setup()
    const admin = load('admin-project', { values: { PDF_FOLDER_ID: 'root-folder' } })
    // はじめは、配るときに入れたフォルダ
    expect(admin.getPdfFolder()).toMatchObject({ id: 'root-folder', name: '先生のフォルダ', url: 'https://drive.google.com/drive/folders/root-folder' })
    const folder = (id: string, name: string, more: Partial<DriveItem> = {}) => drive.items.set(id, { id, name, mimeType: FOLDER, parents: ['my-drive'], trashed: false, versions: 0, ...more })
    folder('new-folder-0123456789', '新しい控え')
    folder('view-folder-0123456789', '見るだけ', { viewOnly: true })
    expect(() => admin.setPdfFolder('メモ')).toThrow(/フォルダのリンクを貼ってください/)
    expect(() => admin.setPdfFolder('https://drive.google.com/drive/folders/no-such-folder-0123')).toThrow(/そのフォルダを開けません/)
    expect(() => admin.setPdfFolder('https://drive.google.com/drive/folders/view-folder-0123456789')).toThrow(/そのフォルダを編集できません/)
    user = 'sensei@example.ac.jp'
    expect(() => admin.setPdfFolder('https://drive.google.com/drive/folders/new-folder-0123456789')).toThrow(/管理者だけ/)
    user = 'kato@example.ac.jp'
    expect(admin.setPdfFolder('https://drive.google.com/drive/folders/new-folder-0123456789?usp=sharing')).toMatchObject({ id: 'new-folder-0123456789', name: '新しい控え' })
    expect(sheetRows('設定')[1].slice(0, 2)).toEqual(['PDF の控えのフォルダ', 'new-folder-0123456789'])
    expect(sheetRows('変更履歴').some((r) => r[3] === 'PDF の控えのフォルダを変更：新しい控え')).toBe(true)
    // 配信の窓口：これからの控えは、新しいフォルダの年度・コースに入る
    expect(post(api, request(tokenOf('00zz0123@example.ac.jp')))).toEqual({ ok: true })
    const course = drive.items.get(drive.pdfs()[0].parents[0])!
    const year = drive.items.get(course.parents[0])!
    expect([year.parents[0], year.name, course.name]).toEqual(['new-folder-0123456789', '2026年度', FILM.name])
  })

  it('authorizePdfCopy（エディタで1回実行して承認する）：スプレッドシートを読み、外部につなぎ、フォルダの名前を出す（未設定なら、そう出す）', () => {
    const api = setup()
    api.authorizePdfCopy()
    expect(logs).toContain('PDF の控えを置くフォルダ：先生のフォルダ')
    expect(logs.some((l) => l.startsWith('読み込めました'))).toBe(true)
    expect(fetched).toHaveLength(1)
    logs = []
    setup({ values: { CLIENT_ID: CLIENT, DOMAIN: 'example.ac.jp' } }).authorizePdfCopy()
    expect(logs.some((l) => l.includes('未設定'))).toBe(true)
    // フォルダでないもの（ファイル）の ID なら知らせる
    drive.items.set('a-file', { id: 'a-file', name: 'x.pdf', mimeType: 'application/pdf', parents: [], trashed: false, versions: 1 })
    expect(() => setup({ values: { ...values, PDF_FOLDER_ID: 'a-file' } }).authorizePdfCopy()).toThrow(/フォルダではありません/)
  })

  it('年度設定の配信（doGet）は今までどおり', () => {
    const api = setup()
    expect(JSON.parse(api.doGet({ parameter: {} }).text)).toMatchObject({ ok: true, year: 2026 })
  })
})

describe('届いた声（api-project の doPost・admin-project の一覧と状態）', () => {
  const CLIENT = 'client-1.apps.googleusercontent.com'
  const values = { PDF_FOLDER_ID: 'root-folder', CLIENT_ID: CLIENT, DOMAIN: 'example.ac.jp' }
  const FILM = initialConfig.courses[0]
  const tokenOf = (email: string) => {
    const token = `tok-${email}-${tokens.size}`
    tokens.set(token, { aud: CLIENT, azp: CLIENT, email, email_verified: 'true', expires_in: '3500' })
    return token
  }
  const post = (api: ReturnType<typeof load>, body: unknown) => JSON.parse(api.doPost({ postData: { type: 'text/plain', contents: JSON.stringify(body) } }).text)
  const voice = (patch: Record<string, unknown> = {}) => ({
    action: 'feedback',
    kind: 'うまく動かない',
    text: '表の写真を入れると、カーソルが下のマスに出る',
    version: 'abc1234',
    device: 'パソコン・Chrome',
    page: '本文 3',
    notice: '選んだ文を削除しました',
    errors: ['TypeError: x is undefined'],
    year: 2026,
    courseId: FILM.id,
    studentId: '00ZZ0123',
    name: '文化　花子',
    ...patch,
  })
  const setup = () => {
    load('admin-project').setup()
    return load('api-project', { values })
  }

  it('受け付けて、シート「届いた声」に残し、受付番号と鍵を返す（配信の窓口はメールを送らない）。トークンは残さない。管理ページが新しい声を管理者にまとめて知らせる（先生には送らない・1回だけ）', () => {
    const api = setup()
    load('admin-project').addMember('teacher@example.ac.jp', '先生', '')
    const token = tokenOf('wu00zz0123@example.ac.jp')
    const body = post(api, voice({ token }))
    expect(body).toMatchObject({ ok: true, id: '1019-001' })
    expect(body.key).toMatch(/^[0-9a-f]{20}$/)
    const rows = sheetRows('届いた声')
    expect(rows[0][0]).toBe('受付番号')
    expect(rows[1].slice(0, 16)).toEqual(['1019-001', body.key, '2026-10-19 12:00', 'うまく動かない', '表の写真を入れると、カーソルが下のマスに出る', 'wu00zz0123@example.ac.jp', '00ZZ0123', '文化　花子', FILM.name, 'abc1234', 'パソコン・Chrome', '本文 3', '選んだ文を削除しました', 'TypeError: x is undefined', '', '受け付けた'])
    expect(JSON.stringify(rows)).not.toContain(token)
    expect(mails).toHaveLength(0)
    // 2件目は通し番号が増える
    expect(post(api, voice({ token })).id).toBe('1019-002')
    // 管理ページの仕掛け（10分ごと）：新しい2件を、管理者に1通で知らせ、知らせた日時を書く。もう一度動いても送らない
    load('admin-project').notifyNewFeedback()
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('kato@example.ac.jp')
    expect(mails[0].subject).toContain('1019-001・1019-002')
    expect(mails[0].body).toContain('表の写真を入れると')
    expect(sheetRows('届いた声').slice(1).map((r) => r[20])).toEqual(['2026-10-19 12:00', '2026-10-19 12:00'])
    load('admin-project').notifyNewFeedback()
    expect(mails).toHaveLength(1)
  })

  it('スクリプト プロパティ FEEDBACK_MAIL_TO の宛先にも、管理者への知らせを送る（重なりは1つに・形の違うものは除く）', () => {
    const api = setup()
    post(api, voice())
    load('admin-project', { props: { FEEDBACK_MAIL_TO: 'home@example.jp、kato@example.ac.jp, ちがう' } }).notifyNewFeedback()
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('kato@example.ac.jp,home@example.jp')
  })

  it('メールには、公開中の管理ページの場所（ビルドで入れたもの）を書く。シートが日付に読み替えた受付の日時は、読める形にする', () => {
    const api = setup()
    post(api, voice())
    sheetRows('届いた声')[1][2] = new Date(2026, 9, 19, 12, 0)
    load('admin-project', { values: { ADMIN_URL: 'https://script.google.com/a/macros/example.ac.jp/s/deployed/exec' } }).notifyNewFeedback()
    expect(mails[0].body).toContain('状態を変えられます：https://script.google.com/a/macros/example.ac.jp/s/deployed/exec')
    expect(mails[0].body).toContain('1019-001（うまく動かない）2026-10-19 12:00')
    expect(mails[0].body).not.toContain('GMT')
  })

  it('ログインなしでも受け付ける（アドレスは空）。形が正しくないもの・中身が空のものは断る', () => {
    const api = setup()
    expect(post(api, voice()).ok).toBe(true)
    expect(sheetRows('届いた声')[1][5]).toBe('')
    for (const bad of [voice({ kind: 'ちがう' }), voice({ text: '   ' }), voice({ text: 'x'.repeat(2001) }), voice({ screen: '%%%' })]) expect(post(api, bad).ok).toBe(false)
  })

  it('画面の写真は、PDF の控えのフォルダの中の「届いた声の画面」に置き、シートにはリンクを書く', () => {
    const api = setup()
    const body = post(api, voice({ screen: Buffer.from('jpeg-bytes').toString('base64') }))
    expect(body.ok).toBe(true)
    expect(drive.folders().map((f) => f.name)).toEqual(['届いた声の画面'])
    const link = String(sheetRows('届いた声')[1][14])
    expect(link).toMatch(/^https:\/\/drive\.google\.com\/file\/d\/d\d+\/view$/)
  })

  it('状態の問い合わせ：鍵が合うものだけ答える。管理ページで「直しました」にして知らせると、学生にメールが届き、状態とひとことが返る', () => {
    const api = setup()
    const body = post(api, voice({ token: tokenOf('wu00zz0123@example.ac.jp') }))
    expect(post(api, { action: 'feedbackStatus', items: [{ id: body.id, key: 'wrong' }] }).items).toEqual([])
    expect(post(api, { action: 'feedbackStatus', items: [{ id: body.id, key: body.key }] }).items).toEqual([{ id: body.id, status: '受け付けた', reply: '', changedAt: '' }])
    const admin = load('admin-project')
    expect(admin.getFeedback().map((f: { id: string }) => f.id)).toEqual([body.id])
    expect(JSON.stringify(admin.getFeedback())).not.toContain(body.key)
    mails.length = 0
    const list = admin.updateFeedback(body.id, '直しました', '', '表の画像の直し（77265c2）', true)
    expect(list[0]).toMatchObject({ status: '直しました', memo: '表の画像の直し（77265c2）', changedAt: '2026-10-19 12:00', notifiedAt: '2026-10-19 12:00' })
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('wu00zz0123@example.ac.jp')
    expect(mails[0].body).toContain('受付番号 1019-001')
    expect(mails[0].body).toContain('直しました')
    expect(post(api, { action: 'feedbackStatus', items: [{ id: body.id, key: body.key }] }).items).toEqual([{ id: body.id, status: '直しました', reply: '', changedAt: '2026-10-19 12:00' }])
    // 「確かめ中」は知らせない（メールも送らない）
    mails.length = 0
    admin.updateFeedback(body.id, '確かめ中', '', '', true)
    expect(mails).toHaveLength(0)
  })

  it('管理ページの届いた声は、登録された先生も見て変えられる。登録されていない人は使えない', () => {
    const api = setup()
    post(api, voice())
    load('admin-project').addMember('teacher@example.ac.jp', '先生', '')
    user = 'teacher@example.ac.jp'
    expect(load('admin-project').getFeedback()).toHaveLength(1)
    user = 'stranger@example.ac.jp'
    expect(() => load('admin-project').getFeedback()).toThrow('登録された先生だけ')
    expect(() => load('admin-project').updateFeedback('1019-001', '直しました', '', '', false)).toThrow('登録された先生だけ')
  })

  it('エラーの記録：シート「エラーの記録」に残す。同じエラーは続けて残さない', () => {
    const api = setup()
    const log = { action: 'errorLog', version: 'abc1234', device: 'スマホ・Safari', page: '抄録', message: 'TypeError: a is null', stack: 'at f (x.js:1)' }
    expect(post(api, log)).toEqual({ ok: true })
    expect(post(api, log)).toEqual({ ok: true, skipped: true })
    expect(post(api, { ...log, message: 'RangeError: b' })).toEqual({ ok: true })
    expect(sheetRows('エラーの記録').map((r) => r[4])).toEqual(['エラー', 'TypeError: a is null', 'RangeError: b'])
    expect(post(api, { ...log, message: '' }).ok).toBe(false)
  })
})

describe('先生の許可の仕組み（学生の名簿・点検表。docs/設計_許可の仕組み.md）', () => {
  const CLIENT = 'client-1.apps.googleusercontent.com'
  const FILM = initialConfig.courses[0]
  const TOP_NOTE = '⚠ 並びを直すときは、管理ページの「コースごとの設定」→「学生の並びを直す」から（灰色の列はツールが書きます）\n✎ 青い見出しの列（点検の回）は、コースごとに名前を変えたり、列を足したり消したりできます'
  const OLD_TOP_NOTE = '並びを直すときは、管理ページの「コースごとの設定」→「学生の並びを直す」から（灰色の列はツールが書きます）'
  const PROTECT_NOTE = 'ツールが書く列です（並べ替えは管理ページの「学生の並びを直す」から）'
  /** 学生（名前はすべて作り物）：姓・名・セイ・メイ */
  const PEOPLE: [string, string, string, string][] = [
    ['青木', '美咲', 'アオキ', 'ミサキ'], ['石田', '遥', 'イシダ', 'ハルカ'], ['上野', '空', 'ウエノ', 'ソラ'], ['遠藤', '莉子', 'エンドウ', 'リコ'], ['太田', '結衣', 'オオタ', 'ユイ'],
    ['金子', '奈々', 'カネコ', 'ナナ'], ['木村', '葵', 'キムラ', 'アオイ'], ['久保', '芽依', 'クボ', 'メイ'], ['小林', '陽菜', 'コバヤシ', 'ヒナ'], ['斎藤', '美緒', 'サイトウ', 'ミオ'],
    ['清水', '楓', 'シミズ', 'カエデ'], ['鈴木', '彩花', 'スズキ', 'アヤカ'], ['瀬川', '真央', 'セガワ', 'マオ'], ['高橋', '咲良', 'タカハシ', 'サクラ'], ['千葉', '千尋', 'チバ', 'チヒロ'],
    ['塚本', '七海', 'ツカモト', 'ナナミ'], ['寺田', '優花', 'テラダ', 'ユウカ'], ['中島', '菜摘', 'ナカジマ', 'ナツミ'], ['西村', '里奈', 'ニシムラ', 'リナ'], ['野口', '杏', 'ノグチ', 'アン'],
    ['長谷川', '舞', 'ハセガワ', 'マイ'], ['平野', '凛', 'ヒラノ', 'リン'], ['福田', '紗希', 'フクダ', 'サキ'], ['星野', '桃子', 'ホシノ', 'モモコ'], ['前田', '和花', 'マエダ', 'ノドカ'],
    ['三浦', '未来', 'ミウラ', 'ミライ'],
  ]
  const idOf = (i: number) => `00ZZ${String(100 + i).padStart(4, '0')}`
  const nameOf = (i: number) => `${PEOPLE[i][0]}　${PEOPLE[i][1]}`
  const mailOf = (i: number) => `${idOf(i).toLowerCase()}@example.ac.jp`
  const tokenOf = (email: string) => {
    const token = `tok-${email}-${tokens.size}`
    tokens.set(token, { aud: CLIENT, azp: CLIENT, email, email_verified: 'true', expires_in: '3500' })
    return token
  }
  const post = (api: ReturnType<typeof load>, body: unknown) => JSON.parse(api.doPost({ postData: { type: 'text/plain', contents: JSON.stringify(body) } }).text)
  const api = () => load('api-project', { values: { PDF_FOLDER_ID: 'root-folder', CLIENT_ID: CLIENT, DOMAIN: 'example.ac.jp' } })
  const admin = () => load('admin-project', { values: { PDF_FOLDER_ID: 'root-folder' } })
  /** 管理ページの準備と、先生（登録のメモに指導教員の名前）を登録 */
  const setup = () => {
    admin().setup()
    admin().addMember('sensei@example.ac.jp', '先生', '梶田　貴子（衣装）')
    return api()
  }
  const registerBody = (i: number, patch: Record<string, unknown> = {}) => ({
    action: 'register',
    token: tokenOf(mailOf(i)),
    year: 2026,
    courseId: FILM.id,
    studentId: idOf(i),
    familyName: PEOPLE[i][0],
    givenName: PEOPLE[i][1],
    familyKana: PEOPLE[i][2],
    givenKana: PEOPLE[i][3],
    ...patch,
  })
  const register = (a: ReturnType<typeof load>, i: number, patch: Record<string, unknown> = {}) => post(a, registerBody(i, patch))
  const status = (a: ReturnType<typeof load>, i: number) => post(a, { action: 'checkStatus', token: tokenOf(mailOf(i)), year: 2026, studentId: idOf(i) })
  const roster = () => sheetRows('学生の名簿')
  const rosterOf = (i: number) => roster().find((r) => r[2] === idOf(i))!
  const book = () => books.get(String(sheetRows('点検表')[1][2]))!
  const tab = () => book().getSheetByName('点検表')!
  const norm = (v: unknown) => String(v ?? '').replace(/\s/g, '')
  /** 点検表の見出しの行（0 から）・見出しの名前・段の始まりの列 */
  const layoutOf = () => {
    const rows = tab().rows
    const h = rows.findIndex((r) => r.some((v) => norm(v) === '番号'))
    const header = rows[h].map(norm)
    const starts = header.flatMap((n, i) => (n === '番号' ? [i] : []))
    return { h, header, starts }
  }
  /** 点検表の学生の行（学籍番号 → 段・行（0 から）・見出しの名前ごとの中身） */
  const sheetStudents = () => {
    const { h, header, starts } = layoutOf()
    const rows = tab().rows
    const out: Record<string, { block: number; row: number; col: (name: string) => number; cells: Record<string, Cell> }> = {}
    starts.forEach((start, b) => {
      const end = b + 1 < starts.length ? starts[b + 1] : header.length
      const col = (name: string) => header.indexOf(name, start)
      for (let r = h + 1; r < rows.length; r++) {
        const key = rows[r]?.[col('学籍番号')]
        if (!key) continue
        const cells: Record<string, Cell> = {}
        for (let c = start; c < end; c++) if (header[c]) cells[header[c]] = rows[r][c] ?? ''
        out[String(key)] = { block: b, row: r, col, cells }
      }
    })
    return out
  }
  /** 先生が点検表のセルに書いた（画面で） */
  const setCell = (key: string, name: string, value: Cell) => {
    const s = sheetStudents()[key]
    tab().rows[s.row][s.col(name)] = value
    return { row: s.row, col: s.col(name) }
  }
  /** 点検表の編集の仕掛け（先生が画面で1つのセルを変えた） */
  const edit = (key: string, name: string, value: Cell, email = 'sensei@example.ac.jp') => {
    const at = setCell(key, name, value)
    admin().onCheckSheetEdit({ range: tab().getRange(at.row + 1, at.col + 1), source: book(), user: { getEmail: () => email } })
  }
  /** 日本の時刻の「月/日」 */
  const md = (d: Date) => {
    const j = new Date(d.getTime() + 9 * 3600 * 1000)
    return `${j.getUTCMonth() + 1}/${j.getUTCDate()}`
  }

  it('並びの崩れていない行を「並びが崩れています」にしない（依頼者の試し 2026-11-04）：教職員の試しの「（試し）」・氏名の書き方の違い・名簿の氏名を直した直後。ほかの学生の氏名が見えている行だけが崩れた行', () => {
    // 依頼者の試しと同じ値：教職員のアカウント（管理者）で学生のツールから登録 → 点検表を開く → 学生の並びの窓 → 回を選ぶ → また開く
    user = 'jun-kato@example.ac.jp'
    owner = user
    const a = setup()
    const key = 'staff:jun-kato@example.ac.jp'
    const staff = { ...registerBody(0, { familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ', studentId: '00ZZ0123' }), token: tokenOf('jun-kato@example.ac.jp') }
    const staffStatus = () => post(api(), { action: 'checkStatus', token: tokenOf('jun-kato@example.ac.jp'), year: 2026, studentId: '00ZZ0123' })
    expect(post(a, staff)).toEqual({ ok: true })
    expect(roster()[1].slice(0, 11)).toEqual([2026, FILM.id, key, '文化', '花子', 'ブンカ', 'ハナコ', '', '', '', ''])
    admin().ensureCheckSheet(2026, FILM.id)
    const { h } = layoutOf()
    expect(tab().rows[h + 1].slice(0, 13)).toEqual([1, '（試し）文化　花子', '', '', '', '', '', '', false, false, false, 'PDF まだ', key])
    admin().listStudents(2026, FILM.id)
    for (const [round, value] of [['1回目', '梶田 予定'], ['2回目', '佐藤 予定'], ['3回目', '加藤 予定']]) edit(key, round, value, 'jun-kato@example.ac.jp')
    expect(post(a, staff)).toEqual({ ok: true })
    admin().ensureCheckSheet(2026, FILM.id)
    admin().syncCheckSheets()
    expect(sheetStudents()[key].cells).toMatchObject({ 氏名: '（試し）文化　花子', '1回目': '梶田 予定', 知らせ: 'PDF まだ' })
    expect(staffStatus().row.rounds[0]).toEqual({ label: '1回目', teacher: '梶田', state: 'plan' })
    // 見える氏名が、書き方だけ違う・（試し）がない・名簿を直す前の古い氏名・だれの氏名でもない：崩れたとはみなさず、氏名を書き直す
    for (const shown of ["'（試し）文化　花子", '(試し) 文化 花子', '文化　花子', '（試し）文化　花', '見本　太郎']) {
      setCell(key, '氏名', shown)
      admin().syncCheckSheets()
      expect(sheetStudents()[key].cells, shown).toMatchObject({ 氏名: '（試し）文化　花子', 知らせ: 'PDF まだ', '1回目': '梶田 予定' })
    }
    // 書き方の違いだけなら、学生のツールへの答えも出す（字の幅・空白・（試し））
    setCell(key, '氏名', '(試し) 文化 花子')
    expect(staffStatus().row).not.toBeNull()
    // ✓ を入れるときも同じ（古い氏名のままでも、並びが崩れたとはみなさず、記録を残す）
    setCell(key, '氏名', '（試し）文化　花')
    edit(key, '抄録許可', true, 'jun-kato@example.ac.jp')
    expect(sheetStudents()[key].cells.知らせ).toBe('PDF まだ')
    expect(String(sheetStudents()[key].cells.抄録許可の記録)).toMatch(/ \/ jun-kato$/)
    // 学生のツールへは、写して氏名がそろってから（古い氏名の間は、許可を渡さない）
    expect(staffStatus().row).toBeNull()
    admin().syncCheckSheets()
    expect(staffStatus().row.abstractOk.by).toBe('jun-kato')
    // ほかの学生（石田 遥）の氏名が見えている行だけは、並びが崩れた行（今までどおり）
    register(a, 1)
    admin().syncCheckSheets()
    setCell(key, '氏名', '石田　遥')
    expect(staffStatus().row).toBeNull()
    admin().syncCheckSheets()
    expect(sheetStudents()[key].cells).toMatchObject({ 氏名: '（試し）文化　花子', 知らせ: '並びが崩れています' })
    expect(logs.some((l) => l.includes('並びが崩れています') && l.includes(key))).toBe(true)
    // 名字・名前を比べる形
    const g = admin()
    expect(["'（試し）文化　花子", '(試し) 文化 花子', '文化花子', 'ﾌﾞﾝｶ'].map((n) => g.nameKey_(n))).toEqual(['文化花子', '文化花子', '文化花子', 'ブンカ'])
  })

  it('register：学生の名簿に入れる・直す（年度と学籍番号で1行）。形の正しくないもの・ほかの学生の学籍番号は断る。教職員の試しは別の行', () => {
    const a = setup()
    expect(register(a, 0)).toEqual({ ok: true })
    expect(roster()[0]).toEqual(['年度', 'コース', '学籍番号', '姓', '名', 'セイ', 'メイ', '並び', 'PDF の ID', 'PDF の日時', '書き換え日時', '更新日時', '所属', '所属の日時'])
    expect(rosterOf(0).slice(0, 8)).toEqual([2026, FILM.id, '00ZZ0100', '青木', '美咲', 'アオキ', 'ミサキ', ''])
    expect(rosterOf(0)[11]).toBeInstanceOf(Date)
    // 直す：同じ行（「wu」＋学籍番号のアドレスも同じ学生）
    expect(post(a, { ...registerBody(0, { givenName: '美咲子', givenKana: 'ミサコ' }), token: tokenOf('wu00zz0100@example.ac.jp') })).toEqual({ ok: true })
    expect(roster()).toHaveLength(2)
    expect(rosterOf(0).slice(3, 7)).toEqual(['青木', '美咲子', 'アオキ', 'ミサコ'])
    // 断る（名簿は変えない）
    const bad: [Record<string, unknown>, RegExp][] = [
      [{ studentId: idOf(1) }, /学籍番号が、ログインしたアカウントと違います/],
      [{ courseId: 'no-such' }, /コース/],
      [{ familyName: 'あ'.repeat(51) }, /形が正しくありません/],
      [{ familyKana: 5 }, /形が正しくありません/],
      [{ familyName: ' ', givenName: '' }, /氏名が空です/],
      [{ year: '20x6' }, /形が正しくありません/],
      [{ token: 'expired-token' }, /ログインを確かめられません/],
    ]
    for (const [patch, error] of bad) expect(register(a, 0, patch).error, JSON.stringify(patch)).toMatch(error)
    expect(roster()).toHaveLength(2)
    // 数式のような氏名も、文字として書く
    expect(register(a, 1, { familyName: '=IMPORTXML("x")' })).toEqual({ ok: true })
    expect(rosterOf(1)[3]).toBe('=IMPORTXML("x")')
    expect(spreadsheet.getSheetByName('学生の名簿')!.formulas).toEqual([])
    // 教職員のアカウント：学生の学籍番号を書いても、学生の行は書き換えず、「staff:アドレス」の行
    expect(post(a, { ...registerBody(0, { familyName: '見本', givenName: '花子' }), token: tokenOf('sensei@example.ac.jp') })).toEqual({ ok: true })
    expect(rosterOf(0)[3]).toBe('青木')
    expect(roster().find((r) => r[2] === 'staff:sensei@example.ac.jp')!.slice(3, 5)).toEqual(['見本', '花子'])
  })

  it('ensureCheckSheet：PDF の控えの年度・コースのフォルダに点検表を作り、ID を覚え、編集の仕掛けを付けて名簿から写す（上に案内の1行。2回目は同じ点検表）', () => {
    const a = setup()
    for (const i of [3, 0, 1]) register(a, i)
    user = 'sensei@example.ac.jp'
    const result = admin().ensureCheckSheet(2026, FILM.id)
    const id = String(sheetRows('点検表')[1][2])
    expect(sheetRows('点検表')[0]).toEqual(['年度', 'コース', 'スプレッドシートの ID'])
    expect(sheetRows('点検表')[1].slice(0, 2)).toEqual([2026, FILM.id])
    expect(result).toEqual({ url: `https://docs.google.com/spreadsheets/d/${id}/edit` })
    expect(book().name).toBe('2026年度 点検表（映画・舞台衣装デザイナー コース）')
    // 置き場所：PDF の控えのフォルダの中の、年度のフォルダの中の、コースのフォルダ（PDF の控えと同じ名前。依頼者 2026-11-05）
    const yearFolder = drive.folders().find((f) => f.name === '2026年度')!
    expect(yearFolder.parents).toEqual(['root-folder'])
    const folder = drive.folders().find((f) => f.name === FILM.name)!
    expect(folder.parents).toEqual([yearFolder.id])
    expect(drive.items.get(id)!.parents).toEqual([folder.id])
    expect(triggers).toEqual([{ handler: 'onCheckSheetEdit', kind: 'edit', source: id }])
    // いちばん上は案内の1行（薄い黄色の帯に、濃い茶色の太字：依頼者の選択 2026-11-07 案B）、見出しは2行目。見出しの行まで固定。ふりがなの順
    const rows = tab().rows
    expect(rows[0][0]).toBe(TOP_NOTE)
    expect(tab().fmtAt(0, 0)).toMatchObject({ fontSize: 12, color: '#5c3b00', bold: true, background: '#fff1c2' })
    // 帯は表の幅まで（「知らせ」の列の上も）。この表では文字のほうが長いので、文字の終わりの先の列まで伸びる
    // （全角 54 字 × 12 ポイント ≒ 864 ピクセル。隠した列は数えない。伸ばしすぎない：最後の列を除くと文字に届かない）
    expect(tab().fmtAt(0, 11).background).toBe('#fff1c2')
    const band = tab().fmts[0].map((f, c) => (f.background === '#fff1c2' && !tab().cols[c]?.hidden ? (tab().cols[c]?.width ?? 100) : 0))
    const bandPx = band.reduce((a, b) => a + b, 0)
    expect(band.length).toBeGreaterThan(15)
    expect(bandPx).toBeGreaterThanOrEqual(54 * 16)
    expect(bandPx - band[band.length - 1]).toBeLessThan(54 * 16 + 12)
    // 回の列は1回目〜4回目のあとに抄録。許可の2列はそのあとに並べる（依頼者 2026-11-07）
    expect(rows[1].slice(0, 15).map(norm)).toEqual(['番号', '氏名', '最新PDF', '1回目', '2回目', '3回目', '4回目', '抄録', '抄録許可', '最終提出可', '教務提出', '知らせ', '学籍番号', '抄録許可の記録', '最終提出可の記録'])
    expect(tab().frozen).toBe(2)
    expect(rows.slice(2).map((r) => [r[0], r[1], r[11], r[12]])).toEqual([
      [1, '青木　美咲', 'PDF まだ', '00ZZ0100'],
      [2, '石田　遥', 'PDF まだ', '00ZZ0101'],
      [3, '遠藤　莉子', 'PDF まだ', '00ZZ0103'],
    ])
    expect(rows.slice(2).map((r) => r.slice(3, 11))).toEqual(Array(3).fill(['', '', '', '', '', false, false, false]))
    // 管理ページを開いたときの状態に、作ってある点検表の場所（「点検表を開く」はサーバーに聞かずに開く）。登録されていない人には渡さない
    expect(admin().getState().checkSheets).toEqual([{ year: 2026, courseId: FILM.id, url: result.url }])
    // 2回目：同じ点検表（作り直さない）。写さずに、すぐ場所を返す（写すのは10分ごとの仕掛けと「この並びにする」）
    const rosterRow = roster().findIndex((r) => r[2] === idOf(0))
    roster()[rosterRow][4] = '美咲子'
    expect(admin().ensureCheckSheet(2026, FILM.id)).toEqual(result)
    expect(books.size).toBe(1)
    expect(triggers).toHaveLength(1)
    expect(sheetStudents()[idOf(0)].cells.氏名).toBe('青木　美咲')
    admin().syncCheckSheets()
    expect(sheetStudents()[idOf(0)].cells.氏名).toBe('青木　美咲子')
    user = 'stranger@example.ac.jp'
    expect(admin().getState().checkSheets).toEqual([])
    user = 'sensei@example.ac.jp'
    // まだ保存していないコース・登録されていない人
    expect(() => admin().ensureCheckSheet(2026, 'new-course')).toThrow(/まだ保存されていません/)
    user = 'stranger@example.ac.jp'
    expect(() => admin().ensureCheckSheet(2026, FILM.id)).toThrow(/登録された先生だけ/)
    // ごみ箱に入れたら、新しく作って、同じ行の ID を直す
    user = owner
    drive.items.get(id)!.trashed = true
    admin().ensureCheckSheet(2026, FILM.id)
    expect(sheetRows('点検表')).toHaveLength(2)
    expect(sheetRows('点検表')[1][2]).toBe('book2')
    expect(triggers.map((t) => t.source)).toEqual(['book2'])
  })

  it('前の案内の文（小さな灰色の字）のままの点検表は、次に写すときに、今の文と黄色の帯に直す', () => {
    setup()
    admin().ensureCheckSheet(2026, FILM.id)
    // 前の版で作った点検表のふり：1行目は前の文・灰色の小さな字、見た目の決まりは前の版（v2）
    tab().getRange(1, 1).setValue(OLD_TOP_NOTE).setFontSize(9).setFontColor('#7a8088').setFontWeight(null).setBackground(null)
    for (const k of [...stored.keys()].filter((k) => k.startsWith('checkLayout:'))) stored.set(k, stored.get(k)!.replace('{"v":8', '{"v":3'))
    admin().syncCheckSheets()
    expect(tab().rows[0][0]).toBe(TOP_NOTE)
    expect(tab().fmtAt(0, 0)).toMatchObject({ fontSize: 12, color: '#5c3b00', bold: true, background: '#fff1c2' })
    // 先生が書き換えた案内は、そのまま（前の文のときだけ直す）
    tab().getRange(1, 1).setValue('コースの先生のメモ')
    for (const k of [...stored.keys()].filter((k) => k.startsWith('checkLayout:'))) stored.set(k, 'old')
    admin().syncCheckSheets()
    expect(tab().rows[0][0]).toBe('コースの先生のメモ')
  })

  it('まだだれも登録していなくても、点検表は案内・見出し・見た目・守りを整えて開ける', () => {
    setup()
    admin().ensureCheckSheet(2026, FILM.id)
    expect(tab().rows.map((r) => norm(r[0]))).toEqual([norm(TOP_NOTE), '番号'])
    expect(tab().frozen).toBe(2)
    expect(tab().protections).toHaveLength(11)
  })

  it('PDF の控えのフォルダが決まっていなければ、点検表は作れない', () => {
    load('admin-project').setup()
    expect(() => load('admin-project').ensureCheckSheet(2026, FILM.id)).toThrow(/PDF の控えを置くフォルダ/)
    expect(books.size).toBe(0)
  })

  it('点検表の見た目（v107 案A・見出しは役目ごとの色 2026-11-07 案A）と守り：✓ の箱・指導教員の名字のプルダウンと色・隠す列。ツールの列と上の2行は、デプロイした人だけが書ける', () => {
    const a = setup()
    for (const i of [0, 1, 2]) register(a, i)
    admin().ensureCheckSheet(2026, FILM.id)
    const t = tab()
    const { header } = layoutOf()
    const col = (name: string) => header.indexOf(name)
    expect(t.fmtAt(2, col('抄録許可'))).toMatchObject({ validation: { kind: 'checkbox' }, background: '#fcf9ee' })
    // 見出しは役目ごとに淡い色と濃い字：ツールが書く列は灰色・点検の回は青・許可は黄色・教務提出は緑
    expect(t.fmtAt(1, col('抄録許可'))).toMatchObject({ background: '#f8dc8c', color: '#5c3b00' })
    expect(t.fmtAt(1, col('最終提出可'))).toMatchObject({ background: '#f8dc8c', color: '#5c3b00' })
    expect(t.fmtAt(1, col('1回目'))).toMatchObject({ background: '#d6e4f5', color: '#1f3f6b' })
    expect(t.fmtAt(1, col('教務提出'))).toMatchObject({ background: '#d3ead6', color: '#1e5b2a' })
    for (const tool of ['番号', '氏名', '知らせ']) expect(t.fmtAt(1, col(tool)), tool).toMatchObject({ background: '#dadce0', color: '#3c4043' })
    expect(t.fmtAt(2, col('教務提出')).validation).toEqual({ kind: 'checkbox' })
    expect(t.fmtAt(2, col('番号')).background).toBe('#f3f4f6')
    // 氏名の列も灰色（ツールが書く）。長い氏名は折り返す（その行だけ高くなる）。ほかの列は折り返さない
    expect(t.fmtAt(2, col('氏名'))).toMatchObject({ background: '#f3f4f6', wrap: true, bold: true })
    expect(t.fmtAt(2, col('1回目')).wrap).toBe(false)
    for (const round of ['1回目', '2回目', '3回目', '抄録', '4回目']) {
      expect(t.fmtAt(4, col(round)).validation).toEqual({ kind: 'list', list: ['梶田 予定', '梶田 済み', '佐藤 予定', '佐藤 済み', '加藤 予定', '加藤 済み'], allowInvalid: true })
    }
    // 学生のいない行には、箱もプルダウンもない
    expect(t.fmtAt(5, col('抄録許可')).validation).toBeUndefined()
    for (const hidden of ['学籍番号', '抄録許可の記録', '最終提出可の記録']) expect(t.cols[col(hidden)].hidden, hidden).toBe(true)
    expect(t.cols[col('1回目')].hidden).toBeFalsy()
    // 済みは先生ごとの淡い色（4人目からは繰り返し）、予定は灰色の字、知らせの赤と灰色
    const rule = (when: string, text: string) => t.rules.find((r) => r.when === when && r.text === text)
    expect(rule('equal', '梶田 済み')).toMatchObject({ background: '#f8e1e4', color: '#8a3442' })
    expect(rule('equal', '佐藤 済み')).toMatchObject({ background: '#e7efe6', color: '#3d6342' })
    expect(rule('equal', '加藤 済み')).toMatchObject({ background: '#f2ece0', color: '#7a5a2c' })
    expect(rule('contains', '予定')).toMatchObject({ color: '#a0a5ad' })
    expect(rule('contains', '予定')!.ranges.map((r) => r.col)).toEqual([4, 5, 6, 7, 8])
    expect(rule('startsWith', '書き換え')).toMatchObject({ color: '#c5221f' })
    expect(rule('equal', '並びが崩れています')).toMatchObject({ color: '#c5221f' })
    expect(rule('equal', 'PDF まだ')).toMatchObject({ color: '#80868b' })
    // 守り：案内の行のはじめの3列・ツールの列（番号・氏名・最新 PDF・知らせ・学籍番号・記録の2列。見出しから下まで）・✓ の列の見出しだけ。
    // 白い回の列は、見出しも中身も守らない（先生が足す・名前を変える）。書けるのはデプロイした人だけ
    const locked = t.protections.map((p) => (p.range.row === 1 ? `案内の行${p.range.cols}列` : p.range.rows === 1 ? `見出しだけ:${header[p.range.col - 1]}` : `${header[p.range.col - 1]}（${p.range.row}行目から）`))
    expect(locked.sort()).toEqual(
      [
        '案内の行3列',
        '番号（2行目から）',
        '氏名（2行目から）',
        '最新PDF（2行目から）',
        '知らせ（2行目から）',
        '学籍番号（2行目から）',
        '抄録許可の記録（2行目から）',
        '最終提出可の記録（2行目から）',
        '見出しだけ:抄録許可',
        '見出しだけ:最終提出可',
        '見出しだけ:教務提出',
      ].sort(),
    )
    for (const p of t.protections) expect(p).toMatchObject({ description: PROTECT_NOTE, editors: [owner], domainEdit: false })
    expect(t.protections.some((p) => ['1回目', '2回目', '3回目', '抄録', '4回目'].includes(header[p.range.col - 1]))).toBe(false)
    // 写し直しても、守りは増えない（並べ方が変わらなければ、見た目も守りもそのまま）
    admin().syncCheckSheets()
    expect(t.protections).toHaveLength(11)
    // 指導教員が変わると、プルダウンと色を直す
    const config = admin().getState().years[0].config
    admin().saveYear({ ...config, courses: [{ ...config.courses[0], advisors: ['山本　太郎', '中村　花'] }] })
    admin().syncCheckSheets()
    expect(t.fmtAt(2, col('1回目')).validation).toEqual({ kind: 'list', list: ['山本 予定', '山本 済み', '中村 予定', '中村 済み'], allowInvalid: true })
    expect(t.rules.find((r) => r.text === '山本 済み')).toMatchObject({ background: '#f8e1e4' })
    expect(t.protections).toHaveLength(11)
  })

  it('checkStatus：コースの切り替え（年度の設定）と、点検表の自分の行（回の予定・済み、許可の日時と先生）。見出しの行は、見出しの名前で見つける', () => {
    let a = setup()
    register(a, 0)
    register(a, 1)
    // 点検表がまだない：row は null
    expect(status(a, 0)).toEqual({ ok: true, enabled: { abstract: false, final: false }, row: null, group: '', groupAt: '' })
    user = 'sensei@example.ac.jp'
    admin().saveTeacherEdits(2026, { permissions: { [FILM.id]: { abstract: true } } })
    admin().ensureCheckSheet(2026, FILM.id)
    setCell(idOf(0), '1回目', '梶田 済み')
    setCell(idOf(0), '2回目', '佐藤　予定')
    setCell(idOf(0), '3回目', '中間発表')
    setCell(idOf(0), '抄録許可', true)
    setCell(idOf(0), '抄録許可の記録', '2026-12-15T03:00:00.000Z / 梶田')
    setCell(idOf(0), '最終提出可', true)
    a = api()
    expect(status(a, 0)).toEqual({
      ok: true,
      enabled: { abstract: true, final: false },
      row: {
        rounds: [
          { label: '1回目', teacher: '梶田', state: 'done' },
          { label: '2回目', teacher: '佐藤', state: 'plan' },
          { label: '3回目', teacher: '中間発表', state: 'done' },
          { label: '4回目', teacher: '', state: '' },
          { label: '抄録', teacher: '', state: '' },
        ],
        abstractOk: { at: '2026-12-15T03:00:00.000Z', by: '梶田' },
        finalOk: { at: '', by: '' },
      },
      group: '',
      groupAt: '',
    })
    expect(status(a, 1).row).toMatchObject({ abstractOk: null, finalOk: null })
    // 名簿にない学生：row は null。ほかの学生の学籍番号では問い合わせられない
    expect(status(a, 5)).toEqual({ ok: true, enabled: { abstract: false, final: false }, row: null, group: '', groupAt: '' })
    expect(post(a, { action: 'checkStatus', token: tokenOf(mailOf(0)), year: 2026, studentId: idOf(1) }).ok).toBe(false)
    // 先生が回の列を足した・名前を変えた（見出しのある列は、どれも回の列）
    const { h, header } = layoutOf()
    tab().rows[h][header.indexOf('4回目')] = '最終\n確認'
    expect(status(a, 0).row.rounds.at(-2)).toEqual({ label: '最終 確認', teacher: '', state: '' })
    // 学生が氏名を直すと、点検表の氏名もすぐ直る（ずれた行とみなさない）
    expect(register(a, 0, { givenName: '美咲子' })).toEqual({ ok: true })
    expect(sheetStudents()[idOf(0)].cells['氏名']).toBe('青木　美咲子')
    expect(status(a, 0).row.abstractOk).toEqual({ at: '2026-12-15T03:00:00.000Z', by: '梶田' })
  })

  it('並びが崩れた行（表の一部だけを並べ替えて、見えない学籍番号と氏名・✓ がずれた）は、許可も回も渡さない。写すと「並びが崩れています」を出し、中身はほかの学生に移さない', () => {
    const a = setup()
    for (const i of [0, 1, 2]) register(a, i)
    admin().ensureCheckSheet(2026, FILM.id)
    setCell(idOf(0), '1回目', '梶田 済み')
    setCell(idOf(0), '抄録許可', true)
    setCell(idOf(0), '抄録許可の記録', '2026-12-15T03:00:00.000Z / 梶田')
    expect(status(a, 0).row.abstractOk).not.toBeNull()
    // 見える列（番号〜知らせ）だけを、青木と石田の行で入れ替えた（見えない学籍番号・記録は動かない）
    const { h } = layoutOf()
    const rows = tab().rows
    for (let c = 0; c < 12; c++) [rows[h + 1][c], rows[h + 2][c]] = [rows[h + 2][c], rows[h + 1][c]]
    expect(status(a, 0).row).toBeNull()
    expect(status(a, 1).row).toBeNull()
    expect(status(a, 2).row).not.toBeNull()
    // ずれた行に ✓ を入れても、記録は残さず、知らせに「並びが崩れています」
    edit(idOf(0), '最終提出可', true)
    expect(sheetStudents()[idOf(0)].cells).toMatchObject({ 最終提出可の記録: '', 知らせ: '並びが崩れています' })
    expect(status(a, 0).row).toBeNull()
    // 写す：氏名は名簿に戻し、知らせに「並びが崩れています」。✓ と回は、その場所のまま（ほかの学生に移さない）
    admin().syncCheckSheets()
    let s = sheetStudents()
    expect(s[idOf(0)].cells).toMatchObject({ 氏名: '青木　美咲', 知らせ: '並びが崩れています', 抄録許可: false, 最終提出可: true, '1回目': '' })
    expect(s[idOf(1)].cells).toMatchObject({ 氏名: '石田　遥', 知らせ: '並びが崩れています', 抄録許可: true, '1回目': '梶田 済み' })
    expect(s[idOf(2)].cells.知らせ).toBe('PDF まだ')
    expect(status(a, 1).row).toBeNull()
    // 次に写しても、知らせは残る（先生が確かめるまで）
    admin().syncCheckSheets()
    expect(sheetStudents()[idOf(1)].cells.知らせ).toBe('並びが崩れています')
    // 先生が石田の行を確かめて、✓ を入れ直す：知らせが消え、その先生の記録が残る
    edit(idOf(1), '抄録許可', false)
    edit(idOf(1), '抄録許可', true)
    s = sheetStudents()
    expect(s[idOf(1)].cells.知らせ).toBe('')
    expect(String(s[idOf(1)].cells.抄録許可の記録)).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z \/ 梶田$/)
    expect(status(a, 1).row.abstractOk.by).toBe('梶田')
    admin().syncCheckSheets()
    expect(sheetStudents()[idOf(1)].cells.知らせ).toBe('PDF まだ')
  })

  it('行ごと動かした（見えない学籍番号も一緒）なら、その行は正しい。写すと、ツールの並びに戻る（先生の書いた中身も一緒）', () => {
    const a = setup()
    for (const i of [0, 1, 2]) register(a, i)
    admin().ensureCheckSheet(2026, FILM.id)
    setCell(idOf(2), '最終提出可', true)
    setCell(idOf(2), '2回目', '加藤 済み')
    const { h } = layoutOf()
    const rows = tab().rows
    rows.splice(h + 1, 0, rows.splice(h + 3, 1)[0])
    expect(Object.keys(sheetStudents())).toEqual([idOf(2), idOf(0), idOf(1)])
    expect(status(a, 2).row).toMatchObject({ finalOk: { at: '', by: '' } })
    admin().syncCheckSheets()
    const s = sheetStudents()
    expect(Object.keys(s)).toEqual([idOf(0), idOf(1), idOf(2)])
    expect(s[idOf(2)].cells).toMatchObject({ 番号: 3, 氏名: '上野　空', 最終提出可: true, '2回目': '加藤 済み', 知らせ: 'PDF まだ' })
    expect(s[idOf(0)].cells).toMatchObject({ 最終提出可: false, '2回目': '' })
  })

  it('26人をこえると半分ずつ2段に組み直し、25人に戻ると1段に。先生の書いた中身は学生と一緒に動く', () => {
    let a = setup()
    for (let i = 25; i >= 1; i--) register(a, i)
    admin().ensureCheckSheet(2026, FILM.id)
    expect(layoutOf().starts).toEqual([0])
    expect(Object.keys(sheetStudents())).toHaveLength(25)
    setCell(idOf(13), '2回目', '佐藤 済み')
    setCell(idOf(13), '抄録許可', true)
    setCell(idOf(13), '抄録許可の記録', '2026-12-01T00:00:00.000Z / 佐藤')
    setCell(idOf(25), '教務提出', true)
    setCell(idOf(1), '1回目', '梶田 予定')
    // 26人目（アオキ：いちばん上に入る）→ 13人ずつ2段（前半が左。すき間の列を1つ）
    register(a, 0)
    admin().syncCheckSheets()
    let { h, header, starts } = layoutOf()
    expect(starts).toEqual([0, 16])
    expect(header[15]).toBe('')
    expect(header.slice(16, 31)).toEqual(header.slice(0, 15))
    let s = sheetStudents()
    expect(Object.keys(s)).toHaveLength(26)
    expect(s[idOf(0)]).toMatchObject({ block: 0, row: h + 1, cells: { 番号: 1 } })
    expect(s[idOf(13)]).toMatchObject({ block: 1, row: h + 1, cells: { 番号: 14, '2回目': '佐藤 済み', 抄録許可: true } })
    expect(s[idOf(25)]).toMatchObject({ block: 1, cells: { 番号: 26, 教務提出: true } })
    expect(s[idOf(1)].cells).toMatchObject({ 番号: 2, '1回目': '梶田 予定', 教務提出: false })
    // 1段目の14行目から下は空にし、箱も外す
    expect(tab().rows.slice(h + 14).every((r) => r.every((v) => v === ''))).toBe(true)
    expect(tab().fmtAt(h + 14, header.indexOf('抄録許可')).validation).toBeNull()
    // 2段目にも ✓ の箱と守り。段のあいだのすき間の列も守る
    expect(tab().fmtAt(h + 1, 16 + header.indexOf('抄録許可')).validation).toEqual({ kind: 'checkbox' })
    expect(tab().protections.filter((p) => p.range.row > 1).map((p) => p.range.col - 1)).toContain(15)
    expect(tab().protections).toHaveLength(1 + 2 * 10 + 1)
    expect(tab().protections.find((p) => p.range.row === 1)!.range).toMatchObject({ col: 1, cols: 3 })
    expect(status(api(), 13).row).toMatchObject({ abstractOk: { at: '2026-12-01T00:00:00.000Z', by: '佐藤' } })
    // 1人がほかのコースへ移る → 25人 → 1段（移った学生の行はなくなる）
    const config = admin().getState().years[0].config
    admin().saveYear({ ...config, courses: [...config.courses, { id: 'pattern', name: 'パターン', advisors: [], subtitleTemplate: '―{input}の制作―' }] })
    a = api()
    expect(register(a, 5, { courseId: 'pattern' })).toEqual({ ok: true })
    admin().syncCheckSheets()
    ;({ h, starts } = layoutOf())
    expect(starts).toEqual([0])
    s = sheetStudents()
    expect(Object.keys(s)).toHaveLength(25)
    expect(s[idOf(5)]).toBeUndefined()
    expect(s[idOf(13)].cells).toMatchObject({ '2回目': '佐藤 済み', 抄録許可: true, 抄録許可の記録: '2026-12-01T00:00:00.000Z / 佐藤' })
    expect(s[idOf(25)].cells).toMatchObject({ 番号: 25, 教務提出: true })
    expect(tab().width()).toBe(15)
    expect(status(a, 13).row.abstractOk.by).toBe('佐藤')
  })

  it('先生が片方の段にだけ回の列を足した・名前を変えた：段ごとに見出しの名前で読み、学生のツールには新しい名前で返す。写しても先生の書いた中身は残る（段を移った学生は、対応する回の列へ）', () => {
    const a = setup()
    for (let i = 0; i < 26; i++) register(a, i)
    admin().ensureCheckSheet(2026, FILM.id)
    let { h, header, starts } = layoutOf()
    expect(starts).toEqual([0, 16])
    // 1段目だけ：「4回目」を「最終確認」に変え、「2回目」のあとに「中間」を足す（白い回の列の見出しは、先生が書ける）
    tab().rows[h][header.indexOf('4回目')] = '最終\n確認'
    tab().insertColumnsAfter(header.indexOf('2回目') + 1, 1)
    tab().rows[h][header.indexOf('2回目') + 1] = '中間'
    expect(layoutOf().starts).toEqual([0, 17])
    setCell(idOf(0), '中間', '梶田 済み')
    setCell(idOf(0), '最終確認', '佐藤 予定')
    // 2段目のはじめの学生（1段目にはない「4回目」）
    setCell(idOf(13), '4回目', '加藤 済み')
    setCell(idOf(13), '抄録許可', true)
    expect(status(a, 0).row.rounds.map((r: { label: string }) => r.label)).toEqual(['1回目', '2回目', '中間', '3回目', '最終 確認', '抄録'])
    expect(status(a, 0).row.rounds[2]).toEqual({ label: '中間', teacher: '梶田', state: 'done' })
    expect(status(a, 13).row.rounds.map((r: { label: string }) => r.label)).toEqual(['1回目', '2回目', '3回目', '4回目', '抄録'])
    // 写しても、先生の書いた中身はそのまま。足した回の列にもプルダウン。回の列の見出しは守らない
    admin().syncCheckSheets()
    let s = sheetStudents()
    expect(s[idOf(0)]).toMatchObject({ block: 0, cells: { 中間: '梶田 済み', 最終確認: '佐藤 予定' } })
    expect(s[idOf(13)]).toMatchObject({ block: 1, cells: { '4回目': '加藤 済み', 抄録許可: true } })
    ;({ h, header } = layoutOf())
    expect(tab().fmtAt(h + 1, header.indexOf('中間')).validation).toMatchObject({ kind: 'list' })
    expect(tab().protections.some((p) => ['中間', '最終確認'].includes(header[p.range.col - 1]))).toBe(false)
    // 27人目（ふりがながいちばん後ろ）：1段は14人になり、2段目のはじめの学生は1段目の最後へ移る。
    // 「4回目」の中身は、1段目の対応する列「最終確認」へ（足しただけの「中間」は空）
    expect(post(a, { action: 'register', token: tokenOf(mailOf(26)), year: 2026, courseId: FILM.id, studentId: idOf(26), familyName: '渡辺', givenName: '光', familyKana: 'ワタナベ', givenKana: 'ヒカル' })).toEqual({ ok: true })
    admin().syncCheckSheets()
    s = sheetStudents()
    expect(s[idOf(13)]).toMatchObject({ block: 0, cells: { 番号: 14, 最終確認: '加藤 済み', 中間: '', 抄録許可: true } })
    expect(s[idOf(0)].cells).toMatchObject({ 中間: '梶田 済み', 最終確認: '佐藤 予定' })
    expect(s[idOf(26)]).toMatchObject({ block: 1, cells: { 番号: 27 } })
    expect(status(api(), 13).row.rounds.at(-2)).toEqual({ label: '最終 確認', teacher: '加藤', state: 'done' })
    // 回の列の対応（同じ名前はそのまま、名前の違う列は、同じ名前の列のあいだで順に組にする。足しただけの列は組にしない）
    const g = admin()
    expect({ ...g.alignRounds_(['1', '2', '3', '抄', '4'], ['1', '2', '中', '3', '抄', '最']) }).toEqual({ '1': '1', '2': '2', '3': '3', 抄: '抄', 最: '4' })
  })

  it('並び：ふりがなの順（ひらがな・カタカナ・半角カナは同じ。ふりがなのない学生は後ろ）。先生の並びのあとに来た学生は、ふりがなの所に入る。「手で動かした」は動かした学生だけ。25人まで1段', () => {
    const g = load('admin-project')
    const st = (id: string, kana: string, order = 0) => ({ id, familyName: id, givenName: '', familyKana: kana, givenKana: '', order })
    const ids = (list: { id: string }[]) => list.map((s) => s.id)
    expect(ids(g.orderStudents_([st('c', 'ウエノ'), st('a', 'あおき'), st('x', ''), st('b', 'ｲｼﾀﾞ')]))).toEqual(['a', 'b', 'c', 'x'])
    // 同じセイなら、メイの順
    expect(ids(g.orderStudents_([{ ...st('b', 'アオキ'), givenKana: 'ミサキ' }, { ...st('a', 'アオキ'), givenKana: 'アヤ' }]))).toEqual(['a', 'b'])
    // 先生の並び：ブンカを3番目に
    const placed = [st('a', 'アオキ', 1), st('b', 'イシダ', 2), st('h', 'ブンカ', 3), st('c', 'ウエノ', 4), st('d', 'エンドウ', 5)]
    expect(ids(g.orderStudents_(placed))).toEqual(['a', 'b', 'h', 'c', 'd'])
    expect(g.movedFlags_(g.orderStudents_(placed))).toEqual([false, false, true, false, false])
    expect(g.movedFlags_(g.orderStudents_(placed.map((s) => ({ ...s, order: 0 }))))).toEqual([false, false, false, false, false])
    // あとから来た学生（並びが空）は、ふりがなの所へ（手で動かした学生は目印にしない）
    expect(ids(g.orderStudents_([...placed, st('e', 'オオタ'), st('f', 'ハヤシ'), st('a2', 'アイダ')]))).toEqual(['a2', 'a', 'b', 'h', 'c', 'd', 'e', 'f'])
    expect(g.blockLayout_(0)).toEqual({ count: 0, blocks: 1, perBlock: 0 })
    expect(g.blockLayout_(25)).toEqual({ count: 25, blocks: 1, perBlock: 25 })
    expect(g.blockLayout_(26)).toEqual({ count: 26, blocks: 2, perBlock: 13 })
    expect(g.blockLayout_(27)).toEqual({ count: 27, blocks: 2, perBlock: 14 })
    // いつも縦1列（依頼者の選択 2026-11-09 mockups/v119）
    expect(g.blockLayout_(40, true)).toEqual({ count: 40, blocks: 1, perBlock: 40 })
    // 所属ごと（登録した順。選んでいない学生は後ろ）・学籍番号順。順番を変えたあと（manualOk が false）は、先生が直した並びを使わない
    const course = { id: 'c', groups: ['②班', '①班'], checkById: true }
    const gs = (id: string, kana: string, group: string, order = 0) => ({ ...st(id, kana, order), group })
    expect(ids(g.orderStudents_([gs('03', 'ア', '①班'), gs('02', 'イ', '②班'), gs('01', 'ウ', ''), gs('04', 'エ', '②班')], course))).toEqual(['02', '04', '03', '01'])
    const fixed = [gs('04', 'エ', '②班', 1), gs('02', 'イ', '②班', 2)]
    expect(ids(g.orderStudents_(fixed, course, true))).toEqual(['04', '02'])
    expect(ids(g.orderStudents_(fixed, course, false))).toEqual(['02', '04'])
  })

  it('所属（依頼者の選択 2026-11-09 mockups/v119）：所属ごと・学籍番号順・いつも縦1列。所属の列と境の線。先生が直した所属は、学生の古い所属で上書きしない', () => {
    setup()
    user = 'sensei@example.ac.jp'
    // 先生も、所属・順番・並べ方を保存できる（同じ名前の所属は断る）
    expect(() => admin().saveTeacherEdits(2026, { sheets: { [FILM.id]: { groups: ['①班', '①班'], checkById: true, checkOneColumn: true } } })).toThrow('「①班」が2つあります')
    admin().saveTeacherEdits(2026, { sheets: { [FILM.id]: { groups: ['①班', '②班'], checkById: true, checkOneColumn: true } } })
    let a = api()
    // 26人：偶数は①班・奇数は②班、最後の1人はまだ選んでいない
    const chosenAt = '2020-01-01T00:00:00.000Z'
    for (let i = 0; i < 26; i++) expect(register(a, i, i === 25 ? { group: '', groupAt: '' } : { group: i % 2 ? '②班' : '①班', groupAt: chosenAt })).toEqual({ ok: true })
    expect(rosterOf(0).slice(12, 14)).toEqual(['①班', chosenAt])
    admin().ensureCheckSheet(2026, FILM.id)
    const { header, starts } = layoutOf()
    // いつも縦1列（26人でも1段）。所属の列は番号の右
    expect(starts).toHaveLength(1)
    expect(header.slice(0, 3)).toEqual(['番号', '所属', '氏名'])
    const s = sheetStudents()
    const rows = Object.entries(s)
      .sort((x, y) => x[1].row - y[1].row)
      .map(([k]) => k)
    const evens = Array.from({ length: 13 }, (_, k) => idOf(k * 2))
    const odds = Array.from({ length: 12 }, (_, k) => idOf(k * 2 + 1))
    expect(rows).toEqual([...evens, ...odds, idOf(25)])
    expect([s[idOf(0)].cells['所属'], s[idOf(1)].cells['所属'], s[idOf(25)].cells['所属']]).toEqual(['①班', '②班', ''])
    // 所属の境（②班の最初・選んでいない学生）の上に太い線
    expect(tab().fmtAt(s[idOf(1)].row, 0).borderTop).toBe('SOLID_MEDIUM')
    expect(tab().fmtAt(s[idOf(25)].row, 0).borderTop).toBe('SOLID_MEDIUM')
    expect(tab().fmtAt(s[idOf(2)].row, 0).borderTop ?? null).toBeNull()
    // 所属の列だけ、所属ごとの淡い地と濃い字（mockups/v121 案A）。選んでいない学生は灰色
    const g = s[idOf(0)].col('所属')
    expect([idOf(0), idOf(1), idOf(25)].map((k) => tab().fmtAt(s[k].row, g).background)).toEqual(['#d7e1f2', '#e5d9f2', '#f3f4f6'])
    expect(tab().fmtAt(s[idOf(1)].row, g)).toMatchObject({ color: '#56377c', bold: true })
    expect(tab().fmtAt(s[idOf(1)].row, s[idOf(1)].col('氏名')).background).toBe('#f3f4f6')
    // 所属の列は、ツールが書く列として守る（見出しから下まで。先生は書けない。直すのは管理ページの「学生の並びを直す」）
    const guard = tab().protections.find((p) => p.range.col === g + 1 && p.range.rows > 1)
    expect(guard).toMatchObject({ description: PROTECT_NOTE, editors: [owner], domainEdit: false })

    // 先生が直す：学生0 を②班に（名簿の所属と日時。学生のツールは、点検表の様子を聞いたときに受け取る）
    admin().saveStudentOrder(2026, FILM.id, null, { [idOf(0)]: '②班' })
    expect(rosterOf(0)[12]).toBe('②班')
    const fixedAt = String(rosterOf(0)[13])
    expect(fixedAt > chosenAt).toBe(true)
    expect(sheetStudents()[idOf(0)].cells['所属']).toBe('②班')
    a = api()
    expect(status(a, 0)).toMatchObject({ group: '②班', groupAt: fixedAt })
    // 学生の別の端末から、直す前の所属（古い日時）が届いても、上書きしない
    expect(register(a, 0, { group: '①班', groupAt: chosenAt })).toEqual({ ok: true })
    expect(rosterOf(0)[12]).toBe('②班')
    // 学生があとで選び直した（新しい日時）なら書く
    expect(register(a, 0, { group: '①班', groupAt: new Date(Date.now() + 60000).toISOString() })).toEqual({ ok: true })
    expect(rosterOf(0)[12]).toBe('①班')
    // 登録していない所属は、まだ選んでいないことにする。前の版のツール（所属を送らない）は、名簿の所属を変えない
    expect(register(a, 2, { group: 'ない班', groupAt: new Date().toISOString() })).toEqual({ ok: true })
    expect(rosterOf(2)[12]).toBe('')
    expect(register(a, 4)).toEqual({ ok: true })
    expect(rosterOf(4)[12]).toBe('①班')
    // 先生は、コースに登録していない所属には直せない
    expect(() => admin().saveStudentOrder(2026, FILM.id, null, { [idOf(1)]: 'ない班' })).toThrow('所属の形が正しくありません')
    // 並べ替えの窓の一覧には、所属が付く
    expect(admin().listStudents(2026, FILM.id).find((e: { studentId: string }) => e.studentId === idOf(1))).toMatchObject({ group: '②班' })
    // 所属を全部消すと、所属の列もなくなる
    admin().saveTeacherEdits(2026, { sheets: { [FILM.id]: { groups: [], checkById: false, checkOneColumn: false } } })
    admin().syncCheckSheets()
    expect(layoutOf().header).not.toContain('所属')
    expect(layoutOf().starts).toHaveLength(2)
  })

  it('学生の並びを直す：listStudents・saveStudentOrder（名簿の「並び」と点検表の順）。null でふりがなの順に戻す。コースを変えた学生の並びは消す', () => {
    let a = setup()
    for (const i of [4, 3, 2, 1, 0]) register(a, i)
    admin().ensureCheckSheet(2026, FILM.id)
    user = 'sensei@example.ac.jp'
    expect(admin().listStudents(2026, FILM.id)).toEqual([0, 1, 2, 3, 4].map((i) => ({ studentId: idOf(i), name: nameOf(i), kana: `${PEOPLE[i][2]} ${PEOPLE[i][3]}`, group: '', moved: false })))
    // 遠藤（4番目）を2番目に
    const order = [0, 3, 1, 2, 4].map(idOf)
    const saved = admin().saveStudentOrder(2026, FILM.id, order)
    expect(saved.map((s: { studentId: string }) => s.studentId)).toEqual(order)
    expect(saved.map((s: { moved: boolean }) => s.moved)).toEqual([false, true, false, false, false])
    expect(order.map((id) => roster().find((r) => r[2] === id)![7])).toEqual([1, 2, 3, 4, 5])
    expect(Object.keys(sheetStudents())).toEqual(order)
    expect(memberHistory().at(-1)).toBe('sensei@example.ac.jp:点検表の学生の並びを直す（2026年度・映画・舞台衣装デザイナー コース）')
    // あとから来た学生（金子）は、ふりがなの所（太田のあと）
    register(a, 5)
    expect(admin().listStudents(2026, FILM.id).map((s: { studentId: string }) => s.studentId)).toEqual([...order, idOf(5)])
    // ふりがなの順に戻す
    const back = admin().saveStudentOrder(2026, FILM.id, null)
    expect(back.map((s: { studentId: string }) => s.studentId)).toEqual([0, 1, 2, 3, 4, 5].map(idOf))
    expect(back.every((s: { moved: boolean }) => !s.moved)).toBe(true)
    expect(roster().slice(1).map((r) => r[7])).toEqual(Array(6).fill(''))
    expect(Object.keys(sheetStudents())).toEqual([0, 1, 2, 3, 4, 5].map(idOf))
    // コースを変えた学生の並びは消す
    admin().saveStudentOrder(2026, FILM.id, order)
    const config = admin().getState().years[0].config
    user = owner
    admin().saveYear({ ...config, courses: [...config.courses, { id: 'pattern', name: 'パターン', advisors: [], subtitleTemplate: '―{input}の制作―' }] })
    a = api()
    register(a, 3, { courseId: 'pattern' })
    expect(rosterOf(3)[7]).toBe('')
    expect(rosterOf(0)[7]).toBe(1)
    // 形の正しくないもの・登録されていない人
    expect(() => admin().saveStudentOrder(2026, FILM.id, 'x')).toThrow(/並びの形/)
    user = 'stranger@example.ac.jp'
    expect(() => admin().saveStudentOrder(2026, FILM.id, null)).toThrow(/登録された先生だけ/)
    expect(() => admin().listStudents(2026, FILM.id)).toThrow(/登録された先生だけ/)
  })

  it('touchAfterFinal：名簿の書き換え日時に入れ、最終提出可の ✓ のあとなら、点検表の知らせに「書き換え 1/14」（写しても残る。✓ を入れ直すと消える）', () => {
    const a = setup()
    register(a, 0)
    register(a, 1)
    admin().ensureCheckSheet(2026, FILM.id)
    const touch = (i: number, at: string) => post(a, { action: 'touchAfterFinal', token: tokenOf(mailOf(i)), year: 2026, studentId: idOf(i), at })
    // 最終提出可の前：名簿だけ
    expect(touch(0, '2026-01-14T03:00:00.000Z')).toEqual({ ok: true, saved: true, noted: false })
    expect((rosterOf(0)[10] as Date).toISOString()).toBe('2026-01-14T03:00:00.000Z')
    expect(sheetStudents()[idOf(0)].cells.知らせ).toBe('PDF まだ')
    // ✓（1/10）のあとに書き換えた
    setCell(idOf(0), '最終提出可', true)
    setCell(idOf(0), '最終提出可の記録', '2026-01-10T00:00:00.000Z / 梶田')
    expect(touch(0, '2026-01-14T03:00:00.000Z')).toEqual({ ok: true, saved: true, noted: true })
    expect(sheetStudents()[idOf(0)].cells.知らせ).toBe('書き換え 1/14')
    admin().syncCheckSheets()
    expect(sheetStudents()[idOf(0)].cells.知らせ).toBe('書き換え 1/14')
    // ✓ を入れ直した（1/15）あとは、知らせを消す
    setCell(idOf(0), '最終提出可の記録', '2026-01-15T00:00:00.000Z / 梶田')
    admin().syncCheckSheets()
    expect(sheetStudents()[idOf(0)].cells.知らせ).toBe('PDF まだ')
    // 名簿にない学生・先の日時（今にする）
    expect(touch(9, '2026-01-14T03:00:00.000Z')).toEqual({ ok: true, saved: false })
    touch(1, '2099-01-01T00:00:00.000Z')
    expect(Math.abs((rosterOf(1)[10] as Date).getTime() - Date.now())).toBeLessThan(60000)
  })

  it('PDF の控え（pdfCopy）を置くと、名簿に PDF の ID と日時を書き（なければ行を作る）、点検表の「最新 PDF」は押すとその PDF。教職員の試しは名簿に足さない', () => {
    const a = setup()
    const pdf = Buffer.from('%PDF-1.4\n1\n%%EOF').toString('base64')
    expect(post(a, { action: 'pdfCopy', token: tokenOf(mailOf(0)), year: 2026, courseId: FILM.id, studentId: idOf(0), name: '青木　美咲', pdf })).toEqual({ ok: true })
    const file = drive.pdfs()[0]
    expect(rosterOf(0).slice(1, 7)).toEqual([FILM.id, idOf(0), '青木', '美咲', '', ''])
    expect(rosterOf(0)[8]).toBe(file.id)
    expect(rosterOf(0)[9]).toBeInstanceOf(Date)
    admin().ensureCheckSheet(2026, FILM.id)
    const s = sheetStudents()[idOf(0)]
    expect(s.cells.最新PDF).toBe(`=HYPERLINK("https://drive.google.com/file/d/${file.id}/view","${md(rosterOf(0)[9] as Date)}")`)
    expect(s.cells.知らせ).toBe('')
    expect(post(a, { action: 'pdfCopy', token: tokenOf('sensei@example.ac.jp'), year: 2026, courseId: FILM.id, studentId: '', name: '見本　花子', pdf })).toEqual({ ok: true })
    expect(roster()).toHaveLength(2)
  })

  it('先生の許可は、先生も保存できる（変更履歴に残す）。両方切ると項目ごと消す。形が正しくなければ保存しない。管理者は年度の設定ごと', () => {
    admin().setup()
    admin().addMember('sensei@example.ac.jp', '先生', '')
    user = 'sensei@example.ac.jp'
    const saved = admin().saveTeacherEdits(2026, { permissions: { [FILM.id]: { abstract: true, final: true }, 'no-such': { abstract: true } } })
    expect(saved.years[0].config.courses[0].permission).toEqual({ abstract: true, final: true })
    expect(admin().getHistory(2026)[0].action).toBe('先生の許可を保存（映画・舞台衣装デザイナー）')
    const off = admin().saveTeacherEdits(2026, { permissions: { [FILM.id]: { abstract: false, final: false } } })
    expect('permission' in off.years[0].config.courses[0]).toBe(false)
    expect(() => admin().saveTeacherEdits(2026, { permissions: { [FILM.id]: { abstract: 'yes' } } })).toThrow('「映画・舞台衣装デザイナー」の先生の許可の設定が正しくありません')
    expect(admin().getHistory(2026)).toHaveLength(3)
    user = owner
    const config = admin().getState().years[0].config
    expect(admin().saveYear({ ...config, courses: [{ ...config.courses[0], permission: { final: true } }] }).years[0].config.courses[0].permission).toEqual({ final: true })
    expect(() => admin().saveYear({ ...config, courses: [{ ...config.courses[0], permission: 'x' }] })).toThrow(/先生の許可の設定が正しくありません/)
  })

  it('サブタイトルを使うかは、先生も保存できる（変更履歴に残す）。使うに戻すと項目ごと消す。true・false 以外は保存しない（依頼者の選択 2026-11-09）', () => {
    admin().setup()
    admin().addMember('sensei@example.ac.jp', '先生', '')
    user = 'sensei@example.ac.jp'
    const saved = admin().saveTeacherEdits(2026, { subtitles: { [FILM.id]: true, 'no-such': true } })
    expect(saved.years[0].config.courses[0].noSubtitle).toBe(true)
    expect(admin().getHistory(2026)[0].action).toBe('サブタイトルを使うかを保存（映画・舞台衣装デザイナー）')
    const on = admin().saveTeacherEdits(2026, { subtitles: { [FILM.id]: false } })
    expect('noSubtitle' in on.years[0].config.courses[0]).toBe(false)
    expect(() => admin().saveTeacherEdits(2026, { subtitles: { [FILM.id]: 'yes' } })).toThrow('「映画・舞台衣装デザイナー」のサブタイトルを使うかの設定が正しくありません')
    // 前後の文字（形式）は、先生は変えられないまま
    expect(admin().getState().years[0].config.courses[0].subtitleTemplate).toBe(saved.years[0].config.courses[0].subtitleTemplate)
  })

  it('名字：最初の空白（半角・全角）の前。指導教員の欄の「、」「,」も分ける。✓ を入れた先生は、登録のメモにある指導教員の名字（なければアドレスの @ より前）', () => {
    const g = load('admin-project')
    expect(['梶田　貴子', '佐藤 綾', '山本', '  加藤　淳之介 ', ''].map((n) => g.surnameOf_(n))).toEqual(['梶田', '佐藤', '山本', '加藤', ''])
    expect(g.advisorSurnames_(['梶田　貴子、佐藤 綾', '加藤　淳之介', '梶田 貴子', '', '中村 花,小川　空'])).toEqual(['梶田', '佐藤', '加藤', '中村', '小川'])
    expect(g.editorSurname_('k-kajita@example.ac.jp', '梶田　貴子（衣装）', ['梶田', '佐藤'])).toBe('梶田')
    expect(g.editorSurname_('k-kajita@example.ac.jp', '衣装の先生', ['梶田'])).toBe('k-kajita')
    expect(g.editorSurname_('', '', [])).toBe('')
  })

  it('✓ を入れると、編集の仕掛けが見えない記録の列に「日時 / 先生の名字」を残し、外すと消す（名字が分からなければアドレスの @ より前）', () => {
    const a = setup()
    register(a, 0)
    admin().ensureCheckSheet(2026, FILM.id)
    edit(idOf(0), '最終提出可', true)
    const record = String(sheetStudents()[idOf(0)].cells.最終提出可の記録)
    expect(record).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z \/ 梶田$/)
    expect(status(a, 0).row.finalOk).toEqual({ at: record.split(' / ')[0], by: '梶田' })
    edit(idOf(0), '最終提出可', false)
    expect(sheetStudents()[idOf(0)].cells.最終提出可の記録).toBe('')
    expect(status(a, 0).row.finalOk).toBeNull()
    admin().addMember('k-other@example.ac.jp', '先生', '')
    edit(idOf(0), '抄録許可', true, 'k-other@example.ac.jp')
    expect(String(sheetStudents()[idOf(0)].cells.抄録許可の記録)).toMatch(/ \/ k-other$/)
    // 回の列などを変えても、記録は書かない
    edit(idOf(0), '1回目', '梶田 済み')
    expect(sheetStudents()[idOf(0)].cells.最終提出可の記録).toBe('')
  })

  it('氏名と担当コース（依頼者の判断 2026-11-09）：setMyProfile で管理者シートの「氏名」「担当コース」に書き、getState の me に返す。先生は担当のコースだけ（点検表・並べ替え・保存）。管理者は全部', () => {
    admin().setup()
    admin().addMember('sensei@example.ac.jp', '先生', '')
    const config = admin().getState().years[0].config
    const OTHER = { ...config.courses[0], id: 'other-course', name: 'ほかのコース', advisors: ['山本　花'] }
    admin().saveYear({ ...config, courses: [...config.courses, OTHER] })
    user = 'sensei@example.ac.jp'
    expect(admin().getState().me).toEqual({ name: '', courseId: '' })
    expect(() => admin().setMyProfile(' ', FILM.id)).toThrow('氏名は1〜40字')
    expect(() => admin().setMyProfile('梶田 貴子', 'no-such')).toThrow('担当のコースが見つかりません')
    // 半角の空白は全角1つに
    expect(admin().setMyProfile(' 梶田 貴子 ', FILM.id)).toEqual({ name: '梶田　貴子', courseId: FILM.id })
    const rows = sheetRows('管理者')
    expect(rows[0].slice(3, 5)).toEqual(['氏名', '担当コース'])
    expect(rows.find((r) => r[0] === 'sensei@example.ac.jp')!.slice(2, 5)).toEqual(['先生', '梶田　貴子', FILM.id])
    expect(admin().getState().me).toEqual({ name: '梶田　貴子', courseId: FILM.id })
    expect(memberHistory().some((h) => h.includes('氏名と担当コースを登録：梶田　貴子'))).toBe(true)
    // 先生は担当のコースだけ（ほかのコースは、サーバーでも断る）
    expect(() => admin().getCheckView(2026, OTHER.id)).toThrow('担当のコースだけを見られます')
    expect(() => admin().listStudents(2026, OTHER.id)).toThrow('担当のコースだけを見られます')
    expect(() => admin().ensureCheckSheet(2026, OTHER.id)).toThrow('担当のコースだけを見られます')
    expect(() => admin().saveTeacherEdits(2026, { notices: { [OTHER.id]: 'お知らせ' } })).toThrow('担当のコースだけを直せます')
    expect(admin().getCheckView(2026, FILM.id)).toMatchObject({ exists: false, teachers: ['梶田', '佐藤', '加藤'], groups: [], split: 0, assignment: null })
    // ほかの人の登録は、管理者だけが直せる
    expect(() => admin().setMemberProfile('sensei@example.ac.jp', '佐藤　綾', FILM.id)).toThrow()
    user = owner
    expect(admin().getCheckView(2026, OTHER.id).exists).toBe(false)
    const members = admin().setMemberProfile('sensei@example.ac.jp', '佐藤　綾', OTHER.id)
    expect(members.find((m: { email: string }) => m.email === 'sensei@example.ac.jp')).toMatchObject({ name: '佐藤　綾', courseId: OTHER.id })
    expect(() => admin().setMemberProfile('nobody@example.ac.jp', '佐藤　綾', FILM.id)).toThrow()
    user = 'sensei@example.ac.jp'
    expect(() => admin().getCheckView(2026, FILM.id)).toThrow('担当のコースだけを見られます')
    expect(admin().getCheckView(2026, OTHER.id).teachers).toEqual(['山本'])
  })

  it('点検表の画面（getCheckView・setCheckCell・saveAssignment）：所属ごとの割り振りを「名字 予定」で入れ、「済み」は書き換えない。あとから来た学生にも写しで入る。✓ は記録の列も書く', () => {
    setup()
    user = 'sensei@example.ac.jp'
    admin().setMyProfile('梶田　貴子', FILM.id)
    admin().saveTeacherEdits(2026, { sheets: { [FILM.id]: { groups: ['①班', '②班'], checkById: true, checkOneColumn: true } } })
    let a = api()
    const at = '2020-01-01T00:00:00.000Z'
    for (let i = 0; i < 6; i++) expect(register(a, i, { group: i % 2 ? '②班' : '①班', groupAt: at })).toEqual({ ok: true })
    expect(admin().getCheckView(2026, FILM.id).exists).toBe(false)
    admin().ensureCheckSheet(2026, FILM.id)
    let v = admin().getCheckView(2026, FILM.id)
    expect(v).toMatchObject({ exists: true, groups: ['①班', '②班'], split: 0, assignment: null })
    const labels: string[] = v.rounds
    expect(labels.slice(0, 2)).toEqual(['1回目', '2回目'])
    expect(v.students.map((s: { key: string }) => s.key)).toEqual([0, 2, 4, 1, 3, 5].map(idOf))
    expect(v.students[0]).toMatchObject({ no: 1, name: nameOf(0), group: '①班', abstractOk: false, finalOk: false, kyomu: false })
    expect(v.students[0].rounds[0]).toEqual({ teacher: '', state: '' })
    // 1人目の1回目は、もう済み（ほかの先生）
    admin().setCheckCell(2026, FILM.id, idOf(0), { round: '1回目', teacher: '加藤', state: 'done' })
    const rows = { '①班': labels.map((_, r) => (r % 2 ? '佐藤' : '梶田')), '②班': labels.map((_, r) => (r % 2 ? '梶田' : '佐藤')) }
    v = admin().saveAssignment(2026, FILM.id, { labels, rows })
    expect(v.assignment.rows['①班'][0]).toBe('梶田')
    const cells = () => sheetStudents()
    expect(cells()[idOf(0)].cells['1回目']).toBe('加藤 済み')
    expect(cells()[idOf(2)].cells['1回目']).toBe('梶田 予定')
    expect(cells()[idOf(1)].cells['2回目']).toBe('梶田 予定')
    expect(v.students.find((s: { key: string }) => s.key === idOf(2)).rounds[0]).toEqual({ teacher: '梶田', state: 'plan' })
    expect(memberHistory().some((h) => h.includes('担当の割り振りを点検表に入れる'))).toBe(true)
    // 指導教員でない名前・形の崩れた割り振りは断る
    expect(() => admin().saveAssignment(2026, FILM.id, { labels, rows: { '①班': ['山田'] } })).toThrow('「山田」は、このコースの指導教員にいません')
    expect(() => admin().saveAssignment(2026, FILM.id, { labels: 'x', rows })).toThrow('割り振りの形が正しくありません')
    // あとから来た学生にも、10分ごとの写しで入る
    a = api()
    expect(register(a, 6, { group: '①班', groupAt: at })).toEqual({ ok: true })
    admin().syncCheckSheets()
    expect(cells()[idOf(6)].cells['1回目']).toBe('梶田 予定')
    // 札を押して「済み」に（写しても、割り振りで書き換えない）
    const s = admin().setCheckCell(2026, FILM.id, idOf(2), { round: '1回目', teacher: '梶田', state: 'done' })
    expect(s.rounds[0]).toEqual({ teacher: '梶田', state: 'done' })
    admin().syncCheckSheets()
    expect(cells()[idOf(2)].cells['1回目']).toBe('梶田 済み')
    // ✓：記録の列に「日時 / 名字」（登録した氏名の名字）。外すと消す
    expect(admin().setCheckCell(2026, FILM.id, idOf(2), { kind: 'abstractOk', on: true }).abstractOk).toBe(true)
    expect(String(cells()[idOf(2)].cells['抄録許可の記録'])).toMatch(/ \/ 梶田$/)
    admin().setCheckCell(2026, FILM.id, idOf(2), { kind: 'abstractOk', on: false })
    expect(cells()[idOf(2)].cells['抄録許可の記録']).toBe('')
    // 形の正しくない書き込みは断る
    expect(() => admin().setCheckCell(2026, FILM.id, idOf(2), { round: '1回目', teacher: '=HYPERLINK("x")', state: 'done' })).toThrow('先生の名前の形が正しくありません')
    expect(() => admin().setCheckCell(2026, FILM.id, idOf(2), { round: 'ない回', teacher: '梶田', state: 'done' })).toThrow('回の列「ない回」が見つかりません')
    expect(() => admin().setCheckCell(2026, FILM.id, idOf(2), { kind: 'other', on: true })).toThrow('書く欄の形が正しくありません')
    expect(() => admin().setCheckCell(2026, FILM.id, 'nobody', { kind: 'finalOk', on: true })).toThrow('この学生が見つかりません')
  })

  it('並び順で等分（checkSplit。依頼者の選択 2026-11-09「いつも等分し直す」）：所属のないコースは、点検表の並びを上から等分して 1班〜。人数が変わると分け直し、班が変わった学生には新しい班の割り振り。所属があれば等分しない', () => {
    setup()
    user = 'sensei@example.ac.jp'
    admin().saveTeacherEdits(2026, { sheets: { [FILM.id]: { groups: [], checkById: true, checkOneColumn: true, checkSplit: 3 } } })
    expect(admin().getState().years[0].config.courses[0].checkSplit).toBe(3)
    for (let i = 0; i < 7; i++) register(api(), i)
    admin().ensureCheckSheet(2026, FILM.id)
    let v = admin().getCheckView(2026, FILM.id)
    expect(v).toMatchObject({ groups: ['1班', '2班', '3班'], split: 3 })
    expect(v.students.map((s: { group: string }) => s.group)).toEqual(['1班', '1班', '1班', '2班', '2班', '3班', '3班'])
    expect(layoutOf().header.slice(0, 3)).toEqual(['番号', '所属', '氏名'])
    admin().saveAssignment(2026, FILM.id, { labels: ['1回目'], rows: { '1班': ['梶田'], '2班': ['佐藤'], '3班': ['加藤'] } })
    expect(sheetStudents()[idOf(5)].cells['1回目']).toBe('加藤 予定')
    // 8人になると 3・3・2 に分け直す（6人目は 3班 → 2班）
    register(api(), 7)
    admin().syncCheckSheets()
    v = admin().getCheckView(2026, FILM.id)
    expect(v.students.map((s: { group: string }) => s.group)).toEqual(['1班', '1班', '1班', '2班', '2班', '2班', '3班', '3班'])
    expect(sheetStudents()[idOf(5)].cells['1回目']).toBe('佐藤 予定')
    expect(sheetStudents()[idOf(7)].cells['1回目']).toBe('加藤 予定')
    // 分ける数は 2〜6
    expect(() => admin().saveTeacherEdits(2026, { sheets: { [FILM.id]: { groups: [], checkById: true, checkOneColumn: true, checkSplit: 9 } } })).toThrow('並び順で分ける数が正しくありません')
    // 所属を登録すると、等分しない
    admin().saveTeacherEdits(2026, { sheets: { [FILM.id]: { groups: ['A'], checkById: true, checkOneColumn: true, checkSplit: 3 } } })
    expect('checkSplit' in admin().getState().years[0].config.courses[0]).toBe(false)
  })

  it('setupCheckSheets（エディタで1回）：10分ごとの写し・点検表ごとの編集の仕掛け・届いた声のメールの仕掛けを作り直す（デプロイした本人だけ。終わった年度の仕掛けは外す）', () => {
    const a = setup()
    register(a, 0)
    admin().ensureCheckSheet(2026, FILM.id)
    triggers.push({ handler: 'onCheckSheetEdit', kind: 'edit', source: 'gone' }, { handler: 'syncCheckSheets', kind: 'time', minutes: 5 })
    admin().setupCheckSheets()
    admin().setupCheckSheets()
    const list = () => triggers.map((t) => `${t.handler}:${t.source ?? t.minutes}`).sort()
    expect(list()).toEqual(['notifyNewFeedback:10', 'onCheckSheetEdit:book1', 'syncCheckSheets:10'])
    expect(stored.get('ADMIN_SHEET_ID')).toBe('sheet-id')
    // 新しい年度を公開すると、前の年度は終わり。その点検表の仕掛けは外し、もう写さない
    admin().createYear(2026, 2027)
    admin().publishYear(2027)
    admin().setupCheckSheets()
    expect(list()).toEqual(['notifyNewFeedback:10', 'syncCheckSheets:10'])
    user = 'sensei@example.ac.jp'
    expect(() => admin().setupCheckSheets()).toThrow(/デプロイした人/)
  })
})
