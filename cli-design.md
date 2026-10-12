**KruDoc 整站生成器 CLI · 详细设计**

---

## 一、目标与范围

目标形态：把当前"自带内容的文档站"改造为 VitePress 式的整站生成器。

- 引擎（编译管线 + 主题 + SSG 装配）打包成可发布的单包
- 用户侧只需提供自己的 `docs/` 与一份 `krudoc.config.ts`
- 命令面：`krudoc dev` / `krudoc build` / `krudoc preview`

本期明确不做（避免范围膨胀）：

- 不做 monorepo 拆分（单包起步，跑通后再谈拆）
- 不做插件生态、多主题、`create` 脚手架
- 不做写作组件语法升级（`::: filetree` 容器是另一条线，不混入）

---

## 二、现状耦合（已核查）

这些是实现时必须解开的点，不是猜测：

- [package.json](file:///d:/__projects/rebuild/krudoc/package.json) 为 `private: true`，无 `bin` / `files` / `exports`，当前不是可发布包
- [parseArticle.ts](file:///d:/__projects/rebuild/krudoc/src/build/parseArticle.ts#L79-L91) 用 `import.meta.url` 推导 `rootPath = path.resolve(dirPath, '../..')`，并把 `docs`、`.cache`、`public/config/post.json`、`public/config/sidebar.json`、`src/theme/views/home.md` 全部写死在这个根下
- [parseArticle.ts](file:///d:/__projects/rebuild/krudoc/src/build/parseArticle.ts#L15) 直接 `import { ARTICLE_DIR, MAX_DEPTH } from '../config/site.config.ts'`，配置是静态导入而非运行时注入
- [vite.config.ts](file:///d:/__projects/rebuild/krudoc/vite.config.ts#L77-L87) 的 `compile-articles` 插件在 `buildStart` 调编译；serve 时调 `finalizeSignature()`
- [vite.config.ts](file:///d:/__projects/rebuild/krudoc/vite.config.ts#L90-L103) 的 `ssgOptions.includedRoutes` 通过 `fileURLToPath(new URL('./.cache', import.meta.url))` 扫当前项目 `.cache` 生成 `/post/{id}` 预渲染路由
- [vite.config.ts](file:///d:/__projects/rebuild/krudoc/vite.config.ts#L104-L160) 的 `ssgOptions.onFinished`：`finalizeSignature()`、修正 `dist/404.html`、读 `public/config/post.json` 生成 sitemap
- 运行时读编译产物：`/.cache/site.json`（[site.ts](file:///d:/__projects/rebuild/krudoc/src/theme/composables/site.ts#L26-L32)）、`/.cache/post.json`（post.ts）、`fetch('/config/post.json')`；路由 `/post/:pathMatch` 的参数来自构建期 `.cache/{id}.vue`（[router/index.ts](file:///d:/__projects/rebuild/krudoc/src/theme/router/index.ts#L2-L10)）
- `vite.config.ts`、`index.html` 都躺在用户（当前=站点）仓库根，属于引擎而非内容

---

## 三、目标架构总览

包内（引擎，用户不可见）：

```
krudoc/
  package.json            # bin / files / exports / deps
  bin/krudoc.mjs          # CLI 入口（薄壳，用 jiti 加载 TS）
  index.html              # 引擎模板入口
  krudoc.config.ts        # 【本仓库自身】站点配置（dogfood）
  src/cli/                # CLI 层
    index.ts              # 命令分发
    config.ts             # 加载/合并/校验用户配置
    paths.ts              # 三根路径模型
    vite.config.ts        # 引擎 vite 配置工厂（编程式）
    dev.ts / build.ts / preview.ts
  src/build/              # 编译管线（parseArticle + plugins）
  src/theme/              # 运行时应用
```

用户项目（只有这两样 + 可选静态资源）：

```
my-site/
  docs/                   # 内容
  krudoc.config.ts        # 站点配置
  public/                 # 可选：自有静态资源
  .krudoc/                # 生成物（gitignore，CLI 自动管理）
```

---

## 四、路径模型——三根

这是整个设计的地基，先定死：

- `PKG_ROOT`：包安装位置，放引擎资源（theme、index.html、plugins）
- `USER_ROOT`：用户项目根（CLI 的 cwd，或 `krudoc dev <dir>` 指定）
- `WORK_DIR`：`<USER_ROOT>/.krudoc`，所有生成物集中于此

关键决策：**Vite root 指向 `WORK_DIR`**。理由——现有主题与路由里大量 `import.meta.glob('/.cache/...')`、`fetch('/config/...json')` 的前导 `/` 是相对 **Vite root** 解析的。把 root 定为 `WORK_DIR`，则 `.cache` 与 `public/config` 落在它下面，**这些 glob 与 URL 一字不用改**，主题侧改动趋近于零。

```ts
// src/cli/paths.ts —— 三根推导，全部锚在 cwd，不再锚在包位置
export const pkgRoot = fileURLToPath(new URL('../..', import.meta.url))
export const userRoot = path.resolve(cwd)                 // 用户项目根
export const workDir = path.join(userRoot, '.krudoc')     // 生成物根 = Vite root
export const cacheDir = path.join(workDir, '.cache')      // → /.cache/*
export const publicDir = path.join(workDir, 'public')     // → publicDir，/config/*.json
```

映射后的一致性：

- `.cache/*.vue` → `/post/{id}` 路由（vite.config 的 walkVue 逻辑原样可用）
- `public/config/*.json` → 运行时 `fetch('/config/post.json')` 原样可用
- 用户 `public/` 内容：启动时并入 `WORK_DIR/public`（一期用拷贝，二期可换中间件）

---

## 五、配置模型

废弃 `src/config/site.config.ts` 作为"站点配置"的角色，改由用户侧 `krudoc.config.ts` 承担；包内只保留**默认值 + 类型 + `defineConfig`**。

```ts
// 用户 krudoc.config.ts —— 只写差异，其余走默认
import { defineConfig } from 'krudoc'

export default defineConfig({
  title: '我的文档',
  description: '……',
  siteUrl: 'https://example.com',   // sitemap / canonical 用
  docsDir: 'docs',                  // 相对 USER_ROOT
  maxDepth: 3,
  repo: { url: 'https://github.com/me/repo', editLink: true },
})
```

- 加载：`jiti`（已在依赖内）运行时加载用户 TS，免去用户预编译
- 合并：`defaults ← user` 浅合并，站点信息 / nav / homeCards 这类结构字段整体覆盖
- 校验：边界处校验（必填 `title`、`docsDir` 存在性），缺关键项直接报错退出，不做静默兜底
- 类型：`KrudocConfig`、`ResolvedConfig` 由包 `exports` 对外暴露，用户获得补全
- 本仓库当前的硬编码站点值 → 搬进仓库根自己的 `krudoc.config.ts`（dogfood）

---

## 六、BuildContext 与编译管线改造

核心：编译管线不再静态 import 配置，改为接收一个显式上下文对象。

```ts
// src/cli/types.ts —— 引擎内部契约，编译期与 CLI 共用
export type BuildContext = {
  userRoot: string
  workDir: string
  articleDir: string      // 绝对路径，= USER_ROOT/docsDir
  maxDepth: number
  homeMdPath: string      // 首页内容源：USER_ROOT/home.md，缺省回退包内模板
  config: ResolvedConfig  // 已合并、已校验
}
```

- `parseArticle.ts`：签名从无参改为 `compileArticles(ctx: BuildContext)`；内部所有 `path.join(rootPath, ...)` 换成 `ctx.workDir` / `ctx.articleDir`；删除 `import ... from '../config/site.config.ts'`；原"解析 site.config.ts → `.cache/site.json`"一步改成"把 `ctx.config` 序列化写 `.cache/site.json`"
- 传递方式：`compile-articles` 插件以 **vite plugin options** 接收 `ctx`（不靠环境变量，显式、可类型化）
- `src/build/plugins/*`：本期无需感知配置，保持只吃 `ctx.escapeHtml` 等既有能力
- 签名缓存：`compileSignature` 掺入 `ctx.config` 的稳定哈希（配置改动也要触发重编译）

---

## 七、CLI 命令面

参数解析用 Node 内置 `node:util` 的 `parseArgs`，零新增依赖（用户偏好标准库）。

```
krudoc dev   [root] [--port 5173] [--config <path>] [--base /]
krudoc build [root] [--outDir dist] [--config <path>] [--base /]
krudoc preview [root] [--port 4173]
```

- 共同前置：定位 `USER_ROOT` → 加载配置 → 构造 `BuildContext` → 确保 `WORK_DIR` 结构
- `dev`：`vite.createServer(engineConfig(ctx))` + `listen`（编程式，不 shell 外调）
- `build`：调 `vite-ssg` 的编程式 `build`，注入 `ssgOptions`（entry / includedRoutes / onFinished / sitemap 全部由工厂生成，路径锚 `ctx`）
- `preview`：`vite preview` 编程式
- 退出码：配置错误/编译错误非 0，便于 CI

---

## 八、包结构（发布面）

```jsonc
// package.json 关键字段
{
  "name": "krudoc",
  "version": "0.1.0",
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/Cnkrru/KruDocs.git" },
  "bin": { "krudoc": "bin/krudoc.mjs" },   // bin 值不能带 ./ 前缀，npm publish 会判非法并移除
  "files": ["bin", "src", "index.html"],   // 一期直接发 TS 源码
  "exports": {
    ".": { "types": "./src/cli/index.ts", "default": "./src/cli/index.ts" },  // defineConfig / 类型
    "./package.json": "./package.json"
  }
  // 移除 "private": true
}
```

- TS 运行时加载：`bin/krudoc.mjs` 用 `jiti` 载入 `src/cli/index.ts`，一期免打包、免 dist；二期若要正式发布再补 esbuild/tsc 预编译
- 依赖分层：`vite-ssg`、`vue`、`vue-router`、`markdown-it` 家族、`shiki`、`jiti` 等由引擎包提供；主题运行时用到的 `mermaid` / `echarts` / `medium-zoom` / `minisearch` 保持按需加载语义不变

---

## 九、逐文件迁移清单

1. `package.json`：去 `private`，加 `bin` / `files` / `exports`，核对 deps（引擎依赖上移）
2. `bin/krudoc.mjs`：新增，薄壳（jiti 加载 + 捕获错误 + 退出码）
3. `src/cli/*`：新增 `index.ts` / `config.ts` / `paths.ts` / `vite.config.ts`（工厂）/ `dev.ts` / `build.ts` / `preview.ts` / `types.ts`
4. `src/config/site.config.ts`：改为"默认值 + `KrudocConfig` 类型 + `defineConfig`"，去掉站点硬编码
5. `krudoc.config.ts`（仓库根）：新增，承载本仓库当前站点配置（dogfood）
6. `src/build/parseArticle.ts`：改 `compileArticles(ctx)`，路径全量改锚 `ctx`，删静态配置 import
7. `vite.config.ts`（仓库根）：内容迁入 `src/cli/vite.config.ts` 工厂；仓库根改留极薄一层（或直接删，dev/build 走 CLI）
8. `index.html`：随包发布；CLI 启动时落到 `WORK_DIR/index.html`
9. `src/theme/**`：理论上零改动（因 Vite root = `WORK_DIR` 保住 `/.cache`、`/config` 语义）；需逐一核对 glob 与 fetch 的字面量
10. `src/theme/views/home.md`：首页内容归用户（默认路径如 `<USER_ROOT>/home.md`，缺省用包内模板）
11. `.gitignore`：追加 `.krudoc/`
12. `README` 或 `krudoc.config.ts` 注释内：给出用户接入三步（装包 / 建 docs / 建 config）

---

## 十、本仓库自身 = 第一个用例

先用本仓库验证，不改内容只换驱动方式：

```jsonc
// 本仓库 package.json scripts 改为
{
  "dev": "krudoc dev",
  "build": "krudoc build"
}
```

跑通即可证明：引擎与内容解耦成立、路径模型正确、主题零改动。之后再考虑把 `docs/` 抽成独立示例仓库做端到端验证。

---

## 十一、风险与验证点

- **`publicDir` 能否指向 `WORK_DIR/public` 且被正确服务**：需实测 dev/build 两条路径
- **index.html 落 `WORK_DIR` 后，`src/theme/main.ts` 的可达性**：靠 alias（`@/` → `PKG_ROOT/src/theme`）+ `server.fs.allow` 放行包目录
- **`server.fs.allow` 与 alias 的边界**：dev 下包外源码被拒绝是常见坑，必须显式放行
- **`.cache` 签名缓存与多项目并发**：生成物在各自 `USER_ROOT/.krudoc`，天然隔离；但需确认 `compileSignature` 的 `scriptPath` 锚点改为包内路径后仍稳定
- **用户 `public/` 并入**：一期拷贝有性能成本，大站点需二期换中间件
- **SSG `onFinished` 里的 `dist/404.html` 修正与 sitemap host**：路径改锚 `USER_ROOT/dist`，host 取 `ctx.config.siteUrl`

---

## 十二、分期落地

1. **骨架期**：`bin` + `paths` + `config` 加载与合并 + 空跑 `dev`
2. **管线期**：`BuildContext` 打通 `parseArticle` 与引擎 vite 工厂，dev 能出页
3. **构建期**：`build`（vite-ssg 编程式）+ `ssgOptions` 全量迁移，产出可访问 dist
4. **收口期**：本仓库切到 CLI 驱动（dogfood）、清理残留、补用户接入文档

---

**关键要点**

1. 地基是"三根"路径模型；**Vite root 指向 `WORK_DIR`** 是让主题零改动的关键决策。
2. 配置从静态 import 改为运行时注入：`krudoc.config.ts`（jiti 加载）+ `BuildContext` 贯穿编译管线。
3. 编译管线签名改为 `compileArticles(ctx)`，所有路径推导锚 `ctx`，不再锚包位置。
4. `vite.config.ts` 从用户侧移入包内，做成工厂，由 CLI 以编程式 API 调用，不 shell 外调。
5. 单包起步、Node `parseArgs` 零依赖、TS 用 jiti 运行时加载，一期不引打包步骤。
6. 用本仓库自身做第一个用例，先证明解耦成立，再谈发布与拆分。
7. 主要风险集中在 `publicDir`、alias + `fs.allow`、index.html 可达性三处，需在骨架期先实测。