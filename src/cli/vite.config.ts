/*
 * 引擎 vite 配置工厂 —— 从仓库根 vite.config.ts 迁入包内，改为编程式调用
 *
 * 与旧配置的差别只有一处：一切路径不再锚在"仓库根"，而是锚在 BuildContext
 *   root      = ctx.workDir   （保住 theme 里 /.cache、/config 的前导 / 语义）
 *   publicDir = WORK_DIR/public
 *   outDir    = USER_ROOT/dist
 * 编译插件与 ssgOptions 都以显式参数接收 ctx，不再依赖 import.meta.url 推路径。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import vue from '@vitejs/plugin-vue'
import type { InlineConfig } from 'vite'
import type { ViteSSGOptions } from 'vite-ssg'
import generateSitemap from 'vite-ssg-sitemap'

import compileArticles, { finalizeSignature } from '../build/parseArticle.ts'
import { resolveCacheDir, resolveOutDir, resolvePublicDir, pkgRoot } from './paths.ts'
import type { BuildContext } from './types.ts'

export type EngineEnv = {
  command: 'serve' | 'build'
  mode: string
  base?: string
  port?: number
  outDir?: string // 绝对路径；缺省由 config 工厂按 USER_ROOT/dist 兜底
}

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

// 递归收集 .cache 下的 .vue 产物，返回相对 .cache 的 id（去掉 .vue 后缀，路径分隔符统一为 /）
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
      // home.vue 是首页内容源产物（由 Home.vue 经 / 路由渲染），不是文章，跳过以免生成 /post/home 幽灵路由
      if (relative(root, full).split(sep).join('/') === 'home.vue') continue
      // 相对 root 而非当前层，否则嵌套层级在递归里被吃掉，id 变成扁平的末段名
      out.push(relative(root, full).split(sep).join('/').replace(/\.vue$/, ''))
    }
  }
  return out
}

export const createEngineConfig = (ctx: BuildContext, env: EngineEnv): InlineConfig => {
  const isServe = env.command === 'serve'
  const themeDir = join(pkgRoot, 'src/theme')
  const config: InlineConfig = {
    configFile: false, // 配置文件由 CLI 自己管，禁止 vite 去 WORK_DIR 里找
    root: ctx.workDir,
    publicDir: resolvePublicDir(ctx.workDir),
    base: env.base,
    mode: env.mode,
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => mathmlTags.includes(tag),
          },
        },
      }),
      {
        name: 'compile-articles',
        async buildStart() {
          await compileArticles(ctx)
          // dev（serve）下不会走到 ssgOptions.onFinished，正式签名也就无处转正，会一直停在上次
          // build 的输入状态；但 dev 编译已经改写了 .cache 产物，签名与产物就此脱钩。故 dev
          // 编译完成后同样转正，保证"正式签名始终描述磁盘上那份产物"
          if (isServe) finalizeSignature(ctx)
        },
      },
    ],
    resolve: {
      alias: [
        // index.html 的入口脚本写作 /src/theme/main.ts（Vite root 相对），此处把它折回包内实际位置
        { find: /^\/src\/theme\//, replacement: themeDir + '/' },
        // @ 指向 theme：theme 内是完整 Vue 框架，内部引用不带 theme 前缀（@/components）
        { find: '@', replacement: themeDir },
      ],
    },
    server: {
      port: env.port,
      // 允许跨域取用站内静态资源（站点可能被外部页面嵌入引用），与 preview 侧保持一致
      cors: true,
      watch: {
        // 编译缓存目录不进 watcher，避免产物写入/更新触发 reload 循环
        ignored: ['**/.cache/**'],
      },
      fs: {
        // 显式放行包目录：root 在用户项目内，主题源码在包目录里，不放行会被 dev server 拒绝
        allow: [ctx.workDir, ctx.userRoot, pkgRoot],
      },
    },
    build: {
      // 产物落在用户项目根，便于直接部署；在 root 之外，需显式允许清空
      outDir: env.outDir ?? resolveOutDir(ctx.userRoot),
      emptyOutDir: true,
    },
  }
  return config
}

/*
 * ssgOptions 工厂：entry / includedRoutes / onFinished / sitemap 全部锚 ctx 与 outDir 生成
 * 由 build 命令作为第一个参数传给 vite-ssg 的编程式 build
 */
export const createSsgOptions = (ctx: BuildContext, outDir: string): ViteSSGOptions => ({
  includedRoutes(paths) {
    // 文章路由不在 routes 里显式登记（id 来自构建产物），预渲染清单靠扫 .cache 目录补齐。
    // .cache/<id>.vue 的 id 直接取自 docs/ 下的相对路径（不含 .md），可能带子目录，故递归收集
    const postIds = walkVue(resolveCacheDir(ctx.workDir))
    // 404 显式加入：路由表末尾的 catch-all 含':'，会被下面的过滤剔除，
    // 而托管平台（Vercel/Netlify/Pages）需要一份真实的 404.html 兜底未知路径
    return ['/404', ...paths.filter((path) => !path.includes(':')), ...postIds.map((id) => `/post/${id}`)]
  },
  // 构建完成后：生成 sitemap.xml/robots.txt
  onFinished() {
    // 编译签名转正：走到这里说明本轮构建（打包+SSG 预渲染）完整成功，
    // pending 签名才有资格短路下次构建（详见 parseArticle.ts finalizeSignature）
    finalizeSignature(ctx)

    /*
     * sitemap 分级：首页最高、文章次之（并用真实更新时间做 lastmod）、归档/工具页最低
     * 插件默认把全部页面写成 priority 1.0 + lastmod=构建时间，搜索引擎会忽略无区分度的权重
     * docs/ 为空时 parseArticle 不会生成 post.json，这里兜空对象，否则 readFileSync 抛错让整个构建 exit 1
     */
    let posts: Record<string, { date?: string; updated?: string }> = {}
    try {
      posts = JSON.parse(readFileSync(join(resolvePublicDir(ctx.workDir), 'config/post.json'), 'utf8'))
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

    /*
     * siteUrl 未配置时直接跳过：sitemap 的每条 <loc> 都是绝对地址，hostname 传空会让插件
     * 产出一份指向本地/相对路径的错链，提交给搜索引擎比没有更糟。
     * 只用前缀判断是否为可用绝对地址 —— 用户把域名写成 blog.some.com/path 也应放行
     */
    if (!/^https?:\/\//i.test(ctx.config.siteUrl)) {
      console.warn(
        '[sitemap] 未配置 siteUrl，已跳过 sitemap.xml 生成（在 vdoc.config.ts 填入站点绝对地址即可恢复）',
      )
      // robots.txt 仍要落一份：它原本是随 sitemap 插件一起产出的，跳过插件不等于能让爬虫拿到 404。
      // 未配域名时不写 Sitemap 行 —— 指向一个不存在的文件比不声明更糟
      writeFileSync(join(outDir, 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8')
      return
    }

    generateSitemap({
      hostname: ctx.config.siteUrl,
      outDir,
      exclude: ['/notfound'],
      priority,
      changefreq,
      lastmod,
      readable: true,
    })
  },
})