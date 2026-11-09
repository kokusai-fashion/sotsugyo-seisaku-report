import { useState } from 'react'
import type { Course } from '../config'
import { courseName } from './changes'
import { Modal } from './Modal'
import { server, type Profile } from './server'
import { Waiting } from './Wait'

/**
 * 先生の「氏名と担当コース」（依頼者の判断 2026-11-09）。点検表の「自分の担当」を見分けるのと、先生が見られるコース（担当の1つだけ）に使う。
 * まだ登録していない先生は、管理ページを開いたときにこの窓が出る（閉じられない）。左下の「氏名と担当コース」からも直せる。
 * 指導教員の一覧（コースごと）から自分の名前を押すと、氏名とコースが一緒に決まる。一覧にないときだけ、氏名を入れてコースを1つ選ぶ。
 * 担当のコースは、いつも1つ（依頼者：「複数選択できると逆に間違っても困る」）
 */
export function ProfileDialog({ courses, me, required, onDone, onClose }: { courses: Course[]; me: Profile | null; required: boolean; onDone: (p: Profile) => void; onClose: () => void }) {
  // 名前の空白は全角1つにそろえる（サーバーも、そう直して保存する）
  const choices = courses.flatMap((c) => c.advisors.filter((a) => a.trim()).map((name) => ({ name: name.trim().replace(/\s+/g, '　'), courseId: c.id, course: courseName(c) })))
  const known = (p: Profile | null) => !!p && choices.some((x) => x.name === p.name && x.courseId === p.courseId)
  const [pick, setPick] = useState<Profile | null>(me && known(me) ? me : null)
  // 一覧にないとき：氏名を入れて、コースを1つ選ぶ
  const [typing, setTyping] = useState(!!me?.name && !known(me))
  const [name, setName] = useState(me?.name && !known(me) ? me.name : '')
  const [courseId, setCourseId] = useState(me?.courseId && !known(me) ? me.courseId : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const chosen: Profile | null = typing ? (name.trim() && courseId ? { name: name.trim(), courseId } : null) : pick
  const save = async () => {
    if (!chosen) return
    setBusy(true)
    setError('')
    try {
      onDone(await server.setMyProfile(chosen.name, chosen.courseId))
    } catch (e) {
      setError(`登録できませんでした：${e instanceof Error ? e.message : String(e)}`)
      setBusy(false)
    }
  }
  return (
    <Modal title="氏名と担当コース" className="profile-modal" onClose={required || busy ? () => undefined : onClose} closable={!required}>
      <p className="lead">
        {required
          ? 'はじめに、お名前と担当のコースを登録してください。管理ページには担当のコースだけが出て、点検表では「自分の担当」を出せます。'
          : me?.name
            ? 'お名前と担当のコースを直します。'
            : '点検表で「自分の担当」を出したいときに登録します（管理者は、登録しなくても使えます）。'}
      </p>
      {!typing ? (
        <>
          <p className="pf-h">お名前を押してください</p>
          <div className="pf-list" role="radiogroup" aria-label="お名前">
            {choices.map((x) => {
              const on = pick?.name === x.name && pick.courseId === x.courseId
              return (
                <button key={`${x.courseId}:${x.name}`} type="button" role="radio" aria-checked={on} className={on ? 'on' : ''} disabled={busy} onClick={() => setPick({ name: x.name, courseId: x.courseId })}>
                  <b>{x.name}</b>
                  <small>{x.course} コース</small>
                </button>
              )
            })}
          </div>
          <button type="button" className="pf-other" onClick={() => setTyping(true)}>
            一覧に名前がないとき
          </button>
        </>
      ) : (
        <>
          <label className="f">
            <span className="l">氏名（姓と名の間に空白）</span>
            <input className="in" value={name} maxLength={40} placeholder="例：文化　花子" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="f">
            <span className="l">担当のコース（1つ）</span>
            <select className="in" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">選んでください</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {courseName(c)} コース
                </option>
              ))}
            </select>
          </label>
          {choices.length > 0 && (
            <button type="button" className="pf-other" onClick={() => setTyping(false)}>
              一覧から選ぶ
            </button>
          )}
        </>
      )}
      {error && <p className="ck-error">{error}</p>}
      <div className="row-buttons">
        <span className="spacer" />
        {!required && (
          <button className="btn" disabled={busy} onClick={onClose}>
            やめる
          </button>
        )}
        <button className={`btn primary${busy ? ' busy' : ''}`} disabled={!chosen || busy} aria-busy={busy} onClick={() => void save()}>
          {busy ? <Waiting text="登録しています…" /> : '登録する'}
        </button>
      </div>
    </Modal>
  )
}
