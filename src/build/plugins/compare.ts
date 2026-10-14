/*
 * compare 对比组件插件
 *
 * 语法：围栏代码块，语言名 compare，用 `@tab 栏标题` 分节，栏内每行一个条目：
 *   ```compare
 *   @tab 优点
 *   构建期渲染
 *   @tab 缺点
 *   需要重新编译
 *   ```
 * 适合优点/缺点、方案A/方案B 对照。
 * 分节走 panel.ts 共享管道（与 tabs / code-group 同构）。
 *
 * 结构约定：HTML 片段一律抽成模块级 const 模板，render 只留解析与编排的 TS 逻辑。
 */
import type { ComponentPlugin } from './base.ts'
import { splitPanels } from './panel.ts'

/* ====================<HTML 模板>==================== */

// 对比栏条目
const COMPARE_ITEM = (esc: (s: string) => string, item: string): string => `<li>${esc(item)}</li>`

// 整栏：栏标题 + 条目列表
const COMPARE_COL = (esc: (s: string) => string, name: string, items: string): string => `
    <div class="compare-col">
        <div class="compare-head">${esc(name)}</div>
        <ul>${items}
        </ul>
    </div>`

const COMPARE_WRAP = (html: string): string => `
<div class="compare" v-pre>${html}
</div>`

/* ====================<插件实现>==================== */

export const compareBlock: ComponentPlugin = {
  name: 'compare',
  fenceLangs: ['compare'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const panels = splitPanels(content, 'compare')
    if (panels.length === 0) return ''
    const html = panels
      .map((p) => {
        const items = p.body
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((it) => COMPARE_ITEM(esc, it))
          .join('')
        return COMPARE_COL(esc, p.name, items)
      })
      .join('')
    return COMPARE_WRAP(html)
  },
}
