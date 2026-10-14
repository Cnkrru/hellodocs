/*
 * 代码组组件插件（code-group，VitePress 标准组件）
 *
 * 语法：围栏代码块语言名 code-group，块内用 `@tab 标签名` 分节（VuePress Plume 的 content tabs 约定）：
 *   ```code-group
 *   @tab npm
 *   npm install
 *   @tab pnpm
 *   pnpm install
 *   ```
 * 每个面板内容按『标签名』推断语言走 shiki 编译期高亮（标签名即语言名，如 npm 不识别则回退纯文本），
 * 切换交互复用 tabs 的纯 CSS radio 方案，零运行时 JS。
 * 分节与分组导航走 panel.ts 共享管道（与 tabs / compare 同构）。
 *
 * 结构约定：HTML 片段一律抽成模块级 const 模板，render 只留解析与编排的 TS 逻辑。
 */
import type { ComponentPlugin } from './base.ts'
import { panelTabs, splitPanels } from './panel.ts'

/* ====================<HTML 模板>==================== */

// 代码面板：shiki 产物（或降级代码块）塞进 body
const CODE_GROUP_PANEL = (group: string, index: number, lang: string, body: string): string => `
    <div class="tabs-panel code-group-panel" data-panel="${group}-${index}">
        <div class="language-${lang}" v-pre>${body}</div>
    </div>`

// 无 shiki 能力时的降级代码块
const CODE_GROUP_PLAIN = (esc: (s: string) => string, code: string): string =>
  `<pre class="shiki"><code>${esc(code)}</code></pre>`

const CODE_GROUP_WRAP = (nav: string, bodies: string): string => `
<div class="tabs code-group" v-pre>${nav}${bodies}
</div>`

/* ====================<插件实现>==================== */

export const codeGroupBlock: ComponentPlugin = {
  name: 'code-group',
  fenceLangs: ['code-group'],

  render(ctx, content) {
    const esc = ctx.escapeHtml
    const panels = splitPanels(content, 'code-group')
    if (panels.length === 0) return ''
    const { group, nav } = panelTabs(ctx, 'cg', panels)

    // 面板内容：优先走编译期 shiki 高亮（标签名即语言名），未提供高亮能力时回退纯文本
    const bodies = panels
      .map((p, i) => {
        const label = p.name.toLowerCase()
        // 类名直接拼进 HTML 属性，先消毒再落盘；送 shiki 的仍是原标签名，着色行为不变
        const attrLang = label.replace(/[^\w-]/g, '') || 'text'
        const codeHtml = ctx.highlight ? ctx.highlight(p.body, label) : CODE_GROUP_PLAIN(esc, p.body)
        return CODE_GROUP_PANEL(group, i, attrLang, codeHtml)
      })
      .join('')

    return CODE_GROUP_WRAP(nav, bodies)
  },
}
