/**
 * HEIC（iPhone の写真）を、端末の中で読む（依頼者の要望 2026-10-28）。
 * パソコンの Chrome・Edge は、HEIC をそのままでは読めない（iPhone・Mac の Safari は読める）。ブラウザが読めなかったときだけ、
 * HEIC を読む部品（libheif-js）を裏の手伝い（heicWorker.ts）で動かして、絵（ImageBitmap）にする。
 * 部品は大きい（約 2MB）ので、HEIC を選んだときに初めて、このページと同じ場所から読み込む。写真はどこにも送らない
 */

/** HEIF の入れ物の印（ファイルの頭の ftyp の種類。名前や種類の表示はあてにならないので、中身で見る） */
const HEIF_BRANDS = ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1', 'heif']

/** HEIC（HEIF）のファイルか（中身の頭で見る） */
export async function isHeif(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const text = (from: number) => String.fromCharCode(...head.subarray(from, from + 4))
  return head.length === 12 && text(4) === 'ftyp' && HEIF_BRANDS.includes(text(8))
}

/** 手伝いを止めるまでの、使わない時間（読み込んだ部品は大きなメモリを使うので、しばらく使わなければ止める） */
const IDLE_MS = 30000

let worker: Worker | null = null
let idle = 0
let seq = 0

/** HEIC を絵にする（写真の向きも直す。読めなければ Error） */
export async function decodeHeic(file: Blob): Promise<ImageBitmap> {
  const bytes = await file.arrayBuffer()
  clearTimeout(idle)
  const w = (worker ??= new Worker(new URL('./heicWorker.ts', import.meta.url), { type: 'module' }))
  const id = ++seq
  try {
    return await new Promise<ImageBitmap>((resolve, reject) => {
      const onMessage = (e: MessageEvent<{ id: number; bitmap?: ImageBitmap; error?: string }>) => {
        if (e.data.id !== id) return
        done()
        if (e.data.bitmap) resolve(e.data.bitmap)
        else reject(new Error(e.data.error ?? 'HEIC を読めませんでした'))
      }
      // 部品を読み込めない・手伝いが止まった：次は作り直す
      const onError = (e: ErrorEvent) => {
        done()
        if (worker === w) worker = null
        w.terminate()
        reject(new Error(e.message || 'HEIC を読む部品を動かせませんでした'))
      }
      const done = () => {
        w.removeEventListener('message', onMessage)
        w.removeEventListener('error', onError)
      }
      w.addEventListener('message', onMessage)
      w.addEventListener('error', onError)
      w.postMessage({ id, bytes }, [bytes])
    })
  } finally {
    idle = window.setTimeout(() => {
      worker?.terminate()
      worker = null
    }, IDLE_MS)
  }
}
