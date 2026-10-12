import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
// 仅取类型：medium-zoom 本体是运行时按需 import 的（见 imageZoom），
// 类型导入在编译期被擦除，不会把库打进主包
import type { Zoom } from 'medium-zoom'

/* ====================<postToc>==================== */
type HeadingItem = {
  id: string
  text: string
  level: number
}
// 模块级单例（ES 模块只求值一次，无需 IIFE 壳）：headings/active 为全文唯一响应式源状态
export const headings = ref<HeadingItem[]>([])
export const active = ref('')

let scrollCtn: HTMLElement | null = null // 正文滚动容器（.main 可滚时为 .main，否则整页滚动）
let scrollBound = false // 滚动监听是否已绑定（null 态也需区分已绑定/未绑定）
let mobs: MutationObserver | null = null // 正文注入观察器（挂在 .main 上）
let observer: IntersectionObserver | null = null // 章节高亮观察器
let scanTimer: ReturnType<typeof setTimeout> | null = null
let scrollTimer: ReturnType<typeof setTimeout> | null = null

/* 探测滚动容器：.main 自身可滚则滚容器，否则整页滚动（移动端） */
const probeCtn = () => {
  const main = document.querySelector<HTMLElement>('.main')
  const canInner = !!main && main.scrollHeight > main.clientHeight
  return canInner ? main : null
}

const onObserve = (entries: IntersectionObserverEntry[]) => {
  // 回调按 observe 顺序派发（同 DOM 顺序），最后进入条带的标题即当前章节
  for (const entry of entries) {
    if (entry.isIntersecting && active.value !== entry.target.id) {
      active.value = entry.target.id
    }
  }
}

/* 触底高亮末章：正文底部可能凑不进条带，滚到底时直接切到最后一章 */
const updateTail = () => {
  if (!headings.value.length) return
  const atBottom = scrollCtn
    ? scrollCtn.scrollTop + scrollCtn.clientHeight >= scrollCtn.scrollHeight - 2
    : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
  if (!atBottom) return
  const last = headings.value[headings.value.length - 1]
  if (last && active.value !== last.id) active.value = last.id
}

const onScroll = () => {
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(updateTail, 40)
}

/* 滚动容器随路由/注入变化时，监听跟到最新容器（先解旧再绑新） */
const bindScroll = () => {
  const nextCtn = probeCtn()
  if (nextCtn === scrollCtn && scrollBound) return
  if (scrollBound) {
    if (scrollCtn) scrollCtn.removeEventListener('scroll', onScroll)
    else window.removeEventListener('scroll', onScroll)
  }
  scrollCtn = nextCtn
  if (scrollCtn) scrollCtn.addEventListener('scroll', onScroll, { passive: true })
  else window.addEventListener('scroll', onScroll, { passive: true })
  scrollBound = true
}

const sameIds = (a: HeadingItem[], b: HeadingItem[]) =>
  a.length === b.length && a.every((item, i) => item.id === b[i]?.id)

const rebuildObserver = (list: HeadingItem[]) => {
  observer?.disconnect()
  observer = null
  if (!list.length) return
  const main = document.querySelector<HTMLElement>('.main')
  const canInner = !!main && main.scrollHeight > main.clientHeight
  observer = new IntersectionObserver(onObserve, {
    root: canInner ? main : null,
    rootMargin: '0px 0px -80% 0px',
    threshold: 0,
  })
  list.forEach((h) => {
    const el = document.getElementById(h.id)
    if (el) observer?.observe(el)
  })
}

