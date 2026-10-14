/*
 * 行内徽章语法：{{v1.0}} → <span class="badge">v1.0</span>
 *
 * 与围栏组件不同，行内语法可出现在表格、列表、标题等任何位置，故用 markdown-it
 * 行内 ruler 级别的 token 替换而非字符串正则——代码块走 fence/text 管线，不经过行内规则，
 * 因此不会误伤代码里的字面量。
 */
import type MarkdownIt from 'markdown-it'
import { makeInlineRule } from './base.ts'
import type { ComponentPlugin } from './base.ts'

const BADGE_HTML = (esc: (s: string) => string, inner: string): string =>
  `<span class="badge">${esc(inner)}</span>`

export const badgePlugin: ComponentPlugin = {
  name: 'badge',
  fenceLangs: [], // 行内语法，不走 fence 拦截
  setup(md: InstanceType<typeof MarkdownIt>) {
    // 插在 emphasis 之前，保证成对定界符优先于 * _ 等通用强调规则被消费
    md.inline.ruler.before('emphasis', 'badge', makeInlineRule('{{', '}}', BADGE_HTML))
  },
}
