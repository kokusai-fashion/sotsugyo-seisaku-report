// HEIC を読む部品（libheif-js。LGPL-3.0）の、このツールで使う所だけの型（部品に付いている型には、HeifDecoder などがないため）
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  export interface HeifImage {
    get_width(): number
    get_height(): number
    is_primary(): boolean
    display(target: { data: Uint8ClampedArray; width: number; height: number }, done: (result: { data: Uint8ClampedArray } | null) => void): void
    free(): void
  }
  export interface Libheif {
    HeifDecoder: new () => { decode(bytes: Uint8Array): HeifImage[] }
  }
  export default function libheif(options?: unknown): Libheif
}
