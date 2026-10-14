/*
 * tabs 选项卡组件插件
 *
 * 语法：围栏代码块，语言名 tabs，块内用 `@tab 标签名` 分节（VuePress Plume 的 content tabs 约定）：
 *   ```tabs
 *   @tab 第一页
 *   页内容
 *   @tab 第二页
 *   页内容
 *   ```
 * 纯 CSS（radio + 兄弟选择器）切换，无 JS；页内容整体转义、不渲染 md。
 * 分节与分组导航走 panel.ts 共享管道（与 code-group / compare 同构）。
 *
 * 结构约定：HTML 片段一律抽成模块级 const 模板，render 只留编排的 TS 逻辑。
 */
import type { ComponentPlugin } from './base.ts'
import { panelTabs, splitPanels } from './panel.ts'

/* ====================<HTML 模板>==================== */

// 面板容器：内容整体转义、不渲染 md
const TABS_PANEL = (group: string, index: number, body: string): string => `
    <div class="tabs-panel" data-panel="${group}-${index}">${body}</div>`

const TABS_WRAP = (nav: string, bodies: string): string => `
<div class="tabs" v-pre>${nav}${bodies}
</div>`

/* ====================<插件实现>==================== */

export const tabsBlock: ComponentPlugin = {
  name: 'tabs',
  fenceLangs: ['tabs'],
  render(ctx, content) {
    const panels = splitPanels(content, 'tabs')
    if (panels.length === 0) return ''
    const { group, nav } = panelTabs(ctx, 'tabs', panels)
    const bodies = panels.map((p, i) => TABS_PANEL(group, i, ctx.escapeHtml(p.body))).join('')
    return TABS_WRAP(nav, bodies)
  },
}
