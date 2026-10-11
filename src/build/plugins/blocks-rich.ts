/*
 * 复合 fence 组件插件：tabs / links / gallery
 *
 * 语法：Markdown 围栏代码块，语言名即组件名（小写）。
 * 编译期直出纯 HTML，外壳结构与 class 命名与原 parseArticle.ts 完全一致。
 */
import type { ComponentPlugin } from './base.ts'

export const richBlocks: ComponentPlugin = {
  name: 'rich-blocks',
  fenceLangs: ['tabs', 'links', 'gallery'],

  render(ctx, lang, content) {
    const esc = ctx.escapeHtml

    // tabs：块内以 == 标签名 == 分隔各页，纯 CSS（radio+兄弟选择器）切换，无 JS
    if (lang === 'tabs') {
      const parts = content.split(/^==\s*(.+?)\s*==$/m).slice(1)
      const panels: { name: string; body: string }[] = []
      for (let i = 0; i + 1 < parts.length; i += 2) {
        panels.push({ name: (parts[i] ?? '').trim(), body: (parts[i + 1] ?? '').trim() })
      }
      if (panels.length === 0) {
        console.warn('[WARN]:tabs 代码块内未找到任何 == 标签名 == 分隔，已按空块跳过')
        return ''
      }
      // 同页多组 tabs 的 radio name 需隔离：以首标签名+面板数做稳定组名
      const group = `tabs-${panels[0]!.name}-${panels.length}`
      const nav = panels
        .map(
          (p, i) => `
    <input type="radio" id="${group}-${i}" name="${group}"${i === 0 ? ' checked' : ''}>
    <label for="${group}-${i}">${esc(p.name)}</label>`,
        )
        .join('')
      const bodies = panels
        .map(
          (p, i) => `
    <div class="tabs-panel" data-panel="${group}-${i}">${esc(p.body)}</div>`,
        )
        .join('')
      return `
<div class="tabs" v-pre>${nav}${bodies}
</div>`
    }

    // links：每行『标题 | 描述 | 网址』，整卡可点击，新窗口打开
    if (lang === 'links') {
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [title = '', desc = '', url = ''] = ctx.splitRow(l)
          // URL 白名单：仅放行 http(s)，其他协议（javascript: 等）降级为纯文本卡
          const safe = /^https?:\/\//i.test(url) ? url : ''
          const inner = `
        <span class="linkcard-title">${esc(title)}</span>
        ${desc ? `<span class="linkcard-desc">${esc(desc)}</span>` : ''}`
          return safe
            ? `
    <a class="linkcard" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${inner}
        <svg class="linkcard-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
    </a>`
            : `
    <div class="linkcard linkcard-static">${inner}
    </div>`
        })
        .join('')
      return `
<div class="linkcards" v-pre>${items}
</div>`
    }

    // gallery：每行『图片地址 | 说明』，复用正文 .content img 的 medium-zoom 灯箱
    if (lang === 'gallery') {
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [src = '', caption = ''] = ctx.splitRow(l)
          if (!src) return ''
          return `
    <figure class="gallery-item">
        <img src="${esc(src)}" alt="${esc(caption)}" loading="lazy">
        ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}
    </figure>`
        })
        .join('')
      return `
<div class="gallery" v-pre>${items}
</div>`
    }

    return null
  },
}
