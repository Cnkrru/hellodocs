// 编译期脚本：docs/*.md → .cache/*.vue（正文 SFC）+ public/config/post.json（元数据）
// 并把 post.json 原样复制为 .cache/post.json（可import 同源副本，供 PostUpdate / search 读元数据）
// 另产出 .cache/search.json（id → 正文纯文本），供 theme 侧搜索按需加载建全文索引
// 由 vite buildStart 调用。
//
// 路径模型：本脚本不再自行推导"项目根"，一切产物路径来自显式传入的 BuildContext
// （见 src/cli/types.ts）。引擎因此能服务任意用户项目，而非只服务本仓库。
//
// 职责边界：编译期做「md → html」、「解析元数据」与「由目录结构派生侧栏树」三件事。
// 侧栏树不再手写配置 —— 由 docs/ 的目录结构派生（见 deriveSidebar）：分组即目录、同级自然序，
// 新增/改名文档后侧栏自动跟随。同一棵树既产出 .cache/sidebar.json，又用于推导上下篇。
//
// 写作组件已插件化（src/build/plugins/）：围栏类（mermaid/timeline/steps/tabs/links/gallery 与
// 提示块 tip/info/warn/error）与行内类（kbd/badge/mark）各自独立成插件，registry.ts 统一登记；
// 新增组件 = 加一个插件文件 + 在 registry 登记一行，本脚本不再改动。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import MarkdownIt from 'markdown-it'
import type { Highlighter } from 'shiki'
import {
  bundledLanguages,
  bundledLanguagesAlias,
  createHighlighter,
  createCssVariablesTheme,
} from 'shiki'
import { anchor } from '@mdit/plugin-anchor'
import { tasklist } from '@mdit/plugin-tasklist'
import { katex } from '@mdit/plugin-katex'
import { footnote } from '@mdit/plugin-footnote'
import { sub } from '@mdit/plugin-sub'
import { sup } from '@mdit/plugin-sup'
import { lightEmoji } from '@mdit/plugin-emoji'
import { ins } from '@mdit/plugin-ins'
import { componentPlugin } from '@mdit-vue/plugin-component'
import { slugify } from '@mdit-vue/shared'
import { serializeSiteConfig, type ResolvedConfig } from '../config/site.config.ts'
import type { BuildContext } from '../cli/types.ts'
import {
  componentFenceLangs,
  renderComponentFence,
  setupComponentPlugins,
} from './plugins/registry.ts'
import { toolbar, splitRow } from './plugins/base.ts'

// 上下篇链接：编译期按侧栏派生树的展平顺序推导，首篇无 prev、末篇无 next
type PostNavLink = {
  title: string
  link: string
}

// 文章元数据：无 frontmatter，全部由编译期推导
// title 取文件名末段，updated 取源文件 mtime
type ArticleMeta = {
  title: string
  updated: string
  prev?: PostNavLink | null
  next?: PostNavLink | null
}

const highlightTheme = createCssVariablesTheme()

/*
 * id: KNOWN_LANGS
 * fn: shiki 可用语言白名单，configLanguage 用它过滤 md 里不受支持的语言名
 * 不过滤会让 createHighlighter 直接抛 ShikiError 打断 buildStart（dev server 起不来）
 * text/plaintext 不在 bundledLanguages/bundledLanguagesAlias 表里，但 shiki 内置支持（纯文本、不做着色），
 * fence 缺省语言与 codeToHtml 的兜底都依赖它，故单独放行
 */
const KNOWN_LANGS: ReadonlySet<string> = new Set([
  ...Object.keys(bundledLanguages),
  ...Object.keys(bundledLanguagesAlias),
  'text',
  'plaintext',
])

// 语法高亮器，configLanguage 初始化，fence 规则闭包使用
let highlighter: Highlighter | null = null

// 脚本文件路径：插件签名与自身 mtime 锚这里（包内路径跨项目稳定）
const scriptPath = fileURLToPath(import.meta.url)
const dirPath = path.dirname(scriptPath)

/*
 * 日志分级：进度类 info 默认静默，HD_DEBUG=1 时打开；warn / error 始终输出。
 * CLI 是给用户跑的命令，「文章文件夹存在」「post.json 存在」这类过程日志每次构建都刷屏，
 * 会把真正的警告淹没（bin/hd.mjs 也已按「保持输出干净」收窄了错误输出）
 */
const info = (...args: unknown[]) => {
  if (process.env.HD_DEBUG) console.log(...args)
}

// 产物路径全部由 BuildContext 派生，本轮编译开始时绑定一次。
// 原实现锚在 import.meta.url 推出的"仓库根"上，改为锚 ctx 后引擎才能服务任意用户项目
let articlePath = ''
let vuePath = ''
let jsonPath = ''
let postMetaPath = ''
let searchPath = ''
let sidebarPath = ''
let sidebarMetaPath = ''
let homeMdPath = ''
let homeVuePath = ''
let maxDepth = 6
let siteConfig: ResolvedConfig | null = null

