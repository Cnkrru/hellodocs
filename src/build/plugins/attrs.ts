/*
 * attrs 属性列表组件插件
 *
 * 语法：围栏代码块，语言名 attrs，每行『属性名 | 值』：
 *   ```attrs
 *   docsDir | docs
 *   ```
 * 键值对列表，适合罗列配置项、参数说明。
 */
import type { ComponentPlugin } from './base.ts'

// 属性行（键 + 值）
const ATTRS_ROW = (esc: (s: string) => string, key: string, val: string): string => `
    <div class="attrs-row">
        <span class="attrs-key">${esc(key)}</span>
        <span class="attrs-val">${esc(val)}</span>
    </div>`

const ATTRS_WRAP = (items: string): string => `\n<div class="attrs" v-pre>${items}\n</div>`

export const attrsBlock: ComponentPlugin = {
  name: 'attrs',
  fenceLangs: ['attrs'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const items = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [key = '', val = ''] = ctx.splitRow(l)
        return ATTRS_ROW(esc, key, val)
      })
      .join('')
    return ATTRS_WRAP(items)
  },
}
