import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Course } from '../config'
import { courseName } from './changes'
import { Modal } from './Modal'
import { server, type StudentEntry } from './server'
import { byKana, comparerFor, isKanaOrder, movedFlags, studentIdLabel } from './studentOrder'
import { useReorder } from './useReorder'
import { useSlow } from './useWait'
import { GripMark } from './ui'
import { SlowNote, Waiting } from './Wait'

/**
 * 「学生の並びを直す」の窓（mockups/v103 案1。依頼者の選択 2026-11-04）：点検表の学生の並び。
 * はじめはふりがなの順。⋮⋮ をドラッグするか ▲▼ で動かす（useReorder。キーボードでは ⋮⋮ で ↑・↓）。
 * 手で動かした学生には「手で動かした」。「この並びにする」で名簿の並びに書き、点検表もこの並びにする。
 * ふりがなの順のままなら並びを空にして保存する（あとから来た学生も、ふりがなの所に入る）。
 * 所属・順番（依頼者の選択 2026-11-09 mockups/v119）：所属のあるコースは、所属ごとに見出しを付けて並べ、動かせるのは所属の中だけ
 * （点検表は、いつも所属ごとに並ぶため）。その中は、コースの順番（五十音順・学籍番号順）。course は保存してある設定
 */
export function StudentOrderDialog({ year, course, onClose, onSaved }: { year: number; course: Course; onClose: () => void; onSaved: () => void }) {
  const [list, setList] = useState<StudentEntry[] | null>(null)
  /** 読み込んだときの所属（学籍番号 → 所属。先生が直した学生だけを送るため） */
  const [loadedGroups, setLoadedGroups] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const slow = useSlow(saving || (!list && !loadError))
  useEffect(() => {
    let alive = true
    server
      .listStudents(year, course.id)
      .then((l) => {
        if (!alive) return
        setList(l)
        setLoadedGroups(Object.fromEntries(l.map((e) => [e.studentId, e.group])))
      })
      .catch((e: unknown) => alive && setLoadError(`読み込めませんでした：${String((e as Error)?.message ?? e)}`))
    return () => {
      alive = false
    }
  }, [year, course.id])

  const compare = comparerFor(course)
  const groups = course.groups ?? []
  /** 所属を使うコースで、その学生の所属の見出し（登録した所属にない学生は、まだ選んでいない） */
  const groupOf = (e: StudentEntry) => (groups.includes(e.group) ? e.group : '')
  const orderName = course.checkById ? '学籍番号順' : '五十音順'
  const listRef = useRef<HTMLDivElement>(null)
  const move = (from: number, to: number) =>
    setList((l) => {
      if (!l || to < 0 || to >= l.length) return l
      // 所属のあるコースは、所属の中だけで動かす
      if (groups.length && groupOf(l[from]) !== groupOf(l[to])) return l
      const next = [...l]
      const [s] = next.splice(from, 1)
      next.splice(to, 0, s)
      return next
    })
  /**
   * 学生の所属を直す（学生が間違えて選んだとき：依頼者の選択 2026-11-09）。直した所属の中の、決まった順の所へ動かす
   */
  const setGroup = (index: number, group: string) =>
    setList((l) => {
      if (!l) return l
      const entry = { ...l[index], group }
      const rest = l.filter((_, k) => k !== index)
      let at = rest.findIndex((x) => compare(entry, x) < 0)
      if (at < 0) at = rest.length
      rest.splice(at, 0, entry)
      return rest
    })
  const order = useReorder(listRef, list?.length ?? 0, move, '.so-li')
  const moved = list ? movedFlags(list, compare) : []

  const save = async () => {
    if (!list) return
    setSaving(true)
    setSaveError(null)
    try {
      const fixes = Object.fromEntries(list.filter((e) => groupOf(e) && groupOf(e) !== (loadedGroups[e.studentId] ?? '')).map((e) => [e.studentId, e.group]))
      await server.saveStudentOrder(year, course.id, isKanaOrder(list, compare) ? null : list.map((s) => s.studentId), fixes)
      onSaved()
    } catch (e) {
      setSaveError(`保存できませんでした：${String((e as Error)?.message ?? e)}`)
    } finally {
      setSaving(false)
    }
  }

  // 窓は body の直下に出す（コースの欄の中に置くと、スクロールする入れ物の中に閉じ込められることがあるため）
  return createPortal(
    <Modal title={`学生の並び（${courseName(course)} コース）`} onClose={onClose} className={`so-modal${groups.length ? ' with-groups' : ''}`}>
      <p className="lead">
        {groups.length ? `所属ごとに、その中は${orderName}に自動で並んでいます。` : `${orderName}に自動で並んでいます。`}
        <GripMark /> をドラッグするか、▲▼ で{groups.length ? '所属の中で' : ''}動かします。この並びが点検表の順になります。
        {groups.length > 0 && '学生が所属を間違えて選んだときは、「所属」の欄で直せます（学生の画面の所属も直ります）。'}
      </p>
      {loadError ? (
        <p className="so-error">{loadError}</p>
      ) : !list ? (
        <p className="so-wait">
          <Waiting text="読み込んでいます…" />
          <SlowNote show={slow} />
        </p>
      ) : !list.length ? (
        <p className="so-empty">まだ学生が載っていません。学生がツールでコースと氏名を入れると、ここに出ます。</p>
      ) : (
        <div className="so-box">
          <div className="so-head" aria-hidden="true">
            <span />
            <span className="no">番号</span>
            <span>ふりがな</span>
            <span>氏名</span>
            <span>学籍番号</span>
            {groups.length > 0 && <span>所属</span>}
            <span>動かす</span>
          </div>
          <div className="so-list" ref={listRef}>
            {list.map((s, i) => [
              groups.length > 0 && (i === 0 || groupOf(list[i - 1]) !== groupOf(s)) && (
                <div key={`g-${groupOf(s)}`} className="so-group">
                  {groupOf(s) || '所属をまだ選んでいない学生'}
                  <small>{list.filter((x) => groupOf(x) === groupOf(s)).length}人</small>
                </div>
              ),
              <div key={s.studentId} className={`so-li${moved[i] ? ' moved' : ''}${order.drag?.from === i ? ' dragging' : ''}`} data-id={s.studentId}>
                <button className="grip" {...order.gripProps(i, s.studentId)}>
                  ⋮⋮
                </button>
                <span className="no">{i + 1}</span>
                <span className="kana">{s.kana}</span>
                <span className="nm">
                  {s.name}
                  {moved[i] && <span className="so-tag">手で動かした</span>}
                </span>
                <span className="id">{studentIdLabel(s.studentId)}</span>
                {groups.length > 0 && (
                  <select className="grp in" aria-label={`${s.name}の所属`} value={groupOf(s)} onChange={(e) => setGroup(i, e.target.value)}>
                    {!groupOf(s) && <option value="">（まだ）</option>}
                    {groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                )}
                <span className="mv">
                  <button type="button" className="up" aria-label={`${s.name}を上へ`} disabled={i === 0 || (groups.length > 0 && groupOf(list[i - 1]) !== groupOf(s))} onClick={() => move(i, i - 1)}>
                    ▲
                  </button>
                  <button type="button" className="down" aria-label={`${s.name}を下へ`} disabled={i === list.length - 1 || (groups.length > 0 && groupOf(list[i + 1]) !== groupOf(s))} onClick={() => move(i, i + 1)}>
                    ▼
                  </button>
                </span>
              </div>,
            ])}
            {order.drag?.line != null && <div className="drop-line" style={{ top: order.drag.line }} />}
          </div>
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {order.message}
      </div>
      {saveError && <p className="so-error">{saveError}</p>}
      <div className="so-foot">
        <button type="button" className="btn quiet sm so-kana" disabled={!list || saving || isKanaOrder(list, compare)} onClick={() => list && setList(byKana(list, compare))}>
          {orderName}に戻す
        </button>
        <span className="spacer" />
        <SlowNote show={saving && slow} />
        <button type="button" className="btn" onClick={onClose}>
          やめる
        </button>
        <button type="button" className={`btn primary so-save${saving ? ' busy' : ''}`} disabled={!list || !list.length || saving} onClick={() => void save()}>
          {saving ? <Waiting text="保存しています…" /> : 'この並びにする'}
        </button>
      </div>
    </Modal>,
    document.body,
  )
}