// 当前正在渲染的页标识：文章 id（首页为 'home'）。插件上下文里透传出去，
// 供需要『同页唯一』的组件（tabs 等分节面板）识别换页后归零页内序号
let currentPageKey = ''

const bindContext = (ctx: BuildContext) => {
  articlePath = ctx.articleDir
  vuePath = path.join(ctx.workDir, '.cache')
  jsonPath = path.join(ctx.workDir, 'public/config/post.json')
  postMetaPath = path.join(vuePath, 'post.json')
  // 正文语料单独一份：post.json 被多个模块 eager import 进主包，正文不能往里塞
  searchPath = path.join(vuePath, 'search.json')
  sidebarPath = path.join(ctx.workDir, 'public/config/sidebar.json')
  sidebarMetaPath = path.join(vuePath, 'sidebar.json')
  // 首页内容源：内容目录顶层的 index.md（缺省回退包内模板）→ .cache/home.vue，
  // 与文章同一渲染管线，但不进侧栏树与 post.json
  homeMdPath = ctx.homeMdPath
  homeVuePath = path.join(vuePath, 'home.vue')
  maxDepth = ctx.maxDepth
  siteConfig = ctx.config
}

/*
 * id: ensureJsonDir
 * fn: 保证 post.json 的父目录存在
 * public/config/ 是编译期生成目录（.gitignore 已忽略），首次构建或被手工清掉时压根不存在，
 * 而 writeFileSync 不会自动建父目录 —— 直接写会 ENOENT。所有写 post.json 的地方都先过这里
 */
const ensureJsonDir = () => {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
}

/*
 * id: compileSignature
 * fn: 输入签名。一次 build 会跑"客户端+服务端"两次 vite build，且每次构建都重新 import 本模块
 * —— 内存态无法跨构建存活，改用 `.cache/.compile-sig` 磁盘 sidecar：签名一致则短路复用缓存
 *
 * 签名必须掺入本脚本自身的 mtime/size：元数据提取逻辑（如 updated 的兜底来源）改动后，
 * docs/ 一个字没变，签名却必须变化，否则缓存短路会让新逻辑要手动清 .cache 才生效
 *
 * 侧栏树改由 docs/ 目录结构派生后，不再需要单独掺入侧栏配置文件：文件的增删改已由下面的
 * files 列表覆盖（新增目录 = 新增文件），所以只改目录结构也一定会让签名变化。
 * 但站点配置（title / nav / homeCards 等）改了 docs/ 一个字没变，产物却必须重生成，故单独掺入。
 *
 * 组件插件化后还必须掺入 plugins/ 下所有插件文件：只改组件外壳而 docs/ 未动时，
 * 签名若不变就会短路复用缓存，新组件产物永远不会生效
 */
// 递归收集 plugins/ 下所有 .ts（含子目录）：签名与增量复用判定共用
// 只扫顶层会让 plugins/registry.ts 引出的子目录插件改动被漏掉，一旦漏掉签名不变就短路复用旧产物
const pluginFiles = (): string[] => {
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.name.endsWith('.ts')) out.push(full)
    }
  }
  try {
    walk(path.join(dirPath, 'plugins'))
  } catch {
    return []
  }
  return out
}
// plugins/ 下最新 mtime：SFC/home 复用判定用它兜底（插件改动后旧产物必须重渲染）
const pluginLatestMtime = (): number =>
  pluginFiles().reduce((max, f) => Math.max(max, fs.statSync(f).mtimeMs), 0)

const compileSignature = (files: string[]): string => {
  const self = fs.statSync(scriptPath)
  const selfTag = `__self__:${self.mtimeMs}:${self.size}`
  const pluginTags = (() => {
    const list = pluginFiles()
    if (list.length === 0) return ['__plugins__:missing']
    // tag 用相对路径而非文件名：子目录同名文件不会互相覆盖
    return list.map((f) => {
      const s = fs.statSync(f)
      return `__plugin_${path.relative(dirPath, f)}__:${s.mtimeMs}:${s.size}`
    })
  })()
  // 首页内容源同样掺入签名：顶层 index.md 改动后不能被短路缓存挡住，否则新内容永远不生效
  const homeTag = (() => {
    try {
      const s = fs.statSync(homeMdPath)
      return `__home_md__:${s.mtimeMs}:${s.size}`
    } catch {
      return '__home_md__:missing'
    }
  })()
  // 站点配置同样掺入签名：配置改动后产物（site.json 及依赖配置的渲染）必须重生成
  const configTag = `__config__:${JSON.stringify(siteConfig)}`
  return [
    selfTag,
    ...pluginTags,
    homeTag,
    configTag,
    ...files.map((f) => {
      const s = fs.statSync(path.join(articlePath, f))
      return `${f}:${s.mtimeMs}:${s.size}`
    }),
  ]
    .sort()
    .join('|')
}

