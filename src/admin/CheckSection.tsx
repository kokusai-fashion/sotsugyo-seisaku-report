import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Course } from '../config'
import { AdminIcon } from './adminIcons'
import { courseName } from './changes'
import { assigned, CHECK_COURSE_KEY as COURSE_KEY, doneCount, leftCount, myBlocks, rotate, surnameOf } from './checkView'
import { server, type CheckField, type CheckRound, type CheckStudent, type CheckView, type Profile } from './server'
import { useSlow } from './useWait'
import { SlowNote, Waiting } from './Wait'

/**
 * 「点検表」の区切り（管理者・先生。依頼者の選択 2026-11-09 mockups/v126：最初の見本 v122 の見た目をもとに）。
 * 点検表（コースごとのスプレッドシート）の中身を、表・カード・担当の目線の3つの見せ方で見て、ここから「済み」や許可の ✓ を入れる（裏はスプレッドシートのまま）。
 * 先生は担当のコースだけ（courses に1つ）。管理者は全部のコースから選ぶ。
 * 範囲（自分の担当・コース全体）と所属で絞る。見せ方はこの端末で覚える（はじめはパソコンが表、スマホが担当の目線）。
 * 「担当の割り振り」：所属（または並び順で等分した班）と回の表で先生を選び、点検表に「名字 予定」を入れる（1回ずつずらして埋める）
 */

type Mode = 'table' | 'card' | 'mine'
const MODE_KEY = 'sotsugyo-admin-check-mode'
function loadMode(phone: boolean, hasMe: boolean): Mode {
  try {
    const saved = localStorage.getItem(MODE_KEY)
    if (saved === 'table' || saved === 'card' || saved === 'mine') return saved
  } catch {
    // 覚えていなければ、はじめの形
  }
  return phone && hasMe ? 'mine' : 'table'
}

/** 先生ごとの色（点検表の「済み」の色と同じ：1人目から薄赤・緑・砂色。4人目からは繰り返し） */
const TONES = [
  { bg: '#f8e1e4', ink: '#8a3442' },
  { bg: '#e7efe6', ink: '#3d6342' },
  { bg: '#f2ece0', ink: '#7a5a2c' },
]
/** 所属の色（点検表の所属の列と同じ：青灰・藤色・水色） */
const GROUP_TONES = [
  { bg: '#d7e1f2', ink: '#2d4470' },
  { bg: '#e5d9f2', ink: '#56377c' },
  { bg: '#cfeaec', ink: '#1b5a5e' },
]

interface Props {
  year: number
  /** 見られるコース（先生は担当のコースだけ） */
  courses: Course[]
  me: Profile | null
  /** 管理ページの場所（この画面に直接入るリンク） */
  adminUrl?: string
  admin: boolean
  phone: boolean
  /** 区切りの見出しのすぐ下に出す知らせ（氏名と担当コースを登録した など） */
  notices?: ReactNode
}

