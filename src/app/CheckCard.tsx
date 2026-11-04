import type { Course } from '../config'
import { markText, type CheckStatus } from '../drive/checkStatus'

/**
 * 「点検の予定と記録」：先生の点検表の、自分の行だけ（依頼者の選択 2026-11-04 mockups/v105。ほかの学生のことは出さない）。
 * 回ごとの先生と「済み・予定」（最初のまだの回は「次はここ」）、先生の許可を使うコースは許可の状態。
 * パソコンは右の欄（コースからのお知らせの下）、スマホはメニューの中。点検表にまだ載っておらず、許可も使わないコースは出さない
 */
export function CheckCard({ status, course }: { status: CheckStatus | null; course: Course | undefined }) {
  const row = status?.row ?? null
  const perm = course?.permission ?? {}
  const rounds = (row?.rounds ?? []).filter((r) => r.teacher)
  if (!rounds.length && !perm.abstract && !perm.final) return null
  const next = rounds.findIndex((r) => r.state !== 'done')
  return (
    <div className="check-card">
      <h4>
        点検の予定と記録 <small>先生の点検表から</small>
      </h4>
      {rounds.length > 0 && (
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
      {(perm.abstract || perm.final) && (
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
