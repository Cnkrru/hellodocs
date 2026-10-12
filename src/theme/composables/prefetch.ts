import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { loadContent } from './content'

/*
 * 站内链接预取，对齐 VitePress 的 usePrefetch：
 * 文章按路由懒加载，每篇是独立 chunk，不预热时点链接要等一次网络往返，
 * 新正文先空挂再注入，表现为「空—闪—出现」。
 * 这里在浏览器空闲时，对进入视口的站内文章链接主动拉取其 chunk，
 * 待用户点击时命中缓存，切换近乎瞬时，从而消除闪烁。
 */
// 已处理路径去重：同一链接只拉一次；当前页也记上，避免从别页链回时重复拉取
const prefetched = new Set<string>()

/* 空闲调度：requestIdleCallback 不可用时退化为 setTimeout（对齐 VitePress 的 rIC 兜底） */
const requestIdle = (cb: () => void) => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => cb())
  else window.setTimeout(cb, 1)
}

/* pathname（已解码）→ 文章 chunk 加载器：仅 /post/<id> 命中，首页/404 等不处理 */
const loaderFor = (pathname: string) => {
  if (!pathname.startsWith('/post/')) return undefined
  const id = pathname.slice('/post/'.length).replace(/\/$/, '')
  return id ? loadContent(id) : undefined
}

export const prefetch = () => {
  // SSR/SSG 阶段无 window，后续全是浏览器 API，直接跳过
  if (typeof window === 'undefined') return
  // 与 VitePress 一致：无 IntersectionObserver、省流或 2G 环境不预热
  if (!window.IntersectionObserver) return
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return

  let observer: IntersectionObserver | null = null

  const observeLinks = () => {
    observer?.disconnect()
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const link = entry.target as HTMLAnchorElement
        observer!.unobserve(link)
        // href 里的非 ASCII 是百分号编码的，须先解码才能拼回 .cache/<id>.vue 的原始 id
        const pathname = decodeURIComponent(new URL(link.href, link.baseURI).pathname)
        if (prefetched.has(pathname)) continue
        prefetched.add(pathname)
        loaderFor(pathname)?.()
      }
    })
    requestIdle(() => {
      document.querySelectorAll<HTMLAnchorElement>('#app a').forEach((link) => {
        const { hostname, pathname } = new URL(link.href, link.baseURI)
        const decodedPath = decodeURIComponent(pathname)
        // 只预热站内、同标签页、可路由的链接（对齐 VitePress 的过滤条件）
        if (link.getAttribute('target') === '_blank') return
        if (hostname !== location.hostname) return
        if (decodedPath === decodeURIComponent(location.pathname)) {
          prefetched.add(decodedPath)
          return
        }
        observer!.observe(link)
      })
    })
  }

  onMounted(observeLinks)
  const route = useRoute()
  watch(() => route.path, observeLinks)
  onUnmounted(() => observer?.disconnect())
}