// 编译期脚本：docs/*.md → .cache/*.vue（正文 SFC）+ public/config/post.json（元数据）
// 并把 post.json 原样复制为 .cache/post.json（可import 同源副本，供 PostUpdate / search 读元数据）
// 由 vite buildStart 调用。
//
// 职责边界：编译期做「md → html」、「解析元数据」与「由目录结构派生侧栏树」三件事。
// 侧栏树不再手写配置 —— 由 docs/ 的目录结构派生（见 deriveSidebar）：分组即目录、同级自然序，
// 新增/改名文档后侧栏自动跟随。同一棵树既产出 .cache/sidebar.json，又用于推导上下篇。
//
// 写作组件已插件化（src/build/plugins/）：fence 组件（mermaid/timeline/steps/tabs/links/gallery）
// 与容器组件（:::tip/info/warn/error 提示块）各自独立成插件，registry.ts 统一登记；
// 新增组件 = 加一个插件文件 + 在 registry 登记一行，本脚本不再改动。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARTICLE_DIR, MAX_DEPTH } from '../config/site.config.ts'

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
import { componentPlugin } from '@mdit-vue/plugin-component'
import { slugify } from '@mdit-vue/shared'
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

// 扫盘最大层级：docs/ 下的第一层目录算第 1 级，超出深度的分支整体不纳入编译
// （侧栏树同源于该扫描结果，超出深度的分支同样不进侧栏）

// 脚本文件路径 → 项目根路径 → 各产物路径
const scriptPath = fileURLToPath(import.meta.url)
const dirPath = path.dirname(scriptPath)
const rootPath = path.resolve(dirPath, '../..')
const articlePath = path.join(rootPath, ARTICLE_DIR)
const vuePath = path.join(rootPath, '.cache')
const jsonPath = path.join(rootPath, 'public/config/post.json')
const postMetaPath = path.join(vuePath, 'post.json')
const sidebarPath = path.join(rootPath, 'public/config/sidebar.json')
const sidebarMetaPath = path.join(vuePath, 'sidebar.json')

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
 * 侧栏树改由 docs/ 目录结构派生后，不再需要单独掺入配置文件：文件的增删改已由下面的
 * files 列表覆盖（新增目录 = 新增文件），所以只改目录结构也一定会让签名变化。
 *
 * 组件插件化后还必须掺入 plugins/ 下所有插件文件：只改组件外壳而 docs/ 未动时，
 * 签名若不变就会短路复用缓存，新组件产物永远不会生效
 */
