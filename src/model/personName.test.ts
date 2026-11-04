import { describe, expect, it } from 'vitest'
import { nameWithoutSpace, tidyName, untidyNameGap, joinName, kanaProblem, nameParts, namePartsDone, toKatakana } from './personName'

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

  it('姓と名から表紙の氏名を作る（間は全角の空白。英字は半角。名が空なら姓だけ）', () => {
    expect(joinName('文化', '花子')).toBe('文化　花子')
    expect(joinName(' 文化 ', ' 花子 ')).toBe('文化　花子')
    expect(joinName('Smith', 'Emma')).toBe('Smith Emma')
    expect(joinName('文化', '')).toBe('文化')
    expect(joinName('', '花子')).toBe('花子')
  })

  it('前の原稿（氏名の欄が1つ）は、最初の空白で姓と名に分ける', () => {
    expect(nameParts({ name: '文化　花子' })).toEqual({ familyName: '文化', givenName: '花子', familyKana: '', givenKana: '' })
    expect(nameParts({ name: '文化 花子' })).toEqual({ familyName: '文化', givenName: '花子', familyKana: '', givenKana: '' })
    expect(nameParts({ name: '文化花子' })).toEqual({ familyName: '文化花子', givenName: '', familyKana: '', givenKana: '' })
    expect(nameParts({ name: '', familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ' })).toEqual({ familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ' })
  })

  it('ふりがなはカタカナにそろえる・カタカナでない字を見つける', () => {
    expect(toKatakana(' ぶんか ')).toBe('ブンカ')
    expect(toKatakana('はなこ')).toBe('ハナコ')
    expect(toKatakana('ブンカ')).toBe('ブンカ')
    expect(kanaProblem('ブンカ')).toBe(false)
    expect(kanaProblem('ガルシア・マリア')).toBe(false)
    expect(kanaProblem('Smith')).toBe(false)
    expect(kanaProblem('文化')).toBe(true)
    expect(kanaProblem('')).toBe(false)
  })

  it('氏名の4つの欄が入れ終わったか（姓とセイは必ず。名を入れたらメイも）', () => {
    expect(namePartsDone({ familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ' })).toBe(true)
    expect(namePartsDone({ familyName: '文化', givenName: '', familyKana: 'ブンカ', givenKana: '' })).toBe(true)
    expect(namePartsDone({ familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: '' })).toBe(false)
    expect(namePartsDone({ familyName: '文化', givenName: '花子', familyKana: '', givenKana: 'ハナコ' })).toBe(false)
    expect(namePartsDone({ familyName: '', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ' })).toBe(false)
    expect(namePartsDone({ familyName: '文化', givenName: '花子', familyKana: '文化', givenKana: 'ハナコ' })).toBe(false)
  })
})