// 语言名消毒：只保留字母数字下划线连字符，防止注入类名/属性
const safeLang = (lang: string): string => String(lang).replace(/[^\w-]/g, '')

/* ====================<代码块外壳模板>==================== */
/*
 * id: codeShell
 * fn: 普通代码块外壳，编译期把shiki高亮结果塞进顶栏+内容区结构
 * 顶栏对齐 blog-map：语言徽章(圆点+文本) + 内联 SVG 复制图标
 */
const codeShell = (lang: string, highlighted: string): string => `
<div class="language-${lang}" v-pre>
    <div class="code-toolbar">
        <span class="lang lang-${lang}">
            <span class="lang-dot"></span>
            <span class="lang-text">${lang}</span>
        </span>
        <button class="copy">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
    </div>
    ${highlighted}
</div>
`

/*
 * id: mtimeToDate
 * fn: 源文件最后修改时间 → YYYY-MM-DD（本地时区，不用 toISOString 以免时差把日期挪走）
 * 用于 frontmatter 缺 updated 时兜底：这批文档成批导入，没有可靠的"最后编辑时间"，
 * 拿文件系统 mtime 当近似值，比留空让「最后编辑于」显示空白要诚实可用
 */
const mtimeToDate = (file: string): string => {
  const d = new Date(fs.statSync(path.join(articlePath, file)).mtime)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 单篇进检索索引的正文上限：整份 search.json 的体积与浏览器侧索引内存都可控
const SEARCH_TEXT_LIMIT = 2000

/*
 * id: toPlainText
 * fn: md 源码 → 检索用纯文本，剥掉标记语法
 * 代码块内**保留**（围栏标记去掉，内容留着）—— 文档站里搜 API 名 / 配置项是刚需，
 * 把代码整段丢掉等于搜索残废；图片与链接只留链接文字，避免 URL 污染召回
 */
const toPlainText = (source: string): string =>
  source
    .replace(/^\s*```.*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_TEXT_LIMIT)

/*
 * id: titleOf
 * fn: 由文章 id 推导显示标题
 * 常规取文件名末段（与侧栏、上下篇、搜索三处显示同一个名字）；
 * 例外是目录索引页 <dir>/index.md —— 它代表所在目录，标题取目录名，
 * 否则侧栏会出现一堆字面量『index』相互无区别。
 * 内容目录顶层的 index.md 是首页，已被 walkDocs 排除，不会走到这里
 */
const titleOf = (id: string): string => {
  const segs = id.split('/')
  const leaf = segs[segs.length - 1] ?? id
  if (leaf !== 'index') return leaf
  return segs[segs.length - 2] ?? leaf
}

/*
 * id: walkDocs
 * fn: 递归扫盘，返回相对 docs/ 的 md 相对路径（统一用 / 分隔，id 即该路径去掉 .md）
 * depth 从 1 起算（docs/ 下的第一层文件/目录算第 1 级），超过 maxDepth 的分支直接剪掉
 */
const walkDocs = (dir: string, prefix: string, depth: number, out: string[]) => {
  if (depth > maxDepth) {
    console.warn(`[WARN]:${prefix} 超过最大层级 ${maxDepth}，该分支已跳过`)
    return
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // 隐藏文件与 .md 之外的产物一律不进文档树
    if (entry.name.startsWith('.')) continue
    // 内容目录顶层的 index.md 是首页内容源（路由 /），不属于文章树：不进文章列表、侧栏与上下篇
    if (depth === 1 && entry.name === 'index.md') continue
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      walkDocs(path.join(dir, entry.name), rel, depth + 1, out)
    } else if (entry.name.endsWith('.md')) {
      out.push(rel)
    }
  }
}

/*
 * id: articlePathChecker
 * fn: 检查文章文件夹是否存在，递归收集其中的 md（返回相对路径，含子目录）
 */
const articlePathChecker = () => {
  if (!fs.existsSync(articlePath)) {
    console.error('[ERR]:文章文件夹不存在')
    return []
  }
  const files: string[] = []
  walkDocs(articlePath, '', 1, files)
  if (files.length === 0) {
    console.warn('[WARN]:文章目录下没有文件')
  }
  return files
}

/*
 * id: cleanVueDir
 * fn: 递归清理单个目录下的过时 .vue 产物，返回该目录清理后是否已空（供上层删空目录）
 * post.json / .compile-sig 等非 .vue 文件不在清理范围，但它们的存在意味着目录不能删
 */
const cleanVueDir = (dir: string, ids: Set<string>, relBase = ''): boolean => {
  let empty = true
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      // 子目录清理后为空则删掉，避免 .cache 里留下空目录壳
      if (cleanVueDir(full, ids, rel)) {
        fs.rmdirSync(full)
      } else {
        empty = false
      }
      continue
    }
    if (entry.name.endsWith('.vue') && !ids.has(rel.replace(/\.vue$/, ''))) {
      fs.rmSync(full)
      info(`[INFO]:清除过时中间产物${rel}`)
      // 删掉了，本目录可能变空，empty 保持当前值
    } else {
      empty = false
    }
  }
  return empty
}

/*
 * id: vuePathCleaner
 * fn: 只清除"已从docs删除文章"的过时产物；仍在用的SFC保留，供mtime增量复用
 */
const vuePathCleaner = (ids: Set<string>) => {
  cleanVueDir(vuePath, ids)
}

/*
 * id: vuePathChecker
 * fn: 检查.cache文件夹是否存在，如果没有则创建一个
 */
const vuePathChecker = (ids: Set<string>) => {
  try {
    if (fs.existsSync(vuePath)) {
      vuePathCleaner(ids)
    } else {
      fs.mkdirSync(vuePath, { recursive: true })
      info('[INFO]:原路径无 .cache 目录，已创建')
    }
  } catch (e) {
    console.error('[ERR]:vue文件夹操作失败', e)
  }
}

/*
 * id: jsonPathChecker
 * fn: 检查post.json是否存在，如果没有则创建一个
 */
const jsonPathChecker = () => {
  try {
    if (fs.existsSync(jsonPath)) return
    ensureJsonDir()
    fs.writeFileSync(jsonPath, '{}', 'utf8')
  } catch (e) {
    console.error('[ERR]:post.json操作失败', e)
  }
}

/*
 * id: syncPostMeta
 * fn: public/ 下的静态资源不进 Vite 模块图，无法 import；把 post.json 原样复制到 .cache/，
 * 得到可 import 的同源副本，供 Post.vue 在 SSR/客户端同步取 SEO 元数据（单一数据源，不做二次加工）
 */
const syncPostMeta = () => {
  if (fs.existsSync(jsonPath)) {
    fs.copyFileSync(jsonPath, postMetaPath)
  }
}

/*
 * id: syncSidebarMeta
 * fn: 与 syncPostMeta 同理：public/ 下的静态资源不进 Vite 模块图，无法 import；
 * 把编译期派生的 sidebar.json 原样复制到 .cache/，得到可 import 的同源副本供 theme 侧同步读
 */
const syncSidebarMeta = () => {
  if (fs.existsSync(sidebarPath)) {
    fs.copyFileSync(sidebarPath, sidebarMetaPath)
  }
}

/*
 * id: syncSiteConfig
 * fn: 把已解析的站点配置（ctx.config）序列化进 .cache/site.json——站点配置编译期写死进产物，
 * theme 内不 import 配置源文件，统一从这份产物同步读（SSG 预渲染和客户端一致）
 * 改配置后需重新构建才生效（开发模式不热更新配置）
 */
const syncSiteConfig = () => {
  if (!siteConfig) return
  const site = serializeSiteConfig(siteConfig)
  fs.writeFileSync(path.join(vuePath, 'site.json'), JSON.stringify(site, null, 4), 'utf8')
}

/*
 * id: configLanguage
 * fn: 遍历md，扫描代码块，每遇到一种语言，集合追加这门，组件语言排除，按需加载
 */
const configLanguage = async (absFiles: string[]) => {
  const langSet = new Set<string>(['text'])
  for (const file of absFiles) {
    const _ = fs.readFileSync(file, 'utf-8')
    // 兼容缩进围栏与「``` js」空格分隔：只认 ^``` 会漏掉缩进块和空格写法，语言进不了 shiki 白名单
    for (const i of _.matchAll(/^[ \t]*```[ \t]*([\w+-]+)/gm)) {
      const lang = (i[1] ?? '').toLowerCase()
      // 组件语言名都走 fence 拦截拼外壳，不是真语言，不进 shiki（注册表统一汇总，含 mermaid）
      if (!componentFenceLangs.has(lang)) {
        langSet.add(lang)
      }
    }
  }
  // 按 shiki 白名单过滤：md 里写了 shiki 不认识的语言名时，createHighlighter 会直接抛
  // ShikiError 打断 buildStart。这里剔掉并告警，单篇文档的语言名不再拖垮整站编译
  const usable = [...langSet].filter((lang) => KNOWN_LANGS.has(lang))
  const dropped = [...langSet].filter((lang) => !KNOWN_LANGS.has(lang))
  for (const lang of dropped) {
    console.warn(`[WARN]:代码块语言 shiki 不支持，已按纯文本回退：${lang}`)
  }

  highlighter = await createHighlighter({
    themes: [highlightTheme],
    langs: usable,
  })
}

