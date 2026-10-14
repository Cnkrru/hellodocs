/*
 * 分节面板共享管道（不是组件插件，只被 tabs / code-group / compare 复用）
 *
 * 三者语法同构：围栏块内用 `@tab 标签名` 分节（VuePress Plume 的 content tabs 约定，
 * 与 tabs / code-group 那套自造 `== 标签名 ==` 相比，不与任何 Markdown 语法字形重合）。
 * 分节切分、空块告警、面板分组导航三处逻辑完全一致，收敛在这里；
 * 面板本体（HTML 模板与正文渲染方式）各有差异，仍留在各自插件文件里。
 */
import type { PluginContext } from './base.ts'

// 单个面板：标签名 + 正文
export type Panel = { name: string; body: string }

// 分节标记：行首 @tab 后跟标签名；用 [ \t] 而非 \s，避免 \s 把换行也吞进标记行
const PANEL_MARK = /^@tab[ \t]+(.+?)[ \t]*$/m

/* 当前页标识与页内组序号：换页即归零。
 * 不掺入跨页累计值 —— 文章处理顺序一变（readdirSync 不保证顺序），
 * 产物里的 id 就会跟着变，构建结果不再逐字节可复现 */
let pageKey = ''
let groupSeq = 0

/* ====================<HTML 模板>==================== */

// 选项卡（radio + label 对），首项默认选中；label 文本由调用方转义后传入
const PANEL_TAB = (group: string, index: number, label: string): string => `
    <input type="radio" id="${group}-${index}" name="${group}"${index === 0 ? ' checked' : ''}>
    <label for="${group}-${index}">${label}</label>`

/* ====================<共享管道>==================== */

/*
 * id: splitPanels
 * fn: 按 `@tab 标签名` 把围栏块内容切成若干面板，每节从标记行到下个标记行
 * 首个标记之前的内容不属于任何面板，直接丢弃（对齐 MkDocs / Plume 的行为）。
 * 一个标记都没有时告警并返回空数组，由调用方按空块跳过
 */
export const splitPanels = (content: string, componentName: string): Panel[] => {
  const parts = content.split(PANEL_MARK).slice(1)
  const panels: Panel[] = []
  for (let i = 0; i + 1 < parts.length; i += 2) {
    panels.push({ name: (parts[i] ?? '').trim(), body: (parts[i + 1] ?? '').trim() })
  }
  if (panels.length === 0) {
    console.warn(`[WARN]:${componentName} 代码块内未找到任何 @tab 标签名 分节，已按空块跳过`)
  }
  return panels
}

/*
 * id: panelTabs
 * fn: 生成面板分组导航条，返回组名与导航 HTML
 * 组名必须同页唯一 —— 同页多组面板的 radio 一旦同名，切换就会互串。
 * 早前拿「首标签名 + 面板数」拼组名，既会把标签名里的引号带进 id/name/for 属性，
 * 也会在两个组的标签名与面板数都相同时撞名，故改为「前缀 + 本页第 N 组」
 */
export const panelTabs = (
  ctx: PluginContext,
  prefix: string,
  panels: Panel[],
): { group: string; nav: string } => {
  if (ctx.pageKey !== pageKey) {
    pageKey = ctx.pageKey
    groupSeq = 0
  }
  groupSeq += 1
  const group = `${prefix}-${groupSeq}`
  const esc = ctx.escapeHtml
  const nav = panels.map((p, i) => PANEL_TAB(group, i, esc(p.name))).join('')
  return { group, nav }
}