const compileSignature = (files: string[]): string => {
  const self = fs.statSync(scriptPath)
  const selfTag = `__self__:${self.mtimeMs}:${self.size}`
  const pluginTags = (() => {
    try {
      const dir = path.join(dirPath, 'plugins')
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.ts'))
        .map((f) => {
          const s = fs.statSync(path.join(dir, f))
          return `__plugin_${f}__:${s.mtimeMs}:${s.size}`
        })
    } catch {
      return ['__plugins__:missing']
    }
  })()
  return [
    selfTag,
    ...pluginTags,
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

/*
 * id: walkDocs
 * fn: 递归扫盘，返回相对 docs/ 的 md 相对路径（统一用 / 分隔，id 即该路径去掉 .md）
 * depth 从 1 起算（docs/ 下的第一层文件/目录算第 1 级），超过 MAX_DEPTH 的分支直接剪掉
 */
const walkDocs = (dir: string, prefix: string, depth: number, out: string[]) => {
  if (depth > MAX_DEPTH) {
    console.warn(`[WARN]:${prefix} 超过最大层级 ${MAX_DEPTH}，该分支已跳过`)
    return
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // 隐藏文件与 .md 之外的产物一律不进文档树
    if (entry.name.startsWith('.')) continue
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
  console.log('[INFO]:文章文件夹存在')
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
      console.log(`[INFO]:清除过时中间产物${rel}`)
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
      console.log('[INFO]:vue文件夹存在')
      vuePathCleaner(ids)
    } else {
      fs.mkdirSync(vuePath, { recursive: true })
      if (fs.existsSync(vuePath)) {
        console.log('[INFO]:原路径无vue文件夹,创建文件夹成功')
      } else {
        console.error('[ERR]:原路径无vue文件夹,创建文件夹失败')
      }
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
    if (fs.existsSync(jsonPath)) {
      console.log('[INFO]:post.json存在')
    } else {
      ensureJsonDir()
      fs.writeFileSync(jsonPath, '{}', 'utf8')
      if (fs.existsSync(jsonPath)) {
        console.log('[INFO]:原路径无post.json,创建文件成功')
      } else {
        console.error('[ERR]:原路径无post.json,创建文件失败')
      }
    }
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
 * fn: 把 src/config/site.ts 全量写进 .cache/site.json——站点配置编译期写死进产物，
 * theme 内不再 import 配置源文件，统一从这份产物同步读（SSG 预渲染和客户端一致）
 * 改配置后需重新构建才生效（开发模式不热更新配置）
 */
const syncSiteConfig = () => {
  const sitePath = path.join(rootPath, 'src/config/site.config.ts')
  if (!fs.existsSync(sitePath)) return
  // 动态 import 会引入异步复杂度，配置是纯常量导出，用 Function 构造器同步求值
  const mod = fs.readFileSync(sitePath, 'utf8')
  const exports: Record<string, unknown> = {}
  // 提取全部 export const 声明：export const NAME = value → exports[NAME] = value
  const re = /export\s+const\s+(\w+)\s*=\s*(`[^`]*`|'[^']*'|"[^"]*"|\[[\s\S]*?\]|[^\n]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(mod)) !== null) {
    const name = m[1]!
    const raw = m[2]!.trim()
    try {
      // 模板字符串/数组/对象字面量用 Function 求值；纯字符串也走这里统一处理
      // eslint-disable-next-line no-new-func
      exports[name] = new Function(`return (${raw})`)()
    } catch {
      console.warn(`[WARN]:配置 ${name} 求值失败，已跳过`)
    }
  }
  fs.writeFileSync(path.join(vuePath, 'site.json'), JSON.stringify(exports, null, 4), 'utf8')
  console.log('[INFO]:站点配置已写入 .cache/site.json')
}

/*
 * id: configLanguage
 * fn: 遍历md，扫描代码块，每遇到一种语言，集合追加这门，组件语言排除，按需加载
 */
const configLanguage = async (files: string[]) => {
  const langSet = new Set<string>(['text'])
  for (const file of files) {
    const _ = fs.readFileSync(path.join(articlePath, file), 'utf-8')
    for (const i of _.matchAll(/^```([\w+-]+)/gm)) {
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
    const componentHtml = renderComponentFence(
      { escapeHtml: md.utils.escapeHtml, toolbar, splitRow },
      lang,
      token.content,
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
 *  - id 按 / 切段，中间段是目录 → 分组节点（无 link，纯折叠容器），末段是文件 → 叶子节点
 *  - 叶子 text 取文件名去 .md，与 post.json 的 title 推导（id.split('/').pop()）一致，
 *    保证侧栏、上下篇、搜索三处显示同一个名字
 *  - 分组 text 取目录名原样（目录名即章节名，不做映射）
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

  for (const file of files) {
    const id = file.replace(/\.md$/, '')
    const segs = id.split('/')
    const leafName = segs.pop()!
    const leaf: SidebarNode = { text: leafName, link: `/post/${id}` }
    if (segs.length === 0) {
      root.push(leaf) // docs/ 根目录下的散篇，直接作为顶级叶子
    } else {
      ensureFolder(segs.join('/')).items!.push(leaf)
    }
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
 * fn: DFS 展平派生树，只收有 link 的叶子，顺序即侧栏顺序 —— 上下篇按它取相邻下标
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
 * id: mdParser
 * fn: 解析md，将md的内容和元数据分别写入对应文件
 */
const mdParser = (files: string[]) => {
  const md = initMd()
  configFence(md)
  setupComponentPlugins(md) // 挂载容器语法的组件插件（:::tip/info/warn/error 提示块）

  const articles: Record<string, ArticleMeta> = {}

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
      fs.statSync(sfcPath).mtimeMs >= fs.statSync(scriptPath).mtimeMs
    const sfcFresh = sfcMtimeOk

    if (!sfcFresh) {
      const rendered = md.render(_) // 直接把文章内容转义为HTML（无 frontmatter，全文即正文）
      const vue = `<template>${rendered}</template>` // 把文章内容拼接成vue的HTML块
      fs.mkdirSync(path.dirname(sfcPath), { recursive: true })
      fs.writeFileSync(sfcPath, vue, 'utf8') // 把拼接好的块写入对应文件
    }

    // 无 frontmatter：title 从文件名末段推导，updated 从源文件 mtime 推导
    articles[id] = {
      title: id.split('/').pop() || id,
      updated: mtimeToDate(file),
    }
  }

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
    vuePathChecker(new Set())
    ensureJsonDir()
    fs.writeFileSync(jsonPath, '{}', 'utf8')
    fs.writeFileSync(sidebarPath, '[]', 'utf8')
    syncPostMeta()
    syncSidebarMeta()
    fs.writeFileSync(path.join(vuePath, '.compile-sig.pending'), compileSignature([]), 'utf8')
    return
  }
  // 输入签名比对：正式签名（上次构建成功后落盘）与 pending 签名（本轮第一次 buildStart 写入）
  // 均可触发短路 —— 前者对应无改动重跑，后者对应同一轮构建的第二次 buildStart（客户端+服务端各一次）
  const sig = compileSignature(files)
  const sigFile = path.join(vuePath, '.compile-sig')
  const pendingFile = path.join(vuePath, '.compile-sig.pending')
  const readIfExists = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '')
  // 产物完整性：post.json 缺失时不短路，否则被删的产物永远不会被重建
  const postJsonExists = fs.existsSync(jsonPath)
  if (postJsonExists && (readIfExists(sigFile) === sig || readIfExists(pendingFile) === sig)) {
    console.log('[INFO]:输入未变,短路复用.cache编译缓存')
    syncPostMeta() // .cache 被清时补建可 import 副本，保证 SSR 每次构建都读得到
    syncSidebarMeta() // 侧栏副本同理：短路时也要保证 .cache/sidebar.json 存在
    syncSiteConfig() // 配置产物同样补建：短路分支也要保证 site.json 存在
    return
  }
  // 2. 检查缓存与元数据文件路径（清除已删除文章的过时产物）
  const ids = new Set(files.map((f) => f.replace(/\.md$/, '')))
  vuePathChecker(ids)
  jsonPathChecker()
  // 3. 初始化 shiki 高亮器（扫描文档中用到的语言，按需加载）
  await configLanguage(files)
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
 * fn: pending 签名转正，由两处调用：构建成功后 vite.config.ts 的 onFinished，
 * 以及 dev 编译完成后 vite.config.ts 的 buildStart（dev 到不了 onFinished）。
 * 转正后正式签名即描述磁盘上那份产物，输入回退到旧状态时才不会误判短路
 */
export const finalizeSignature = () => {
  const pendingFile = path.join(vuePath, '.compile-sig.pending')
  const sigFile = path.join(vuePath, '.compile-sig')
  if (fs.existsSync(pendingFile)) {
    fs.copyFileSync(pendingFile, sigFile)
  }
}

// 直接运行本文件时编译；作为模块被 vite.config 导入时由 buildStart 调用
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  manager()
}

export default () => manager()
