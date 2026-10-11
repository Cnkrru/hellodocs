/*
 * 侧栏树：数据源是手写配置 src/theme/config/sidebar.json（结构照 VitePress 的 themeConfig.sidebar）
 *
 * 手写而非编译期生成的理由：
 *  - 编译期只做「md → html + 解析元数据」两件事，侧栏的分组/顺序/命名属于内容组织决策，
 *    写进配置比让脚本猜目录名更可控（目录名 ≠ 章节名的情况在 docs/ 里很常见）
 *  - 上下篇由本文档树的展平顺序推出，配置即唯一事实源，不存在两处顺序打架的可能
 *
 * 配置在模块顶层 import —— 不放 onMounted，这样 SSG/SSR 阶段侧栏就能完整渲染，
 * 不会出现"JS 到达前左边一根空条"的布局跳动
 */

import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import sidebarConfig from '@config/sidebar.json'

// 结构照 VitePress 的 SidebarItem：text 为显示名，link 为可点击入口，items 为子项
// 不含 collapsed —— 分组固定展开，只在用户手动点箭头时才折叠（状态记在组件内，不进配置）
export type SidebarNode = {
  text: string
  link?: string
  items?: SidebarNode[]
}

const sidebarTree: SidebarNode[] = sidebarConfig

/** 节点是否含子项（含空分组） */
const hasItems = (node: SidebarNode): boolean => Array.isArray(node.items) && node.items!.length > 0

/*
 * 展平：一次 DFS 同时产出两张表 ——
 *
 * flatNodes  带层级信息的全量节点表（分组 + 叶子），侧栏按它渲染，靠 depth 做缩进、ancestors 判可见性
 * flatPosts  只含有 link 的节点的有序表，上一篇/下一篇按它取相邻下标
 *
 * 两张表顺序一致（都是 DFS），故上下篇顺序即配置里的书写顺序，
 * 不需要 frontmatter 里那个至今无人填写的 order 字段
 *
 * 展平而非运行时递归搜树，是因为「当前文章落在哪个分组」要靠 ancestors 反查，
 * 记下来是 O(1) 查表；每次渲染递归搜则是 O(n×depth)
 */
export type FlatNode = {
  /** 节点唯一键：祖先 text 依次拼成，顶级形如 /电气 */
  key: string
  text: string
  link?: string
  /** 层级，顶级为 0 */
  depth: number
  /** 是否分组（有子项），分组才渲染折叠箭头 */
  isFolder: boolean
  /** 祖先 key 链，不含自身。全部祖先都展开时本节点才可见 */
  ancestors: string[]
}

export type FlatPost = { id: string; title: string; link: string }

const nodesOut: FlatNode[] = []
const postsOut: FlatPost[] = []

const walk = (nodes: SidebarNode[], depth: number, ancestors: string[]): void => {
  for (const node of nodes) {
    const key = `${ancestors[ancestors.length - 1] ?? ''}/${node.text}`
    const isFolder = hasItems(node)
    nodesOut.push({ key, text: node.text, link: node.link, depth, isFolder, ancestors })
    // id 取 link 去掉 /post/ 前缀 —— 与 .cache/<id>.vue 的 id、route.params.pathMatch 同一套键
    if (node.link) postsOut.push({ id: node.link.replace(/^\/post\//, ''), title: node.text, link: node.link })
    if (isFolder) walk(node.items!, depth + 1, [...ancestors, key])
  }
}

walk(sidebarTree, 0, [])

/** 侧栏全量节点的深度优先扁平表（模块级单例，只算一次） */
export const flatNodes: readonly FlatNode[] = nodesOut

/** 全站文章的有序扁平表（模块级单例） */
export const flatPosts: readonly FlatPost[] = postsOut

/**
 * 当前文章所在分支的分组 key 集合：祖先链 + 自身（若自身是分组，点索引页时也该看到它的子项）
 *
 * 这批分组默认展开、其余默认折叠 —— 同 VSCode 的 explorer.autoReveal：
 * 默认全收起，切到哪个文件就展开到哪个文件
 */
export const activeBranchOf = (currentPath: string): Set<string> => {
  const node = nodesOut.find((n) => n.link === currentPath)
  if (!node) return new Set()
  const keys = new Set(node.ancestors)
  if (node.isFolder) keys.add(node.key)
  return keys
}

/**
 * 当前文章的相邻文档：取扁平表中的前后邻居
 * 首篇无上一篇、末篇无下一篇，对应项留空串
 */
export const neighborOf = (currentPath: string): { pre: FlatPost | null; next: FlatPost | null } => {
  const i = flatPosts.findIndex((p) => p.link === currentPath)
  if (i === -1) return { pre: null, next: null }
  return { pre: flatPosts[i - 1] ?? null, next: flatPosts[i + 1] ?? null }
}

/*
 * 组件级接口：侧栏折叠状态
 *
 * 默认全折叠，仅当前文章所在分支自动展开 —— 同 VSCode 的 explorer.autoReveal
 * （默认收起、切到哪个文件就展开到哪个文件）
 *
 * overrides 是手动折叠覆盖表：key → 是否折叠。只有用户点过箭头的分组才会写进来
 */
export const sidebarState = () => {
  const route = useRoute()

  /* 手动折叠覆盖表 */
  const overrides = ref<Record<string, boolean>>({})

  /* 当前文章所在分支：这批分组默认展开，其余默认折叠 */
  const activeBranch = computed(() => activeBranchOf(route.path))

  const isCollapsed = (key: string): boolean => {
    const manual = overrides.value[key]
    if (manual !== undefined) return manual
    return !activeBranch.value.has(key)
  }

  /* 可见项：祖先全部展开才显示。折叠一个分组即隐藏它下面的全部后代 */
  const visible = computed(() => flatNodes.filter((n) => n.ancestors.every((k) => !isCollapsed(k))))

  const toggle = (key: string) => {
    overrides.value = { ...overrides.value, [key]: !isCollapsed(key) }
  }

  /* 缩进：depth 直接换像素，不再靠嵌套 ul 的 padding 层层累加 */
  const indent = (depth: number): string => `calc(var(--space-sm) + ${depth * 14}px)`

  /* 滚动到当前项：侧栏是 overflow-y 容器，展开分支后当前文章仍可能落在视口外 */
  const treeRef = ref<HTMLElement | null>(null)
  onMounted(() => {
    treeRef.value?.querySelector('.sb-link.on')?.scrollIntoView({ block: 'nearest' })
  })

  return { flatNodes, visible, isCollapsed, toggle, indent, treeRef }
}

/* ====================<移动端抽屉>==================== */
/*
 * 移动端侧栏抽屉的共享开关：顶栏汉堡按钮、侧栏本体、遮罩层三处共用。
 * 模块级 ref 保证跨组件同一实例；桌面端始终显示侧栏，此状态不产生影响。
 */
export const sidebarOpen = ref(false)
export const toggleSidebarOpen = () => {
  sidebarOpen.value = !sidebarOpen.value
}
export const closeSidebar = () => {
  sidebarOpen.value = false
}

