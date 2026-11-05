import type { InlineNode, ParagraphBlock } from './types'

/**
 * ひな形の「書き出しの文」（mockups/v111 案B。依頼者 2026-11-05）。
 * 先生が、段落のはじめの文（書き出し）と、その続きに何を書くかの説明を用意する。学生の段落には、書き出しの字が入り、
 * 書き出しのままのあいだは、そのあとに説明が薄く出る。学生が続きを書くと、説明は消える。
 */

/** 段落の字の印（書き出しのままかを比べる。図表への参照は、番号ではなく ID で比べる：番号は、前に図表を足すと変わるため） */
export const contentKey = (content: InlineNode[]): string => content.map((n) => (n.type === 'text' ? n.text : `\u0000${n.targetId}`)).join('')

/** 書き出しの文のまま（学生がまだ続きを書いていない）段落か */
export const untouchedStarter = (p: ParagraphBlock): boolean => p.starter !== undefined && contentKey(p.content) === p.starter
