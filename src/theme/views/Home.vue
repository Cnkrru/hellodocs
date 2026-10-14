<script setup lang="ts">
/*
 * 首页：完全由 Markdown 驱动
 *
 * 正文源 src/theme/views/home.md 在编译期由 parseArticle.ts 渲染为 .cache/home.vue
 * （与文章同一管线：shiki 高亮、写作组件、KaTeX 全支持），此处懒加载渲染该产物。
 * 首页内容改动只需编辑 home.md 并重新构建，本组件不含任何写死内容。
 */
import { defineAsyncComponent, shallowRef, type Component } from 'vue'
import Render from '@/components/post/Render.vue'
import { useSeo } from '@/composables/seo'
import { site } from '@/composables/site'

// 首页标题就用站名本身，不加「- 站名」后缀（首页顶着重复站名反而不像首页）
useSeo(() => ({ title: site.SITE_TITLE, path: '/' }))

// 首页正文：home.md 的编译产物，懒加载独立 chunk
const homeLoaders = import.meta.glob<{ default: Component }>('/.cache/home.vue')
const homeContent = shallowRef<Component | null>(null)
const homeLoader = homeLoaders['/.cache/home.vue']
if (homeLoader) homeContent.value = defineAsyncComponent(homeLoader)
</script>

<template>
  <div class="home">
    <Render v-if="homeContent" class="home-content">
      <component :is="homeContent" />
    </Render>
  </div>
</template>

<style scoped>
/* ---- 首页容器：与文章页正文同宽，居中阅读 ---- */
.home {
  position: relative;
  padding: 48px 24px 64px;
  overflow: hidden;
  max-width: 860px;
  margin: 0 auto;
}

/* 水墨光晕 */
.home::before {
  content: '';
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 320px;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 400px 160px at 30% 50%,
      color-mix(in srgb, var(--g-color) 8%, transparent),
      transparent 60%
    ),
    radial-gradient(ellipse 300px 140px at 70% 60%, rgba(120, 100, 70, 0.04), transparent 60%);
  animation: inkDrift 14s ease-in-out infinite alternate;
}

@keyframes inkDrift {
  0% {
    transform: translateX(-50%) translateY(0) scale(1);
    opacity: 0.8;
  }
  100% {
    transform: translateX(-50%) translateY(-8px) scale(1.04);
    opacity: 1;
  }
}

/* ---- Markdown 正文区：复用文章页 content 样式体系 ---- */
.home-content {
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 装饰性水墨笔触 */
.home::after {
  content: ' ';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--g-color), transparent);
  opacity: 0.15;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  /* [响应式-sm] 手机 */
  .home {
    padding: 32px 16px 48px;
  }
  .home::before {
    width: 100%;
    height: 240px;
  }
}

@media (max-width: 480px) {
  /* [响应式-xs] 窄屏：间距进一步收紧 */
  .home {
    padding: 24px 8px 40px;
  }
}
</style>
