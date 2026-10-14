/*
 * 组件插件共享基础模块
 *
 * 职责：定义『编译期组件插件』的统一契约与公共工具，所有写作组件插件都基于它实现。
 *
 * 行业标准分层（对齐 VitePress / Docusaurus）：
 *  - 编译期（本层）：拦截 Markdown 扩展语法，产出『语义化 HTML 结构』，class 命名约定稳定
 *  - 主题层（content.css）：按 class 约定配色与排版，组件样式可主题化
 *
 * 新增一个组件 = 在 plugins/ 下加一个文件（一个文件只放一种语法），实现 ComponentPlugin，并在 registry.ts 登记一行。
 */

// StateInline 从 markdown-it 主入口取：markdown-it 15 自带类型并导出该类型，
// 深层路径 markdown-it/lib/... 会落到 @types/markdown-it 的旧声明，两套 StateInline 结构不一致，类型检查报错
import type MarkdownIt from 'markdown-it'
import type { StateInline } from 'markdown-it'

/*
 * 行内字段切分：组件块内每行是一个条目，字段用半角竖线 | 分隔。
 * 字段内若需竖线本身，转义为 \|，这里统一还原；首尾空白收敛。
 * 与各组件插件共用，避免每个插件各自实现一份。
 */
export const splitRow = (line: string): string[] =>
  line.split(/(?<!\\)\|/).map((s) => s.trim().replace(/\\\|/g, '|'))

/*
 * 代码块顶栏：语言徽章（圆点+文本）。
 * 普通高亮代码块与 mermaid 共用同一顶栏结构，保证视觉一致。
 */
export const toolbar = (lang: string): string => `
    <div class="code-toolbar">
        <span class="lang lang-${lang}">
            <span class="lang-dot"></span>
            <span class="lang-text">${lang}</span>
        </span>
    </div>`

/*
 * 通用行内规则工厂：成对定界符 [[...]] {{...}} ==...==
 * open/close 定界符相同或不同均可；内容不允许跨行、不允许为空。
 * html 只负责拼 HTML（收到的 inner 已转义），定界符匹配与位置推进由本工厂统一处理，
 * kbd / badge / mark 三个行内语法插件共用。
 */
export const makeInlineRule = (
  open: string,
  close: string,
  html: (esc: (s: string) => string, inner: string) => string,
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
      token.content = html(state.md.utils.escapeHtml, state.src.slice(innerStart, end))
    }
    state.pos = end + close.length
    return true
  }
}

/*
 * 组件插件上下文：编译期提供给每个插件的最小能力集。
 *  - escapeHtml：正文/字段统一走 markdown-it 的转义，防注入
 *  - toolbar / splitRow：上述公共片段与切分
 *  - renderMarkdown：嵌套渲染一段 markdown 正文（提示块这类『块内正文仍要正常渲染』的组件用）
 * 约定：插件只依赖本上下文，不反向依赖编译主流程，保证插件可独立维护、可单测。
 */
export interface PluginContext {
  escapeHtml: (s: string) => string
  toolbar: typeof toolbar
  splitRow: typeof splitRow
  /* 嵌套渲染一段 markdown：组件块内需要完整 markdown 能力时调用（如提示块正文） */
  renderMarkdown: (s: string) => string
  /* 当前页标识（文章 id，首页为 'home'）：需要『同页唯一』的组件靠它识别换页 */
  pageKey: string
  /** shiki 编译期高亮单段代码（code-group 等内嵌代码的组件用）；未提供时组件自行降级 */
  highlight?: (code: string, lang: string) => string
}

/*
 * 编译期组件插件契约。
 *  - name：插件名（调试用）
 *  - fenceLangs：声明本插件要拦截的围栏代码块语言名（小写）。命中时由 render 直出 HTML；
 *    未命中返回 null，交还给默认高亮流程。多个语言名可指向同一插件（如提示块的四个等级）
 *  - render：content 是围栏块内正文；info 是完整信息串（语言名 + language 之后的可选文本），
 *    只有需要读『语言名之后的参数』的组件才用得上（如提示块用它取等级与标题）
 *  - setup：需要挂 markdown-it 规则的组件在此挂载（如 kbd/badge/mark 行内规则）；纯 fence 组件可不实现
 */
export interface ComponentPlugin {
  name: string
  fenceLangs: readonly string[]
  render?: (ctx: PluginContext, content: string, info?: string) => string | null
  setup?: (md: InstanceType<typeof MarkdownIt>) => void
}
