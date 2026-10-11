/*
 * 站点配置：编译期输入的唯一配置源，全部在构建时确定，运行期无配置读取
 * 改本文件后需重新构建才生效（开发模式不热更新配置）
 */

/* ====================<编译期配置>==================== */
// 只被 src/build/parseArticle.ts（Node 环境）消费，不进浏览器包

// 文章根目录：docs/ 下的 .md 是文档源，须与 vite.config.ts 的 includedRoutes 扫描范围一致
export const ARTICLE_DIR = 'docs'

// 扫盘最大层级：docs/ 下的第一层目录算第 1 级，超出深度的分支整体不纳入编译
export const MAX_DEPTH = 6

/* ====================<站点配置>==================== */
// 编译期全量写进 .cache/site.json（parseArticle.ts 的 syncSiteConfig），theme 内经 composables/site.ts 同步读产物
// vite.config.ts（sitemap 生成）为构建期代码，直接 import 本文件

// 站点级常量：sitemap 生成共用，换域名/站名只改这一处
// TODO 部署域名待定：sitemap.xml 的绝对链接都取自这里，上线后改成真实域名
export const SITE_URL = 'https://blog.cnkrru.top'
export const SITE_TITLE = 'KruDoc'
export const SITE_DESCRIPTION =
  '个人技术笔记知识库，记录编程学习与工程实践，涵盖后端、前端、硬件、框架、脚本等多个领域。'
export const SITE_KEYWORDS = 'KruDoc,技术笔记,知识库,后端,前端,硬件,嵌入式,框架,脚本'
// 分享封面：社交平台抓取 og:image 用（Facebook/Twitter 不支持 SVG，必须是 png/jpg）
// 换图只需替换 public/og-cover.png；文章可在 frontmatter 用 cover 字段单独指定
export const SITE_OG_IMAGE = '/og-cover.png'
export const SITE_OG_IMAGE_ALT = 'KruDoc 技术笔记知识库'

// ---- 页脚版权：手写在配置里，换年份/文案只改这一处 ----
export const SITE_COPYRIGHT = `© ${new Date().getFullYear()} KruDoc · Vue 3 驱动`

// ---- 首页分类卡片：手写在配置里，首页网格按此渲染 ----
// link 与顶栏导航同一套规则：只指向具体文档页（这里统一指向该分类的首篇），不写分组前缀
export type HomeCard = { text: string; link: string; desc: string }
export const HOME_CARDS: HomeCard[] = [
  { text: '测试', link: '/post/test-1', desc: '测试文档，验证编译与渲染效果' },
]

// ---- 顶栏导航：手写在配置里，加/删/改顺序只动这个数组 ----
// link 两种写法，靠是否以 http(s):// 开头区分：
//  站内  /            —— 首页
//        /post/<id>   —— 文章页，id 是 docs/ 下的相对路径去掉 .md
//  外链  https://...  —— 用原生 a 打开新窗口
// 只指向具体文档页：不认 /post/电气 这类分组前缀（分组没有落地页，点了会落到 404）
export type NavItem = { text: string; link: string }
export const SITE_NAV: NavItem[] = [
  { text: '首页', link: '/' },
  { text: '文档', link: '/post/test-1' },
]

// ---- 仓库配置：postEdit / postHistory 由此拼出 GitHub 的编辑页与提交历史页 ----
// owner/repo：仓库地址，留空则文章页不渲染「编辑 / 历史」两个入口（避免死链）
export const SITE_REPO = 'Cnkrru/KruDocs'
// 分支名：GitHub 默认主分支为 main
export const SITE_REPO_BRANCH = 'main'
// 文档在仓库中的根目录，须与上面的 ARTICLE_DIR 一致
export const SITE_DOCS_DIR = 'docs'
