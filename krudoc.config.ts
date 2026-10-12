/*
 * 本仓库作为 krudoc 的第一个用例（dogfood）：只写站点差异，其余走引擎默认值
 *
 * 配置契约（类型 / 默认值 / defineConfig）在 src/config/site.config.ts。
 * 用户项目里改为从包入口导入：import { defineConfig } from 'krudoc'
 * 本仓库尚未作为依赖安装自身，故走相对路径导入，避免依赖包自引用的解析行为。
 */
import { defineConfig } from './src/config/site.config.ts'

export default defineConfig({
  title: 'KruDoc',
  description:
    '个人技术笔记知识库，记录编程学习与工程实践，涵盖后端、前端、硬件、框架、脚本等多个领域。',
  keywords: 'KruDoc,技术笔记,知识库,后端,前端,硬件,嵌入式,框架,脚本',
  // sitemap.xml 的绝对链接都取自这里，上线后改成真实域名
  siteUrl: 'https://blog.cnkrru.top',
  // 分享封面：社交平台抓取 og:image 用（Facebook/Twitter 不支持 SVG，必须是 png/jpg）
  ogImage: '/og-cover.png',
  ogImageAlt: 'KruDoc 技术笔记知识库',
  copyright: `© ${new Date().getFullYear()} KruDoc · Vue 3 驱动`,
  docsDir: 'docs',
  maxDepth: 6,
  // 顶栏导航：只有站内链接，link 指向具体文档页（分组没有落地页）
  nav: [
    { text: '首页', link: '/' },
    { text: '文档', link: '/post/test-1' },
  ],
  homeCards: [{ text: '测试', link: '/post/test-1', desc: '测试文档，验证编译与渲染效果' }],
  // 文章页「编辑 / 历史」入口由此拼出 GitHub 链接
  repo: { url: 'Cnkrru/KruDocs', branch: 'main', docsDir: 'docs' },
})