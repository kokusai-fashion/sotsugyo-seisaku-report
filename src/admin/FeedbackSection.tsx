import { useEffect, useState } from 'react'
import { useConfirm } from './confirm'
import { FEEDBACK_NOTIFY, FEEDBACK_STATUSES, server, type FeedbackItem, type FeedbackStatus } from './server'
import { Chip, SectionHead } from './ui'
import { Waiting } from './Wait'

/**
 * 「届いた声」の区切り（管理者・先生とも。依頼者 2026-11-01：mockups/v85）。
 * 学生がツールの「困ったこと・おかしいことを知らせる」から送ったものの一覧（シート「届いた声」。新しいものから）。
 * 状態を変えて保存する。「直しました」「使い方で解決」にして「保存して学生に知らせる」を押すと、学生が次にツールを開いたとき
 * 右の欄の上に知らせが出て、ログインして送った声なら大学のメールにも届く（gas/admin-project の updateFeedback）
 */

/** 状態の札の色 */
const STATUS_KIND: Record<FeedbackStatus, '' | 'acc' | 'chg' | 'off' | 'ok'> = { 受け付けた: 'chg', 確かめ中: 'acc', 直しました: 'ok', 使い方で解決: 'ok', 対応しない: 'off' }
/** まだ対応していない（「まだのもの」に出す） */
const OPEN: FeedbackStatus[] = ['受け付けた', '確かめ中']

export function FeedbackSection() {
  const [list, setList] = useState<FeedbackItem[] | null>(null)
  const [error, setError] = useState('')
  const [all, setAll] = useState(false)
  useEffect(() => {
    let live = true
    server.getFeedback().then(
      (items) => live && setList(items),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [])
  const open = list?.filter((f) => OPEN.includes(f.status)) ?? []
  const shown = all ? (list ?? []) : open
  return (
    <>
      <SectionHead
        title="届いた声"
        lead="学生がツールの「困ったこと・おかしいことを知らせる」から送ったものです。届くと、10分ほどで管理者にメールが届きます。「直しました」「使い方で解決」にして知らせると、学生のツールとメールに届きます。"
      />
      {error ? (
        <p className="fb-load-error" role="alert">
          読み込めませんでした（{error}）
        </p>
      ) : !list ? (
        <Waiting text="読み込んでいます…" />
      ) : (
        <>
          <div className="fb-filter" role="group" aria-label="出すもの">
            <button className={all ? '' : 'on'} aria-pressed={!all} onClick={() => setAll(false)}>
              まだのもの <b>{open.length}</b>
            </button>
            <button className={all ? 'on' : ''} aria-pressed={all} onClick={() => setAll(true)}>
              すべて <b>{list.length}</b>
            </button>
          </div>
          {shown.length === 0 ? (
            <p className="fb-empty">{all ? 'まだ届いていません。' : 'まだ対応していないものはありません。'}</p>
          ) : (
            shown.map((item) => <FeedbackCard key={item.id} item={item} onSaved={setList} />)
          )}
        </>
      )}
    </>
  )
}

function FeedbackCard({ item, onSaved }: { item: FeedbackItem; onSaved: (list: FeedbackItem[]) => void }) {
  const ask = useConfirm()
  const [status, setStatus] = useState<FeedbackStatus>(item.status)
  const [reply, setReply] = useState(item.reply)
  const [memo, setMemo] = useState(item.memo)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = status !== item.status || reply !== item.reply || memo !== item.memo
  const notifiable = FEEDBACK_NOTIFY.includes(status)
  const sender = [item.studentId, item.name].filter(Boolean).join('　') || '（表紙が空）'

  const save = async (notify: boolean) => {
    if (notify) {
      const where = item.email ? `学生のツールと、大学のメール（${item.email}）` : '学生のツール（ログインなしで送られたため、メールは送れません）'
      if (!(await ask(`受付番号 ${item.id} を「${status}」にして、${where}に知らせます。`, { title: '学生に知らせますか？', ok: '知らせる' }))) return
    }
    setBusy(true)
    setError('')
    try {
      onSaved(await server.updateFeedback(item.id, status, reply.trim(), memo.trim(), notify))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="card fb-item" data-feedback-id={item.id}>
      <header className="fb-head">
        <b className="fb-id">{item.id}</b>
        <span className="fb-date">{item.receivedAt}</span>
        <Chip>{item.kind}</Chip>
        <Chip kind={STATUS_KIND[item.status] ?? ''}>{item.status}</Chip>
        {item.notifiedAt && <Chip kind="ok">知らせた {item.notifiedAt.slice(5)}</Chip>}
      </header>
      <p className="fb-text">{item.text}</p>
      <dl className="fb-meta">
        <div>
          <dt>送った人</dt>
          <dd>
            {sender}
            <span className="fb-mail">{item.email || 'ログインなし（メールは送れません）'}</span>
            {item.course && <span className="fb-course">{item.course}</span>}
          </dd>
        </div>
        <div>
          <dt>端末</dt>
          <dd>{item.device}</dd>
        </div>
        <div>
          <dt>開いていたページ</dt>
          <dd>{item.page || '—'}</dd>
        </div>
        {item.notice && (
          <div>
            <dt>直前の知らせ</dt>
            <dd>{item.notice}</dd>
          </div>
        )}
        {item.errors && (
          <div>
            <dt>ツールの中のエラー</dt>
            <dd className="fb-errors">{item.errors}</dd>
          </div>
        )}
        {item.screen && (
          <div>
            <dt>ページの写真</dt>
            <dd>
              {item.screen.startsWith('https://') ? (
                <a href={item.screen} target="_blank" rel="noreferrer">
                  開く（ドライブ）
                </a>
              ) : (
                item.screen
              )}
            </dd>
          </div>
        )}
        <div>
          <dt>ツールの版</dt>
          <dd>{item.version || '—'}</dd>
        </div>
      </dl>
      <div className="fb-edit">
        <label className="fb-status">
          <span>状態</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)} disabled={busy}>
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            学生へのひとこと<small>（任意。知らせとメールに出ます）</small>
          </span>
          <textarea rows={2} maxLength={500} value={reply} onChange={(e) => setReply(e.target.value)} disabled={busy} placeholder="例：使い方の「抄録」の動画で、写し方を見られます" />
        </label>
        <label>
          <span>
            先生のメモ<small>（学生には出ません）</small>
          </span>
          <textarea rows={2} maxLength={1000} value={memo} onChange={(e) => setMemo(e.target.value)} disabled={busy} />
        </label>
        {error && (
          <p className="fb-save-error" role="alert">
            保存できませんでした（{error}）
          </p>
        )}
        <div className="fb-buttons">
          <button className="btn" onClick={() => void save(false)} disabled={busy || !dirty}>
            保存
          </button>
          {notifiable && (
            <button className="btn primary" onClick={() => void save(true)} disabled={busy}>
              {item.notifiedAt ? '保存して、もう一度知らせる' : '保存して学生に知らせる'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
