/*
 * 提示块组件插件（admonition）
 *
 * 语法（CommonMark directives 提案风格，Docusaurus/remark-directive 同款）：
 *   :::tip 可选标题
 *   内容（走正常 md 渲染）
 *   :::
 * 标题省略时用各等级默认文案。
 *
 * 实现：@mdit/plugin-container 的 open/closeRenderer 分两段渲染，
 * open 出图标+标题+body 开标签，中间内容由 markdown-it 正常渲染，close 收尾。
 * 外壳结构与原 parseArticle.ts 完全一致，content.css 无需改动。
 */
import type MarkdownIt from 'markdown-it'
import { container } from '@mdit/plugin-container'
import { alert } from '@mdit/plugin-alert'
import type { ComponentPlugin } from './base.ts'

// 等级 → 图标键 + 默认文案
const ADMONITION_META: Record<string, { icon: string; label: string }> = Object.freeze({
  tip: { icon: 'asterisk', label: '提示' },
  info: { icon: 'info', label: '信息' },
  warn: { icon: 'alert', label: '警告' },
  error: { icon: 'close', label: '错误' },
})

// 内联 SVG path（stroke 风格，随 currentColor 变色）
const ADMONITION_ICON: Record<string, string> = Object.freeze({
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  alert:
    '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>',
  close: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  asterisk: '<path d="M12 4v16"/><path d="M5 8l5.8 3.7 3.6-2.2"/><path d="m11 20 1-6 6-1"/>',
})

const shellOpen = (type: string, title: string, esc: (s: string) => string): string => {
  const meta = ADMONITION_META[type] || ADMONITION_META.info
  // 标题来自文档正文，必须转义后再进 HTML：否则「:::tip <img onerror=...>」可注入
  const t = title ? esc(title) : meta.label
  return `
<!-- == admonition ${type} == -->
<div class="admonition admonition-${type}">
    <div class="admonition-head">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ADMONITION_ICON[meta.icon]}</svg>
        <span class="admonition-title">${t}</span>
    </div>
    <div class="admonition-body">`
}

const shellClose = (): string => `</div></div>`

/*
 * GFM Alerts 别名（GitHub 官方标准）：
 *   > [!NOTE] 可选标题
 *   > 内容
 * 与 :::tip 同一渲染出口（复用外壳与样式），写法与 GitHub README 完全一致。
 * 等级映射：note→info、tip→tip、important/warning→warn、caution→error
 */
const GFM_ALERT_MAP: Record<string, string> = Object.freeze({
  note: 'info',
  tip: 'tip',
  important: 'warn',
  warning: 'warn',
  caution: 'error',
})

export const admonition: ComponentPlugin = {
  name: 'admonition',
  fenceLangs: [], // 容器语法，不走 fence 拦截

  setup(md: InstanceType<typeof MarkdownIt>) {
    const esc = md.utils.escapeHtml
    for (const type of ['tip', 'info', 'warn', 'error']) {
      md.use(container, {
        name: type,
        openRenderer(tokens, idx) {
          const token = tokens[idx]!
          // 标题：`:::info 标题` 取『标题』，缺省为空串（fallback 到默认文案）
          const raw = token.info.trim().slice(type.length).trim()
          return shellOpen(type, raw, esc)
        },
        closeRenderer() {
          return shellClose()
        },
      })
    }
    // GFM Alerts 别名：> [!NOTE] 等引用块语法，映射到同一套外壳
    md.use(alert, {
      alertNames: ['note', 'tip', 'important', 'warning', 'caution'],
      openRenderer(tokens, idx) {
        const token = tokens[idx]!
        // info 形如『[!NOTE] 可选标题』：取等级名与剩余标题
        const raw = token.info.trim()
        const m = /^\[!\s*(\w+)\s*\]?\s*(.*)$/i.exec(raw)
        const name = (m?.[1] ?? 'note').toLowerCase()
        const type = GFM_ALERT_MAP[name] ?? 'info'
        return shellOpen(type, m?.[2] ?? '', esc)
      },
      closeRenderer() {
        return shellClose()
      },
    })
  },
}