/*
 * id: initMd
 * fn: 创建markdown-it实例，挂载插件
 */
const initMd = () => {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false })
    .use(componentPlugin) // 支持原生HTML和vue组件
    .use(anchor, { slugify }) // 支持md'#'标签绑定id
    .use(tasklist) // 支持md的任务列表转HTML
    .use(katex) // 支持KATEX
    .use(footnote) // 支持脚注 [^1]（GFM/Pandoc/Obsidian 标准语法）
    .use(sub) // 支持下标 H~2~O（Pandoc 语法）
    .use(sup) // 支持上标 x^2^（Pandoc 语法）
    .use(lightEmoji) // 支持 emoji 短代码 :tada:（GFM 标准，轻量版渲染为 Unicode 字符）
    .use(ins) // 支持插入标记 ++新增++（Pandoc 语法；删除线 ~~xx~~ GFM 已内置）
  // 行内代码统一带 v-pre：code 内容原样进 SFC 模板，其中的 {{ }} 若不屏蔽会被 Vue 当插值解析，
  // 轻则内容消失、重则编译报错（文档里展示 Vue 模板语法/徽章语法时必然出现）。围栏代码块外壳自带 v-pre，无需处理
  md.renderer.rules.code_inline = (tokens, idx, _options, _env, self) =>
    `<code v-pre${self.renderAttrs(tokens[idx]!)}>${md.utils.escapeHtml(tokens[idx]!.content)}</code>`

  return md
}

