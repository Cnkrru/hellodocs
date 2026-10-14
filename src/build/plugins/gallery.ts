/*
 * gallery 图集组件插件
 *
 * 语法：围栏代码块，语言名 gallery，每行『图片地址 | 说明（可省略）』：
 *   ```gallery
 *   /imgs/a.png | 首页截图
 *   ```
 * 复用正文 .content img 的 medium-zoom 灯箱，无需额外运行时逻辑。
 */
import type { ComponentPlugin } from './base.ts'

// 图集条目（图 + 可选说明）
const GALLERY_ITEM = (esc: (s: string) => string, src: string, caption: string): string => `
    <figure class="gallery-item">
        <img src="${esc(src)}" alt="${esc(caption)}" loading="lazy">
        ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}
    </figure>`

const GALLERY_WRAP = (items: string): string => `
<div class="gallery" v-pre>${items}
</div>`

export const galleryBlock: ComponentPlugin = {
  name: 'gallery',
  fenceLangs: ['gallery'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const items = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [src = '', caption = ''] = ctx.splitRow(l)
        return src ? GALLERY_ITEM(esc, src, caption) : ''
      })
      .join('')
    return GALLERY_WRAP(items)
  },
}
