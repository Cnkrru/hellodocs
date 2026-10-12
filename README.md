KruDoc —— 基于 Vue 3 + Vite 的静态文档站生成器。

引擎（编译管线 / 主题 / SSG 装配）随包发布，用户项目只提供 Markdown 内容与一份配置：目录结构即侧栏，`docs/` 增删文件后侧栏与上下篇自动跟随。

---

## 接入三步

第一步，安装。

```sh
npm i -D krudoc
```

第二步，建内容目录 `docs/` 并放入 Markdown 文件。

- 目录层级 = 侧栏分组，同级按文件名自然序
- 文件名末段 = 文章标题；文件 mtime = 「最后编辑」时间
- 路由为 `/post/<相对 docs/ 的路径去掉 .md>`
- 项目根可放 `home.md` 覆盖首页正文，缺省用引擎内置模板

第三步，在项目根建 `krudoc.config.ts`（仅 `title` 必填）。

```ts
import { defineConfig } from 'krudoc'

export default defineConfig({
  title: '我的文档',
  description: '一句话站点简介',
  siteUrl: 'https://example.com', // sitemap / canonical 的绝对地址
  nav: [
    { text: '首页', link: '/' },
    { text: '文档', link: '/post/第一篇' },
  ],
})
```

引擎运行期把生成物写在 `<项目根>/.krudoc/`（中间产物与配置快照），构建产物默认写 `<项目根>/dist/`。两者都建议加进 `.gitignore`。

---

## 命令

```sh
krudoc dev        # 启动开发服务器
krudoc build      # 构建静态站点，产出 dist/
krudoc preview    # 本地预览已构建产物
```

可用选项。

- `--config <path>` 指定配置文件（相对项目根），默认探测 `krudoc.config.ts`
- `--port <number>` dev / preview 端口
- `--base <path>` 部署基础路径，默认 `/`
- `--outDir <dir>` build 产物目录（相对项目根），默认 `dist`
- `-h, --help` 显示帮助

`krudoc <command> [root]` 的 `root` 缺省为当前工作目录，即项目根。

---

## 配置字段

除 `title` 外全部可选，只写与默认值的差异。

- `title` 站点标题，必填
- `description` 站点描述，默认空
- `keywords` 站点关键词，默认空
- `siteUrl` 绝对地址，默认空；留空则不产 sitemap 链接
- `ogImage` 分享封面，默认 `/og-cover.png`（须为 png/jpg）
- `ogImageAlt` 封面替代文本，默认空
- `copyright` 页脚版权，默认空
- `docsDir` 内容目录，相对项目根，默认 `docs`
- `maxDepth` 扫盘最大层级，默认 `6`
- `nav` 顶栏导航 `{ text, link }[]`，默认空
- `homeCards` 首页分类卡片 `{ text, link, desc }[]`，默认空
- `repo` 仓库外链 `{ url, branch, docsDir }`；`url` 留空则文章页不渲染「编辑 / 历史」入口

改配置后需重新编译才生效（开发模式不热更新配置）。

---

## 写作能力

正文除标准 Markdown 外，另有编译期直出的写作组件：提示块（`:::tip/info/warn/error`）、文件树、时间线、步骤、标签页、链接卡片、图库、Mermaid 与 ECharts 等，均为 fence 或容器语法。仅调整样式不涉及这些组件的 JS。

---

## 本仓库开发

本仓库是 KruDoc 的第一个用例（dogfood），`scripts` 已切到 CLI 驱动。

```sh
npm install
npm run dev        # = krudoc dev
npm run build      # = type-check + krudoc build
npm run preview    # = krudoc preview
```

站点实值在仓库根的 [krudoc.config.ts](krudoc.config.ts)，配置契约与默认值在 `src/config/site.config.ts`。打包发布面见 `package.json` 的 `bin` / `files` / `exports`。

---

## 关键要点

1. 用户侧只需 `docs/` + `krudoc.config.ts`，其余全部由引擎提供
2. 命令面为 `krudoc dev` / `build` / `preview`，参数走 Node 内置解析，无额外依赖
3. 生成物落项目根 `.krudoc/`，构建产物默认 `dist/`，均建议 gitignore
4. 侧栏与上下篇由 `docs/` 目录结构派生，无需手写配置
5. 配置改后要重新编译，开发模式不热更新配置
6. 本仓库用 CLI 自我驱动，改动引擎后旧文章缓存会自动失效