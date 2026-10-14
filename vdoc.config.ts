/*
 * 本仓库作为 vdoc 的第一个用例（dogfood）：只写站点差异，其余走引擎默认值
 *
 * 配置契约（类型 / 默认值 / defineConfig）在 src/config/site.config.ts。
 * 用户项目里改为从包入口导入：import { defineConfig } from '@hello/vdoc'
 * 本仓库尚未作为依赖安装自身，故走相对路径导入，避免依赖包自引用的解析行为。
 */
import { defineConfig } from './src/config/site.config.ts'

export default defineConfig({
  title: 'hello',
  description:
    '基于 Vue 3 + Vite 的静态文档站生成器：docs/ 目录即站点，编译期直出静态 HTML。',
  keywords: 'hello,静态站点生成器,SSG,文档站,Vue,Vite,Markdown,shiki',
  // TODO 站点上线前填入真实域名（如 https://docs.example.com）
  // 留空时：不生成 sitemap.xml，也不下发 canonical / og:url —— sitemap 的每条 <loc> 都是
  // 绝对地址，用错域名产出的错链提交给搜索引擎比没有更糟，故宁可缺。
  siteUrl: '',
  // 分享封面：社交平台抓取 og:image 用（Facebook/Twitter 不支持 SVG，必须是 png/jpg）
  ogImage: '/og-cover.png',
  ogImageAlt: 'hello 静态文档站生成器',
  copyright: `© ${new Date().getFullYear()} hello · Vue 3 驱动`,
  docsDir: 'docs',
  maxDepth: 6,
  // 顶栏导航：只有站内链接，link 指向具体文档页（分组没有落地页）
  nav: [
    { text: '首页', link: '/' },
    { text: '配置', link: '/post/配置' },
    { text: '实现原理', link: '/post/实现原理' },
  ],
  // 文章页「编辑 / 历史」入口由此拼出 GitHub 链接（仓库名与包名解耦，仍是 KruDocs）
  repo: { url: 'Cnkrru/KruDocs', branch: 'main', docsDir: 'docs' },
})
