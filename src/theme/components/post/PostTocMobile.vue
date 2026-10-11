<script setup lang="ts">
import { headings, jump } from '../../composables/post.ts'
/*
 * 移动端目录：正文顶部的折叠块（原生 details，无 JS 依赖的展开/收起）。
 * 数据与 PostToc 同一份 headings（composables 的扫描结果），
 * 仅 ≤768px 显示（样式断点控制），桌面端由右侧常驻目录承担。
 */
const onJump = (id: string, e: MouseEvent) => {
  jump(id)
  // 点完自动收起：details 根元素去掉 open 即折叠
  ;(e.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')
}
</script>

<template>
  <details v-if="headings.length" class="toc-mobile">
    <summary>本页目录</summary>
    <nav class="toc-mobile-list">
      <p
        v-for="h in headings"
        :key="h.id"
        class="toc-item"
        :style="{ paddingLeft: (h.level - 1) * 14 + 'px' }"
        @click="onJump(h.id, $event)"
      >
        {{ h.text }}
      </p>
    </nav>
  </details>
</template>

<style scoped>
/* 桌面端隐藏：≤768px 由下方媒体查询显示 */
.toc-mobile {
  display: none;
}
@media (max-width: 768px) {
  .toc-mobile {
    display: block;
    margin: 0 0 var(--space-md);
    border: 1px solid color-mix(in srgb, var(--g-color) 20%, transparent);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .toc-mobile > summary {
    padding: 8px 14px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    list-style: none;
    user-select: none;
    background: color-mix(in srgb, var(--g-color) 6%, transparent);
    color: color-mix(in srgb, var(--g-text) 75%, transparent);
  }
  .toc-mobile > summary::before {
    content: '▸';
    display: inline-block;
    margin-right: 8px;
    color: var(--g-color);
    transition: transform 0.2s;
  }
  .toc-mobile[open] > summary::before {
    transform: rotate(90deg);
  }
  .toc-mobile-list {
    padding: 6px 14px;
    border-top: 1px solid color-mix(in srgb, var(--g-color) 15%, transparent);
    max-height: 50vh;
    overflow-y: auto;
  }
  .toc-item {
    margin: 1px 0;
    padding: 4px 0;
    font-size: 13px;
    line-height: 1.5;
    color: color-mix(in srgb, var(--g-text) 65%, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }
  .toc-item:hover {
    color: var(--g-color);
  }
}
</style>
