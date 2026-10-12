/*
 * 组件注册表：所有编译期组件插件的统一登记处。
 *
 * 新增一个写作组件的标准流程：
 *   1. 在 plugins/ 下新建（或并入现有）插件文件，实现 ComponentPlugin
 *   2. 在下面 import 并追加进 componentPlugins 数组
 * 编译主流程（parseArticle.ts）只读取本清单，无需再改动核心脚本。
 *
 * 说明：
 *  - fence 组件语言名集合由各插件 fenceLangs 自动汇总（componentFenceLangs），
 *    语言扫描（configLanguage）靠它排除『不是真语言』的组件块，不进 shiki。
 *  - 需要挂 markdown-it 插件的组件（如 admonition）由 setup 钩子统一挂载。
 */
import type MarkdownIt from 'markdown-it'
import type { ComponentPlugin, PluginContext } from './base.ts'
import { basicBlocks } from './blocks-basic.ts'
import { echartsBlock } from './echarts.ts'
import { extraBlocks } from './blocks-extra.ts'
import { richBlocks } from './blocks-rich.ts'
import { admonition } from './admonition.ts'
import { codeGroupBlock } from './code-group.ts'
import { structureBlocks } from './blocks-structure.ts'
import { notesBlocks } from './blocks-notes.ts'
import { inlineMarks } from './inline-marks.ts'

// 全部组件插件：新增组件在这里登记
export const componentPlugins: readonly ComponentPlugin[] = [
  basicBlocks,
  echartsBlock,
  extraBlocks,
  richBlocks,
  admonition,
  codeGroupBlock,
  structureBlocks,
  notesBlocks,
  inlineMarks,
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
 * 未命中任何插件时返回 null，由调用方走默认 shiki 高亮。
 */
export const renderComponentFence = (
  ctx: PluginContext,
  lang: string,
  content: string,
): string | null => {
  for (const plugin of componentPlugins) {
    if (plugin.render && plugin.fenceLangs.includes(lang)) {
      return plugin.render(ctx, lang, content)
    }
  }
  return null
}
