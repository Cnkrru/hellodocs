/*
 * 行内语法插件：按键 kbd / 徽章 badge / 荧光笔高亮 mark
 *
 * 语法（行业标准行内写法，编译期替换为语义化标签）：
 *   [[Ctrl]]      → <kbd>Ctrl</kbd>        键盘按键
 *   {{v1.0}}      → <span class="badge">    小徽章/状态标签
 *   ==重点==      → <mark>重点</mark>      荧光笔高亮
 *
 * 通过 markdown-it 行内 ruler 注入，与正文渲染同一管线；
 * 产物是纯内联标签，样式 class 约定见 content.css。
 *
 * 与围栏组件不同：行内语法常出现在表格、列表、标题等任何位置，
 * 用 ruler 级别的 token 替换，而非字符串正则——可避免误伤代码块
 * 内的字面量（代码块走 fence/text 管线，不经过行内规则）。
 */
import type MarkdownIt from 'markdown-it'
// StateInline 从 markdown-it 主入口取：markdown-it 15 自带类型并导出该类型，
// 深层路径 markdown-it/lib/... 会落到 @types/markdown-it 的旧声明，两套 StateInline 结构不一致，类型检查报错
import type { StateInline } from 'markdown-it'
import type { ComponentPlugin } from './base.ts'

/*
 * 通用行内规则工厂：成对定界符 [[...]] {{...}} ==...==
 * open/close 定界符相同或不同均可；内容不允许跨行、不允许为空。
 */
const makeInlineRule = (
  open: string,
  close: string,
  render: (inner: string, esc: (s: string) => string) => string,
) => {
  return (state: StateInline, silent: boolean): boolean => {
    const start = state.pos
    // 必须落在开启定界符上，且定界符后不能紧跟空白（避免 [[ 空格]] 这类空壳被吞）
    if (!state.src.startsWith(open, start)) return false
    const innerStart = start + open.length
    if (state.src[innerStart] === ' ' || state.src[innerStart] === '\n') return false
    const end = state.src.indexOf(close, innerStart)
    if (end === -1 || end === innerStart) return false
    if (!silent) {
      const token = state.push('html_inline', '', 0)
      token.content = render(state.src.slice(innerStart, end), state.md.utils.escapeHtml)
    }
    state.pos = end + close.length
    return true
  }
}

// kbd：[[Ctrl]] → 键盘按键
const kbdRule = makeInlineRule('[[', ']]', (inner, esc) => `<kbd>${esc(inner)}</kbd>`)
// badge：{{v1.0}} → 小徽章
const badgeRule = makeInlineRule(
  '{{',
  '}}',
  (inner, esc) => `<span class="badge">${esc(inner)}</span>`,
)
// mark：==重点== → 荧光笔高亮（标准 mark 语义）
const markRule = makeInlineRule('==', '==', (inner, esc) => `<mark>${esc(inner)}</mark>`)

export const inlineMarks: ComponentPlugin = {
  name: 'inline-marks',
  fenceLangs: [], // 行内语法，不走 fence 拦截
  setup(md: InstanceType<typeof MarkdownIt>) {
    // 插在 emphasis 之前，保证成对定界符优先于 * _ 等通用强调规则被消费
    md.inline.ruler.before('emphasis', 'kbd', kbdRule)
    md.inline.ruler.before('emphasis', 'badge', badgeRule)
    md.inline.ruler.before('emphasis', 'mark', markRule)
  },
}
