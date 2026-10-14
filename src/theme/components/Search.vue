<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  RefKeyword,
  RefSearchRes,
  searchOpen,
  buildIndex,
  go,
  resetSearch,
  searchHl,
  onEnter,
  onFocus,
  mountSearch,
  unmountSearch,
} from '@/composables/search'

/*
 * 索引按需构建：正文语料是独立 chunk，构建还要分词 200+ 篇文章，
 * 首屏不必为用不到搜索的访客买单 —— 首次聚焦输入框或打开移动端面板时才建
 * （buildIndex 内部幂等；未就绪期间的输入由组装器的 null 守卫兜住）
 */
const ensureIndex = () => {
  void buildIndex()
}

const onFocusIndex = () => {
  ensureIndex()
  onFocus()
}

onMounted(() => {
  mountSearch()
})

onUnmounted(() => {
  unmountSearch()
})

// Esc 关闭面板
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    resetSearch()
    closePanel()
  }
}

/* ---- 移动端面板开关 ----
 * 面板挂到 body（Teleport），避免顶栏 overflow/stacking context 裁切；
 * 打开时锁 body 滚动，关闭时恢复并聚焦输入框
 */
const panelOpen = ref(false)
const overlayInput = ref<HTMLInputElement | null>(null)
const openPanel = () => {
  ensureIndex()
  panelOpen.value = true
  document.body.style.overflow = 'hidden'
  nextTick(() => overlayInput.value?.focus())
}
const closePanel = () => {
  panelOpen.value = false
  document.body.style.overflow = ''
  resetSearch()
}
const goAndClose = (id: string) => {
  go(id)
  closePanel()
}
</script>

<template>
  <!-- 移动端搜索按钮（行业标准形态）：≤768px 显示，点击展开全屏面板 -->
  <button class="search-trigger" @click="openPanel" aria-label="搜索">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  </button>
  <!-- 全屏搜索面板：移动端为全屏覆盖层，桌面端退化为原位展开（不显示按钮） -->
  <Teleport to="body">
    <div v-if="panelOpen" class="search-overlay" @click.self="closePanel">
      <div class="search-overlay-panel">
        <div class="search-overlay-head">
          <input
            ref="overlayInput"
            type="text"
            class="search-input"
            placeholder="搜索文档..."
            v-model="RefKeyword"
            @focus="ensureIndex"
            @keydown="onKeydown"
            @keypress.enter="onEnter"
            aria-label="搜索文档"
          />
          <button class="search-overlay-close" @click="closePanel" aria-label="关闭搜索">✕</button>
        </div>
        <div class="search-panel open">
          <div v-if="RefSearchRes.length === 0" class="search-empty">输入关键词搜索文档</div>
          <ul v-else class="search-results">
            <li v-for="result in RefSearchRes" :key="result.id">
              <a class="search-item" @click.prevent="goAndClose(result.id)" href="#">
                <div class="search-item-title" v-html="searchHl(result.title, RefKeyword)"></div>
                <div class="search-item-desc" v-html="searchHl(result.updated, RefKeyword)"></div>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Teleport>
  <div class="search-wrap">
    <input
      type="text"
      class="search-input"
      placeholder="搜索文档..."
      v-model="RefKeyword"
      @focus="onFocusIndex"
      @keydown="onKeydown"
      @keypress.enter="onEnter"
      aria-label="搜索文档"
    />
    <button
      class="search-clear"
      :class="{ visible: RefKeyword.length > 0 }"
      @click="resetSearch"
      aria-label="清除搜索"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <div class="search-panel" :class="{ open: searchOpen }">
      <div v-if="RefSearchRes.length === 0" class="search-empty">输入关键词搜索文档</div>
      <ul v-else class="search-results">
        <li v-for="result in RefSearchRes" :key="result.id">
          <a class="search-item" @click.prevent="go(result.id)" href="#">
            <div class="search-item-title" v-html="searchHl(result.title, RefKeyword)"></div>
            <div class="search-item-desc" v-html="searchHl(result.updated, RefKeyword)"></div>
          </a>
        </li>
      </ul>
      <div class="search-hint">
        <kbd>Esc</kbd> 关闭
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---- 移动端搜索按钮：≤768px 显示，桌面端隐藏（桌面用常驻输入框） ---- */
.search-trigger {
    display: none;
    width: 34px;
    height: 34px;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--g-color) 15%, transparent);
    border-radius: 5px;
    background: none;
    color: color-mix(in srgb, var(--g-text) 55%, transparent);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
}
.search-trigger:hover {
    color: var(--g-color);
    border-color: var(--g-color);
    background: color-mix(in srgb, var(--g-color) 8%, transparent);
}
.search-trigger svg {
    width: 16px;
    height: 16px;
    display: block;
}

/* ---- 全屏搜索覆盖层（Teleport 到 body，移动端专属） ---- */
.search-overlay {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 12vh 16px 16px;
}
.search-overlay-panel {
    width: 100%;
    max-width: 560px;
    background: var(--g-bg);
    border: 1px solid color-mix(in srgb, var(--g-color) 15%, transparent);
    border-radius: 12px;
    box-shadow: 0 16px 48px var(--g-shadow);
    overflow: hidden;
    animation: overlayIn 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes overlayIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}
