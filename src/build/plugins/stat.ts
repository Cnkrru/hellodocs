/*
 * stat 数据卡组件插件
 *
 * 语法：围栏代码块，语言名 stat，每行『数值 | 说明』：
 *   ```stat
 *   100% | 编译期渲染
 *   ```
 * 大数字 + 说明文字的统计卡片，横排自适应。
 */
import type { ComponentPlugin } from './base.ts'

// 统计卡条目（大数字 + 说明文字）
const STAT_ITEM = (esc: (s: string) => string, value: string, label: string): string => `
    <div class="stat-item">
        <div class="stat-value">${esc(value)}</div>
        <div class="stat-label">${esc(label)}</div>
    </div>`

const STAT_WRAP = (items: string): string => `
<div class="stat" v-pre>${items}
</div>`

export const statBlock: ComponentPlugin = {
  name: 'stat',
  fenceLangs: ['stat'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const items = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [value = '', label = ''] = ctx.splitRow(l)
        return STAT_ITEM(esc, value, label)
      })
      .join('')
    return STAT_WRAP(items)
  },
}
