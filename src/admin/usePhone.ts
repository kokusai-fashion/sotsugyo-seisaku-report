import { useEffect, useState } from 'react'

/**
 * 管理ページを、スマホの並べ方（1列。はじめに区切りの一覧）にする画面（admin.css の @media と同じ。mockups/v68 案C）。
 * 横向きのスマホ（高さが低く、指で操作する）も（前はパソコンの3列になり、はみ出した：mockups/v71 ③）
 */
export const PHONE_QUERY = '(max-width: 760px), (max-height: 500px) and (pointer: coarse)'

/** スマホの幅の画面か（画面の向きを変えたときなども追う） */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const mq = matchMedia(PHONE_QUERY)
    const onChange = () => setPhone(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return phone
}
