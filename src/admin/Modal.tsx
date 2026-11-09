import { useRef, useState, type ReactNode } from 'react'
import { useDialogFocus } from '../app/useDialogFocus'
import { IGNORE_OUTSIDE_MS } from './confirm'

/**
 * 管理ページの窓（「まだ保存していない変更」「学生の並び」など）。外の暗い所を押すか、×・Esc で閉じる。
 * 「学生の並びを直す」の窓（CourseSection.tsx）でも使うため、AdminApp.tsx から分けた
 */
export function Modal({ title, children, onClose, className = '', closable = true }: { title: string; children: ReactNode; onClose: () => void; className?: string; /** false：×を出さない（まだ登録していない先生の「氏名と担当コース」など） */ closable?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialogFocus(ref, onClose)
  // 開いてすぐの、外の暗い所の押し下げでは閉じない（ボタンのダブルクリックの2回目で、開いてすぐ閉じないように：confirm.tsx と同じ）
  const [openedAt] = useState(() => performance.now())
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && performance.now() - openedAt > IGNORE_OUTSIDE_MS && onClose()}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header>
          <h2>{title}</h2>
          {closable && (
            <button className="close" onClick={onClose} aria-label="閉じる">
              ×
            </button>
          )}
        </header>
        {children}
      </div>
    </div>
  )
}