const scan = () => {
  bindScroll()
  const ct = document.querySelector('.content')
  if (!ct) {
    // 不在文章页 / 正文未注入：清空目录与观察器
    if (headings.value.length || active.value) {
      active.value = ''
      headings.value = []
    }
    rebuildObserver([])
    return
  }
  const next = [...ct.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .map((h) => ({ id: h.id, text: h.textContent?.trim() ?? '', level: Number(h.tagName[1]) }))
    .filter((h) => h.id)
  // 标题未变（如图片懒加载触发）则复用现有观察器，只重扫不重建
  if (sameIds(headings.value, next)) return
  headings.value = next
  active.value = ''
  rebuildObserver(next)
  updateTail()
}

const scanScheduled = () => {
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(scan, 60)
}

/* 跳转：容器可滚时走容器平滑滚动（-20px 呼吸），否则回退 scrollIntoView（移动端整页滚动） */
export const jump = (id: string) => {
  const el = document.getElementById(id)
  if (!el) return
  if (scrollCtn && scrollCtn.scrollHeight > scrollCtn.clientHeight && scrollCtn.contains(el)) {
    const top =
      el.getBoundingClientRect().top - scrollCtn.getBoundingClientRect().top + scrollCtn.scrollTop
    scrollCtn.scrollTo({ top: top - 20, behavior: 'smooth' })
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/* 挂载（PostToc 生命周期负责）：首扫 + 观察 .main 子树，异步注入/路由切换均触发重扫 */
export const mount = () => {
  scan()
  const main = document.querySelector<HTMLElement>('.main')
  if (main && !mobs) {
    mobs = new MutationObserver(scanScheduled)
    mobs.observe(main, { childList: true, subtree: true })
  } else if (main) {
    scanScheduled()
  }
}

export const unmount = () => {
  if (scanTimer) clearTimeout(scanTimer)
  if (scrollTimer) clearTimeout(scrollTimer)
  mobs?.disconnect()
  mobs = null
  observer?.disconnect()
  observer = null
  if (scrollBound) {
    if (scrollCtn) scrollCtn.removeEventListener('scroll', onScroll)
    else window.removeEventListener('scroll', onScroll)
  }
  scrollBound = false
  scrollCtn = null
  headings.value = []
  active.value = ''
}

/* ====================<content>==================== */
// 正文根元素：Content.vue 的 .content 容器经模板 ref 绑定，供代码复制委托与图片灯箱复用
export const root = ref<HTMLElement>()
let zoom: Zoom | null = null

export const codeCopy = (e: MouseEvent) => {
  const el = (e.target as HTMLElement).closest<HTMLButtonElement>('button.copy')
  if (!el || !root.value?.contains(el)) return
  const wrapper = el.closest('div[class*="language-"]')
  // textContent 不含行号伪元素，复制的是纯净源码
  const text = wrapper?.querySelector('pre code')?.textContent || ''
  // 降级方案：非 HTTPS 环境下 navigator.clipboard 不存在，用 execCommand 兜底
  const copyToClipboard = (str: string): Promise<void> => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(str)
    }
    const ta = document.createElement('textarea')
    ta.value = str
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return Promise.resolve()
  }
  copyToClipboard(text).then(() => {
    el.classList.add('copied')
    setTimeout(() => {
      el.classList.remove('copied')
      el.blur()
    }, 2000)
  })
}
export const imgBox = async () => {
  if (!root.value) return
  // 幂等守卫：只取未绑定过的图片并打标记，防止正文里已有灯箱图片时重复 attach
  const imgs = Array.from(root.value.querySelectorAll<HTMLImageElement>('img:not([data-zoom-bound])'))
  if (!imgs.length) return
  imgs.forEach((i) => {
    i.dataset.zoomBound = '1'
  })
  const { default: mediumZoom } = await import('medium-zoom')
  if (!zoom) {
    zoom = mediumZoom(imgs, { background: 'var(--g-bg)' })
  } else {
    zoom.attach(imgs)
  }
}

/* ====================<postNeighbor>==================== */
/*
 * 上下篇导航：编译期已把 prev/next 写进 .cache/post.json（parseArticle.ts 按 sidebar 配置顺序算好），
 * 此处只做同步读取与响应式包装，不做任何推导
 * glob 而非静态 import：首次构建该文件可能尚未生成，glob 返回空对象而非编译报错
 */
type NavInfo = { title: string; link: string } | null
type NeighborMeta = { prev?: NavInfo; next?: NavInfo }

const neighborMap = import.meta.glob<Record<string, NeighborMeta>>('/.cache/post.json', {
  eager: true,
  import: 'default',
})
const neighborData = neighborMap['/.cache/post.json'] ?? {}

export const postNeighbor = () => {
  const route = useRoute()
  // pathMatch 是可重复参数，嵌套文章的 id 含斜杠，需拼回完整 id
  const postKey = computed(() =>
    route.params.pathMatch ? (route.params.pathMatch as string[]).join('/') : '',
  )
  const meta = computed(() => neighborData[postKey.value])
  const pre = computed(() => meta.value?.prev ?? null)
  const next = computed(() => meta.value?.next ?? null)
  return { pre, next }
}

/* ====================<postUpdated>==================== */
/*
 * 最后编辑于：读编译期产物 .cache/post.json 的 updated 字段（parseArticle 用源文件 mtime 推导）
 * 与 postNeighbor 同一份 glob 数据，SSG 预渲染和客户端都同步可读
 */
export const postUpdated = () => {
  const route = useRoute()
  const postKey = computed(() => {
    const value = route.params.pathMatch
    return Array.isArray(value) ? value.join('/') : String(value ?? '')
  })
  const meta = computed(() => neighborData[postKey.value] as { updated?: string } | undefined)
  // updated 由编译期 mtime 推导，正常都有值；仍兜一层空态
  return computed(() => (meta.value?.updated ? `最后编辑于 ${meta.value.updated}` : ''))
}

/* ====================<backToTop>==================== */
/*
 * 返回顶部：探测滚动容器（.main 可滚滚容器，否则整页滚动），平滑滚回顶部
 * 与 TOC 的 probeCtn 同一套判断，移动端整页滚动也能正确回顶
 */
export const backToTop = () => {
  const area = document.querySelector('.main')
  const canArea = area && area.scrollHeight > area.clientHeight
  if (canArea) {
    area.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

/*
 * 滚动进度：监听滚动，把当前进度写进 .progress 的 --progress 变量（conic-gradient 画进度环）
 * 返回清理函数供组件 onUnmounted 解绑，避免路由切换后残留监听
 */
export const scrollProgress = (): (() => void) => {
  const area = document.querySelector<HTMLElement>('.main')
  // 收窄到返回顶部按钮内的进度环：正文写作组件里也有 .progress，通用选择器会命中错元素
  const progress = document.querySelector<HTMLElement>('.back-top-btn .progress')
  if (!area || !progress) return () => {}

  const canArea = area.scrollHeight > area.clientHeight
  const scroller: HTMLElement | Window = canArea ? area : window
  const scrolled = canArea ? () => area.scrollTop : () => window.scrollY
  const total = canArea
    ? area.scrollHeight - area.clientHeight
    : document.documentElement.scrollHeight - window.innerHeight

  const update = () => {
    const _progress = total > 0 ? Math.min(1, scrolled() / total) : 0 // 用总可滚px做保护
    progress.style.setProperty('--progress', _progress * 360 + 'deg')
  }
  scroller.addEventListener('scroll', update, { passive: true })
  update()
  return () => scroller.removeEventListener('scroll', update)
}

/* ====================<echarts>==================== */
/*
 * ECharts 运行时渲染：与 mermaid 同款按需模式。
 * 页面无 echarts 块时零开销（echarts 全量约 1MB，不应每篇都背）；
 * 有块时动态 import，读 code 内的 option JSON 渲染到容器。
 * 容器高度：option 里可写 "height": 320 自定义（非 echarts 标准字段，渲染前摘出）。
 */
export const echarts = async () => {
  const blocks = document.querySelectorAll('pre[data-lang="echarts"] code:not([data-rendered])')
  if (!blocks.length) return
  const { init } = await import('echarts')
  for (const block of Array.from(blocks)) {
    const pre = block.closest('pre')
    if (!pre) continue
    // 先标记再渲染：echarts 会往 pre 里注入容器，不标记会被 MutationObserver 反复触发
    block.setAttribute('data-rendered', '1')
    try {
      const option = JSON.parse(block.textContent || '{}')
      // 摘出自定义高度字段（默认 320px），其余原样交给 echarts
      const height = Number(option.height) || 320
      delete option.height
      const chart = init(pre, undefined, { height })
      chart.setOption(option)
      // 背景透明：融入明暗主题，不与代码块底色冲突
      pre.style.background = 'transparent'
    } catch {
      console.error('[ERR]:echarts 渲染错误，option JSON 非法')
    }
  }
}

/* ====================<mermaid>==================== */
export const mermaid = async () => {
  const mermaidCode = document.querySelectorAll('pre[data-lang="mermaid"] code:not([data-rendered])')
  if (!mermaidCode.length) return
  // 先标记再渲染：mermaid 会把 code 换成 svg，不标记会被 MutationObserver 反复触发
  mermaidCode.forEach((el) => el.setAttribute('data-rendered', '1'))

  //   库变量改名 mermaidLib，避免与导出函数同名遮蔽
  const { default: mermaidLib } = await import('mermaid')
  // 配置mermaid.js
  mermaidLib.initialize({ startOnLoad: false })
  try {
    await mermaidLib.run({ nodes: Array.from(mermaidCode) as HTMLElement[] })
  } catch {
    console.error('[ERR]:mermaid渲染错误')
  }
}
