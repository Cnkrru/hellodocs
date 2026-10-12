<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { root, codeCopy, imgBox, mermaid, echarts } from '../../composables/post.ts'

// 高亮已在编译期完成（parseArticle.ts 的 shiki），运行时只需图片灯箱和 mermaid/echarts。
// 三者按需加载：页面无图/无对应块时零开销（mermaid 全家族约 1MB+，不应每篇都背）。
// SPA 切文章时本组件不重挂，onMounted 只跑一次，故用 MutationObserver 监听正文子树，
// 让新注入的图片/图表重新初始化（各函数内部有幂等守卫，不会自触发死循环）
let contentObserver: MutationObserver | null = null

const initContent = () => {
  if (root.value?.querySelector('img:not([data-zoom-bound])')) imgBox()
  if (root.value?.querySelector('pre[data-lang="mermaid"] code:not([data-rendered])')) mermaid()
  if (root.value?.querySelector('pre[data-lang="echarts"] code:not([data-rendered])')) echarts()
}

onMounted(() => {
  initContent()
  contentObserver = new MutationObserver(initContent)
  if (root.value) contentObserver.observe(root.value, { childList: true, subtree: true })
})

onUnmounted(() => {
  contentObserver?.disconnect()
  contentObserver = null
})
</script>

<template>
  <div ref="root" class="content" @click="codeCopy">
    <slot />
  </div>
</template>

<style scoped></style>