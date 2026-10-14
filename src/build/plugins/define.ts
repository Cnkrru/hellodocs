/*
 * define 定义组件插件
 *
 * 语法：围栏代码块，语言名 define，每行『术语 | 释义』：
 *   ```define
 *   SSG | 静态站点生成器
 *   ```
 * 学术笔记风格的定义列表，术语加粗、释义跟随。
 */
import type { ComponentPlugin } from './base.ts'

// 定义条目（术语加粗 + 释义跟随）
const DEFINE_ITEM = (esc: (s: string) => string, term: string, def: string): string => `
    <div class="define-item">
        <dt class="define-term">${esc(term)}</dt>
        <dd class="define-def">${esc(def)}</dd>
    </div>`

const DEFINE_WRAP = (items: string): string => `
<dl class="define" v-pre>${items}
</dl>`

export const defineBlock: ComponentPlugin = {
  name: 'define',
  fenceLangs: ['define'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const items = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [term = '', def = ''] = ctx.splitRow(l)
        return DEFINE_ITEM(esc, term, def)
      })
      .join('')
    return DEFINE_WRAP(items)
  },
}
