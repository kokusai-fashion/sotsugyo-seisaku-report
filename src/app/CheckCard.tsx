import { useEffect, useState } from 'react'
import type { Course } from '../config'
import { markText, type CheckStatus } from '../drive/checkStatus'

/** パソコンの右の欄で、開いているか（この端末で覚える。はじめは閉じている） */
const OPEN_KEY = 'sotsugyo-seisaku-report-check-card-open'
function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 「点検の予定と記録」：先生の点検表の、自分の行だけ（依頼者の選択 2026-11-04 mockups/v105。ほかの学生のことは出さない）。
 * 回ごとの先生と「済み・予定」（最初のまだの回は「次はここ」）、先生の許可を使うコースは許可の状態。
 * パソコンは右の欄（コースからのお知らせの下）、スマホはメニューの中。点検表にまだ載っておらず、許可も使わないコースは出さない。
 * foldable（パソコンの右の欄）：はじめは1行にたたみ（次の回と先生だけ）、押すと開く。セルフチェックの「直すところ」を広く見せるため
 * （依頼者の選択 2026-11-05 mockups/v110 案C）
 */
export function CheckCard({ status, course, foldable = false }: { status: CheckStatus | null; course: Course | undefined; foldable?: boolean }) {
  const [open, setOpen] = useState(readOpen)
  useEffect(() => {
    if (!foldable) return
    try {
      if (open) localStorage.setItem(OPEN_KEY, '1')
      else localStorage.removeItem(OPEN_KEY)
    } catch {
      // 覚えておけなくても、今は開いたまま・閉じたまま
    }
  }, [open, foldable])
  const row = status?.row ?? null
  const perm = course?.permission ?? {}
  const rounds = (row?.rounds ?? []).filter((r) => r.teacher)
  if (!rounds.length && !perm.abstract && !perm.final) return null
  const next = rounds.findIndex((r) => r.state !== 'done')
  const shown = !foldable || open
  // たたんだときの1行：次の回と先生（回がすべて済んでいれば「すべて済み」。回がまだ点検表にないときは、許可のようす）
  const summary =
    next >= 0
      ? `次は ${rounds[next].label}・${rounds[next].teacher}先生`
      : rounds.length
        ? 'すべて済み'
        : perm.final && row?.finalOk
          ? '最終提出の許可が出ています'
          : perm.abstract && row?.abstractOk
            ? '抄録の許可が出ています'
            : '許可はまだです'
  const title = (
    <>
      点検の予定と記録 {shown ? <small>先生の点検表から</small> : <span className="cc-sum">{summary}</span>}
    </>
  )
  return (
    <div className={`check-card${foldable ? ' foldable' : ''}${shown ? '' : ' folded'}`}>
      {foldable ? (
        <h4>
          <button type="button" className="cc-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            {title}
            <span className="cc-open" aria-hidden="true">
              {open ? '閉じる ▴' : '開く ▾'}
            </span>
          </button>
        </h4>
      ) : (
        <h4>{title}</h4>
      )}
      {shown && rounds.length > 0 && (
        <table>
          <tbody>
            {rounds.map((r, i) => (
              <tr key={`${r.label}-${i}`}>
                <td className="r">{r.label}</td>
                <td className="t">{r.teacher}先生</td>
                <td className={r.state === 'done' ? 'done' : i === next ? 'next' : 'plan'}>{r.state === 'done' ? '✓ 済み' : i === next ? '次はここ' : '予定'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {shown && (perm.abstract || perm.final) && (
        <div className={rounds.length ? 'perm' : 'perm first'}>
          {perm.abstract && (
            <div>
              抄録を書く許可：{row?.abstractOk ? <><span className="ok">出ています</span>（{markText(row.abstractOk)}）</> : <span className="wait">まだです</span>}
            </div>
          )}
          {perm.final && (
            <div>
              最終提出の許可：{row?.finalOk ? <><span className="ok">出ています</span>（{markText(row.finalOk)}）</> : <span className="wait">まだです</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
