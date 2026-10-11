/*
 * 笔记展示类 fence 组件插件：define / qa / stat / compare / quote
 *
 * 语法：Markdown 围栏代码块，语言名即组件名（小写）。
 * 面向学习笔记与展示场景的编译期组件，产物纯 HTML，无运行时开销。
 */
import type { ComponentPlugin } from './base.ts'

export const notesBlocks: ComponentPlugin = {
  name: 'notes-blocks',
  fenceLangs: ['define', 'qa', 'stat', 'compare', 'quote'],
  render(ctx, lang, content) {
    const esc = ctx.escapeHtml

    /*
     * define：定义块，每行『术语 | 释义』
     * 学术笔记风格的定义列表，术语加粗、释义跟随
     */
    if (lang === 'define') {
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [term = '', def = ''] = ctx.splitRow(l)
          return `
    <div class="define-item">
        <dt class="define-term">${esc(term)}</dt>
        <dd class="define-def">${esc(def)}</dd>
    </div>`
        })
        .join('')
      return `
<dl class="define" v-pre>${items}
</dl>`
    }

    /*
     * qa：问答块，每行『问题 | 答案』
     * 答案默认折叠（原生 details），点击问题展开，适合自测复习
     */
    if (lang === 'qa') {
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [q = '', a = ''] = ctx.splitRow(l)
          return `
    <details class="qa-item">
        <summary class="qa-q"><span class="qa-badge">Q</span>${esc(q)}</summary>
        <div class="qa-a"><span class="qa-badge qa-badge-a">A</span>${esc(a)}</div>
    </details>`
        })
        .join('')
      return `
<div class="qa" v-pre>${items}
</div>`
    }

    /*
     * stat：数据卡，每行『数值 | 说明』
     * 大数字 + 说明文字的统计卡片，横排自适应
     */
    if (lang === 'stat') {
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [value = '', label = ''] = ctx.splitRow(l)
          return `
    <div class="stat-item">
        <div class="stat-value">${esc(value)}</div>
        <div class="stat-label">${esc(label)}</div>
    </div>`
        })
        .join('')
      return `
<div class="stat" v-pre>${items}
</div>`
    }

    /*
     * compare：对比双栏，用 == 左栏标题 == / == 右栏标题 == 分隔两栏
     * 栏内每行一个条目，适合优点/缺点、方案A/方案B 对照
     */
    if (lang === 'compare') {
      const parts = content.split(/^==\s*(.+?)\s*==$/m).slice(1)
      const cols: { name: string; items: string[] }[] = []
      for (let i = 0; i + 1 < parts.length; i += 2) {
        cols.push({
          name: (parts[i] ?? '').trim(),
          items: (parts[i + 1] ?? '')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        })
      }
      if (cols.length === 0) {
        console.warn('[WARN]:compare 代码块内未找到任何 == 栏标题 == 分隔，已按空块跳过')
        return ''
      }
      const html = cols
        .map(
          (c) => `
    <div class="compare-col">
        <div class="compare-head">${esc(c.name)}</div>
        <ul>${c.items.map((it) => `<li>${esc(it)}</li>`).join('')}
        </ul>
    </div>`,
        )
        .join('')
      return `
<div class="compare" v-pre>${html}
</div>`
    }

    /*
     * quote：引用卡，第一行内容，之后『作者 | 出处』一行可省略
     * 左侧竖线 + 大号引号的名言卡片
     */
    if (lang === 'quote') {
      const lines = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      const body = lines[0] ?? ''
      const [author = '', source = ''] = lines.length > 1 ? ctx.splitRow(lines[1]!) : []
      const cite = author || source
      return `
<blockquote class="quote" v-pre>
    <div class="quote-body">${esc(body)}</div>
    ${
      cite
        ? `
    <footer class="quote-cite">${esc(author)}${
      source ? `<cite class="quote-source">《${esc(source)}》</cite>` : ''
    }</footer>`
        : ''
    }
</blockquote>`
    }

    return null
  },
}
