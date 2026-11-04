import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Course } from '../config'
import { courseName } from './changes'
import { Modal } from './Modal'
import { server, type StudentEntry } from './server'
import { byKana, isKanaOrder, movedFlags, studentIdLabel } from './studentOrder'
import { useReorder } from './useReorder'
import { useSlow } from './useWait'
import { SlowNote, Waiting } from './Wait'

/**
 * 「学生の並びを直す」の窓（mockups/v103 案1。依頼者の選択 2026-11-04）：点検表の学生の並び。
 * はじめはふりがなの順。⋮⋮ をドラッグするか ▲▼ で動かす（useReorder。キーボードでは ⋮⋮ で ↑・↓）。
 * 手で動かした学生には「手で動かした」。「この並びにする」で名簿の並びに書き、点検表もこの並びにする。
 * ふりがなの順のままなら並びを空にして保存する（あとから来た学生も、ふりがなの所に入る）
 */
export function StudentOrderDialog({ year, course, onClose, onSaved }: { year: number; course: Course; onClose: () => void; onSaved: () => void }) {
  const [list, setList] = useState<StudentEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const slow = useSlow(saving || (!list && !loadError))
  useEffect(() => {
    let alive = true
    server
      .listStudents(year, course.id)
      .then((l) => alive && setList(l))
      .catch((e: unknown) => alive && setLoadError(`読み込めませんでした：${String((e as Error)?.message ?? e)}`))
    return () => {
      alive = false
    }
  }, [year, course.id])

  const listRef = useRef<HTMLDivElement>(null)
  const move = (from: number, to: number) =>
    setList((l) => {
      if (!l || to < 0 || to >= l.length) return l
      const next = [...l]
      const [s] = next.splice(from, 1)
      next.splice(to, 0, s)
      return next
    })
  const order = useReorder(listRef, list?.length ?? 0, move, '.so-li')
  const moved = list ? movedFlags(list) : []

  const save = async () => {
    if (!list) return
    setSaving(true)
    setSaveError(null)
    try {
      await server.saveStudentOrder(year, course.id, isKanaOrder(list) ? null : list.map((s) => s.studentId))
      onSaved()
    } catch (e) {
      setSaveError(`保存できませんでした：${String((e as Error)?.message ?? e)}`)
    } finally {
      setSaving(false)
    }
  }

  // 窓は body の直下に出す（コースの欄の中に置くと、スクロールする入れ物の中に閉じ込められることがあるため）
  return createPortal(
    <Modal title={`学生の並び（${courseName(course)} コース）`} onClose={onClose} className="so-modal">
      <p className="lead">ふりがなの順に自動で並んでいます。⋮⋮ をドラッグするか、▲▼ で動かします。この並びが点検表の順になります。</p>
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
            <span>動かす</span>
          </div>
          <div className="so-list" ref={listRef}>
            {list.map((s, i) => (
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
                <span className="mv">
                  <button type="button" className="up" aria-label={`${s.name}を上へ`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                    ▲
                  </button>
                  <button type="button" className="down" aria-label={`${s.name}を下へ`} disabled={i === list.length - 1} onClick={() => move(i, i + 1)}>
                    ▼
                  </button>
                </span>
              </div>
            ))}
            {order.drag?.line != null && <div className="drop-line" style={{ top: order.drag.line }} />}
          </div>
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {order.message}
      </div>
      {saveError && <p className="so-error">{saveError}</p>}
      <div className="so-foot">
        <button type="button" className="btn quiet sm so-kana" disabled={!list || saving || isKanaOrder(list)} onClick={() => list && setList(byKana(list))}>
          ふりがなの順に戻す
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
