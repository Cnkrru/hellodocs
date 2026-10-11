<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { headings, jump } from '@/composables/post'
import { sidebarOpen, toggleSidebarOpen } from '@/composables/sidebar'

/*
 * 移动端本地导航条（对齐 VitePress 的 VPLocalNav）：
 * 顶栏里的第二行 —— 左侧「菜单」开侧栏抽屉，右侧「本页目录」下拉章节列表。
 *
 * 之所以放进 header 而不是正文里：header 自身就是 sticky，本行随之吸顶，
 * 不必再去估算顶栏的实际高度（手机端顶栏允许换行，高度并不固定）。
 * 仅 ≤768px 显示；桌面端侧栏与右侧目录常驻，不需要这条。
 */
const tocOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const onJump = (id: string) => {
  jump(id)
  tocOpen.value = false
}

/* 下拉是绝对定位浮层，没有抽屉那样的遮罩，点条外任意处自行收起 */
const onDocClick = (e: MouseEvent) => {
  if (tocOpen.value && rootRef.value && !rootRef.value.contains(e.target as Node)) {
    tocOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="rootRef" class="local-nav">
    <button
      class="ln-btn"
      :aria-expanded="sidebarOpen"
      aria-label="打开导航菜单"
      @click="toggleSidebarOpen"
    >
      <svg class="ln-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      <span>菜单</span>
    </button>

    <button
      v-if="headings.length"
      class="ln-btn ln-toc"
      :class="{ open: tocOpen }"
      :aria-expanded="tocOpen"
      aria-label="本页目录"
      @click="tocOpen = !tocOpen"
    >
      <span>本页目录</span>
      <svg class="ln-icon ln-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>

    <nav v-if="tocOpen" class="ln-panel">
      <p
        v-for="h in headings"
        :key="h.id"
        class="ln-item"
        :style="{ paddingLeft: 12 + (h.level - 1) * 14 + 'px' }"
        @click="onJump(h.id)"
      >
        {{ h.text }}
      </p>
    </nav>
  </div>
</template>

<style scoped>
/* 桌面端隐藏：≤768px 由下方媒体查询显示 */
.local-nav {
  display: none;
}

@media (max-width: 768px) {
  /* 自成一行：占满顶栏整行宽（顶栏在 ≤768px 允许换行） */
  .local-nav {
    display: flex;
    flex: 1 1 100%;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    /* 作为下拉面板的定位参照 */
    position: relative;
    padding: 4px 0;
    border-top: 1px solid color-mix(in srgb, var(--g-color) 12%, transparent);
  }

  /* 文字 + 图标的轻量按钮，与顶栏图标同一套视觉语言 */
  .ln-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: color-mix(in srgb, var(--g-text) 70%, transparent);
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .ln-btn:hover {
    color: var(--g-color);
    background: color-mix(in srgb, var(--g-color) 8%, transparent);
  }

  .ln-icon {
    display: block;
    width: 16px;
    height: 16px;
  }

  /* 展开时箭头翻转，提示面板已打开 */
  .ln-caret {
    transition: transform 0.2s ease;
  }

  .ln-toc.open .ln-caret {
    transform: rotate(180deg);
  }

  /* ---- 目录面板：绝对定位浮层，贴导航条下方展开 ---- */
  .ln-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 60vh;
    overflow-y: auto;
    box-sizing: border-box; /* 无全局 border-box 重置，须显式声明，否则 padding 会把滚动区撑破 max-height */
    /* 上下留白：滚动条不贴面板顶/底边 */
    padding: var(--space-xs) 0;
    background: color-mix(in srgb, var(--g-bg) 96%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid color-mix(in srgb, var(--g-color) 15%, transparent);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px var(--g-shadow);
  }

  .ln-item {
    margin: 1px 0;
    padding: 6px var(--space-sm);
    font-size: 13px;
    line-height: 1.5;
    color: color-mix(in srgb, var(--g-text) 72%, transparent);
    border-radius: var(--radius-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .ln-item:hover {
    color: var(--g-color);
    background: color-mix(in srgb, var(--g-color) 8%, transparent);
  }
}
</style>