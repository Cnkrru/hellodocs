/*
 * mermaid 图组件插件
 *
 * 语法：围栏代码块，语言名 mermaid，块内为 mermaid 源码：
 *   ```mermaid
 *   graph TD
 *   A --> B
 *   ```
 * 编译期只拦截并产出容器，图表由运行时 mermaid.run 按需渲染（页面无 mermaid 块则零开销）。
 */
import type { ComponentPlugin } from './base.ts'

// 渲染前是源码文本，由运行时 mermaid.run 替换为图
const MERMAID_BLOCK = (toolbarHtml: string, code: string): string => `
<div class="language-mermaid" v-pre>${toolbarHtml}
    <pre data-lang="mermaid"><code>${code}</code></pre>
</div>`

export const mermaidBlock: ComponentPlugin = {
  name: 'mermaid',
  fenceLangs: ['mermaid'],
  render(ctx, content) {
    return MERMAID_BLOCK(ctx.toolbar('mermaid'), ctx.escapeHtml(content))
  },
}
