/*
 * 代码组组件插件（code-group，VitePress 标准组件）
 *
 * 语法：围栏代码块语言名 code-group，块内以 == 标签名 == 分隔各代码面板：
 *   ```code-group
 *   == npm ==
 *   npm install
 *   == pnpm ==
 *   pnpm install
 *   ```
n * 每个面板内容按『标签名』推断语言走 shiki 编译期高亮（标签名即语言名，如 npm 不识别则回退纯文本），
n * 切换交互复用 tabs 的纯 CSS radio 方案，零运行时 JS。
n */
import type { ComponentPlugin } from './base.ts'

export const codeGroupBlock: ComponentPlugin = {
  name: 'code-group',
  fenceLangs: ['code-group'],

  render(ctx, lang, content) {
    if (lang !== 'code-group') return null
    const esc = ctx.escapeHtml

    // 与 tabs 同款分隔：== 标签名 == 切分面板
    const parts = content.split(/^==\s*(.+?)\s*==$/m).slice(1)
    const panels: { name: string; body: string }[] = []
    for (let i = 0; i + 1 < parts.length; i += 2) {
      panels.push({ name: (parts[i] ?? '').trim(), body: (parts[i + 1] ?? '').trim() })
    }
    if (panels.length === 0) {
      console.warn('[WARN]:code-group 代码块内未找到任何 == 标签名 == 分隔，已按空块跳过')
      return ''
    }

    // 同页多组 code-group 的 radio name 需隔离：以首标签名+面板数做稳定组名
    const group = `cg-${panels[0]!.name}-${panels.length}`
    const nav = panels
      .map(
        (p, i) => `
    <input type="radio" id="${group}-${i}" name="${group}"${i === 0 ? ' checked' : ''}>
    <label for="${group}-${i}">${esc(p.name)}</label>`,
      )
      .join('')

    // 面板内容：优先走编译期 shiki 高亮（标签名即语言名），未提供高亮能力时回退纯文本
    const bodies = panels
      .map((p, i) => {
        const langName = p.name.toLowerCase()
        let codeHtml: string
        if (ctx.highlight) {
          codeHtml = ctx.highlight(p.body, langName)
        } else {
          codeHtml = `<pre class="shiki"><code>${esc(p.body)}</code></pre>`
        }
        return `
    <div class="tabs-panel code-group-panel" data-panel="${group}-${i}">
        <div class="language-${langName}" v-pre>${codeHtml}</div>
    </div>`
      })
      .join('')

    return `
<div class="tabs code-group" v-pre>${nav}${bodies}
</div>`
  },
}
