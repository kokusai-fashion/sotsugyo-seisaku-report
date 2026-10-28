import libheif, { type Libheif } from 'libheif-js/libheif-wasm/libheif-bundle.mjs'

/**
 * HEIC（iPhone の写真）を絵（ImageBitmap）にする、裏の手伝い（model/heic.ts から使う）。
 * HEIC を読む部品（libheif）は大きく、読むのに少し時間がかかるので、画面を止めないよう、ここで動かす。写真はどこにも送らない
 */

let lib: Libheif | null = null

self.onmessage = async (e: MessageEvent<{ id: number; bytes: ArrayBuffer }>) => {
  const { id, bytes } = e.data
  try {
    lib ??= libheif()
    const images = new lib.HeifDecoder().decode(new Uint8Array(bytes))
    try {
      // 中の絵のうち、写真そのもの（primary。ほかは小さな見本など）
      const image = images.find((i) => i.is_primary()) ?? images[0]
      if (!image) throw new Error('HEIC の中に写真がありません')
      const data = new ImageData(image.get_width(), image.get_height())
      // 写真の向き（回転・反転）は、部品が直す
      await new Promise<void>((resolve, reject) => image.display(data, (shown) => (shown ? resolve() : reject(new Error('HEIC を読めませんでした')))))
      const bitmap = await createImageBitmap(data)
      postMessage({ id, bitmap }, { transfer: [bitmap] })
    } finally {
      for (const image of images) image.free()
    }
  } catch (error) {
    postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