/*
 * id: configFence
 * fn: 编译期拦截代码块：组件语言交给注册表里的组件插件拼外壳直出 HTML，
 * 未命中任何组件插件的走 shiki 编译期高亮（运行时无需再处理）
 */
const configFence = (md: InstanceType<typeof MarkdownIt>) => {
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!
    const info = md.utils.unescapeAll(token.info).trim()
    // 统一小写：收集侧（configLanguage）已 toLowerCase，这里不转会让 Cpp/Vue 这类写法
    // 命中 codeToHtml 的 catch 静默回退成纯文本，等于白丢语法着色
    const lang = (info.split(/\s+/)[0] || 'text').toLowerCase()
    const safe = safeLang(lang)

    // 组件插件：mermaid 与写作组件（timeline/steps/tabs/links/gallery 等，注册表统一调度）
    // highlight：code-group 等内嵌代码的组件用，编译期 shiki 高亮；未知语言回退纯文本
    // renderMarkdown：提示块这类『块内正文仍要正常渲染』的组件用，嵌套跑一遍本实例
    const componentHtml = renderComponentFence(
      {
        escapeHtml: md.utils.escapeHtml,
        toolbar,
        splitRow,
        renderMarkdown: (s: string): string => md.render(s),
        pageKey: currentPageKey,
        highlight: (code: string, lang: string): string => {
          try {
            return highlighter!.codeToHtml(code, { lang, theme: highlightTheme })
          } catch {
            return highlighter!.codeToHtml(code, { lang: 'text', theme: highlightTheme })
          }
        },
      },
      lang,
      token.content,
      info,
    )
    if (componentHtml !== null) return componentHtml

    // 编译期高亮：highlighter 由 manager 的 configLanguage 初始化，此处必有值
    let highlighted: string
    try {
      highlighted = highlighter!.codeToHtml(token.content, { lang, theme: highlightTheme })
    } catch {
      highlighted = highlighter!.codeToHtml(token.content, { lang: 'text', theme: highlightTheme })
    }
    return codeShell(safe, highlighted)
  }
}

/* ====================<侧栏树派生>==================== */
// 结构与 theme 侧 composables/sidebar.ts 的 SidebarNode 一致：text 显示名、link 可点入口、items 子项
type SidebarNode = {
  text: string
  link?: string
  items?: SidebarNode[]
}

/*
 * id: naturalCompare
 * fn: 自然序比较器：数字段按数值比较
 * 必须用自然序 —— docs 里有 css-基础-1…css-基础-25、stm32-1…stm32-24，
 * 纯字典序会把 css-基础-10 排到 css-基础-2 之前
 */
const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })
const naturalCompare = (a: string, b: string) => collator.compare(a, b)

/*
 * id: deriveSidebar
 * fn: 由 walkDocs 扫出的文件 id 列表派生侧栏树
 * 规则：
 *  - id 按 / 切段，中间段是目录 → 分组节点，末段是文件 → 叶子节点
 *  - 叶子 text 取文件名末段（目录索引页 index.md 例外，见 titleOf），与 post.json 的
 *    title 用同一套推导，保证侧栏、上下篇、搜索三处显示同一个名字
 *  - 分组 text 取目录名原样（目录名即章节名，不做映射）
 *  - 目录索引页 <dir>/index.md **不单独成叶子**，而是挂成该分组的 link ——
 *    分组标题本身可点进索引页（PostSidebar 已支持分组的 link，点标题导航、点箭头折叠），
 *    否则侧栏会出现一堆字面量『index』
 *  - 内容目录顶层的 index.md 是首页，已被 walkDocs 排除，不会出现在这棵树里
 *  - 同级目录在前、文件在后，各自自然序
 * 注意：theme 侧分组 key 用祖先 text 链拼接（sidebar.ts），同级同名目录会撞 key —— docs 现状无同名兄弟目录
 */
