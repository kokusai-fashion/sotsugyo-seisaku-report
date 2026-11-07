import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FigureCrop, PhotoPosition } from '../model/types'
import { MAX_PHOTO_ZOOM } from '../model/photos'
import { Modal } from './dialogs'

/**
 * トリミングの窓（依頼者の選択 2026-11-03、mockups/v94 案2）。大きな写真の上で、白い枠（紙面に出す範囲）を動かし、角のつまみで大きさを変える。
 * - 本文の図：枠の形を選べる（元の形・縦長・正方形・横長・自由）。決めた範囲の形が、紙面の図の形になる（Figure.crop）
 * - 作品写真：枠の形は、紙面の写真の枠の形のまま（並べ方で決まる）。大きさと位置だけを決める（PhotoPosition の x・y・zoom）
 * 枠の位置と大きさは、写真の幅・高さに対する割合（0〜1）で持つ
 */

type Rect = FigureCrop

/** 本文の図の枠の形（縦÷横ではなく、横÷縦の比。null は自由） */
const SHAPES: { id: string; label: string; ratio: (imageRatio: number) => number | null }[] = [
  { id: 'original', label: '元の形', ratio: (r) => r },
  { id: 'portrait', label: '縦長', ratio: () => 3 / 4 },
  { id: 'square', label: '正方形', ratio: () => 1 },
  { id: 'landscape', label: '横長', ratio: () => 4 / 3 },
  { id: 'free', label: '自由', ratio: () => null },
]

/** 枠の大きさの下限（写真の幅・高さに対する割合） */
const MIN_SIZE = 0.1

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * 写真（横÷縦 imageRatio）の中に入る、形 ratio（紙面の横÷縦）の、いちばん大きい枠（割合）。center を中心に置く（はみ出す分はずらす）
 */
export function largestRect(imageRatio: number, ratio: number, center = { x: 0.5, y: 0.5 }, scale = 1): Rect {
  // 割合の空間では、紙面の横÷縦 ratio は、w / h = ratio / imageRatio
  const k = ratio / imageRatio
  let w = k >= 1 ? 1 : k
  let h = k >= 1 ? 1 / k : 1
  w *= scale
  h *= scale
  return { x: clamp(center.x - w / 2, 0, 1 - w), y: clamp(center.y - h / 2, 0, 1 - h), w, h }
}

/** 作品写真のトリミング（x%・y%・倍率）→ 枠（割合）。slotRatio：紙面の枠の横÷縦 */
export function photoRect(imageRatio: number, slotRatio: number, trim: PhotoPosition | null): Rect {
  const cover = largestRect(imageRatio, slotRatio)
  const zoom = trim?.zoom && trim.zoom > 1 ? trim.zoom : 1
  const w = cover.w / zoom
  const h = cover.h / zoom
  const x = trim ? trim.x / 100 : 0.5
  const y = trim ? trim.y / 100 : 0.5
  return { x: x * (1 - w), y: y * (1 - h), w, h }
}

/** 枠（割合）→ 作品写真のトリミング（x%・y%・倍率） */
export function photoTrim(imageRatio: number, slotRatio: number, rect: Rect): PhotoPosition {
  const cover = largestRect(imageRatio, slotRatio)
  const zoom = Math.min(MAX_PHOTO_ZOOM, cover.w / rect.w)
  const pct = (start: number, size: number) => (size >= 0.999 ? 50 : Math.round(clamp(start / (1 - size), 0, 1) * 1000) / 10)
  return { x: pct(rect.x, rect.w), y: pct(rect.y, rect.h), ...(zoom > 1.005 ? { zoom: Math.round(zoom * 100) / 100 } : {}) }
}

/** 本文の図の、今の枠に合う形（どれにも合わなければ「自由」） */
function shapeOf(rect: Rect | null, imageRatio: number): string {
  if (!rect) return 'original'
  const r = (rect.w / rect.h) * imageRatio
  return SHAPES.find((s) => {
    const want = s.ratio(imageRatio)
    return want !== null && Math.abs(r / want - 1) < 0.01
  })?.id ?? 'free'
}

interface Drag {
  mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  startX: number
  startY: number
  from: Rect
}

export type TrimTarget =
  | { kind: 'figure'; label: string; src: string; imageRatio: number; crop: FigureCrop | null; onApply: (crop: FigureCrop | null) => void }
  | { kind: 'photo'; label: string; src: string; imageRatio: number; slotRatio: number; trim: PhotoPosition | null; onApply: (trim: PhotoPosition | null) => void }

