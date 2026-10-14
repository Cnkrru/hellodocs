/*
 * progress 进度条组件插件
 *
 * 语法：围栏代码块，语言名 progress，每行『标签 | 百分比』：
 *   ```progress
 *   编译期渲染 | 80
 *   ```
 * 百分比编译期收敛到 0-100。
 */
import type { ComponentPlugin } from './base.ts'

// 单条进度（百分比已收敛到 0-100）
const PROGRESS_ITEM = (esc: (s: string) => string, label: string, pct: number): string => `
    <div class="progress-item">
        <span class="progress-label">${esc(label)}</span>
        <div class="progress-track">
            <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <span class="progress-pct">${pct}%</span>
    </div>`

const PROGRESS_WRAP = (items: string): string => `\n<div class="progress" v-pre>${items}\n</div>`

export const progressBlock: ComponentPlugin = {
  name: 'progress',
  fenceLangs: ['progress'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const items = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [label = '', pctRaw = '0'] = ctx.splitRow(l)
        const pct = Math.max(0, Math.min(100, Number(pctRaw) || 0))
        return PROGRESS_ITEM(esc, label, pct)
      })
      .join('')
    return PROGRESS_WRAP(items)
  },
}
