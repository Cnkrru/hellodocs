/*
 * 文章元数据的单一出处：读编译期产物 .cache/post.json
 *
 * parseArticle 为每篇文章写 { title, updated, prev, next }，侧栏、上下篇、最后编辑时间、
 * 搜索四处都要用它。此前 post.ts 与 search.ts 各写了一份 import.meta.glob，
 * 同一份产物被解析两遍，此处收敛为一处，改契约只需改这里。
 *
 * glob 而非静态 import：首次构建该产物可能尚未生成，glob 返回空对象而非编译报错
 */

export type NavLink = { title: string; link: string }

export type PostMeta = {
  title: string
  /** 由源文件 mtime 推导的 YYYY-MM-DD */
  updated: string
  prev?: NavLink | null
  next?: NavLink | null
}

const metaMap = import.meta.glob<Record<string, PostMeta>>('/.cache/post.json', {
  eager: true,
  import: 'default',
})

/** id（docs/ 相对路径去 .md）→ 元数据 */
export const postMeta: Record<string, PostMeta> = metaMap['/.cache/post.json'] ?? {}
