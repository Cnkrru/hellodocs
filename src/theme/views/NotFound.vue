<script setup lang="ts">
/*
 * 404 页：站内路径写错、或文章被移出 docs/ 后的兜底
 *
 * noindex 与标题由 useSeo 按页注入，不再依赖构建期改写 dist/404.html 的字符串手术
 * —— 那条路径只在 onFinished 里对单页生效，且改的是产出的 HTML，客户端路由切到 404
 * 时 meta 不会跟着变。走 unhead 后 SSG 与客户端是同一份声明。
 */
import { useSeo } from '@/composables/seo'
import { site } from '@/composables/site'

useSeo(() => ({ title: `页面不存在 - ${site.SITE_TITLE}`, path: '/404', noindex: true }))
</script>

<template>
  <div class="notfound">
    <div class="error">404</div>
    <h1 class="title">页面不存在</h1>
    <p class="text">你访问的页面可能已被移动、重命名，或地址有误。可用顶部搜索框查找文档。</p>
    <div class="actions">
      <router-link to="/" class="btn">返回首页</router-link>
    </div>
  </div>
</template>

<style scoped>
.notfound {
  box-sizing: border-box;
  width: 100%;
  min-height: 60vh;
  padding: 48px 24px;

  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
}

.error {
  font-size: clamp(72px, 18vw, 120px);
  font-weight: 900;
  line-height: 1;
  color: var(--g-color);
  margin-bottom: var(--space-md);
  /* 入场回弹，用项目弹性曲线 */
  animation: error-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes error-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: var(--g-text);
  margin: 0 0 var(--space-sm);
}

.text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--g-text);
  opacity: 0.65;
  margin: 0 0 32px;
}

/* 双按钮：主色填充 + 描边次要，窄屏并排不撑破 */
.actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.btn {
  display: inline-block;
  padding: 10px 28px;
  border: 2px solid var(--g-color);
  border-radius: 50px;
  background: var(--g-color);

  font-size: 15px;
  color: var(--g-bg);
  text-decoration: none;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.btn:hover {
  background: var(--g-hover);
  border-color: var(--g-hover);
  transform: translateY(-2px);
}

/* ====================<响应式>==================== */
@media (max-width: 1024px) {
  /* [响应式-md] 平板：间距略收 */
  .notfound {
    padding: 40px 16px;
  }
}

@media (max-width: 768px) {
  /* [响应式-sm] 手机 */
  .notfound {
    min-height: 50vh;
    padding: 32px 12px;
  }

  .title {
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  /* [响应式-xs] 窄屏：文字和按钮进一步缩小 */
  .notfound {
    padding: 24px 8px;
  }

  .title {
    font-size: 18px;
  }

  .btn {
    padding: 8px 20px;
    font-size: 14px;
  }
}
</style>
