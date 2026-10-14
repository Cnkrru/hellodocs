/*
 * ECharts 图表组件插件
 *
 * 语法：Markdown 围栏代码块，语言名 echarts，块内为图表 option 的 JSON：
 *   ```echarts
 *   { "xAxis": { "type": "category", "data": ["一","二","三"] }, "yAxis": { "type": "value" }, "series": [{ "type": "bar", "data": [5, 3, 8] }] }
 *   ```
 *
 * 实现：编译期只做『JSON 校验 + 转义 + 产出容器』，图表由运行时按需渲染
 * （composables/post.ts 的 echarts 函数动态 import echarts，页面无图表块则零开销）。
 * 与 mermaid 同款架构：编译期拦截 fence、运行时懒加载渲染。
 *
 * JSON 非法时降级为纯文本展示源码并告警，不打断整篇编译。
 *
 * 结构约定：HTML 片段一律抽成模块级 const 模板，render 只留解析与编排的 TS 逻辑。
 */
import type { ComponentPlugin } from './base.ts'

/* ====================<HTML 模板>==================== */

// JSON 非法时的降级块：按源码文本展示
const ECHARTS_FALLBACK = (toolbarHtml: string, code: string): string => `
<div class="language-text" v-pre>${toolbarHtml}
    <pre data-lang="text"><code>${code}</code></pre>
</div>`

// 容器：option 源码放 code 内（运行时读取后替换为 canvas），结构与 mermaid 一致
const ECHARTS_BLOCK = (toolbarHtml: string, code: string): string => `
<div class="language-echarts" v-pre>${toolbarHtml}
    <pre data-lang="echarts"><code>${code}</code></pre>
</div>`

/* ====================<插件实现>==================== */

export const echartsBlock: ComponentPlugin = {
  name: 'echarts',
  fenceLangs: ['echarts'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    // 编译期校验 JSON：非法则按纯文本源码展示，保留可读性
    try {
      JSON.parse(content)
    } catch {
      console.warn('[WARN]:echarts 块不是合法 JSON，已按源码文本展示')
      return ECHARTS_FALLBACK(ctx.toolbar('echarts'), esc(content))
    }
    return ECHARTS_BLOCK(ctx.toolbar('echarts'), esc(content))
  },
}
