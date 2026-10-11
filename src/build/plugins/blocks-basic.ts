/*
 * 基础 fence 组件插件：mermaid / timeline / steps
 *
 * 语法：Markdown 围栏代码块，语言名即组件名（小写）。
 * 编译期解析块内文本、拼外壳直出纯 HTML，无运行时开销。
 * 外壳结构与样式 class 命名与原 parseArticle.ts 完全一致，content.css 无需改动。
 */
import type { ComponentPlugin } from './base.ts'

export const basicBlocks: ComponentPlugin = {
  name: 'basic-blocks',
  fenceLangs: ['mermaid', 'timeline', 'steps'],

  render(ctx, lang, content) {
    const esc = ctx.escapeHtml

    // mermaid：渲染前是源码文本，由运行时 mermaid.run 替换为图
    if (lang === 'mermaid') {
      return `
<div class="language-mermaid" v-pre>${ctx.toolbar('mermaid')}
    <pre data-lang="mermaid"><code>${esc(content)}</code></pre>
</div>`
    }

    // timeline：每行『时间 | 标题 | 描述』，描述可省略
    if (lang === 'timeline') {
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [time = '', title = '', desc = ''] = ctx.splitRow(l)
          return `
    <div class="timeline-item">
        <span class="timeline-dot"></span>
        <div class="timeline-time">${esc(time)}</div>
        <div class="timeline-title">${esc(title)}</div>
        ${desc ? `<div class="timeline-desc">${esc(desc)}</div>` : ''}
    </div>`
        })
        .join('')
      return `
<div class="timeline" v-pre>${items}
</div>`
    }

    // steps：每行『标题 | 描述』，序号编译期自动生成
    if (lang === 'steps') {
      let n = 0
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [title = '', desc = ''] = ctx.splitRow(l)
          n += 1
          return `
    <div class="steps-item">
        <span class="steps-no">${n}</span>
        <div class="steps-body">
            <div class="steps-title">${esc(title)}</div>
            ${desc ? `<div class="steps-desc">${esc(desc)}</div>` : ''}
        </div>
    </div>`
        })
        .join('')
      return `
<div class="steps" v-pre>${items}
</div>`
    }

    return null
  },
}
