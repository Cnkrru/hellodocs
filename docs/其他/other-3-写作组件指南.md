# 写作组件指南

本站全部写作组件均为编译期实现：Markdown 源码在构建时被拦截、转换为语义化 HTML，产物零运行时开销（mermaid 除外）。本文档是各组件的语法参考与开发指引。

## 总览

| 分类 | 组件 | 语法形态 |
| --- | --- | --- |
| 容器 | tip / info / warn / error 提示块 | `:::type 标题` |
| 围栏 | timeline / steps / tabs / links / gallery | ```` ```lang ```` |
| 围栏 | filetree / terminal / details / flow | ```` ```lang ```` |
| 围栏 | define / qa / stat / compare / quote | ```` ```lang ```` |
| 行内 | 按键 / 徽章 / 高亮 | `[[x]]` `{{x}}` `==x==` |

**通用约定**

- 围栏组件的行内字段统一用半角竖线 `|` 分隔；字段内需要竖线本身时转义为 `\|`
- 每行一个条目，空行自动忽略
- 组件可自由混排，也可嵌入提示块容器内

## 一、容器组件：提示块

```markdown
:::tip 可选标题
内容走正常 Markdown 渲染，可包含列表、代码、公式等。
:::
```

四种等级：`tip`（提示）、`info`（信息）、`warn`（警告）、`error`（错误）。标题省略时使用默认文案。

## 二、围栏组件

### timeline 时间线

每行『时间 | 标题 | 描述』，描述可省略：

```timeline
2024-03-01 | 项目启动 | 完成需求梳理与技术选型
2024-06-15 | 首个版本 | v0.1 内测版发布
```

### steps 步骤条

每行『标题 | 描述』，序号编译期自动生成：

```steps
拉取代码 | git clone 仓库到本地
安装依赖 | npm install
```

### tabs 标签页

块内用 `== 标签名 ==` 分隔各页，纯 CSS 切换（radio + 兄弟选择器），无 JS。同一组最多 8 个标签：

```tabs
== 安装 ==
npm install
== 构建 ==
npm run build
```

### links 链接卡片

每行『标题 | 描述 | 网址』。仅放行 http/https 链接，其他协议自动降级为纯文本卡（防注入）：

```links
Vue.js | 渐进式 JavaScript 框架 | https://cn.vuejs.org
Vite | 下一代前端构建工具 | https://cn.vite.dev
```

### gallery 图片画廊

每行『图片地址 | 说明』，图片带懒加载，自动复用正文的 medium-zoom 灯箱：

```gallery
/favicon.svg | 站点图标
/og-cover.png | 分享封面
```

### filetree 文件树

用 Markdown 无序列表写法（`-` / `*` / `+`），层级由列表缩进表达，目录名以 `/` 结尾；支持『名称 | 注释』：

```filetree
- src/ | 源码目录
  - build/ | 编译脚本
  - theme/ | 主题
- package.json | 项目配置
```

### terminal 终端窗口

Mac 风格窗口；`$ ` 开头的行按命令渲染（绿色提示符），其余行按输出渲染：

```terminal
$ npm install
added 387 packages in 12s
```

### details 折叠块

块内第一行为标题（summary），其余为折叠内容；原生 `<details>` 标签，无 JS：

```details
为什么组件要走编译期实现？
产物是纯 HTML，首屏无需等待 JS，对 SEO 和无 JS 环境友好。
```

### flow 简易流程

每行『节点 | 可选说明』，节点间自动画向下箭头：

```flow
Markdown 源文件 | docs/ 目录
vite-ssg 预渲染 | 生成静态 HTML
```

### define 定义块

每行『术语 | 释义』，学术笔记风格：

```define
预渲染 | 构建期把每个路由渲染成完整 HTML
Hydration | 产物中残留的少量 JS，用于激活交互
```

### qa 问答块

每行『问题 | 答案』，答案默认折叠（原生 details），适合自测复习：

```qa
时间线组件用什么语法？ | ```timeline 围栏块，每行『时间 | 标题 | 描述』
```

### stat 数据卡

每行『数值 | 说明』，横排自适应：

```stat
14 | 写作组件总数
100% | 编译期完成的渲染
```

### compare 对比双栏

用 `== 栏标题 ==` 分隔两栏（目前支持两栏），栏内每行一个条目：

```compare
== 编译期渲染 ==
首屏无需等待 JS
SEO 友好
== 运行时渲染 ==
依赖浏览器执行
首屏有白屏时间
```

### quote 引用卡

第一行为引用内容；可选第二行『作者 | 出处』：

```quote
任何可以用编译期解决的问题，都不应该留给运行时。
KruDocs 设计原则 | 项目笔记
```

## 三、行内语法

写在正文任意位置（含表格、列表、标题），编译期通过 markdown-it 行内规则替换，不会误伤代码块内的字面量：

| 语法 | 效果 | 适用 |
| --- | --- | --- |
| `[[Ctrl]]` | 键盘按键 | 快捷键说明 |
| `{{v0.2}}` | 小徽章 | 版本号、状态标签 |
| `==重点==` | 荧光笔高亮 | 强调重点 |

## 四、开发指引：新增一个组件

组件体系是插件化架构，新增组件无需改动编译主流程：

```steps
新建插件 | 在 src/build/plugins/ 下新建文件，实现 ComponentPlugin 契约（base.ts）
登记注册 | 在 registry.ts 的 componentPlugins 数组追加一行
补充样式 | 在 content.css 按 class 约定追加样式
验证 | 写一篇测试文档，执行 npm run build-only 检查产物
```

插件契约要点：

- `fenceLangs`：声明要拦截的围栏语言名；语言扫描与 fence 拦截都靠注册表自动汇总，组件块不会进 shiki 高亮
- `render(ctx, lang, content)`：编译期把块内文本转成 HTML；文本字段统一走 `ctx.escapeHtml` 转义防注入
- `setup(md)`：需要挂 markdown-it 插件的组件（容器语法、行内规则）在此挂载；纯 fence 组件无需实现
- 公共工具在 base.ts：`splitRow`（竖线切分）、`toolbar`（代码块顶栏）

## 五、注意事项

:::warn
- tabs 面板内容是整体转义的纯文本（保留换行），不支持面板内再嵌套组件
- 组件产物均带 `v-pre`，Vue 不会二次解析其中的插值语法，字段里可以放心写 `{{ }}`
- 行内语法定界符后不能紧跟空格，`[[ 内容 ]]` 这种写法不会被识别
:::
