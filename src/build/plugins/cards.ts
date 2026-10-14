/*
 * cards 卡片网格组件插件
 *
 * 语法：围栏代码块，语言名 cards，每行『标题 | 描述 | 链接（可省略）』：
 *   ```cards
 *   配置教学 | 安装与全部字段 | /post/配置
 *   ```
 * 带链接时整卡可点击，链接走协议白名单（http(s)/mailto/站内相对路径/锚点）。
 */
import type { ComponentPlugin } from './base.ts'

// 卡片本体（标题 + 可选描述）
const CARDS_ITEM = (esc: (s: string) => string, title: string, desc: string): string => `
    <div class="card-item">
        <div class="card-title">${esc(title)}</div>
        ${desc ? `<div class="card-desc">${esc(desc)}</div>` : ''}
    </div>`

// 有链接时整卡可点击
const CARDS_LINK = (esc: (s: string) => string, href: string, body: string): string =>
  `\n    <a class="card-link" href="${esc(href)}">${body}\n    </a>`

const CARDS_WRAP = (items: string): string => `\n<div class="cards" v-pre>${items}\n</div>`

export const cardsBlock: ComponentPlugin = {
  name: 'cards',
  fenceLangs: ['cards'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const items = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [title = '', desc = '', link = ''] = ctx.splitRow(l)
        const body = CARDS_ITEM(esc, title, desc)
        // 链接白名单：仅放行 http(s)/mailto/站内相对路径/锚点，其他协议（javascript: 等）降级为不可点卡片
        const safe = /^(https?:\/\/|mailto:|\/|#)/i.test(link.trim()) ? link.trim() : ''
        return safe ? CARDS_LINK(esc, safe, body) : body
      })
      .join('')
    return CARDS_WRAP(items)
  },
}
