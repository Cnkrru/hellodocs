/*
 * 组件注册表：所有编译期组件插件的统一登记处。
 *
 * 新增一个写作组件的标准流程：
 *   1. 在 plugins/ 下新建一个文件（一个文件只放一种语法），实现 ComponentPlugin
 *   2. 在下面 import 并追加进 componentPlugins 数组
 * 编译主流程（parseArticle.ts）只读取本清单，无需再改动核心脚本。
 *
 * 说明：
 *  - fence 组件语言名集合由各插件 fenceLangs 自动汇总（componentFenceLangs），
 *    语言扫描（configLanguage）靠它排除『不是真语言』的组件块，不进 shiki。
 *  - 需要挂 markdown-it 规则的组件（kbd/badge/mark 行内规则）由 setup 钩子统一挂载。
 */
import type MarkdownIt from 'markdown-it'
import type { ComponentPlugin, PluginContext } from './base.ts'

// 基础
import { mermaidBlock } from './mermaid.ts'
import { timelineBlock } from './timeline.ts'
import { stepsBlock } from './steps.ts'
// 结构
import { filetreeBlock } from './filetree.ts'
import { terminalBlock } from './terminal.ts'
import { detailsBlock } from './details.ts'
import { flowBlock } from './flow.ts'
// 代码
import { codeGroupBlock } from './code-group.ts'
import { echartsBlock } from './echarts.ts'
// 展示
import { cardsBlock } from './cards.ts'
import { linksBlock } from './links.ts'
import { galleryBlock } from './gallery.ts'
import { statBlock } from './stat.ts'
import { progressBlock } from './progress.ts'
import { attrsBlock } from './attrs.ts'
// 编排
import { tabsBlock } from './tabs.ts'
// 笔记
import { defineBlock } from './define.ts'
import { qaBlock } from './qa.ts'
import { compareBlock } from './compare.ts'
import { quoteBlock } from './quote.ts'
// 提示块与行内
import { admonition } from './admonition.ts'
import { kbdPlugin } from './kbd.ts'
import { badgePlugin } from './badge.ts'
import { markPlugin } from './mark.ts'

// 全部组件插件：新增组件在这里登记
const componentPlugins: readonly ComponentPlugin[] = [
  mermaidBlock,
  timelineBlock,
  stepsBlock,
  filetreeBlock,
  terminalBlock,
  detailsBlock,
  flowBlock,
  codeGroupBlock,
  echartsBlock,
  cardsBlock,
  linksBlock,
  galleryBlock,
  statBlock,
  progressBlock,
  attrsBlock,
  tabsBlock,
  defineBlock,
  qaBlock,
  compareBlock,
  quoteBlock,
  admonition,
  kbdPlugin,
  badgePlugin,
  markPlugin,
]

// fence 组件语言名集合（小写）：语言扫描与 fence 拦截共用，新增组件语言自动生效
export const componentFenceLangs: ReadonlySet<string> = new Set(
  componentPlugins.flatMap((p) => p.fenceLangs),
)

/*
 * 统一挂载：把各插件的 setup 钩子依次挂到 markdown-it 实例。
 * 纯 fence 组件没有 setup，跳过。
 */
export const setupComponentPlugins = (md: InstanceType<typeof MarkdownIt>) => {
  for (const plugin of componentPlugins) {
    plugin.setup?.(md)
  }
}

/*
 * 统一 fence 拦截：按语言名找到声明了该语言的插件，交给它的 render 直出 HTML。
 * info 为完整信息串，透传给需要『语言名之后参数』的组件（如提示块取等级与标题）。
 * 未命中任何插件时返回 null，由调用方走默认 shiki 高亮。
 */
export const renderComponentFence = (
  ctx: PluginContext,
  lang: string,
  content: string,
  info: string,
): string | null => {
  for (const plugin of componentPlugins) {
    if (plugin.render && plugin.fenceLangs.includes(lang)) {
      return plugin.render(ctx, content, info)
    }
  }
  return null
}
