<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { initLD } from '@/composables/ld'
import Header from './components/layout/Header.vue'
import Footer from './components/layout/Footer.vue'
import BackToTop from './components/BackToTop.vue'

// var.css 靠 body 上的 .light/.dark 挂变量，必须客户端挂载后再定class（SSR 阶段无 localStorage）
onMounted(() => {
  initLD()
})
</script>

<template>
  <Header />
  <main class="main"><RouterView /></main>
  <Footer />
  <BackToTop />
</template>

<style>
/* ---- 基础重置与全局外观 ---- */
html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  font-family:
    system-ui,
    -apple-system,
    'PingFang SC',
    'Microsoft YaHei',
    'Noto Sans SC',
    sans-serif;
  font-size: 1rem;
  line-height: 1.75;
  color: var(--g-text);
  background: var(--g-bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition:
    background 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ---- 三区纵向布局：顶栏吸顶 / 内容区吃掉剩余高度 / 页脚自然落底 ---- */
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ---- 内容区：flex:1 撑开剩余高度，页面短时把页脚压到底部 ---- */
.main {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 1360px;
  margin: 0 auto;
  padding: 0 24px;
  /* 无全局 border-box 重置，须显式声明：否则 width:100% + 左右 padding
     会让外层比视口宽出 padding 那么多，整页出现横向滚动条 */
  box-sizing: border-box;
}

/* ---- 响应式 ---- */
@media (max-width: 1024px) {
  /* [响应式-md] 平板：内容区内边距略收 */
  .main {
    padding: 0 16px;
  }
}

@media (max-width: 768px) {
  /* [响应式-sm] 手机：内容区内边距收窄 */
  .main {
    padding: 0 12px;
  }
}

@media (max-width: 480px) {
  /* [响应式-xs] 窄屏：内容区内边距进一步收窄 */
  .main {
    padding: 0 8px;
  }
}
</style>