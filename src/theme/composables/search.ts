import { ref, watch } from 'vue'
import MiniSearch from 'minisearch'
import { getRouter } from '@/router'

/* ====================<search>==================== */
type SearchDoc = { id: string; title: string; date: string; tags: string[] }
type PostMeta = { title?: string; updated?: string; tags?: string[] }

export const RefKeyword = ref('')
export const RefSearchRes = ref<SearchDoc[]>([])
export const searchOpen = ref(false)

let miniSearch: MiniSearch<SearchDoc> | null = null
let buildFlag = false

// 元数据：.cache/post.json 是构建期从 public/config/post.json 复制的可 import 同源副本
// 用 import.meta.glob 而非静态 import —— 文章为空时该文件不生成，glob 返回空对象而非编译报错
const metaMap = import.meta.glob<Record<string, PostMeta>>('/.cache/post.json', {
  eager: true,
  import: 'default',
})

// 分词：中文按 2-gram 切，英文数字按分隔符切
const slicer = (text: string) => {
  const words = String(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  const tokens = new Set(words)
  words.forEach((w) => {
    if (/[\u4e00-\u9fff]/.test(w) && w.length > 1) {
      for (let i = 0; i < w.length; i++) {
        tokens.add(w.slice(i, i + 2))
      }
    }
  })
  return [...tokens]
}

// 建索引：数据源是构建期写入的 .cache/post.json，import 即得，不走运行时请求
export const buildIndex = () => {
  if (buildFlag) return

  try {
    const postMeta = metaMap['/.cache/post.json'] ?? {}
    // krudoc 的 post.json 无 date 字段（parseArticle 只派生 title/updated），
    // 时间取 updated（源文件 mtime 推导），按时间倒序取全部文章
    const docs: SearchDoc[] = Object.entries(postMeta)
      .map(([id, m]) => ({ id, title: m.title || id, date: m.updated || '', tags: m.tags || [] }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))

    miniSearch = new MiniSearch<SearchDoc>({
      fields: ['title', 'tags', 'date'], // 参与检索的字段
      storeFields: ['id', 'title', 'date', 'tags'], // 检索结果里返回的字段
      tokenize: slicer, // 中文分词
      searchOptions: {
        boost: { title: 3, tags: 2, date: 1 }, // 标题权重最高
        fuzzy: 0.2, // 容错匹配
        prefix: true, // 允许前缀匹配
        combineWith: 'OR', // 多个 token 命中任一即可，提升召回
      },
    })
    miniSearch.addAll(docs)
    buildFlag = true
    console.info('[INFO]:minisearch初始化完成')
  } catch {
    console.error('[ERR]:miniSearch初始化失败')
  }
}

// 检索
const assembler = (key: string) => {
  const q = key.trim()
  if (!q || !miniSearch) {
    RefSearchRes.value = []
    return
  }
  // SearchResult 靠索引签名携带 storeFields，显式提取字段映射回 SearchDoc 契约
  RefSearchRes.value = miniSearch
    .search(q)
    .slice(0, 10)
    .map((r) => ({
      id: String(r.id),
      title: r.title as string,
      date: r.date as string,
      tags: (r.tags as string[]) || [],
    }))
}

// 结果清空
const clearRes = () => {
  RefSearchRes.value = []
}

// 输入清空：keyword、结果、面板一次性复位（点击结果/清除按钮后调用）
export const resetSearch = () => {
  RefKeyword.value = ''
  clearRes()
  searchOpen.value = false
}

// 输入联动：空输入收起面板，非空则检索并展开（Search.vue 只做 v-model 绑定）
watch(RefKeyword, (v) => {
  const q = v.trim()
  if (!q) {
    clearRes()
    searchOpen.value = false
    return
  }
  assembler(q)
  searchOpen.value = true
})

// 高亮命中片段：keyword 前后内容分别转义后回填高亮标签
const escMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
export const searchHl = (text: string, kw: string) => {
  const s = String(text ?? '')
  const k = (kw || '').trim()
  const esc = (str: string) => str.replace(/[&<>"']/g, (c) => escMap[c] ?? c)
  if (!k) return esc(s)
  const i = s.toLowerCase().indexOf(k.toLowerCase())
  if (i === -1) return esc(s)
  return (
    esc(s.slice(0, i)) +
    '<mark>' +
    esc(s.slice(i, i + k.length)) +
    '</mark>' +
    esc(s.slice(i + k.length))
  )
}

/* ====================<search UI 交互>==================== */
// 点击结果：跳转文章页并复位搜索状态（router 实例由 main.ts 注入）
export const go = (id: string) => {
  getRouter()?.push(`/post/${id}`)
  resetSearch()
}

export const onEnter = () => {
  const first = RefSearchRes.value[0]
  if (first) go(first.id)
}

export const onFocus = () => {
  if (RefKeyword.value.trim()) searchOpen.value = true
}

const onClickOutside = (e: MouseEvent) => {
  if (!(e.target as HTMLElement).closest('.search-wrap')) searchOpen.value = false
}

// 挂载/卸载：注册全局点击监听，Search.vue 生命周期调用
export const mountSearch = () => {
  document.addEventListener('click', onClickOutside)
}
export const unmountSearch = () => {
  document.removeEventListener('click', onClickOutside)
}
