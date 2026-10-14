/*
 * filetree 目录树组件插件
 *
 * 语法：围栏代码块，语言名 filetree，块内复用 Markdown 无序列表写法（- / * / +）：
 *   ```filetree
 *   - docs | 内容目录
 *     - index.md | 索引页
 *   ```
 * 层级由列表缩进表达，行尾 / 表示目录；产物为嵌套 ul/li，树线由 CSS 绘制。
 */
import type { ComponentPlugin } from './base.ts'

// 目录/文件图标（feather 风格，随 currentColor 变色）
const ICON_DIR =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
const ICON_FILE =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>'

/*
 * 树结构由编译期逐层拼装，标签本身是控制流的一部分，故单独抽成常量：
 * 一个节点先出开标签（保持未闭合），进子级时把 ul 嵌进其内部，回退时逐层收尾
 */
const FILES_TREE_ROOT_OPEN = '<ul class="filetree">'
const FILES_TREE_SUB_OPEN = '<ul>'
const FILES_TREE_NODE_CLOSE = '</li></ul>'
const FILES_TREE_SIBLING_CLOSE = '</li>'

// 节点开标签：图标 + 名称 + 可选注释（目录名尾部的 / 由调用方剥掉）
const FILES_TREE_NODE = (
  esc: (s: string) => string,
  isDir: boolean,
  label: string,
  note: string,
): string =>
  `<li class="${isDir ? 'is-dir' : 'is-file'}"><span class="filetree-icon">${
    isDir ? ICON_DIR : ICON_FILE
  }</span><span class="filetree-name">${esc(label)}</span>${
    note ? `<span class="filetree-note">${esc(note)}</span>` : ''
  }`

const FILES_TREE_BOX = (html: string): string => `\n<div class="filetree-box" v-pre>${html}\n</div>`

export const filetreeBlock: ComponentPlugin = {
  name: 'filetree',
  fenceLangs: ['filetree'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const lines = content.split('\n').filter((l) => l.trim().length > 0)
    if (lines.length === 0) return ''
    const stack: number[] = [] // 各层级的缩进宽度栈
    let html = ''
    let depth = 0
    for (const line of lines) {
      const raw = line.replace(/\t/g, '  ')
      const indent = raw.length - raw.trimStart().length
      // 剥掉行首的列表标记，其余按缩进判层；不写标记的旧写法仍可用
      const [name = '', note = ''] = ctx.splitRow(raw.trim().replace(/^[-*+]\s+/, ''))
      const isDir = name.endsWith('/')
      const label = isDir ? name.slice(0, -1) : name
      if (depth === 0) {
        stack.push(indent)
        html += FILES_TREE_ROOT_OPEN
        depth = 1
      } else if (indent > stack[depth - 1]!) {
        // 进入子级：上一个 li 保持未闭合，ul 嵌进其内部
        stack.push(indent)
        html += FILES_TREE_SUB_OPEN
        depth++
      } else {
        // 回退到首个不浅于当前缩进的层级，逐层收尾
        while (depth > 1 && indent < stack[depth - 1]!) {
          html += FILES_TREE_NODE_CLOSE
          stack.pop()
          depth--
        }
        html += FILES_TREE_SIBLING_CLOSE // 同级：先闭合上一个条目
      }
      html += FILES_TREE_NODE(esc, isDir, label, note)
    }
    while (depth > 0) {
      html += FILES_TREE_NODE_CLOSE
      depth--
    }
    return FILES_TREE_BOX(html)
  },
}
