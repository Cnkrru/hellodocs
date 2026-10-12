import type { Component } from 'vue'

/*
 * 文章 chunk 加载：编译产物 .cache/<id>.vue 按路由懒加载，每篇是独立 chunk。
 * 此前 eager: true 会把全部文章（含 KaTeX 海量 MathML 节点）揉进单个 Post 大包（实测 3.3MB），
 * 每打开一篇文章都要下载并执行全站文章代码，是运行时卡顿的根源。
 *
 * 本模块是「文章 id → 加载器」的唯一出处：Post.vue 取它渲染正文，prefetch.ts 取它预热 chunk。
 * id 即 docs/ 相对路径去掉 .md（如 guide/install），与 .cache/<id>.vue、route.params.pathMatch 同键
 */
const loaders = import.meta.glob<{ default: Component }>('/.cache/**/*.vue')

/* 按文章 id 取对应 chunk 加载器；不存在（无效 id）返回 undefined */
export const loadContent = (id: string) => loaders[`/.cache/${id}.vue`]