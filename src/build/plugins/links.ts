/*
 * links 链接卡组件插件
 *
 * 语法：围栏代码块，语言名 links，每行『标题 | 描述 | 网址』：
 *   ```links
 *   Vue | 渐进式框架 | https://vuejs.org
 *   ```
 * 整卡可点击、新窗口打开；URL 走白名单（仅 http(s)，其他协议降级为纯文本卡）。
 */
import type { ComponentPlugin } from './base.ts'

// 卡片内文（标题 + 可选描述）
const LINKCARD_INNER = (esc: (s: string) => string, title: string, desc: string): string => `
        <span class="linkcard-title">${esc(title)}</span>
        ${desc ? `<span class="linkcard-desc">${esc(desc)}</span>` : ''}`

// 外链指示箭头
const LINKCARD_ARROW =
  '<svg class="linkcard-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>'

// 整卡可点击（新窗口打开）
const LINKCARD_LINK = (esc: (s: string) => string, href: string, inner: string): string => `
    <a class="linkcard" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}
        ${LINKCARD_ARROW}
    </a>`

// 非 http(s) 协议时降级为不可点静态卡
const LINKCARD_STATIC = (inner: string): string => `
    <div class="linkcard linkcard-static">${inner}
    </div>`

const LINKCARD_WRAP = (items: string): string => `
<div class="linkcards" v-pre>${items}
</div>`

export const linksBlock: ComponentPlugin = {
  name: 'links',
  fenceLangs: ['links'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const items = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [title = '', desc = '', url = ''] = ctx.splitRow(l)
        const inner = LINKCARD_INNER(esc, title, desc)
        // URL 白名单：仅放行 http(s)，其他协议（javascript: 等）降级为纯文本卡
        const safe = /^https?:\/\//i.test(url) ? url : ''
        return safe ? LINKCARD_LINK(esc, safe, inner) : LINKCARD_STATIC(inner)
      })
      .join('')
    return LINKCARD_WRAP(items)
  },
}
