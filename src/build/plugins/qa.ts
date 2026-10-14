/*
 * qa 问答组件插件
 *
 * 语法：围栏代码块，语言名 qa，每行『问题 | 答案』：
 *   ```qa
 *   什么是 SSG | 构建期直出静态 HTML
 *   ```
 * 答案默认折叠（原生 details），点击问题展开，适合自测复习。
 */
import type { ComponentPlugin } from './base.ts'

// 问答条目：答案默认折叠
const QA_ITEM = (esc: (s: string) => string, q: string, a: string): string => `
    <details class="qa-item">
        <summary class="qa-q"><span class="qa-badge">Q</span>${esc(q)}</summary>
        <div class="qa-a"><span class="qa-badge qa-badge-a">A</span>${esc(a)}</div>
    </details>`

const QA_WRAP = (items: string): string => `
<div class="qa" v-pre>${items}
</div>`

export const qaBlock: ComponentPlugin = {
  name: 'qa',
  fenceLangs: ['qa'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const items = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [q = '', a = ''] = ctx.splitRow(l)
        return QA_ITEM(esc, q, a)
      })
      .join('')
    return QA_WRAP(items)
  },
}
