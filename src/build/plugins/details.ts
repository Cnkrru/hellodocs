/*
 * details 折叠块组件插件
 *
 * 语法：围栏代码块，语言名 details，块内第一行作标题，其余为折叠内容：
 *   ```details 点击展开
 *   折叠起来的说明
 *   ```
 * 原生 details 标签，无 JS；内容整体转义、保留换行（CSS pre-wrap）。
 */
import type { ComponentPlugin } from './base.ts'

const DETAILS_BLOCK = (esc: (s: string) => string, summary: string, body: string): string => `
<details class="details" v-pre>
    <summary>${esc(summary)}</summary>
    <div class="details-body">${esc(body)}</div>
</details>`

export const detailsBlock: ComponentPlugin = {
  name: 'details',
  fenceLangs: ['details'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const nl = content.indexOf('\n')
    const summary = (nl === -1 ? content : content.slice(0, nl)).trim() || '详情'
    const body = (nl === -1 ? '' : content.slice(nl + 1)).trim()
    return DETAILS_BLOCK(esc, summary, body)
  },
}
