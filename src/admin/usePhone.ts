import { useEffect, useState } from 'react'

/** 管理ページを、スマホの並べ方（1列。はじめに区切りの一覧）にする幅（admin.css の @media と同じ。mockups/v68 案C） */
export const PHONE_QUERY = '(max-width: 760px)'

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
