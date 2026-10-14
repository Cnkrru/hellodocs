/*
 * quote 引用卡组件插件
 *
 * 语法：围栏代码块，语言名 quote，第一行为内容，之后『作者 | 出处』一行可省略：
 *   ```quote
 *   任何可以用编译期解决的问题，都不应该留给运行时。
 *   设计原则
 *   ```
 * 左侧竖线 + 大号引号的名言卡片。
 */
import type { ComponentPlugin } from './base.ts'

// 署名行：作者 + 可选出处
const QUOTE_CITE = (esc: (s: string) => string, author: string, source: string): string => `
    <footer class="quote-cite">${esc(author)}${
      source ? `<cite class="quote-source">《${esc(source)}》</cite>` : ''
    }</footer>`

const QUOTE_BLOCK = (
  esc: (s: string) => string,
  body: string,
  author: string,
  source: string,
): string => `
<blockquote class="quote" v-pre>
    <div class="quote-body">${esc(body)}</div>
    ${author || source ? QUOTE_CITE(esc, author, source) : ''}
</blockquote>`

export const quoteBlock: ComponentPlugin = {
  name: 'quote',
  fenceLangs: ['quote'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const body = lines[0] ?? ''
    const [author = '', source = ''] = lines.length > 1 ? ctx.splitRow(lines[1]!) : []
    return QUOTE_BLOCK(esc, body, author, source)
  },
}
