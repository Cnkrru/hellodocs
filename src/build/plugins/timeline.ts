/*
 * timeline 时间线组件插件
 *
 * 语法：围栏代码块，语言名 timeline，每行『时间 | 标题 | 描述（可省略）』：
 *   ```timeline
 *   2025-01 | 立项 | 确定技术选型
 *   ```
 * 编译期直出纯 HTML，竖线由 CSS 绘制，无运行时开销。
 */
import type { ComponentPlugin } from './base.ts'

// 单条：时间 + 标题 + 可选描述
const TIMELINE_ITEM = (
  esc: (s: string) => string,
  time: string,
  title: string,
  desc: string,
): string => `
    <div class="timeline-item">
        <span class="timeline-dot"></span>
        <div class="timeline-time">${esc(time)}</div>
        <div class="timeline-title">${esc(title)}</div>
        ${desc ? `<div class="timeline-desc">${esc(desc)}</div>` : ''}
    </div>`

const TIMELINE_WRAP = (items: string): string => `
<div class="timeline" v-pre>${items}
</div>`

export const timelineBlock: ComponentPlugin = {
  name: 'timeline',
  fenceLangs: ['timeline'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const items = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [time = '', title = '', desc = ''] = ctx.splitRow(l)
        return TIMELINE_ITEM(esc, time, title, desc)
      })
      .join('')
    return TIMELINE_WRAP(items)
  },
}
