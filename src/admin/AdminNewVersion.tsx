import { useState } from 'react'
import { flushSync } from 'react-dom'
import { NewVersionBanner, useNewVersion } from '../app/newVersion'
import { useConfirm } from './confirm'
import { server } from './server'

/**
 * 管理ページにも「新しい版があります［新しくする］」を出す（依頼者の判断 2026-10-27。学生のツールと同じ形：app/newVersion.tsx）。
 * 管理ページは Apps Script から配るので、version.json ではなく、サーバーの getVersion で公開中の版の印を読む
 * （まとめるときに、画面と Code.js に同じ印を入れる：scripts/build-gas.mjs）。開発サーバー（印が 'dev'）では調べない
 */

/** 開き直す場所（公開中の管理ページ。getVersion が返す） */
let reloadUrl = ''

/** 公開中の版の印（読めない・前の版のサーバーで getVersion がないときは null） */
async function publishedAdminId(): Promise<string | null> {
  try {
    const v = await server.getVersion()
    if (typeof v?.url === 'string' && v.url) reloadUrl = v.url
    return typeof v?.id === 'string' && v.id ? v.id : null
  } catch {
    return null
  }
}

/**
 * dirty：保存していない変更がある（新しくすると消えるので、確かめる）。
 * onLeave：開き直す直前（タブを離れるときの確認を、もう一度出さないように止める）
 */
export function AdminNewVersion({ dirty, onLeave }: { dirty: boolean; onLeave: () => void }) {
  const newer = useNewVersion(publishedAdminId)
  const [closed, setClosed] = useState(false)
  const ask = useConfirm()
  if (!newer || closed) return null
  return (
    <NewVersionBanner
      busyText="開き直しています…"
      onClose={() => setClosed(true)}
      onReload={async () => {
        if (dirty && !(await ask('保存していない変更があります。新しくすると、この変更は消えます。', { title: '新しい版にしますか？', ok: '変更を消して新しくする', danger: true }))) return false
        // 確認を止めてから移る（止める前に移ると、ブラウザの「このサイトを離れますか？」がもう一度出る）
        flushSync(onLeave)
        // Apps Script の画面は、中の枠だけを読み込み直すと白くなるので、管理ページの場所を開き直す（押した直後なので、上の画面を移れる）
        window.setTimeout(() => window.open(reloadUrl || location.href, '_top'), 0)
      }}
    />
  )
}
