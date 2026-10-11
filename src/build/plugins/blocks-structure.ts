/*
 * 结构类 fence 组件插件：filetree / terminal / details / flow
 *
 * 语法：Markdown 围栏代码块，语言名即组件名（小写）。
 * 编译期直出纯 HTML，样式 class 约定见 content.css。
 */
import type { ComponentPlugin } from './base.ts'

// 目录/文件图标（feather 风格，随 currentColor 变色）
const ICON_DIR =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
const ICON_FILE =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>'
const ICON_ARROW_DOWN =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>'

export const structureBlocks: ComponentPlugin = {
  name: 'structure-blocks',
  fenceLangs: ['filetree', 'terminal', 'details', 'flow'],
  render(ctx, lang, content) {
    const esc = ctx.escapeHtml

    /*
     * filetree：缩进（2 空格或 tab 一级）表达层级，行尾 / 表示目录
     * 行格式『路径 | 可选注释』，产物为嵌套 ul/li，树线由 CSS 绘制
     */
    if (lang === 'filetree') {
      const lines = content.split('\n').filter((l) => l.trim().length > 0)
      if (lines.length === 0) return ''
      const stack: number[] = [] // 各层级的缩进宽度栈
      let html = ''
      let depth = 0
      for (const line of lines) {
        const raw = line.replace(/\t/g, '  ')
        const indent = raw.length - raw.trimStart().length
        const [name = '', note = ''] = ctx.splitRow(raw.trim())
        const isDir = name.endsWith('/')
        const label = isDir ? name.slice(0, -1) : name
        if (depth === 0) {
          stack.push(indent)
          html += '<ul class="filetree">'
          depth = 1
        } else if (indent > stack[depth - 1]!) {
          // 进入子级：上一个 li 保持未闭合，ul 嵌进其内部
          stack.push(indent)
          html += '<ul>'
          depth++
        } else {
          // 回退到首个不浅于当前缩进的层级，逐层收尾
          while (depth > 1 && indent < stack[depth - 1]!) {
            html += '</li></ul>'
            stack.pop()
            depth--
          }
          html += '</li>' // 同级：先闭合上一个条目
        }
        html += `<li class="${isDir ? 'is-dir' : 'is-file'}"><span class="filetree-icon">${
          isDir ? ICON_DIR : ICON_FILE
        }</span><span class="filetree-name">${esc(label)}</span>${
          note ? `<span class="filetree-note">${esc(note)}</span>` : ''
        }`
      }
      while (depth > 0) {
        html += '</li></ul>'
        depth--
      }
      return `\n<div class="filetree-box" v-pre>${html}\n</div>`
    }

    /*
     * terminal：Mac 风格终端窗口
     * 『$ 』开头的行按命令渲染（主色提示符），其余按输出渲染
     */
    if (lang === 'terminal') {
      const rows = content
        .split('\n')
        .map((l) => l.replace(/\s+$/, ''))
        .filter((l) => l.trim().length > 0)
        .map((l) => {
          if (l.startsWith('$ ')) {
            return `\n        <div class="terminal-line terminal-cmd"><span class="terminal-prompt">$</span> ${esc(
              l.slice(2),
            )}</div>`
          }
          return `\n        <div class="terminal-line">${esc(l)}</div>`
        })
        .join('')
      return `
<div class="terminal" v-pre>
    <div class="terminal-bar">
        <span class="terminal-dot dot-red"></span>
        <span class="terminal-dot dot-yellow"></span>
        <span class="terminal-dot dot-green"></span>
        <span class="terminal-title">terminal</span>
    </div>
    <div class="terminal-body">${rows}
    </div>
</div>`
    }

    /*
     * details：折叠块，块内第一行作标题（summary），其余为折叠内容
     * 原生 details 标签，无 JS；内容整体转义、保留换行（CSS pre-wrap）
     */
    if (lang === 'details') {
      const nl = content.indexOf('\n')
      const summary = (nl === -1 ? content : content.slice(0, nl)).trim() || '详情'
      const body = (nl === -1 ? '' : content.slice(nl + 1)).trim()
      return `
<details class="details" v-pre>
    <summary>${esc(summary)}</summary>
    <div class="details-body">${esc(body)}</div>
</details>`
    }

    /*
     * flow：简易流程，每行『节点 | 可选说明』，节点间自动画向下箭头
     */
    if (lang === 'flow') {
      const lines = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      const items = lines
        .map((l, i) => {
          const [text = '', sub = ''] = ctx.splitRow(l)
          const node = `
    <div class="flow-node">
        <div class="flow-text">${esc(text)}</div>
        ${sub ? `<div class="flow-sub">${esc(sub)}</div>` : ''}
    </div>`
          const arrow =
            i < lines.length - 1 ? `\n    <div class="flow-arrow">${ICON_ARROW_DOWN}</div>` : ''
          return node + arrow
        })
        .join('')
      return `\n<div class="flow" v-pre>${items}\n</div>`
    }

    return null
  },
}
