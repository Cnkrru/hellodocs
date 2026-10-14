import { ref, watch } from 'vue'
import MiniSearch from 'minisearch'

import { getRouter } from '@/router'
import { postMeta } from './meta'

/* ====================<search>==================== */
type SearchDoc = { id: string; title: string; updated: string; text: string }

export const RefKeyword = ref('')
export const RefSearchRes = ref<Omit<SearchDoc, 'text'>[]>([])
export const searchOpen = ref(false)

let miniSearch: MiniSearch<SearchDoc> | null = null
let indexBuilt = false

/*
 * 正文语料：.cache/search.json（parseArticle 从 md 源码提取的纯文本），按 id 索引。
 *
 * 不并进 post.json —— post.json 被多个模块 eager import（会进主包），塞进 224 篇正文
 * 会把首屏体积顶上去。这里用非 eager 的 glob 拿到动态 import 加载器，
 * 首次检索时才拉取，独立成 chunk；MiniSearch 的索引也在那时才构建。
 */
const textLoaders = import.meta.glob<Record<string, string>>('/.cache/search.json', {
  import: 'default',
})

let corpusPromise: Promise<Record<string, string>> | null = null

const loadCorpus = (): Promise<Record<string, string>> => {
  if (corpusPromise) return corpusPromise
  corpusPromise = (async () => {
    const loader = textLoaders['/.cache/search.json']
    // 产物缺失（如 docs/ 为空）时按空语料处理，搜索降级为仅标题匹配，不打断页面
    if (!loader) return {}
    try {
      return (await loader()) ?? {}
    } catch {
      console.error('[ERR]:正文语料加载失败，搜索降级为仅标题匹配')
      return {}
    }
  })()
  return corpusPromise
}

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

/*
 * 建索引：标题 + 正文纯文本都进检索字段；正文语料按需异步加载，故本函数是 async。
 * Search.vue 在 onMounted 里 await 它；未就绪期间检索返回空结果（组装器有 null 守卫）
 */
export const buildIndex = async () => {
  if (indexBuilt) return
  try {
    const corpus = await loadCorpus()
    // 时间取 updated（源文件 mtime 推导），按时间倒序取全部文章
    const docs: SearchDoc[] = Object.entries(postMeta)
      .map(([id, m]) => ({
        id,
        title: m.title || id,
        updated: m.updated || '',
        text: corpus[id] ?? '',
      }))
      .sort((a, b) => (a.updated < b.updated ? 1 : -1))

    miniSearch = new MiniSearch<SearchDoc>({
      fields: ['title', 'text'], // 参与检索的字段
      // storeFields 不含 text：语料只用于打分，随结果回传会把长文本塞进每一行结果
      storeFields: ['id', 'title', 'updated'],
      tokenize: slicer, // 中文分词
      searchOptions: {
        boost: { title: 3 }, // 标题权重高于正文
        fuzzy: 0.2, // 容错匹配
        prefix: true, // 允许前缀匹配
        combineWith: 'OR', // 多个 token 命中任一即可，提升召回
      },
    })
    miniSearch.addAll(docs)
    indexBuilt = true
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
  // SearchResult 靠索引签名携带 storeFields，显式提取字段映射回对外契约
  RefSearchRes.value = miniSearch
    .search(q)
    .slice(0, 10)
    .map((r) => ({
      id: String(r.id),
      title: r.title as string,
      updated: r.updated as string,
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
