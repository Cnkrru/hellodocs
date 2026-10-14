# hello

把 `docs/` 目录编译成整站静态 HTML 的文档站生成器。

```stat
docs/ | 内容目录
Markdown | 写作格式
静态 HTML | 产出形态
```

## 开始写作

```steps
新建文档 | 在 docs/ 下创建 Markdown 文件
层级即侧栏 | 目录结构自动生成侧栏分组，文件名即文章标题
构建站点 | 运行 build 产出静态 HTML
```

```filetree
docs/
  index.md | 目录索引页，标题取目录名
  guide/
    install.md | 二级文档会自动归入 guide 分组
```

## 设计理念

```quote
任何可以用编译期解决的问题，都不应该留给运行时。
hello 设计原则
```

```tip 本页可替换
这是引擎内置的默认首页模板。在你的项目根目录新建 `home.md` 即可覆盖它，改写成你自己的首页内容。
```
