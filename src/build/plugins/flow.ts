/*
 * flow 简易流程组件插件
 *
 * 语法：围栏代码块，语言名 flow，每行『节点 | 可选说明』，节点间自动画向下箭头：
 *   ```flow
 *   读取配置 | config.ts
 *   编译文章
 *   ```
 */
import type { ComponentPlugin } from './base.ts'

const ICON_ARROW_DOWN =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>'

// 单个节点：正文 + 可选说明
const FLOW_NODE = (esc: (s: string) => string, text: string, sub: string): string => `
    <div class="flow-node">
        <div class="flow-text">${esc(text)}</div>
        ${sub ? `<div class="flow-sub">${esc(sub)}</div>` : ''}
    </div>`

// 节点间向下箭头（末节点不接）
const FLOW_ARROW = `\n    <div class="flow-arrow">${ICON_ARROW_DOWN}</div>`

const FLOW_WRAP = (items: string): string => `\n<div class="flow" v-pre>${items}\n</div>`

export const flowBlock: ComponentPlugin = {
  name: 'flow',
  fenceLangs: ['flow'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const items = lines
      .map((l, i) => {
        const [text = '', sub = ''] = ctx.splitRow(l)
        const arrow = i < lines.length - 1 ? FLOW_ARROW : ''
        return FLOW_NODE(esc, text, sub) + arrow
      })
      .join('')
    return FLOW_WRAP(items)
  },
}
