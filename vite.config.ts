import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { join, relative, resolve, sep } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import generateSitemap from 'vite-ssg-sitemap'
import compileArticles, { finalizeSignature } from './src/build/parseArticle.ts'
import { SITE_TITLE, SITE_URL } from './src/config/site.config.ts'
import 'vite-ssg'

// katex 公式产物里的 MathML 标签，告知 Vue 模板编译器按原生元素处理（不解析为组件）
const mathmlTags = [
  'math',
  'semantics',
  'mrow',
  'mfrac',
  'msqrt',
  'msub',
  'msup',
  'msubsup',
  'munder',
  'mover',
  'munderover',
  'mi',
  'mo',
  'mn',
  'mtext',
  'mspace',
  'mstyle',
  'annotation',
]
// giscus 的 web component，由浏览器 customElements 接管，Vue 按原生元素渲染
const customTags = [...mathmlTags, 'giscus-widget']

// 递归收集 .cache 下的.vue 产物，返回相对 .cache 的 id（去掉 .vue 后缀，路径分隔符统一为 /）
// .cache 目录可能不存在（首次构建/被手工清掉），此时返回空数组而非抛错
function walkVue(root: string, dir = root): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    if (dir === root) console.warn('[ssg].cache 目录不存在，跳过文章路由预渲染')
    return []
  }
  const out: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkVue(root, full))
    } else if (entry.name.endsWith('.vue')) {
      // 相对 root 而非当前层，否则嵌套层级在递归里被吃掉，id 变成扁平的末段名
      out.push(relative(root, full).split(sep).join('/').replace(/\.vue$/, ''))
    }
  }
  return out
}

// dev（serve）下不会走到 ssgOptions.onFinished，正式签名也就无处转正，会一直停在上次 build 的
// 输入状态；但 dev 编译已经改写了 .cache 产物，签名与产物就此脱钩 —— 输入一旦回退到那次 build
// 的状态，就会误判"未变"而短路，留下上一个状态的产物（幽灵文章页/幽灵侧栏项）。
// 故 dev 编译完成后同样转正，保证"正式签名始终描述磁盘上那份产物"
let isServe = false

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => customTags.includes(tag),
        },
      },
    }),
    {
      name: 'compile-articles',
      configResolved(config) {
        isServe = config.command === 'serve'
      },
      async buildStart() {
        await compileArticles()
        // 转正放在短路分支之外：compileArticles 短路时 pending 描述的仍是磁盘上那份产物，
        // 直接沿用即可，两条路径都能让正式签名与产物对齐
        if (isServe) finalizeSignature()
      },
    },
  ],
  ssgOptions: {
    includedRoutes(paths) {
      // 文章路由不在 routes 里显式登记（id 来自构建产物），预渲染清单靠扫 .cache 目录补齐。
      // .cache/<id>.vue 的 id 直接取自 docs/ 下的相对路径（不含 .md），可能带子目录，故递归收集
      const cacheDir = fileURLToPath(new URL('./.cache', import.meta.url))
      const postIds = walkVue(cacheDir)
      // 404 显式加入：路由表末尾的 catch-all 含':'，会被下面的过滤剔除，
      // 而托管平台（Vercel/Netlify/Pages）需要一份真实的 404.html 兜底未知路径
      return [
        '/404',
        ...paths.filter((path) => !path.includes(':')),
        ...postIds.map((id) => `/post/${id}`),
      ]
    },
    // 构建完成后：生成 sitemap.xml/robots.txt
    onFinished() {
      // 编译签名转正：走到这里说明本轮构建（打包+SSG 预渲染）完整成功，
      // pending 签名才有资格短路下次构建（详见 parseArticle.ts finalizeSignature）
      finalizeSignature()
      // 404 产物的 head 修正：全站 SEO（useHead）尚未接入，title 仍是 index.html 的静态值。
      // vite-ssg@28 没有 transformHtml 钩子，而 Vite 插件的 closeBundle 早于 SSG 写文件，
      // 故只能放在 onFinished —— 此刻 dist/404.html 已落盘。全站 SEO 接通后本段即可删除。
      const notFound = resolve('dist/404.html')
      if (existsSync(notFound)) {
        writeFileSync(
          notFound,
          readFileSync(notFound, 'utf8')
            .replace(/<title>[\s\S]*?<\/title>/, `<title>页面不存在 - ${SITE_TITLE}</title>`)
            .replace(
              /<meta name="viewport"/,
              '<meta name="robots" content="noindex, nofollow">\n    <meta name="description" content="你访问的页面可能已被移动、重命名，或地址有误。">\n    <meta name="viewport"',
            ),
          'utf8',
        )
      } else {
        console.warn('[404] dist/404.html 不存在，跳过 head 修正')
      }

      // sitemap 分级：首页最高、文章次之（并用真实更新时间做 lastmod）、归档/工具页最低
      // 插件默认把全部页面写成 priority 1.0 + lastmod=构建时间，搜索引擎会忽略无区分度的权重
      // docs/ 为空时 parseArticle 不会生成 post.json，这里兜空对象，否则 readFileSync 抛错让整个构建 exit 1
      let posts: Record<string, { date?: string; updated?: string }> = {}
      try {
        posts = JSON.parse(readFileSync(resolve('public/config/post.json'), 'utf8'))
      } catch {
        console.warn('[sitemap] post.json 不存在，按空文章列表生成')
      }
      const priority: Record<string, number> = { '/': 1.0 }
      const changefreq: Record<string, string> = { '/': 'daily' }
      const lastmod: Record<string, Date> = {}
      for (const [id, meta] of Object.entries(posts)) {
        const route = `/post/${id}`
        priority[route] = 0.8
        changefreq[route] = 'weekly'
        const stamp = meta.updated || meta.date
        if (stamp) lastmod[route] = new Date(stamp)
      }
      for (const route of ['/postlist', '/category', '/tag', '/about', '/link', '/setting']) {
        priority[route] = 0.5
        changefreq[route] = 'monthly'
      }

      generateSitemap({
        hostname: SITE_URL,
        exclude: ['/notfound'],
        priority,
        changefreq,
        lastmod,
        readable: true,
      })
    },
  },
  resolve: {
    alias: {
      // @ 指向 theme：theme 内是完整 Vue 框架，内部引用不带 theme 前缀（@/components）
      '@': fileURLToPath(new URL('./src/theme', import.meta.url)),
      // @config 指向 src/config：编译期输入的配置（site.config.ts），theme 内经此别名引用
      '@config': fileURLToPath(new URL('./src/config', import.meta.url)),
    },
  },
  server: {
    // giscus iframe 跨域 fetch public/ 下的评论主题CSS，dev server 必须带 CORS 头
    cors: true,
    watch: {
      // 编译缓存目录不进 watcher，避免产物写入/更新触发 reload 循环
      ignored: ['**/.cache/**'],
    },
  },
})
