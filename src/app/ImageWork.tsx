import { useState, useSyncExternalStore } from 'react'
import type { ReportEditor } from '../editor/reportEditor'
import { WaitToast } from './Busy'
import type { ImageWork, ImageWorkState } from './imageWorkStore'

/**
 * 選んだ写真を縮めて保存している間の「写真を取り込んでいます…」（紙面の上の真ん中。依頼者の要望 2026-10-20）。
 * 編集の中核（editor/reportEditor.ts の onImageWork）から知らせを受けて、ここだけを描き直す
 * （画面全体（App）を描き直すと、遅いスマホでは知らせが出るまで 0.2秒ほどかかったため）
 */

/**
 * 写真を取り込んでいる間と、保存し終えたあと、その写真が紙面に出るまで（組み直し終えるまで）出す知らせ。
 * まとめて選んだときは「（2 / 5枚）」
 */
export function ImageWorkToast({ work, editor }: { work: ImageWork; editor: ReportEditor }) {
  const state = useSyncExternalStore(work.subscribe, work.get)
  const rendering = useSyncExternalStore(editor.subscribe, () => editor.getSnapshot().rendering)
  // 入れた図が紙面に出るのを待っている間は、画面の下の「図を入れています…」だけにする（2つ同時に出て、スマホの横向きでは重なっていた：試し 2026-10-26）
  const waiting = useSyncExternalStore(editor.subscribe, () => editor.getSnapshot().waiting)
  // 保存し終えたあと、紙面を組み直し終えるまで（描く途中で合わせる。React の「前の値と比べて state を変える」書き方）
  const [tail, setTail] = useState(false)
  const [last, setLast] = useState<ImageWorkState>(null)
  if (state !== last) {
    setLast(state)
    if (!state && last) setTail(true)
  }
  if (tail && !state && !rendering) setTail(false)
  if (!state && (!tail || waiting)) return null
  // HEIC を変換している間は、そう伝える（数秒かかり、ふつうの写真より待つため。依頼者の要望 2026-10-28）
  const doing = state?.heic ? 'iPhone の写真（HEIC）を変換しています…' : '写真を取り込んでいます…'
  const text = state && state.total > 1 ? `${doing}（${Math.min(state.done + 1, state.total)} / ${state.total}枚）` : doing
  return <WaitToast className="on-stage" text={text} />
}
