import { useState } from 'react'
import type { DriveSync } from '../drive/driveSync'
import type { EditorSnapshot, ReportEditor } from '../editor/reportEditor'
import { deviceText, FEEDBACK_API_URL, FEEDBACK_KINDS, lastNotice, recentErrors, sendFeedback, type FeedbackKind, type FeedbackReceipt } from '../feedback/feedback'
import { BUILD_ID } from './newVersion'
import { Modal } from './dialogs'
import { Spinner } from './Busy'
import { pageName } from './uiShared'

/** 送る窓の言葉（mockups/v85 窓A） */
export const FEEDBACK_TEXTS = {
  title: '困ったこと・おかしいことを知らせる',
  question: '何をしようとして、何が起きましたか',
  placeholder: '例：表の生地見本のマスに写真を入れたら、カーソルが下のマスに出て、どこを書いているのか分からなくなった',
  attach: 'いま開いているページの写真を付ける',
  attachNote: '原稿の文が写ります。先生だけが見ます',
  auto: 'いっしょに送るもの（自動）',
  autoItems: ['ツールの版・パソコンかスマホか・ブラウザ', '開いていたページ', '直前に出た知らせ・ツールの中で起きたエラー'],
  autoNot: '原稿の文や写真は送りません。',
  wait: '送っていただいた内容は、確かめてからツールを直します。直るまでに数日かかることがあります。急ぐときは、担当の先生に直接お知らせください。',
  sentLogin: '直したら、このツールを開いたときと、大学のメールでお知らせします。',
  sentLocal: '直したら、この端末でツールを開いたときにお知らせします。',
}

/** いま開いているページを JPEG にする（PDF と同じ作り方で、少し粗く。base64） */
async function pageImage(editor: ReportEditor, index: number): Promise<string | undefined> {
  const page = editor.pageElements()[index]
  if (!page) return undefined
  const { pagesToPdf } = await import('../pdf/pagesToPdf')
  let data: string | undefined
  await pagesToPdf([page], {
    dpi: 96,
    onPage: ({ canvas }) => {
      data = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
    },
  })
  return data
}

/**
 * 困ったこと・おかしいことを知らせる窓（mockups/v85 窓A）：種類を選び、1つの欄に書いて送る。
 * いっしょに送るもの（版・端末・ページ・直前の知らせ・エラー）は、いつも見せる。送ったら受付番号を出す
 */
export function FeedbackDialog({ editor, snap, phone, drive, onClose }: { editor: ReportEditor; snap: EditorSnapshot; phone: boolean; drive: DriveSync | null; onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>(FEEDBACK_KINDS[0])
  const [text, setText] = useState('')
  const [attach, setAttach] = useState(false)
  const [phase, setPhase] = useState<{ kind: 'edit' | 'sending' } | { kind: 'sent'; receipt: FeedbackReceipt; login: boolean } | { kind: 'error'; message: string }>({ kind: 'edit' })
  const page = pageName(snap)

  const send = async () => {
    if (!FEEDBACK_API_URL || !text.trim()) return
    setPhase({ kind: 'sending' })
    try {
      const token = drive ? await drive.copyToken() : null
      const { courseId, studentId, name } = snap.report.basicInfo
      const receipt = await sendFeedback(FEEDBACK_API_URL, {
        action: 'feedback',
        ...(token ? { token: token.accessToken } : {}),
        kind,
        text: text.trim(),
        version: BUILD_ID,
        device: deviceText(navigator.userAgent, phone, window.innerWidth, window.innerHeight),
        page,
        notice: lastNotice(),
        errors: recentErrors(),
        ...(attach ? { screen: await pageImage(editor, snap.page) } : {}),
        year: snap.report.fiscalYear,
        courseId: courseId ?? '',
        studentId: studentId.trim(),
        name: name.trim(),
      })
      setPhase({ kind: 'sent', receipt, login: !!token })
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  if (phase.kind === 'sent') {
    return (
      <Modal title="送りました" onClose={onClose} className="feedback">
        <div className="fb-sent">
          <div className="ok" aria-hidden="true">
            ✓
          </div>
          <p>
            受付番号 <span className="no">{phase.receipt.id}</span>
          </p>
          <p>
            {phase.login ? FEEDBACK_TEXTS.sentLogin : FEEDBACK_TEXTS.sentLocal}
            <br />
            急ぐときは、担当の先生に直接お知らせください。
          </p>
        </div>
        <div className="fb-actions">
          <button className="primary" data-autofocus onClick={onClose}>
            閉じる
          </button>
        </div>
      </Modal>
    )
  }

  const sending = phase.kind === 'sending'
  return (
    <Modal title={FEEDBACK_TEXTS.title} onClose={onClose} className="feedback" busy={sending}>
      <div className="fb-kinds" role="radiogroup" aria-label="どんなことか">
        {FEEDBACK_KINDS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {k}
          </button>
        ))}
      </div>
      <label className="fb-q" htmlFor="fb-text">
        {FEEDBACK_TEXTS.question}
      </label>
      <textarea id="fb-text" rows={5} maxLength={2000} value={text} placeholder={FEEDBACK_TEXTS.placeholder} onChange={(e) => setText(e.target.value)} data-autofocus />
      <label className="fb-attach">
        <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
        <span>
          {FEEDBACK_TEXTS.attach}
          <small>{FEEDBACK_TEXTS.attachNote}</small>
        </span>
      </label>
      <div className="fb-auto">
        <b>{FEEDBACK_TEXTS.auto}</b>
        <ul>
          {FEEDBACK_TEXTS.autoItems.map((t) => (
            <li key={t}>{t === '開いていたページ' && page ? `${t}（${page}）` : t}</li>
          ))}
        </ul>
        {FEEDBACK_TEXTS.autoNot}
      </div>
      <p className="fb-wait">{FEEDBACK_TEXTS.wait}</p>
      {phase.kind === 'error' && (
        <p className="fb-error" role="alert">
          送れませんでした（{phase.message}）。少しあとで、もう一度送ってください。急ぐときは、担当の先生に直接お知らせください。
        </p>
      )}
      <div className="fb-actions">
        <button onClick={onClose} disabled={sending}>
          やめる
        </button>
        <button className="primary" onClick={() => void send()} disabled={sending || !text.trim() || !FEEDBACK_API_URL}>
          {sending ? <Spinner /> : null}
          {sending ? '送っています…' : '送る'}
        </button>
      </div>
    </Modal>
  )
}

/** 「直しました」の知らせ（右の欄のいちばん上。スマホはメニューの中。mockups/v85 知らせA）。× で閉じるまで出す */
export function FeedbackDone({ items, onDismiss }: { items: FeedbackReceipt[]; onDismiss: (id: string) => void }) {
  if (!items.length) return null
  return (
    <>
      {items.map((r) => {
        const d = new Date(r.sentAt)
        const date = Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}月${d.getDate()}日に`
        return (
          <div key={r.id} className="fb-done" role="status">
            <b>✓ {r.status === '直しました' ? '直しました' : '使い方で解決できます'}</b>
            <span>
              {date}送っていただいた「{r.summary}」は、{r.status === '直しました' ? '直しました。' : '使い方で解決できます。'}
            </span>
            {r.reply && <span className="fb-reply">{r.reply}</span>}
            <button className="x" aria-label="この知らせを閉じる" onClick={() => onDismiss(r.id)}>
              ×
            </button>
          </div>
        )
      })}
    </>
  )
}
