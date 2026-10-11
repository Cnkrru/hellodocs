<script setup lang="ts">
/*
 * 顶栏导航：数据源是手写的 src/theme/config/site.ts 的 SITE_NAV
 *
 * 单 v-for 直接渲染，没有嵌套结构（不设下拉菜单），故不需要递归组件或树形数据
 * 配置在模块顶层 import —— 与侧栏同理，SSG 阶段就能渲染完整，不会先出空条再补
 */
import { site } from '@/composables/site'

// 外链判定：router-link 只能跳站内路由，外链必须走原生 a（并带 noopener 防新页面拿到 window.opener）
const isExternal = (link: string): boolean => /^https?:\/\//.test(link)
</script>

<template>
  <nav class="nav">
    <ul class="nav-links">
      <li v-for="item in site.SITE_NAV" :key="item.link" class="nav-item">
        <a v-if="isExternal(item.link)" :href="item.link" target="_blank" rel="noopener noreferrer">
          {{ item.text }}
        </a>
        <router-link v-else :to="item.link">{{ item.text }}</router-link>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.nav {
  flex-shrink: 0;
}

.nav-links {
  display: flex;
  gap: 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-item a {
  color: color-mix(in srgb, var(--g-text) 55%, transparent);
  text-decoration: none;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-item a:hover {
  color: var(--g-color);
}

/* 当前所在页：命中路由时 router-link 自动挂上 router-link-active，不必自己比对 path */
.nav-item a.router-link-active {
  color: var(--g-color);
}

@media (max-width: 1024px) {
  /* [响应式-md] 平板：间距略收 */
  .nav-links {
    gap: 18px;
  }
}

@media (max-width: 768px) {
  /* [响应式-sm] 手机：站内导航收起（同 VitePress 手机端把导航项收进菜单），
     顶栏只留 Logo / 搜索 / 工具图标，避免再挤出一行 */
  .nav {
    display: none;
  }
}

@media (max-width: 480px) {
  /* [响应式-xs] 窄屏：间距进一步收紧 */
  .nav-links {
    gap: 12px;
  }
}
</style>
