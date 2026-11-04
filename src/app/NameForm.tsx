import { useId, useLayoutEffect, useRef, useState } from 'react'
import { kanaProblem, namePartsDone, toKatakana, type NameParts } from '../model/personName'
import { useDialogFocus } from './useDialogFocus'

/**
 * 氏名を、姓・名・セイ・メイの4つの欄で入れる（依頼者の選択 2026-11-04 mockups/v101）。
 * 表紙の氏名は「姓　名」で自動で入る。ふりがなは表紙には出さず、先生の点検表を名前の順（あいうえお順）に並べるのに使う。
 * はじめての案内の「氏名」の段（StartGuide.tsx）と、表紙の氏名を押したときの小窓（NameDialog）で使う
 */

/** 入れ終わっていない欄の言い方（「次へ」「決める」を押したときに出す） */
export function nameProblem(p: NameParts): string | null {
  if (!p.familyName.trim()) return '姓を入力してください'
  if (!p.familyKana.trim()) return 'セイ（ふりがな）を入力してください'
  if (kanaProblem(toKatakana(p.familyKana))) return 'ふりがなは、カタカナで入力してください'
  if (p.givenName.trim() && !p.givenKana.trim()) return 'メイ（ふりがな）を入力してください'
  if (kanaProblem(toKatakana(p.givenKana))) return 'ふりがなは、カタカナで入力してください'
  return null
}

const FIELDS: { key: keyof NameParts; label: string; placeholder: string; kana?: boolean }[] = [
  { key: 'familyName', label: '姓', placeholder: '例：文化' },
  { key: 'givenName', label: '名', placeholder: '例：花子' },
  { key: 'familyKana', label: 'セイ（カタカナ）', placeholder: '例：ブンカ', kana: true },
  { key: 'givenKana', label: 'メイ（カタカナ）', placeholder: '例：ハナコ', kana: true },
]

/**
 * 4つの欄。Enter で次の欄へ、最後の欄の Enter で onSubmit。
 * ふりがなは、欄を離れたときにカタカナにそろえる（打っている途中に変えると、日本語の変換が崩れるため）。
 * tried：「次へ」などを押したあと（入っていない欄に赤い枠を付ける）
 */
export function NameFields({ value, onChange, onSubmit, tried }: { value: NameParts; onChange: (p: NameParts) => void; onSubmit: () => void; tried: boolean }) {
  const id = useId()
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const need = (key: keyof NameParts) => {
    if (!tried) return false
    if (key === 'familyName' || key === 'familyKana') return !value[key].trim() || (key === 'familyKana' && kanaProblem(toKatakana(value[key])))
    if (key === 'givenKana') return (!!value.givenName.trim() && !value.givenKana.trim()) || kanaProblem(toKatakana(value.givenKana))
    return false
  }
  return (
    <div className="name-fields">
      <b className="nf-row">氏名</b>
      <b className="nf-row kana">ふりがな</b>
      {FIELDS.map((f, i) => (
        <label key={f.key} className={`nf-${f.key}`} htmlFor={`${id}-${f.key}`}>
          {f.label}
          <input
            id={`${id}-${f.key}`}
            ref={(el) => {
              refs.current[i] = el
            }}
            className={need(f.key) ? 'need' : undefined}
            value={value[f.key]}
            placeholder={f.placeholder}
            autoComplete="off"
            enterKeyHint={i < FIELDS.length - 1 ? 'next' : 'done'}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            onBlur={() => f.kana && value[f.key] !== toKatakana(value[f.key]) && onChange({ ...value, [f.key]: toKatakana(value[f.key]) })}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
              e.preventDefault()
              const next = refs.current[i + 1]
              if (next) next.focus()
              else onSubmit()
            }}
            data-autofocus={i === firstEmpty(value) ? true : undefined}
          />
        </label>
      ))}
    </div>
  )
}

/** はじめに文字のカーソルを置く欄（入っていない最初の欄。全部入っていれば姓） */
function firstEmpty(p: NameParts): number {
  const i = FIELDS.findIndex((f) => (f.key === 'givenName' || f.key === 'givenKana' ? false : !p[f.key].trim()))
  if (i >= 0) return i
  if (p.givenName.trim() && !p.givenKana.trim()) return 3
  return 0
}

/**
 * 表紙の氏名を押したときの小窓（PC は氏名のすぐ下。スマホは画面の上：下に出すと、キーボードに隠れるため）。
 * 「決める」で表紙に入れる。「やめる」・窓の外・Esc は、変えずに閉じる
 */
export function NameDialog({ rect, initial, onSave, onClose }: { rect: DOMRect; initial: NameParts; onSave: (p: NameParts) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(initial)
  const [tried, setTried] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || el.closest('.app.phone')) return
    const margin = 8
    const left = Math.max(margin, Math.min(rect.left - 40, window.innerWidth - el.offsetWidth - margin))
    const below = rect.bottom + 8
    const top = below + el.offsetHeight > window.innerHeight - margin ? Math.max(margin, rect.top - el.offsetHeight - 8) : below
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [rect])
  useDialogFocus(ref, onClose)
  const problem = tried ? nameProblem(value) : null
  const save = () => {
    setTried(true)
    if (!namePartsDone({ ...value, familyKana: toKatakana(value.familyKana), givenKana: toKatakana(value.givenKana) })) return
    onSave(value)
    onClose()
  }
  return (
    <div className="popover-backdrop" onMouseDown={onClose}>
      <div className="popover name-dialog" ref={ref} role="dialog" aria-label="氏名とふりがな" style={{ left: rect.left, top: rect.bottom + 8 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="popover-title">氏名とふりがな</div>
        <NameFields value={value} onChange={setValue} onSubmit={save} tried={tried} />
        {problem && <p className="nf-error">{problem}</p>}
        <p className="nf-note">表紙には「姓　名」の形で入ります。ふりがなは表紙には出ません。</p>
        <div className="nf-actions">
          <button onClick={onClose}>やめる</button>
          <button className="primary" onClick={save}>
            決める
          </button>
        </div>
      </div>
    </div>
  )
}