export function TrimDialog({ target, onClose }: { target: TrimTarget; onClose: () => void }) {
  const { imageRatio } = target
  const [shape, setShape] = useState(() => (target.kind === 'figure' ? shapeOf(target.crop, imageRatio) : 'slot'))
  const [rect, setRect] = useState<Rect>(() =>
    target.kind === 'figure' ? (target.crop ?? { x: 0, y: 0, w: 1, h: 1 }) : photoRect(imageRatio, target.slotRatio, target.trim),
  )
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<Drag | null>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)

  /** 枠の形（紙面の横÷縦。null は自由） */
  const ratio = target.kind === 'photo' ? target.slotRatio : (SHAPES.find((s) => s.id === shape)?.ratio(imageRatio) ?? null)

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const measure = () => setBox({ w: img.clientWidth, h: img.clientHeight })
    if (img.complete) measure()
    img.addEventListener('load', measure)
    const observer = new ResizeObserver(measure)
    observer.observe(img)
    return () => {
      img.removeEventListener('load', measure)
      observer.disconnect()
    }
  }, [])

  const chooseShape = (id: string) => {
    setShape(id)
    const want = SHAPES.find((s) => s.id === id)?.ratio(imageRatio)
    if (want === null || want === undefined) return
    // 今の枠の中心のまま、その形でいちばん大きい枠に
    setRect(largestRect(imageRatio, want, { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }))
  }

  const onPointerDown = (mode: Drag['mode']) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { mode, startX: e.clientX, startY: e.clientY, from: rect }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !box) return
    const dx = (e.clientX - d.startX) / box.w
    const dy = (e.clientY - d.startY) / box.h
    const f = d.from
    if (d.mode === 'move') {
      setRect({ ...f, x: clamp(f.x + dx, 0, 1 - f.w), y: clamp(f.y + dy, 0, 1 - f.h) })
      return
    }
    // 角をつまんで大きさを変える：反対の角は動かさない
    const right = d.mode === 'ne' || d.mode === 'se'
    const bottom = d.mode === 'sw' || d.mode === 'se'
    const anchorX = right ? f.x : f.x + f.w
    const anchorY = bottom ? f.y : f.y + f.h
    let w = clamp(right ? f.w + dx : f.w - dx, MIN_SIZE, right ? 1 - anchorX : anchorX)
    let h = clamp(bottom ? f.h + dy : f.h - dy, MIN_SIZE, bottom ? 1 - anchorY : anchorY)
    if (ratio !== null) {
      // 形を決めているとき：割合の空間での w / h を保つ（動かした向きの大きい方に合わせ、入らなければ小さくする）
      const k = ratio / imageRatio
      if (w / h > k) h = w / k
      else w = h * k
      const maxW = right ? 1 - anchorX : anchorX
      const maxH = bottom ? 1 - anchorY : anchorY
      const fit = Math.min(1, maxW / w, maxH / h)
      w *= fit
      h *= fit
      if (w < MIN_SIZE || h < MIN_SIZE) return
    }
    setRect({ x: right ? anchorX : anchorX - w, y: bottom ? anchorY : anchorY - h, w, h })
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const apply = () => {
    if (target.kind === 'figure') {
      const whole = rect.x < 0.002 && rect.y < 0.002 && rect.w > 0.996 && rect.h > 0.996
      target.onApply(whole ? null : { x: round4(rect.x), y: round4(rect.y), w: round4(rect.w), h: round4(rect.h) })
    } else {
      target.onApply(photoTrim(imageRatio, target.slotRatio, rect))
    }
    onClose()
  }

  const reset = () => {
    if (target.kind === 'figure') {
      setShape('original')
      setRect({ x: 0, y: 0, w: 1, h: 1 })
    } else {
      setRect(photoRect(imageRatio, target.slotRatio, null))
    }
  }

  const px = box ? { left: rect.x * box.w, top: rect.y * box.h, width: rect.w * box.w, height: rect.h * box.h } : null
  // 画面全体の上に出す。スマホの下の道具（.sel-bar）の中に置くと、紙面の下の帯「指でずらして、トリミングを調整」が窓の上に重なり、
  // 枠の下の角のつまみをつかめなかった（学生向けの動画で見つけた。2026-11-07）
  return createPortal(
    <Modal title={`トリミング（${target.label}）`} className="trim-modal" onClose={onClose}>
      <p className="lead">白い枠の中が、紙面に入ります。枠をつかんで動かし、角のつまみで大きさを変えます。</p>
      {target.kind === 'figure' && (
        <div className="trim-shapes" role="radiogroup" aria-label="枠の形">
          <span>形：</span>
          {SHAPES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={shape === s.id} className={shape === s.id ? 'on' : undefined} onClick={() => chooseShape(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="trim-stage" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="trim-image">
          <img ref={imgRef} src={target.src} alt="" draggable={false} />
          {px && (
            <div className="trim-frame" style={px} onPointerDown={onPointerDown('move')} aria-label="紙面に出す範囲（つかんで動かす）">
              <div className="trim-view" style={{ backgroundImage: `url("${target.src}")`, backgroundSize: `${box!.w}px ${box!.h}px`, backgroundPosition: `${-px.left}px ${-px.top}px` }} />
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <i key={corner} className={`trim-handle ${corner}`} onPointerDown={onPointerDown(corner)} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="row-buttons">
        <button type="button" onClick={reset}>
          {target.kind === 'figure' ? '元の形に戻す' : '全体に戻す'}
        </button>
        <span className="spacer" />
        <button type="button" onClick={onClose}>
          やめる
        </button>
        <button type="button" className="primary trim-apply" onClick={apply}>
          これで決める
        </button>
      </div>
    </Modal>,
    document.body,
  )
}

const round4 = (n: number) => Math.round(n * 10000) / 10000
