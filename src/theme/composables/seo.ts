/*
 * 页面级 SEO：把 title / description / keywords / canonical / og / twitter 收敛到一处
 *
 * 背景：index.html 是随包发布的引擎模板，读不到用户配置，写死站名会导致全站标题与
 * 配置里的 title 不一致。故模板不再写 <title>，改由本函数按页注入 —— 引擎 vite 配置里
 * vite-ssg 已 app.use(head)，SSG 预渲染与客户端拿到的是同一份 head 数据。
 *
 *    useHead 必须来自与 vite-ssg 同一份 @unhead/vue 实例：vite-ssg 28 依赖 @unhead/vue ^2，
 *    若项目里另装一份 v3，两份模块各有自己的 inject symbol，useHead 取不到 head 实例会
 *    静默失效（页面没有 title，但构建一路 exit 0）。改这个依赖的版本时务必核对
 *    node_modules/vite-ssg/node_modules/@unhead/vue 是否还存在。
 */
import { useHead } from '@unhead/vue'

import { site } from './site'

/*
 * 入参用 getter 而非普通对象：useHead 内部会把函数当响应式输入求解，
 * 文章页切文章（路由变化）时标题才会跟着变 —— 传静态对象则只在首次挂载生效。
 */
type SeoInput = {
  /** 完整页面标题。本函数不做模板拼接，避免调用方与这里各拼一半 */
  title: string
  description?: string
  /** 站内路径，用于 canonical / og:url；站点未配 siteUrl 时不下发 */
  path?: string
  /** 分享封面，缺省用站点默认封面 */
  image?: string
  /** 不参与收录（404 等错误页） */
  noindex?: boolean
}

/** 站内相对路径补成绝对地址：canonical 与 og:image 都要求绝对 URL */
const absolute = (url: string): string => {
  if (!url || !site.SITE_URL) return url
  try {
    return new URL(url, site.SITE_URL).href
  } catch {
    return url
  }
}

/* 一条 meta 只可能是 name 或 property 二选一，写成显式联合便于与 unhead 的 Meta 类型对齐 */
type MetaEntry = { name: string; content: string } | { property: string; content: string }

const tag = (key: 'name' | 'property', field: string, content: string): MetaEntry =>
  key === 'name' ? { name: field, content } : { property: field, content }

export const useSeo = (input: () => SeoInput) => {
  useHead(() => {
    const { title, description, path, image, noindex } = input()
    const desc = description ?? site.SITE_DESCRIPTION
    // siteUrl 未配置时不下发 canonical/og:url：宁可缺，不可给出错误域名的绝对地址
    const canonical = site.SITE_URL && path ? absolute(path) : ''
    const cover = absolute(image || site.SITE_OG_IMAGE)

    const meta = [tag('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')]
    if (desc) meta.push(tag('name', 'description', desc))
    if (site.SITE_KEYWORDS) meta.push(tag('name', 'keywords', site.SITE_KEYWORDS))

    meta.push(tag('property', 'og:type', 'website'), tag('property', 'og:title', title))
    if (desc) meta.push(tag('property', 'og:description', desc))
    if (site.SITE_TITLE) meta.push(tag('property', 'og:site_name', site.SITE_TITLE))
    if (canonical) meta.push(tag('property', 'og:url', canonical))
    if (cover) meta.push(tag('property', 'og:image', cover))
    if (site.SITE_OG_IMAGE_ALT) meta.push(tag('property', 'og:image:alt', site.SITE_OG_IMAGE_ALT))

    meta.push(
      tag('name', 'twitter:card', cover ? 'summary_large_image' : 'summary'),
      tag('name', 'twitter:title', title),
    )
    if (desc) meta.push(tag('name', 'twitter:description', desc))
    if (cover) meta.push(tag('name', 'twitter:image', cover))

    return {
      title,
      meta,
      link: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  })
}
