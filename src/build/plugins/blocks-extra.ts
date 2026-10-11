/*
 * 扩展展示类 fence 组件插件：cards / progress / attrs
 *
 * 语法：Markdown 围栏代码块，语言名即组件名（小写）。
 * 面向内容展示场景的编译期组件，产物纯 HTML，无运行时开销。
 *
 *   cards：卡片网格，每行『标题 | 描述 | 链接(可选)』
 *   progress：进度条，每行『标签 | 百分比』
 *   attrs：属性列表，每行『属性名 | 值』
 */
import type { ComponentPlugin } from './base.ts'

export const extraBlocks: ComponentPlugin = {
  name: 'extra-blocks',
  fenceLangs: ['cards', 'progress', 'attrs'],
  render(ctx, lang, content) {
    const esc = ctx.escapeHtml

    // cards：卡片网格，链接可选（有链接时整卡可点击）
    if (lang === 'cards') {
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [title = '', desc = '', link = ''] = ctx.splitRow(l)
          const body = `
    <div class="card-item">
        <div class="card-title">${esc(title)}</div>
        ${desc ? `<div class="card-desc">${esc(desc)}</div>` : ''}
    </div>`
          return link
            ? `\n    <a class="card-link" href="${esc(link)}">${body}\n    </a>`
            : body
        })
        .join('')
      return `\n<div class="cards" v-pre>${items}\n</div>`
    }

    // progress：进度条，百分比自动收敛到 0-100
    if (lang === 'progress') {
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [label = '', pctRaw = '0'] = ctx.splitRow(l)
          const pct = Math.max(0, Math.min(100, Number(pctRaw) || 0))
          return `\n    <div class="progress-item">
        <span class="progress-label">${esc(label)}</span>
        <div class="progress-track">
            <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <span class="progress-pct">${pct}%</span>
    </div>`
        })
        .join('')
      return `\n<div class="progress" v-pre>${items}\n</div>`
    }

    // attrs：属性列表，键值对展示
    if (lang === 'attrs') {
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [key = '', val = ''] = ctx.splitRow(l)
          return `\n    <div class="attrs-row">
        <span class="attrs-key">${esc(key)}</span>
        <span class="attrs-val">${esc(val)}</span>
    </div>`
        })
        .join('')
      return `\n<div class="attrs" v-pre>${items}\n</div>`
    }

    return null
  },
}
