/*
 * 提示块组件插件（admonition）
 *
 * 语法：围栏代码块，语言名即等级（tip / info / warn / error），语言名之后可跟可选标题：
 *   ```warn 数据丢失风险
 *   正文走正常 markdown 渲染，块内仍可用行内语法与其他组件。
 *   ```
 * 标题省略时回落各等级默认文案；不依赖任何 markdown-it 容器/引用插件，
 * 与其余写作组件同一套 fence 拦截，外壳结构与 content.css 全部沿用。
 *
 * 结构约定：HTML 片段一律抽成模块级 const 模板，render 只留解析与编排的 TS 逻辑。
 */
import type { ComponentPlugin } from './base.ts'

/* ====================<HTML 模板>==================== */

// 外壳开标签：图标 + 标题 + body 开标签，正文由调用方渲染后传入
const ADMONITION_OPEN = (type: string, icon: string, title: string): string => `
<!-- == admonition ${type} == -->
<div class="admonition admonition-${type}">
    <div class="admonition-head">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
        <span class="admonition-title">${title}</span>
    </div>
    <div class="admonition-body">`

// 外壳收尾：关闭 body 与外壳两层
const ADMONITION_CLOSE = '</div></div>'

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

/* ====================<插件实现>==================== */

export const admonition: ComponentPlugin = {
  name: 'admonition',
  // 语言名即等级，四级共用同一外壳（content.css 已按 admonition-<type> 配色）
  fenceLangs: ['tip', 'info', 'warn', 'error'],

  render(ctx, content, info) {
    // info 形如『warn 可选标题』：首词是等级，其余是标题
    const [level = '', ...rest] = (info ?? '').trim().split(/\s+/)
    const type = level.toLowerCase()
    const meta = ADMONITION_META[type]
    // 语言名不在四级之内时交还默认高亮流程
    if (!meta) return null
    // 标题来自文档正文，必须转义后再进 HTML：否则 ```tip <img onerror=...> 可注入
    const title = rest.length > 0 ? ctx.escapeHtml(rest.join(' ')) : meta.label
    return `${ADMONITION_OPEN(type, ADMONITION_ICON[meta.icon]!, title)}${ctx.renderMarkdown(content)}${ADMONITION_CLOSE}`
  },
}
