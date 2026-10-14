/*
 * 仓库外链：由当前文章的 id（相对 docs/ 且去掉 .md 的路径）拼出 GitHub 的编辑页
 *
 * 行业标准做法同 VitePress（editLink）与 Docusaurus（Edit this page）：
 * 入口是纯外链，挂 <a target="_blank" rel="noopener noreferrer">，不引路由、不做运行时请求
 *
 * SITE_REPO 为空时 url 返回空串 —— 组件据此不渲染，避免留一个点进去 404 的死链
 */

import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { site } from '@/composables/site'

const hasRepo = () => !!site.SITE_REPO

/** 仓库首页链接（顶栏 GitHub 图标用）；未配置 repo.url 时返回空串，入口据此不渲染 */
export const repoHomeUrl = (): string => (site.SITE_REPO ? `https://github.com/${site.SITE_REPO}` : '')

/** 仓库内该文章的源文件路径，如 docs/前端/Vue.md */
const srcPath = (postKey: string) => `${site.SITE_DOCS_DIR}/${postKey}.md`

/**
 * 只编码路径段、保留分隔符：直接 encodeURI 会连 / 一起编码，GitHub 会当成单个文件名
 * 中文与空格必须编码，否则 href 里出现裸字符在部分环境下会丢字
 */
const encodePath = (p: string) =>
  p
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')

/** 在 GitHub 上编辑本页：/edit/{branch}/{path} */
const repoEditUrl = (postKey: string) =>
  hasRepo() && postKey
    ? `https://github.com/${site.SITE_REPO}/edit/${site.SITE_REPO_BRANCH}/${encodePath(srcPath(postKey))}`
    : ''

/*
 * 组件级接口：从当前路由解析文章 id，响应式返回编辑页链接
 * pathMatch 是可重复参数，嵌套文章的 id 含斜杠，需拼回完整 id
 */
export const postEditHref = () => {
  const route = useRoute()
  const postKey = computed(() => {
    const value = route.params.pathMatch
    return Array.isArray(value) ? value.join('/') : String(value ?? '')
  })
  return computed(() => repoEditUrl(postKey.value))
}
