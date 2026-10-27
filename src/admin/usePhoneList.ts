import { useCallback, useEffect, useState } from 'react'

/**
 * スマホの「区切りの一覧」と「区切りの中身」の行き来（mockups/v68 案C）を、ブラウザの履歴に入れる。
 * スマホの「戻る」（Android の戻る・iPhone の左端から右へなぞる）で、一覧と中身を行き来する
 * （前は管理ページの外へ出て、iPhone では保存していない変更が知らせなしに消えるおそれがあった：管理ページの試し 2026-10-27）。
 * 画面の「‹ 管理ページの一覧」も、履歴を1つ足す（戻ると、前に見ていた区切りが出る）。
 * 本番（Apps Script）は、管理ページが枠（iframe）の中にあるので、google.script.history を使う。試験用サーバーは、ブラウザの history
 */

/** 履歴に入れる印（区切りの中身を見ているか） */
type Entry = { adminSection: boolean }

interface ScriptHistory {
  push(state: Entry): void
  setChangeHandler(handler: (e: { state: unknown }) => void): void
}

const scriptHistory = (): ScriptHistory | undefined => (window as unknown as { google?: { script?: { history?: ScriptHistory } } }).google?.script?.history

const isSection = (state: unknown) => !!state && typeof state === 'object' && (state as Entry).adminSection === true

function push(entry: Entry): void {
  const api = scriptHistory()
  if (api) api.push(entry)
  else window.history.pushState(entry, '')
}

/** 履歴を戻した・進めたときに呼ぶもの（管理者の画面と先生の画面の両方から。本番の google.script.history は、呼ぶものを1つだけ持つので、ここで配る） */
const handlers = new Set<(state: unknown) => void>()
let listening = false

function onChange(handler: (state: unknown) => void): () => void {
  handlers.add(handler)
  if (!listening) {
    listening = true
    const call = (state: unknown) => handlers.forEach((h) => h(state))
    const api = scriptHistory()
    if (api) api.setChangeHandler((e) => call(e.state))
    else window.addEventListener('popstate', (e) => call(e.state))
  }
  return () => void handlers.delete(handler)
}

/** [一覧を出しているか, 中身を出す, 一覧へ戻る] */
export function usePhoneList(): [boolean, () => void, () => void] {
  const [list, setList] = useState(true)
  useEffect(
    () =>
      onChange((state) => {
        setList(!isSection(state))
        window.scrollTo(0, 0)
      }),
    [],
  )
  const show = useCallback(() => {
    setList(false)
    push({ adminSection: true })
    window.scrollTo(0, 0)
  }, [])
  const back = useCallback(() => {
    setList(true)
    push({ adminSection: false })
    window.scrollTo(0, 0)
  }, [])
  return [list, show, back]
}
