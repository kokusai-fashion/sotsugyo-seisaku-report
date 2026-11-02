import { useCallback, useState } from 'react'

/**
 * 「コースごとの設定」で開いているコース。はじめは閉じたまま（前はいちばん上のコースが開いていた）。
 * この端末で最後に開いていたコースを覚えておき、次に開いたときは、そのコースを開いた形で始める（閉じていれば閉じたまま。依頼者の要望 2026-11-02）
 */
const KEY = 'sotsugyo-admin-open-course'

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** [開いているコースの ID（ないコース・どれも閉じているときは null）, 開く・閉じる（null）] */
export function useOpenCourse(courseIds: string[]): [string | null, (id: string | null) => void] {
  const [open, setOpen] = useState<string | null>(read)
  const change = useCallback((id: string | null) => {
    setOpen(id)
    try {
      if (id) localStorage.setItem(KEY, id)
      else localStorage.removeItem(KEY)
    } catch {
      // 覚えておけなくても、開く・閉じるはできる
    }
  }, [])
  return [open && courseIds.includes(open) ? open : null, change]
}
