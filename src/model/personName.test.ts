import { describe, expect, it } from 'vitest'
import { nameWithoutSpace, tidyName, untidyNameGap } from './personName'

describe('氏名の書き方をそろえる', () => {
  it('姓と名の間の半角の空白・続いた空白は、全角の空白1つにする。前後の空白と改行は除く', () => {
    expect(tidyName('文化 花子')).toBe('文化　花子')
    expect(tidyName('文化  花子')).toBe('文化　花子')
    expect(tidyName('文化　　花子')).toBe('文化　花子')
    expect(tidyName('文化 　花子')).toBe('文化　花子')
    expect(tidyName(' 文化　花子　\n')).toBe('文化　花子')
    expect(tidyName('文化　花子')).toBe('文化　花子')
    expect(tidyName('ワン シャオミン')).toBe('ワン　シャオミン')
  })

  it('英字の名前のとなりの空白は、打ったままにする', () => {
    expect(tidyName('Emma Smith')).toBe('Emma Smith')
    expect(tidyName(' Ｅｍｍａ Ｓｍｉｔｈ ')).toBe('Ｅｍｍａ Ｓｍｉｔｈ')
    expect(tidyName('文化 Emma')).toBe('文化 Emma')
  })

  it('空白なし・1字・英字は、そのまま', () => {
    expect(tidyName('文化花子')).toBe('文化花子')
    expect(tidyName('')).toBe('')
    expect(tidyName('   ')).toBe('')
  })

  it('そろっていない空白の位置（半角か）。英字のとなりと、全角1つは見ない', () => {
    expect(untidyNameGap('文化 花子')).toEqual({ start: 2, end: 3, half: true })
    expect(untidyNameGap('文化　　花子')).toEqual({ start: 2, end: 4, half: false })
    expect(untidyNameGap('文化　花子')).toBeNull()
    expect(untidyNameGap('Emma Smith')).toBeNull()
    expect(untidyNameGap(' 文化　花子 ')).toBeNull()
  })

  it('姓と名の間に空白がない名前（英字・「・」でつないだ名前・1字は見ない）', () => {
    expect(nameWithoutSpace('文化花子')).toBe(true)
    expect(nameWithoutSpace(' 文化花子 ')).toBe(true)
    expect(nameWithoutSpace('文化　花子')).toBe(false)
    expect(nameWithoutSpace('文化 花子')).toBe(false)
    expect(nameWithoutSpace('EmmaSmith')).toBe(false)
    expect(nameWithoutSpace('マリア・ガルシア')).toBe(false)
    expect(nameWithoutSpace('文')).toBe(false)
    expect(nameWithoutSpace('')).toBe(false)
  })
})
