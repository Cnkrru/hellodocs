/*
 * 组件插件共享基础模块
 *
 * 职责：定义『编译期组件插件』的统一契约与公共工具，所有写作组件插件都基于它实现。
 *
 * 行业标准分层（对齐 VitePress / Docusaurus）：
 *  - 编译期（本层）：拦截 Markdown 扩展语法，产出『语义化 HTML 结构』，class 命名约定稳定
 *  - 主题层（content.css）：按 class 约定配色与排版，组件样式可主题化
 *
 * 新增一个组件 = 在 plugins/ 下加一个文件，实现 ComponentPlugin，并在 registry.ts 登记一行。
 */

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
 * 组件插件上下文：编译期提供给每个插件的最小能力集。
 *  - escapeHtml：正文/字段统一走 markdown-it 的转义，防注入
 *  - toolbar / splitRow：上述公共片段与切分
 * 约定：插件只依赖本上下文，不反向依赖编译主流程，保证插件可独立维护、可单测。
 */
export interface PluginContext {
  escapeHtml: (s: string) => string
  toolbar: typeof toolbar
  splitRow: typeof splitRow
}

/*
 * 编译期组件插件契约。
 *  - name：插件名（调试用）
 *  - fenceLangs：声明本插件要拦截的围栏代码块语言名（小写）。
 *    命中时由 render 直出 HTML；未命中返回 null，交还给默认高亮流程。
 *  - setup：需要挂载 markdown-it 插件（如容器块）的组件在此挂载；纯 fence 组件可不实现。
 */
import type MarkdownIt from 'markdown-it'

export interface ComponentPlugin {
  name: string
  fenceLangs: readonly string[]
  render?: (ctx: PluginContext, lang: string, content: string) => string | null
  setup?: (md: InstanceType<typeof MarkdownIt>) => void
}