const deriveSidebar = (files: string[]): SidebarNode[] => {
  const root: SidebarNode[] = []
  // 目录路径前缀 → 分组节点，避免同一目录被重复建节点
  const folderMap = new Map<string, SidebarNode>()

  // 逐级向上补建分组：目录 xxx/yyy/zzz 会连带建出 xxx、xxx/yyy
  const ensureFolder = (prefix: string): SidebarNode => {
    const existed = folderMap.get(prefix)
    if (existed) return existed
    const node: SidebarNode = { text: prefix.slice(prefix.lastIndexOf('/') + 1), items: [] }
    folderMap.set(prefix, node)
    const slash = prefix.lastIndexOf('/')
    if (slash === -1) {
      root.push(node)
    } else {
      ensureFolder(prefix.slice(0, slash)).items!.push(node)
    }
    return node
  }

  // 目录前缀 → 索引页 id，待分组节点建好后再回填 link
  const folderIndex = new Map<string, string>()

  for (const file of files) {
    const id = file.replace(/\.md$/, '')
    const segs = id.split('/')
    const leafName = segs.pop()!
    const prefix = segs.join('/')
    // 先建目录：只有 index.md 的目录也必须出现在侧栏里（下面不再为它建叶子）
    if (prefix) ensureFolder(prefix)

    if (leafName === 'index') {
      folderIndex.set(prefix, id)
      continue
    }

    const leaf: SidebarNode = { text: titleOf(id), link: `/post/${id}` }
    if (segs.length === 0) {
      root.push(leaf) // docs/ 根目录下的散篇，直接作为顶级叶子
    } else {
      ensureFolder(prefix).items!.push(leaf)
    }
  }

  for (const [prefix, id] of folderIndex) {
    ensureFolder(prefix).link = `/post/${id}`
  }

  const sortNodes = (nodes: SidebarNode[]) => {
    nodes.sort((a, b) => {
      const rank = (n: SidebarNode) => (n.items ? 0 : 1) // 目录(0) 排在 文件(1) 之前
      return rank(a) !== rank(b) ? rank(a) - rank(b) : naturalCompare(a.text, b.text)
    })
    for (const node of nodes) {
      if (node.items) sortNodes(node.items)
    }
  }
  sortNodes(root)
  return root
}

/*
 * id: flattenSidebar
 * fn: DFS 展平派生树，收下所有带 link 的节点（含挂了索引页的分组），
 * 顺序即侧栏顺序 —— 上下篇按它取相邻下标，索引页因此也参与上下篇链条
 */