.search-overlay-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--g-color) 12%, transparent);
}
.search-overlay-head .search-input {
    flex: 1;
}
.search-overlay-close {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: color-mix(in srgb, var(--g-text) 55%, transparent);
    cursor: pointer;
    font-size: 14px;
    border-radius: 5px;
    flex-shrink: 0;
}
.search-overlay-close:hover {
    color: var(--g-color);
    background: color-mix(in srgb, var(--g-color) 12%, transparent);
}
/* 覆盖层内的面板：去掉绝对定位，改为文档流 */
.search-overlay .search-panel {
    position: static;
    max-height: 55vh;
    border: none;
    border-radius: 0;
    box-shadow: none;
    backdrop-filter: none;
    background: none;
}

/* ---- 断点切换：≤768px 输入框隐藏、按钮显示 ---- */
@media (max-width: 768px) {
    .search-trigger {
        display: flex;
    }
    .search-wrap {
        display: none;
    }
}

/* ---- 搜索 ---- */
.search-wrap {
    position: relative;
    flex: 0 1 260px;
    min-width: 0;
}

.search-input {
    width: 100%;
    height: 34px;
    padding: 0 34px 0 12px;
    box-sizing: border-box; /* 无全局 border-box 重置，须显式声明：否则 padding+border 使输入框比容器宽 48px，右侧图标被顶到框内偏中 */
    border: 1px solid color-mix(in srgb, var(--g-color) 15%, transparent);
    border-radius: 8px;
    background: rgba(var(--glass-r), var(--glass-g), var(--glass-b), 0.6);
    color: var(--g-text);
    font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
    font-size: 0.8125rem;
    outline: none;
    transition: border-color 0.12s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 0.12s cubic-bezier(0.16, 1, 0.3, 1),
                background 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
.search-input::placeholder {
    color: color-mix(in srgb, var(--g-text) 50%, transparent);
}
.search-input:focus {
    border-color: var(--g-color);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--g-color) 15%, transparent);
    background: rgba(var(--glass-r), var(--glass-g), var(--glass-b), 0.85);
}

.search-icon {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: color-mix(in srgb, var(--g-text) 55%, transparent);
    pointer-events: none;
    transition: color 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
.search-input:focus ~ .search-icon,
.search-input:not(:placeholder-shown) ~ .search-icon {
    color: var(--g-color);
}

.search-clear {
    position: absolute;
    right: 28px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    display: none;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: color-mix(in srgb, var(--g-text) 55%, transparent);
    cursor: pointer;
    padding: 0;
    border-radius: 50%;
    transition: color 0.12s cubic-bezier(0.16, 1, 0.3, 1),
                background 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
.search-clear:hover {
    color: var(--g-color);
    background: color-mix(in srgb, var(--g-color) 12%, transparent);
}
.search-clear.visible { display: flex; }

.search-panel {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    max-height: 400px;
    overflow-y: auto;
    box-sizing: border-box; /* 无全局 border-box 重置，须显式声明，否则 padding 会把面板撑破 max-height */
    /* 上下留白：滚动条不贴面板顶/底边 */
    padding: var(--space-xs) 0;
    background: rgba(var(--glass-r), var(--glass-g), var(--glass-b), 0.85);
    backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid color-mix(in srgb, var(--g-color) 15%, transparent);
    border-radius: 8px;
    box-shadow: 0 8px 24px var(--g-shadow);
    z-index: 200;
    display: none;
    animation: panelIn 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
.search-panel.open { display: block; }

@keyframes panelIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
}

.search-empty {
    padding: 24px 16px;
    text-align: center;
    color: color-mix(in srgb, var(--g-text) 55%, transparent);
    font-size: 0.8125rem;
}

.search-results {
    margin: 0;
    padding: 4px;
    list-style: none;
}

.search-item {
    display: block;
    padding: 8px 12px;
    border-radius: 5px;
    text-decoration: none;
    color: var(--g-text);
    cursor: pointer;
    transition: background 0.12s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
.search-item:hover {
    background: color-mix(in srgb, var(--g-color) 12%, transparent);
    transform: translateX(2px);
}
.search-item:active {
    transform: scale(0.99);
}

.search-item-title {
    font-size: 0.8125rem;
    font-weight: 600;
    margin-bottom: 2px;
    line-height: 1.4;
}
.search-item-title mark {
    background: none;
    color: var(--g-color);
    font-weight: 700;
}

.search-item-desc {
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--g-text) 55%, transparent);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 2px;
}
.search-item-desc mark {
    background: none;
    color: var(--g-color);
}

.search-hint {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 12px;
    border-top: 1px solid color-mix(in srgb, var(--g-color) 12%, transparent);
    font-size: 0.6875rem;
    color: color-mix(in srgb, var(--g-text) 55%, transparent);
    opacity: 0.65;
}
</style>
