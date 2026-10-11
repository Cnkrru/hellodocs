<script setup lang="ts">
import { onMounted } from 'vue'
import { root, codeCopy, imgBox, mermaid, echarts } from '../../composables/post.ts'

onMounted(() => {
  // 高亮已在编译期完成（parseArticle.ts 的 shiki），运行时只需图片灯箱和 mermaid。
  // 两者按需加载：页面无图/无 mermaid 块时零开销（mermaid 全家族约 1MB+，不应每篇都背）
  if (root.value?.querySelector('.content img, img')) imgBox()
  if (root.value?.querySelector('pre[data-lang="mermaid"] code')) mermaid()
  if (root.value?.querySelector('pre[data-lang="echarts"] code')) echarts()
})
</script>

<template>
  <div ref="root" class="content" @click="codeCopy">
    <slot />
  </div>
</template>

<style scoped></style>
