/*
 * 引擎配置契约：类型 + 默认值 + defineConfig + 序列化
 *
 * 站点实值由用户侧的 krudoc.config.ts 提供（用户只写差异，其余走默认）。
 * src/cli/config.ts 负责加载用户配置、与这里的默认值合并、校验，产出 ResolvedConfig；
 * 编译期再由 parseArticle 把 ResolvedConfig 序列化成 .cache/site.json 供 theme 读取。
 * 改配置后需重新编译才生效（开发模式不热更新配置）。
 */

export type NavItem = { text: string; link: string }
export type HomeCard = { text: string; link: string; desc: string }

/*
 * 仓库外链：postEdit 由此拼出 GitHub 的编辑页
 * url 留空则文章页不渲染「编辑 / 历史」入口（避免死链）
 */
export type RepoConfig = {
  url?: string // owner/repo
  branch?: string // 默认 main
  docsDir?: string // 文档在仓库中的根目录，默认与顶层 docsDir 一致
}

/* 用户配置：除 title 外全部可选，只写与默认值的差异 */
export type KrudocConfig = {
  title: string
  description?: string
  keywords?: string
  siteUrl?: string // sitemap / canonical 的绝对地址
  ogImage?: string
  ogImageAlt?: string
  copyright?: string
  docsDir?: string // 内容目录，相对 USER_ROOT，默认 docs
  maxDepth?: number // 扫盘最大层级，默认 6
  nav?: NavItem[] // 顶栏导航
  homeCards?: HomeCard[] // 首页分类卡片
  repo?: RepoConfig
}

/* 合并默认值、校验通过后的完整配置：编译管线与 CLI 共用 */
export type ResolvedConfig = {
  title: string
  description: string
  keywords: string
  siteUrl: string
  ogImage: string
  ogImageAlt: string
  copyright: string
  docsDir: string
  maxDepth: number
  nav: NavItem[]
  homeCards: HomeCard[]
  repo: { url: string; branch: string; docsDir: string }
}

export const defaultConfig: ResolvedConfig = {
  title: 'KruDoc',
  description: '',
  keywords: '',
  siteUrl: '',
  ogImage: '/og-cover.png',
  ogImageAlt: '',
  copyright: '',
  docsDir: 'docs',
  maxDepth: 6,
  nav: [],
  homeCards: [],
  repo: { url: '', branch: 'main', docsDir: '' },
}

/* 用户配置书写入口：仅做类型收窄，运行时原样返回 */
export const defineConfig = (config: KrudocConfig): KrudocConfig => config

/*
 * ResolvedConfig → .cache/site.json 的键名映射
 * theme 侧 composables/site.ts 按大写键同步读，故这里的键名即对外契约，改键名等于改契约
 */
export const serializeSiteConfig = (config: ResolvedConfig) => ({
  SITE_URL: config.siteUrl,
  SITE_TITLE: config.title,
  SITE_DESCRIPTION: config.description,
  SITE_KEYWORDS: config.keywords,
  SITE_OG_IMAGE: config.ogImage,
  SITE_OG_IMAGE_ALT: config.ogImageAlt,
  SITE_COPYRIGHT: config.copyright,
  HOME_CARDS: config.homeCards,
  SITE_NAV: config.nav,
  SITE_REPO: config.repo.url,
  SITE_REPO_BRANCH: config.repo.branch,
  SITE_DOCS_DIR: config.repo.docsDir,
})