const flattenSidebar = (nodes: SidebarNode[]): { id: string; title: string; link: string }[] => {
  const out: { id: string; title: string; link: string }[] = []
  const walk = (list: SidebarNode[]) => {
    for (const node of list) {
      if (node.link) {
        // id 即 link 去掉 /post/ 前缀，与 .cache/<id>.vue、route.params.pathMatch 同一套键
        out.push({
          id: node.link.replace(/^\/post\//, ''),
          title: node.text,
          link: node.link,
        })
      }
      if (node.items && node.items.length > 0) walk(node.items)
    }
  }
  walk(nodes)
  return out
}
/*
 * id: compileHome
 * fn: 首页内容源（内容目录顶层 index.md，缺省回退包内模板）→ .cache/home.vue，与文章同一渲染管线，
 *     但不进侧栏树与 post.json（首页不是文章）。源文件不存在时清掉过时产物。
 *     mtime 增量与文章 SFC 同规则：产物不旧于源文件与本脚本则跳过重渲染
 */
const compileHome = (md: InstanceType<typeof MarkdownIt>, pluginMtime: number) => {
  if (!fs.existsSync(homeMdPath)) {
    if (fs.existsSync(homeVuePath)) fs.rmSync(homeVuePath)
    return
  }
  const fresh =
    fs.existsSync(homeVuePath) &&
    fs.statSync(homeVuePath).mtimeMs >= fs.statSync(homeMdPath).mtimeMs &&
    fs.statSync(homeVuePath).mtimeMs >= fs.statSync(scriptPath).mtimeMs &&
    fs.statSync(homeVuePath).mtimeMs >= pluginMtime
  if (fresh) return
  currentPageKey = 'home'
  const rendered = md.render(fs.readFileSync(homeMdPath, 'utf8'))
  fs.writeFileSync(homeVuePath, `<template>${rendered}</template>`, 'utf8')
  info('[INFO]:首页内容源已渲染为 .cache/home.vue')
}

/*
 * id: mdParser
 * fn: 解析md，将md的内容和元数据分别写入对应文件
 */
const mdParser = (files: string[]) => {
  const md = initMd()
  configFence(md)
  setupComponentPlugins(md) // 挂载需要自定义 markdown-it 规则的组件（kbd/badge/mark 行内规则）
  const pluginMtime = pluginLatestMtime() // 插件最新 mtime：SFC/home 复用判定共用
  compileHome(md, pluginMtime) // 首页内容源同管线渲染，但不进侧栏树与 post.json

  const articles: Record<string, ArticleMeta> = {}
  // 正文语料：搜索索引的数据源，与 SFC 同一轮遍历顺手产出，不额外读一遍盘
  const corpus: Record<string, string> = {}

  for (const file of files) {
    const id = file.replace(/\.md$/, '') // 把文章名取出来
    const _ = fs.readFileSync(path.join(articlePath, file), 'utf8') // 读取文章内容

    // mtime增量：SFC产物存在且不旧于源文件与本编译脚本 → 跳过重渲染，直接复用
    // 必须比对脚本自身 mtime：脚本逻辑（如渲染规则）变更后，旧 SFC 是按旧逻辑生成的，
    // mtime 再新也不能复用 —— 此前 v-pre 修复后旧产物被复用导致二次失败，就是这个漏洞
    const sfcPath = path.join(vuePath, `${id}.vue`)
    const sfcMtimeOk =
      fs.existsSync(sfcPath) &&
      fs.statSync(sfcPath).mtimeMs >= fs.statSync(path.join(articlePath, file)).mtimeMs &&
      fs.statSync(sfcPath).mtimeMs >= fs.statSync(scriptPath).mtimeMs &&
      fs.statSync(sfcPath).mtimeMs >= pluginMtime
    const sfcFresh = sfcMtimeOk

    if (!sfcFresh) {
      currentPageKey = id // 换页：分节面板的页内组序号随页归零
      const rendered = md.render(_) // 直接把文章内容转义为HTML（无 frontmatter，全文即正文）
      const vue = `<template>${rendered}</template>` // 把文章内容拼接成vue的HTML块
      fs.mkdirSync(path.dirname(sfcPath), { recursive: true })
      fs.writeFileSync(sfcPath, vue, 'utf8') // 把拼接好的块写入对应文件
    }

    // 无 frontmatter：title 由 id 推导（目录索引页取目录名，见 titleOf），updated 取源文件 mtime
    articles[id] = {
      title: titleOf(id),
      updated: mtimeToDate(file),
    }
    corpus[id] = toPlainText(_)
  }

  // 正文语料落盘：theme 侧搜索按需动态 import 这一份（不进主包）
  fs.writeFileSync(searchPath, JSON.stringify(corpus), 'utf8')

  // ---- 侧栏树：由扫盘结果派生，同一棵树既写盘供 theme 读，又用于推导上下篇 ----
  // 单一事实源：侧栏顺序 = 上下篇顺序，不存在配置与目录两处打架的可能
  const sidebarTree = deriveSidebar(files)
  ensureJsonDir() // 本函数首个写入点，父目录在这里兜底（jsonPathChecker 可能因短路未执行）
  fs.writeFileSync(sidebarPath, JSON.stringify(sidebarTree, null, 4), 'utf8')

  // 按派生树的展平顺序为每篇文章算 prev/next，写进 articles 元数据
  const flat = flattenSidebar(sidebarTree)
  for (let i = 0; i < flat.length; i++) {
    // noUncheckedIndexedAccess 下 flat[i] 判为可能 undefined，先取出再做空值收敛
    const cur = flat[i]
    if (!cur) continue
    const target = articles[cur.id]
    if (!target) continue // 理论上不会命中，兜一层以防派生树与 articles 不同源
    const prev = i > 0 ? (flat[i - 1] ?? null) : null
    const next = i < flat.length - 1 ? (flat[i + 1] ?? null) : null
    target.prev = prev ? { title: prev.title, link: prev.link } : null
    target.next = next ? { title: next.title, link: next.link } : null
  }

  fs.writeFileSync(jsonPath, JSON.stringify(articles, null, 4), 'utf8')
  return articles
}

/*
 * id: manager
 * fn: 集中管理编译流程：路径检查 → 签名短路 → 缓存清理 → 语言配置 → 文章编译
 */
const manager = async () => {
  // 0. 缓存目录必须先建：docs/ 为空时下面会走"清空产物"分支，且 includedRoutes 无条件 readdirSync 它
  fs.mkdirSync(vuePath, { recursive: true })

  // 1. 检查文章文件夹，拿到md文件列表
  const files = articlePathChecker() || []

  // 空文章目录：走"全清"分支。直接 return 会留下已删文章的过时 SFC 和 post.json 残留，
  // 下游 includedRoutes 会照着这些幽灵产物预渲染出已不存在的文章页
  if (files.length === 0) {
    // 空文档目录也要渲染首页内容源（若存在）：首页内容不依赖任何文章
    vuePathChecker(new Set(fs.existsSync(homeMdPath) ? ['home'] : []))
    if (fs.existsSync(homeMdPath)) {
      await configLanguage([homeMdPath])
      const md = initMd()
      configFence(md)
      setupComponentPlugins(md)
      compileHome(md, pluginLatestMtime())
    }
    ensureJsonDir()
    fs.writeFileSync(jsonPath, '{}', 'utf8')
    fs.writeFileSync(searchPath, '{}', 'utf8')
    fs.writeFileSync(sidebarPath, '[]', 'utf8')
    syncPostMeta()
    syncSidebarMeta()
    syncSiteConfig() // 空文档分支同样要补建 site.json，否则 theme 读不到配置产物
    fs.writeFileSync(path.join(vuePath, '.compile-sig.pending'), compileSignature([]), 'utf8')
    return
  }
  // 输入签名比对：正式签名（上次构建成功后落盘）与 pending 签名（本轮第一次 buildStart 写入）
  // 均可触发短路 —— 前者对应无改动重跑，后者对应同一轮构建的第二次 buildStart（客户端+服务端各一次）
  const sig = compileSignature(files)
  const sigFile = path.join(vuePath, '.compile-sig')
  const pendingFile = path.join(vuePath, '.compile-sig.pending')
  const readIfExists = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '')
  // 产物完整性：post.json / search.json 任一缺失都不短路，否则被删的产物永远不会被重建
  // （search.json 是搜索的语料来源，缺了搜索会静默退化成仅标题匹配）
  const artifactsOk = fs.existsSync(jsonPath) && fs.existsSync(searchPath)
  if (artifactsOk && (readIfExists(sigFile) === sig || readIfExists(pendingFile) === sig)) {
    info('[INFO]:输入未变,短路复用.cache编译缓存')
    syncPostMeta() // .cache 被清时补建可 import 副本，保证 SSR 每次构建都读得到
    syncSidebarMeta() // 侧栏副本同理：短路时也要保证 .cache/sidebar.json 存在
    syncSiteConfig() // 配置产物同样补建：短路分支也要保证 site.json 存在
    return
  }
  // 2. 检查缓存与元数据文件路径（清除已删除文章的过时产物）
  // home 产物不在文章扫盘范围：顶层 index.md 存在时显式保留，避免被当过时产物清掉
  const ids = new Set(files.map((f) => f.replace(/\.md$/, '')))
  if (fs.existsSync(homeMdPath)) ids.add('home')
  vuePathChecker(ids)
  jsonPathChecker()
  // 3. 初始化 shiki 高亮器（扫描文档中用到的语言，按需加载；首页内容源一并扫描）
  const langFiles = files.map((f) => path.join(articlePath, f))
  if (fs.existsSync(homeMdPath)) langFiles.push(homeMdPath)
  await configLanguage(langFiles)
  // 4. 配置markdown-it并编译文章（编译期完成 shiki 高亮，运行时无需再处理）
  mdParser(files)
  syncPostMeta() // 复制为可 import 的同源副本，供 PostUpdate / search 读元数据
  syncSidebarMeta() // 侧栏产物同理，供 theme 侧侧栏同步读
  syncSiteConfig() // 站点配置写进 .cache/site.json，theme 内同步读
  // 只写 pending：此刻仅是 buildStart 完成，vite 打包与 SSG 渲染尚未发生，构建不算成功。
  // 转正由 vite.config.ts 负责 —— build 走 onFinished、dev 走 buildStart（详见 finalizeSignature）；
  // 本轮中途抛错时不会转正，正式签名保持旧值，下次不会短路，全部重来
  fs.writeFileSync(pendingFile, sig, 'utf8')
}

/*
 * id: finalizeSignature
 * fn: pending 签名转正，由两处调用：构建成功后引擎 vite 配置的 onFinished，
 * 以及 dev 编译完成后引擎 compile-articles 插件的 buildStart（dev 到不了 onFinished）。
 * 转正后正式签名即描述磁盘上那份产物，输入回退到旧状态时才不会误判短路
 */
export const finalizeSignature = (ctx: BuildContext) => {
  const cacheDir = path.join(ctx.workDir, '.cache')
  const pendingFile = path.join(cacheDir, '.compile-sig.pending')
  const sigFile = path.join(cacheDir, '.compile-sig')
  if (fs.existsSync(pendingFile)) {
    fs.copyFileSync(pendingFile, sigFile)
  }
}

/*
 * id: compileArticles
 * fn: 编译入口。绑定本轮 BuildContext 后交给 manager；
 * 由引擎 compile-articles 插件在 buildStart 调用
 */
export const compileArticles = async (ctx: BuildContext) => {
  bindContext(ctx)
  await manager()
}

export default compileArticles
