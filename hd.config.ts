import { defineConfig } from './src/config/site.config.ts'

export default defineConfig({
  title: 'hello',
  description:
    '基于 Vue 3 + Vite 的静态文档站生成器：docs/ 目录即站点，编译期直出静态 HTML。',
  keywords: 'hello,静态站点生成器,SSG,文档站,Vue,Vite,Markdown,shiki',
  siteUrl: '',
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
  // 文章页「编辑 / 历史」入口由此拼出 GitHub 链接（仓库名与包名解耦）
  repo: { url: 'Cnkrru/hello-vdoc', branch: 'main', docsDir: 'docs' },
})