export function CheckSection({ year, courses, me, adminUrl, admin, phone, notices }: Props) {
  const myName = me?.name ? surnameOf(me.name) : ''
  const [courseId, setCourseIdState] = useState(() => {
    let saved = ''
    try {
      saved = localStorage.getItem(COURSE_KEY) ?? ''
    } catch {
      // 覚えていなければ、担当のコースか、いちばん上のコース
    }
    return [saved, me?.courseId].find((id) => id && courses.some((c) => c.id === id)) ?? courses[0]?.id ?? ''
  })
  const setCourseId = (id: string) => {
    setCourseIdState(id)
    // 前のコースの所属で絞ったまま0人に見えた・記録の欄が残った（2026-11-09 の点検）
    setGroup('')
    setPicked(null)
    setLinkOpen(false)
    setSub('check')
    setTab('left')
    setScope(null)
    setRefreshing(null)
    setCreating(false)
    setError('')
    try {
      localStorage.setItem(COURSE_KEY, id)
    } catch {
      // 覚えられなくても、今は切り替わる
    }
  }
  const course = courses.find((c) => c.id === courseId)
  const [view, setView] = useState<CheckView | null>(null)
  /** いま見ている年度・コース。書く・更新する・割り振るの返事は、押したときと同じときだけ使う（途中でコースを替えると、前のコースの表が出た：2026-11-09 の点検） */
  const showing = useRef('')
  useEffect(() => {
    showing.current = `${year}:${courseId}`
  }, [year, courseId])
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [mode, setModeState] = useState<Mode>(() => loadMode(phone, !!myName))
  const setMode = (m: Mode) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // 覚えられなくても、今は切り替わる
    }
  }
  /** 範囲（はじめは、自分の担当があれば自分の担当。まだ割り振っていなければコース全体） */
  const [scope, setScope] = useState<'mine' | 'all' | null>(null)
  const [group, setGroup] = useState('')
  const [tab, setTab] = useState<number | 'left'>('left')
  const [sub, setSub] = useState<'check' | 'assign'>('check')
  const [picked, setPicked] = useState<string | null>(null)
  const [busyKeys, setBusyKeys] = useState<string[]>([])
  const isBusy = (key: string) => busyKeys.includes(key)
  const [linkOpen, setLinkOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  /** 「今すぐ更新」：'busy' 写している・'done' 写し終わった（数秒「更新しました」） */
  const [refreshing, setRefreshing] = useState<'busy' | 'done' | null>(null)
  const slow = useSlow(!view && !error)

  // 保存したコースの設定のうち、点検表の中身に効くもの（変わったら読み直す：点検表の画面から保存したとき、表示が古いまま残った：2026-11-09 の点検）
  const settingsKey = JSON.stringify([course?.groups ?? [], course?.checkSplit ?? 0, course?.checkById === true, course?.checkOneColumn === true, course?.advisors ?? []])
  useEffect(() => {
    if (!courseId) return
    let live = true
    setView(null)
    setError('')
    server.getCheckView(year, courseId).then(
      (v) => live && setView(v),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [year, courseId, reload, settingsKey])

  // 読み直した点検表に、選んでいた所属・学生がなければ、はじめに戻す（所属で絞ったまま設定を保存すると、表が空になった：2026-11-09 の点検）
  useEffect(() => {
    if (!view) return
    if (group && !view.groups.includes(group)) setGroup('')
    if (picked && !view.students.some((s) => s.key === picked)) setPicked(null)
  }, [view, group, picked])
  // 見ているコースを選べなくなったら（学生に表示しないにして保存した など）、いちばん上のコースへ
  useEffect(() => {
    if (!course && courses.length) setCourseIdState(courses[0].id)
  }, [course, courses])
  // 記録の欄が画面の外（カードの一覧の下。スマホ・狭い画面）に出たら、そこまで動かす（前は画面が動かず、出たことが分からなかった：2026-11-09 の点検）
  useEffect(() => {
    if (!picked) return
    const id = requestAnimationFrame(() => {
      const panel = document.querySelector('.ck-panel')
      const r = panel?.getBoundingClientRect()
      if (panel && r && (r.top > innerHeight * 0.6 || r.bottom < 0)) panel.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [picked])
  // 「この画面のリンク」の窓：Esc・窓の外を押すと閉じる
  useEffect(() => {
    if (!linkOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLinkOpen(false)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (t && !t.closest('.ck-pop, .ck-linkbtn')) setLinkOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [linkOpen])

  /** 記録の欄を閉じる（スマホは、押したカードの所に戻る：欄はカードの一覧の下にあるため） */
  const closePanel = () => {
    const key = picked
    setPicked(null)
    if (key)
      requestAnimationFrame(() => {
        const card = document.querySelector(`.ck-card[data-key="${CSS.escape(key)}"]`)
        const r = card?.getBoundingClientRect()
        if (card && r && (r.top < 0 || r.bottom > innerHeight)) card.scrollIntoView({ block: 'center' })
      })
  }

  /** 1つの欄を書き、その学生の行を差し替える */
  const write = useCallback(
    async (s: CheckStudent, field: CheckField) => {
      const key = `${s.key}:${'round' in field ? field.round : field.kind}`
      setBusyKeys((b) => [...b, key])
      setError('')
      const asked = `${year}:${courseId}`
      try {
        const next = await server.setCheckCell(year, courseId, s.key, field)
        if (showing.current !== asked) return
        if (next) setView((v) => (v ? { ...v, students: v.students.map((x) => (x.key === next.key ? next : x)) } : v))
      } catch (e) {
        if (showing.current === asked) setError(`書けませんでした：${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setBusyKeys((b) => b.filter((x) => x !== key))
      }
    },
    [year, courseId],
  )
  /** 回の欄の「済み」と「予定」を入れ替える（先生が入っていない欄は、何もしない） */
  const toggle = (s: CheckStudent, r: number) => {
    const cell = s.rounds[r]
    if (!view || !cell.teacher) return
    void write(s, { round: view.rounds[r], teacher: cell.teacher, state: cell.state === 'done' ? 'plan' : 'done' })
  }

  const toneOf = (teacher: string) => {
    const i = view ? view.teachers.indexOf(teacher) : -1
    return TONES[(i < 0 ? 0 : i) % TONES.length]
  }
  const groupTone = (g: string) => {
    const i = view ? view.groups.indexOf(g) : -1
    return i < 0 ? null : GROUP_TONES[i % GROUP_TONES.length]
  }
  const scopeNow = scope ?? (myName && view?.students.some((s) => s.rounds.some((x) => x.teacher === myName)) ? 'mine' : 'all')
  const shown = useMemo(() => {
    if (!view) return []
    return view.students.filter((s) => (!group || s.group === group) && (scopeNow === 'all' || !myName || s.rounds.some((x) => x.teacher === myName)))
  }, [view, group, scopeNow, myName])

  const link = adminUrl ? `${adminUrl}${adminUrl.includes('?') ? '&' : '?'}view=check${admin ? `&course=${encodeURIComponent(courseId)}` : ''}` : ''
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      ;(document.querySelector('.ck-pop code') as HTMLElement | null)?.focus()
    }
  }

  /** 今すぐ更新（10分ごとの写しを待たずに、名簿から点検表に写して読み直す） */
  const refresh = async () => {
    setRefreshing('busy')
    setError('')
    const asked = `${year}:${courseId}`
    try {
      const next = await server.refreshCheckView(year, courseId)
      if (showing.current !== asked) return
      setView(next)
      setRefreshing('done')
      setTimeout(() => setRefreshing((r) => (r === 'done' ? null : r)), 2500)
    } catch (e) {
      if (showing.current !== asked) return
      setError(`更新できませんでした：${e instanceof Error ? e.message : String(e)}`)
      setRefreshing(null)
    }
  }

  const create = async () => {
    setCreating(true)
    setError('')
    const asked = `${year}:${courseId}`
    try {
      await server.ensureCheckSheet(year, courseId)
      if (showing.current === asked) setReload((n) => n + 1)
    } catch (e) {
      if (showing.current === asked) setError(`点検表を作れませんでした：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      if (showing.current === asked) setCreating(false)
    }
  }

  const chip = (s: CheckStudent, r: number) => {
    const x = s.rounds[r]
    if (!x.teacher) return <span className="ck-none">—</span>
    const t = toneOf(x.teacher)
    const label = `${x.teacher} ${x.state === 'done' ? '済み' : x.state === 'plan' ? '予定' : ''}`.trim()
    const cls = x.state === 'done' ? 'ck-chip' : `ck-chip plan${x.teacher === myName ? ' me' : ''}`
    const style = x.state === 'done' ? { background: t.bg, color: t.ink } : undefined
    const busy = isBusy(`${s.key}:${view?.rounds[r]}`)
    return (
      <button type="button" className={`${cls}${busy ? ' busy' : ''}`} style={style} disabled={busy} onClick={() => toggle(s, r)} aria-label={`${s.name}の${view?.rounds[r]}：${label}（押すと${x.state === 'done' ? '予定に戻す' : '済みにする'}）`}>
        {label}
      </button>
    )
  }
  const sw = (s: CheckStudent, kind: 'abstractOk' | 'finalOk' | 'kyomu', label: string) => {
    const busy = isBusy(`${s.key}:${kind}`)
    return (
      <button type="button" role="switch" aria-checked={s[kind]} aria-label={`${s.name}の${label}`} className={`ck-tog${s[kind] ? ' on' : ''}${busy ? ' busy' : ''}`} disabled={busy} onClick={() => void write(s, { kind, on: !s[kind] })} />
    )
  }
  const pdf = (s: CheckStudent) =>
    s.pdf?.url ? (
      <a className="ck-pdf" href={s.pdf.url} target="_blank" rel="noreferrer">
        PDF {s.pdf.label}
      </a>
    ) : (
      <span className="ck-warn gray">PDF まだ</span>
    )
  const note = (s: CheckStudent) => (s.note && s.note !== 'PDF まだ' ? <span className={`ck-warn ${s.note.startsWith('書き換え') || s.note.startsWith('並び') ? 'red' : 'gray'}`}>{s.note}</span> : null)
  const gtag = (g: string) => {
    const t = groupTone(g)
    return g ? (
      <span className="ck-gtag" style={t ? { background: t.bg, color: t.ink } : undefined}>
        {g}
      </span>
    ) : null
  }

  // ---- 上の段（知らせは、その下） ----
  const top = (
    <>
    <div className="ck-top">
      <h1 className="sec-h">
        点検表
        {admin && courses.length > 1 ? (
          <select className="ck-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="コース">
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {courseName(c)} コース
              </option>
            ))}
          </select>
        ) : (
          <span className="ck-course fixed">{course ? `${courseName(course)} コース` : ''}</span>
        )}
      </h1>
      <span className="ck-acts">
        {view?.exists && (
        <button type="button" className={`ck-btn${sub === 'assign' ? ' on' : ''}`} onClick={() => (setSub(sub === 'assign' ? 'check' : 'assign'), setError(''))}>
          {sub === 'assign' ? AdminIcon.sheet : AdminIcon.people}
          {sub === 'assign' ? '点検にもどる' : '担当の割り振り'}
        </button>
        )}
        {view?.exists && (
          <button type="button" className={`ck-btn ck-refresh${refreshing === 'busy' ? ' busy' : ''}`} disabled={refreshing === 'busy'} aria-busy={refreshing === 'busy'} onClick={() => void refresh()} title="新しく登録した学生・並び・PDF の日付などは、10分ごとにスプレッドシートへ自動で入ります。押すと、待たずにいま入れて、この画面も読み直します">
            {refreshing === 'busy' ? <Waiting text="更新中…" /> : <>{AdminIcon.reset}{refreshing === 'done' ? '更新しました' : '今すぐ更新'}</>}
          </button>
        )}
        {link && (
          <button type="button" className={`ck-btn ck-linkbtn${linkOpen ? ' on' : ''}`} onClick={() => setLinkOpen(!linkOpen)} aria-expanded={linkOpen}>
            {AdminIcon.link}この画面のリンク
          </button>
        )}
        {view?.url && (
          <a className="ck-btn" href={view.url} target="_blank" rel="noreferrer">
            <i className="ck-gs" />
            スプレッドシートで開く
          </a>
        )}
        {linkOpen && (
          <div className="ck-pop" role="dialog" aria-label="この画面のリンク">
            <b>この画面に直接入るリンク</b>
            ブックマークや、スマホのホーム画面に置いておくと、1回押すだけで点検表が開きます。
            <span className="ck-url">
              <code tabIndex={0}>{link}</code>
              <button type="button" onClick={() => void copy()}>
                {copied ? 'コピーしました' : 'コピー'}
              </button>
            </span>
            <small>ホーム画面への置き方：iPhone は共有 →「ホーム画面に追加」、Android は右上の点3つ →「ホーム画面に追加」</small>
          </div>
        )}
      </span>
    </div>
    {notices}
    </>
  )

  // 担当のコースが、この年度にない（学生に表示しないコースになった・前の年度のコース）：コースごとの設定と同じ言葉で知らせる
  if (!course) return <p className="ck-empty">{admin ? '点検表を見られるコースがありません。' : 'この年度には、担当のコースがありません。上で年度を切り替えるか、「氏名と担当コース」（パソコンは左下、スマホは一覧のいちばん下）で担当のコースを確かめてください。'}</p>
  if (error && !view)
    return (
      <div className="ck">
        {top}
        <p className="ck-error">{error}</p>
      </div>
    )
  if (!view)
    return (
      <div className="ck">
        {top}
        <p className="ck-wait">
          <Waiting text="点検表を読み込んでいます…" />
          <SlowNote show={slow} />
        </p>
      </div>
    )
  if (!view.exists)
    return (
      <div className="ck">
        {top}
        <div className="ck-box">
          <p>このコースの点検表は、まだありません。作ると、学生がコースと氏名を入れたときに自動で載ります。</p>
          <button type="button" className={`btn primary${creating ? ' busy' : ''}`} disabled={creating} onClick={() => void create()}>
            {creating ? <Waiting text="作っています…" /> : '点検表を作る'}
          </button>
          {error && <p className="ck-error">{error}</p>}
        </div>
      </div>
    )

  if (sub === 'assign') return <div className="ck">{top}{error && <p className="ck-error">{error}</p>}<AssignPanel key={view.groups.join('\n')} view={view} year={year} courseId={courseId} onSaved={(v) => showing.current === `${year}:${courseId}` && setView(v)} /></div>

  // ---- 切り替え ----
  const filters = (
    <div className="ck-filter">
      {myName && (
        <span className="ck-grp">
          <span className="k">範囲</span>
          <span className="ck-chips">
            <button type="button" className={scopeNow === 'mine' ? 'on' : ''} onClick={() => (setScope('mine'), setPicked(null))}>
              自分の担当（{myName}）
            </button>
            <button type="button" className={scopeNow === 'all' ? 'on' : ''} onClick={() => (setScope('all'), setPicked(null))}>
              コース全体
            </button>
          </span>
        </span>
      )}
      {view.groups.length > 0 && (
        <span className="ck-grp">
          <span className="k">{view.split ? '班' : '所属'}</span>
          <span className="ck-chips">
            {['', ...view.groups].map((g) => (
              <button type="button" key={g || 'all'} className={group === g ? 'on' : ''} onClick={() => (setGroup(g), setPicked(null))}>
                {g || 'すべて'}
              </button>
            ))}
          </span>
        </span>
      )}
      <span className="ck-grp right">
        <span className="k">見せ方</span>
        <span className="ck-vseg">
          {(
            [
              ['table', AdminIcon.table, '表'],
              ['card', AdminIcon.course, 'カード'],
              ['mine', AdminIcon.done, '担当の目線'],
            ] as const
          ).map(([m, icon, label]) => (
            <button type="button" key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)} aria-pressed={mode === m} aria-label={label} title={label}>
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </span>
      </span>
    </div>
  )
  const progress = (
    <div className="ck-prog">
      {view.rounds.map((l, r) => {
        const n = doneCount(shown, r)
        return (
          <div key={l}>
            <b>{l}</b>
            <span className="n">
              {n}
              <small>/ {shown.length}人 済み</small>
            </span>
            <div className="ck-bar">
              <i style={{ width: `${shown.length ? (n / shown.length) * 100 : 0}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
  const legend = (
    <div className="ck-legend">
      <span className="ck-chip" style={{ background: TONES[0].bg, color: TONES[0].ink }}>
        済み
      </span>
      <span className="ck-chip plan">予定</span>
      {myName && <span className="ck-chip plan me">自分の担当（青い点線）</span>}
      <span>札を押すと「済み」になります（もう一度押すと「予定」に戻ります）</span>
    </div>
  )
  const empty = !view.students.length ? <p className="ck-empty">まだ学生がいません。学生がツールでコースと氏名を入れると、ここに出ます。</p> : null
  // 範囲が「自分の担当」なのに、このコースにまだ自分の担当が入っていない（全部済んだのではない）
  const noMine = scopeNow === 'mine' && !!myName && !view.students.some((x) => x.rounds.some((c) => c.teacher === myName))
  // 所属で絞って、その所属に自分の担当がいない
  const noMineHere = !noMine && scopeNow === 'mine' && !!myName && !!group && !shown.length
  const noMineNote = noMine ? (
    <p className="ck-empty">このコースには、まだ自分の担当が入っていません（「担当の割り振り」で決めるか、「コース全体」で見てください）。</p>
  ) : noMineHere ? (
    <p className="ck-empty">この所属には、自分の担当の学生がいません。</p>
  ) : null

  // ---- 表 ----
  const tableView = () => {
    const rows: ReactNode[] = []
    shown.forEach((s, i) => {
      if (view.groups.length && (i === 0 || shown[i - 1].group !== s.group)) {
        const list = shown.filter((x) => x.group === s.group)
        const t = groupTone(s.group)
        rows.push(
          <tr key={`g-${s.group}`} className="gh">
            <td colSpan={view.rounds.length + 6} style={t ? { background: t.bg, color: t.ink } : undefined}>
              {s.group || '所属をまだ選んでいない学生'}
              <span className="cnt">{list.length}人</span>
            </td>
          </tr>,
        )
      }
      rows.push(
        <tr key={s.key}>
          <td className="no">{s.no}</td>
          <td className="nm">{s.name}</td>
          <td>{pdf(s)}</td>
          {view.rounds.map((l, r) => (
            <td key={l}>{chip(s, r)}</td>
          ))}
          <td>{sw(s, 'abstractOk', '抄録許可')}</td>
          <td>{sw(s, 'finalOk', '最終提出可')}</td>
          <td>{note(s)}</td>
        </tr>,
      )
    })
    return (
      <div className="ck-ta">
        <table>
          <thead>
            <tr>
              <th />
              <th>氏名</th>
              <th>最新 PDF</th>
              {view.rounds.map((l) => (
                <th key={l}>{l}</th>
              ))}
              <th>抄録許可</th>
              <th>最終提出可</th>
              <th>知らせ</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    )
  }

  // ---- カード ----
  const cardOf = (s: CheckStudent) => {
    const t = groupTone(s.group)
    return (
      <button type="button" key={s.key} data-key={s.key} className={`ck-card${picked === s.key ? ' sel' : ''}`} style={{ ['--g' as string]: t?.ink ?? '#c3c8d0' }} onClick={() => setPicked(picked === s.key ? null : s.key)}>
        <span className="r1">
          <b>{s.name}</b>
          {note(s) ?? (s.pdf?.label ? <span className="ck-pdf">PDF {s.pdf.label}</span> : <span className="ck-warn gray">PDF まだ</span>)}
        </span>
        <span className="ck-dots">
          {s.rounds.map((x, r) => {
            const tone = x.state === 'done' ? toneOf(x.teacher) : null
            return (
              <span key={r} className="ck-dot">
                <i className={x.state === 'done' ? '' : `plan${x.teacher === myName ? ' me' : ''}`} style={tone ? { background: tone.bg, color: tone.ink } : undefined}>
                  {x.teacher ? x.teacher[0] : ''}
                </i>
                {view.rounds[r].replace('回目', '')}
              </span>
            )
          })}
        </span>
        <span className="ck-badges">
          <span className={s.abstractOk ? 'ok' : ''}>抄録許可 {s.abstractOk ? '✓' : '—'}</span>
          <span className={s.finalOk ? 'ok' : ''}>最終提出可 {s.finalOk ? '✓' : '—'}</span>
        </span>
      </button>
    )
  }
  const cardView = () => {
    const groups = view.groups.length ? [...view.groups, ''].filter((g) => shown.some((s) => s.group === g)) : ['']
    return (
      <div className="ck-cardwrap">
        {groups.map((g) => {
          const list = shown.filter((s) => !view.groups.length || s.group === g)
          return (
            <div key={g || 'all'} className="ck-gb">
              {view.groups.length > 0 && (
                <h3>
                  {gtag(g) ?? <span className="ck-gtag">所属をまだ選んでいない学生</span>}
                  <small>{list.length}人</small>
                </h3>
              )}
              <div className="ck-cards">{list.map(cardOf)}</div>
            </div>
          )
        })}
      </div>
    )
  }
  const pickedStudent = view.students.find((s) => s.key === picked)
  const panel = pickedStudent && (
    <div className="ck-panel" role="dialog" aria-label={`${pickedStudent.name}の記録`}>
      <div className="hd">
        <b>{pickedStudent.name}</b>
        {gtag(pickedStudent.group)}
        <button type="button" className="x" aria-label="閉じる" onClick={closePanel}>
          ×
        </button>
      </div>
      <div>{pdf(pickedStudent)}</div>
      <div>
        <div className="lbl">点検の回</div>
        {view.rounds.map((l, r) => (
          <RoundRow key={l} label={l} cell={pickedStudent.rounds[r]} teachers={view.teachers} myName={myName} busy={isBusy(`${pickedStudent.key}:${l}`)} tone={toneOf(pickedStudent.rounds[r].teacher)} onSet={(teacher, state) => void write(pickedStudent, { round: l, teacher, state })} />
        ))}
      </div>
      <div className="perm">
        <div>
          <span>抄録許可</span>
          {sw(pickedStudent, 'abstractOk', '抄録許可')}
        </div>
        <div>
          <span>最終提出可</span>
          {sw(pickedStudent, 'finalOk', '最終提出可')}
        </div>
        <div>
          <span>教務提出</span>
          {sw(pickedStudent, 'kyomu', '教務提出')}
        </div>
      </div>
    </div>
  )

  // ---- 担当の目線 ----
  const mineView = () => {
    const showLeft = scopeNow === 'mine' && !!myName
    const current = tab === 'left' && !showLeft ? 0 : tab
    const blocks =
      current === 'left'
        ? myBlocks(view, myName, shown)
        : [{ r: current, label: view.rounds[current], kind: 'now' as const, list: shown.filter((s) => s.rounds[current].state !== 'done' && (scopeNow === 'all' || s.rounds[current].teacher === myName)) }].filter((b) => b.list.length > 0)
    const r = current === 'left' ? view.rounds.findIndex((_, k) => !view.students.every((s) => !s.rounds[k].teacher || s.rounds[k].state === 'done')) : current
    const statRound = r < 0 ? 0 : r
    return (
      <>
        <div className="ck-tabs" role="tablist">
          {showLeft && (
            <button type="button" role="tab" aria-selected={current === 'left'} className={current === 'left' ? 'on' : ''} onClick={() => setTab('left')}>
              まだの分{leftCount(view, myName, shown) > 0 && <em>{leftCount(view, myName, shown)}</em>}
            </button>
          )}
          {view.rounds.map((l, k) => (
            <button type="button" role="tab" key={l} aria-selected={current === k} className={current === k ? 'on' : ''} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="ck-cgrid">
          <div className="ck-col">
            {!blocks.length && !noMine && !noMineHere && <div className="ck-box ck-done">ここに出す学生はいません。{current === 'left' ? 'まだ済んでいない学生がいなくなりました。' : ''}</div>}
            {blocks.map((b) =>
              b.kind === 'later' ? (
                <FoldBox key={b.r} label={b.label} count={b.list.length}>
                  {b.list.map((s) => taskRow(s, b.r, false))}
                </FoldBox>
              ) : (
                <div key={b.r} className="ck-box">
                  <h3>
                    {b.label}
                    {b.kind === 'left' && current === 'left' && <span className="left">残り</span>}
                    <small>{b.list.length}人</small>
                  </h3>
                  {b.list.map((s) => taskRow(s, b.r, b.kind === 'left' && current === 'left'))}
                </div>
              ),
            )}
          </div>
          <div className="ck-col">
            <div className="ck-box">
              <h3>
                {view.rounds[statRound]}の進み具合<small>先生ごと</small>
              </h3>
              {view.teachers.map((t) => {
                const list = assigned(view, statRound, t)
                const n = doneCount(list, statRound)
                const tone = toneOf(t)
                return (
                  <div key={t} className="ck-trow">
                    <span className="ck-chip" style={{ background: tone.bg, color: tone.ink }}>
                      {t}
                    </span>
                    <span className="ck-bar">
                      <i style={{ width: `${list.length ? (n / list.length) * 100 : 0}%`, background: tone.ink }} />
                    </span>
                    <span>
                      {n} / {list.length}人
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="ck-box">
              <h3>気になる学生</h3>
              <div className="ck-wait-list">
                {myName && <div>・始まった回で、まだ済んでいない自分の担当：{leftCount(view, myName)}人</div>}
                <div>・PDF をまだ出していない学生：{view.students.filter((s) => !s.pdf?.url).length}人</div>
                <div>・最終提出のあとに書き換えた学生：{view.students.filter((s) => s.note.startsWith('書き換え')).length}人</div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }
  const taskRow = (s: CheckStudent, r: number, strong: boolean) => {
    const busy = isBusy(`${s.key}:${view.rounds[r]}`)
    const cell = s.rounds[r]
    // 割り振っていない回は、押した先生の名字で「済み」にする（割り振りを使わないコース）
    const who = cell.teacher || myName
    return (
      <div key={`${s.key}-${r}`} className="ck-task">
        <span className="who">
          <b>{s.name}</b>
          {gtag(s.group)}
          {scopeNow === 'all' && cell.teacher && <span className="ck-muted">{cell.teacher}</span>}
        </span>
        {pdf(s)}
        <span>{note(s)}</span>
        {who ? (
          <button type="button" className={`ck-do${strong ? ' strong' : ''}${busy ? ' busy' : ''}`} disabled={busy} onClick={() => void write(s, { round: view.rounds[r], teacher: who, state: 'done' })}>
            {busy ? <Waiting text="" /> : '済みにする'}
          </button>
        ) : (
          <span className="ck-muted">担当なし</span>
        )}
      </div>
    )
  }

  return (
    <div className={`ck${phone ? ' phone' : ''}`}>
      {top}
      {filters}
      {mode !== 'mine' && progress}
      {mode === 'table' && legend}
      {error && <p className="ck-error">{error}</p>}
      {empty}
      {!empty && noMineNote}
      {!empty && mode === 'table' && tableView()}
      {!empty && mode === 'card' && (
        <>
          <div className="ck-legend">丸は回（{view.rounds.map((l) => l.replace('回目', '')).join('・')}）。色の付いた丸は済み、点線の丸は予定{myName ? '、青い点線は自分の担当' : ''}です。カードを押すと、その学生の記録を直せます。</div>
          <div className={`ck-split${pickedStudent ? ' with-panel' : ''}`}>
            {cardView()}
            {panel}
          </div>
        </>
      )}
      {!empty && mode === 'mine' && mineView()}
    </div>
  )
}

/** たたんだ回（まだ先の回。押すと開く） */
function FoldBox({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`ck-box${open ? '' : ' fold'}`}>
      <h3>
        <button type="button" className="ck-fold" aria-expanded={open} onClick={() => setOpen(!open)}>
          {label}・まだ先<small>{count}人　{open ? '▾ たたむ' : '▸ 開く'}</small>
        </button>
      </h3>
      {open && children}
    </div>
  )
}

/** カードの右の欄の、回ごとの1行（先生を選び直す・「済み」にする） */
/**
 * カードの右の欄の、点検の回の1行（依頼者の選択 2026-11-09 mockups/v127 案A）：札の形の「先生を選ぶ欄」（押すと先生を選べる。済みは先生の色、予定は点線）と、
 * 「済みにする」「予定に戻す」のボタン。前は札・選ぶ欄・ボタンの3つで、名前が2回出て、選ぶ欄の右端がボタンの下に隠れていた
 */
function RoundRow({ label, cell, teachers, myName, busy, tone, onSet }: { label: string; cell: CheckRound; teachers: string[]; myName: string; busy: boolean; tone: { bg: string; ink: string }; onSet: (teacher: string, state: CheckRound['state']) => void }) {
  const done = cell.state === 'done'
  const cls = !cell.teacher ? ' none' : done ? '' : ` plan${cell.teacher === myName ? ' me' : ''}`
  return (
    <div className="ck-prow">
      <span className="r">{label}</span>
      <span className={`ck-pchip${cls}${busy ? ' busy' : ''}`} style={cell.teacher && done ? { background: tone.bg, color: tone.ink } : undefined}>
        <span className="t">{cell.teacher ? `${cell.teacher} ${done ? '済み' : '予定'}` : '先生を選ぶ'}</span>
        <i aria-hidden="true">▾</i>
        {/* 札の上に重ねた、見えない選ぶ欄（押すと先生の一覧） */}
        <select aria-label={`${label}の先生`} value={cell.teacher} disabled={busy} onChange={(e) => onSet(e.target.value, e.target.value ? (done ? 'done' : 'plan') : '')}>
          <option value="">—（先生なし）</option>
          {[...new Set([...teachers, cell.teacher].filter(Boolean))].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </span>
      {cell.teacher ? (
        <button type="button" className={`ck-do${cell.state === 'done' ? '' : cell.teacher === myName ? ' strong' : ''}`} disabled={busy} onClick={() => onSet(cell.teacher, cell.state === 'done' ? 'plan' : 'done')}>
          {cell.state === 'done' ? '予定に戻す' : '済みにする'}
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}

/**
 * 担当の割り振り（依頼者の選択 2026-11-09）：まとまり（所属・等分した班）と回の表で、先生を選ぶ。
 * 「1回ずつずらして埋める」で、1回目の先生を2回目から1つずつずらして回す。「点検表に入れる」で、回の欄に「名字 予定」を入れる（済みの欄は書き換えない）
 */
function AssignPanel({ view, year, courseId, onSaved }: { view: CheckView; year: number; courseId: string; onSaved: (v: CheckView) => void }) {
  const initial = () => {
    const rows: Record<string, string[]> = {}
    view.groups.forEach((g) => {
      const saved = view.assignment?.rows[g] ?? []
      rows[g] = view.rounds.map((l) => {
        const i = view.assignment?.labels.indexOf(l) ?? -1
        return i >= 0 ? (saved[i] ?? '') : ''
      })
    })
    return rows
  }
  const [rows, setRows] = useState<Record<string, string[]>>(initial)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  // 知らせが出たら、1回だけ見える所まで動かす（スマホで画面の外に出ていた。描き直しのたびには動かさない）
  useEffect(() => {
    if (note) document.querySelector('.ck-asmsg')?.scrollIntoView({ block: 'nearest' })
  }, [note])
  if (!view.groups.length)
    return (
      <div className="ck-box">
        <p>担当の割り振りは、コースの学生を所属（制作グループなど）か班に分けると使えます。「コースごとの設定」の「所属」で、「学生が選ぶ」か「並び順で等分」を選んで保存してください。</p>
      </div>
    )
  const set = (g: string, r: number, t: string) => {
    setRows({ ...rows, [g]: (rows[g] ?? view.rounds.map(() => '')).map((x, i) => (i === r ? t : x)) })
    setNote(null)
  }
  const ranges = view.split
    ? view.groups.map((g) => {
        const list = view.students.filter((s) => s.group === g)
        return list.length ? `${list[0].no}〜${list[list.length - 1].no}番` : '0人'
      })
    : null
  const save = async () => {
    const none = !Object.values(rows).some((list) => list.some(Boolean))
    if (none && !view.assignment) return setNote({ ok: false, text: '先生がまだ選ばれていません。表で先生を選んでから押してください。' })
    setSaving(true)
    setNote(null)
    try {
      const next = await server.saveAssignment(year, courseId, { labels: view.rounds, rows })
      onSaved(next)
      setNote({ ok: true, text: none ? '割り振りを空にしました。点検表に入っている「予定」は、そのままです。' : `点検表に入れました。「済み」の欄はそのままです。${view.split ? '人数が変わって班が変わった学生にも' : 'あとから所属を選んだ学生にも'}、10分ほどで入ります。` })
    } catch (e) {
      setNote({ ok: false, text: `入れられませんでした：${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <div className="ck-asnote">
        分け方：<b>{view.split ? `並び順で${view.split}等分` : '所属（学生が選ぶ）'}</b>
        <small>{view.split ? `${view.students.length}人を、点検表の並びの上から分けます。人数が変わると分け直します。` : '所属は、学生がはじめに選びます。'}分け方は「コースごとの設定」の「所属」で変えられます。</small>
      </div>
      <div className="ck-ta assign">
        <table>
          <thead>
            <tr>
              <th>{view.split ? '班' : '所属'}</th>
              {view.rounds.map((l) => (
                <th key={l}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.groups.map((g, gi) => {
              const tone = GROUP_TONES[gi % GROUP_TONES.length]
              return (
                <tr key={g}>
                  <td>
                    <span className="ck-gtag" style={{ background: tone.bg, color: tone.ink }}>
                      {g}
                    </span>
                    <small className="ck-muted">
                      {view.students.filter((s) => s.group === g).length}人{ranges && <span style={{ whiteSpace: 'nowrap' }}>{`　${ranges[gi]}`}</span>}
                    </small>
                  </td>
                  {view.rounds.map((l, r) => {
                    const t = rows[g]?.[r] ?? ''
                    const i = view.teachers.indexOf(t)
                    const tt = i >= 0 ? TONES[i % TONES.length] : null
                    return (
                      <td key={l}>
                        <select className="ck-pick" aria-label={`${g}の${l}の先生`} value={t} style={tt ? { background: tt.bg, color: tt.ink } : undefined} onChange={(e) => set(g, r, e.target.value)}>
                          <option value="">—</option>
                          {view.teachers.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="ck-asfoot">
        <button type="button" className="btn" onClick={() => setRows(rotate(view.groups, view.groups.map((g) => rows[g]?.[0] ?? ''), view.rounds.length))} disabled={view.groups.some((g) => !rows[g]?.[0])}>
          1回ずつずらして埋める
        </button>
        <button type="button" className={`btn primary${saving ? ' busy' : ''}`} disabled={saving} onClick={() => void save()}>
          {saving ? <Waiting text="入れています…" /> : '点検表に入れる'}
        </button>
        {note && (
          <p className={`ck-asmsg ${note.ok ? 'ck-ok' : 'ck-error'}`} role="status">
            {note.text}
          </p>
        )}
        <small>1回目の先生を選んで「1回ずつずらして埋める」を押すと、2回目からは、先生が1つ下の{view.split ? '班' : '所属'}へずれて回ります。「点検表に入れる」で、点検表の回の欄に「名字 予定」が入ります（「済み」の欄は書き換えません）。「—」にしても、もう入っている予定は消えません（消すときは、カードを押して出る欄で「—（先生なし）」）。{view.split ? '' : '所属をまだ選んでいない学生には入りません。'}</small>
      </div>
    </>
  )
}
