<script setup lang="ts">
import { computed, defineAsyncComponent, shallowRef, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'
import PostToc from '@/components/post/PostToc.vue'
import PostSidebar from '@/components/post/PostSidebar.vue'
import Render from '@/components/post/Render.vue'
import PostNav from '@/components/post/PostNav.vue'
import PostUpdate from '@/components/post/PostUpdate.vue'
import PostEdit from '@/components/post/PostEdit.vue'
import { loadContent } from '@/composables/content'
import { postMeta } from '@/composables/meta'
import { useSeo } from '@/composables/seo'
import { site } from '@/composables/site'
import { sidebarOpen, closeSidebar } from '@/composables/sidebar'
// 仅点文档链接才收起抽屉：分组箭头的展开/折叠操作不收（避免误触关闭）
const onSidebarClick = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('.sb-link')) closeSidebar()
}
const route = useRoute()
// pathMatch 是可重复参数，嵌套文章的 id 含斜杠（如 guide/install），需拼回完整 id
const postKey = computed(() => (route.params.pathMatch as string[]).join('/'))

/*
 * 文章页 head：标题取编译期派生的 title（post.json），随路由变化 —— 传 getter 而非静态对象，
 * SPA 内切文章时标题才会跟着换。description 暂用站点描述（文档无 frontmatter 摘要可提取）
 */
useSeo(() => {
  const name = postMeta[postKey.value]?.title
  // 标题恰好等于站名时不再拼后缀：docs 根下的 index.md 派生出的就是站点标题，
  // 无条件拼接会得到「hello - hello」。缺标题（无效 id）时同样回退站名
  const title = name && name !== site.SITE_TITLE ? `${name} - ${site.SITE_TITLE}` : site.SITE_TITLE
  return { title, path: route.path }
})

// 文章正文按 id 懒加载（加载器与预取共用同一出处），每篇文章是独立 chunk，看哪篇加载哪篇
const content = shallowRef<Component | null>(null)
watch(
  postKey,
  (key) => {
    const loader = loadContent(key)
    content.value = loader ? defineAsyncComponent(loader) : null
  },
  { immediate: true },
)
</script>

<template>
  <div class="post">
    <div class="sidebar-mask" :class="{ show: sidebarOpen }" @click="closeSidebar"></div>
    <aside class="post-sidebar" :class="{ open: sidebarOpen }" @click="onSidebarClick">
      <PostSidebar />
    </aside>

    <div class="post-main">
      <Render v-if="content">
        <component :is="content" />
      </Render>

      <div class="mian-footer">
        <div class="el">
          <PostUpdate />
          <div class="links">
            <PostEdit />
          </div>
        </div>
        <PostNav />
      </div>
    </div>

    <PostToc />
  </div>
</template>

<style scoped>
/* ---- 文档页三栏：左侧栏 + 正文 + 右侧目录，横向 flex ---- */
/* align-items: flex-start —— 两个侧栏不被正文高度拉伸，各自 sticky 才能生效 */
.post {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 32px;
  /* 顶部留白加大：与吸顶侧栏的 16px 呼吸间距呼应 */
  padding: 32px 0 24px;
}

/* ---- 左侧栏：定宽 + sticky 吸顶（VitePress 式：顶栏高 + 呼吸间距） ---- */
.post-sidebar {
  flex: 0 0 240px;
  position: sticky;
  /* 顶栏 56px + 16px 呼吸间距：吸顶后侧栏与顶栏之间留一道缝，不紧贴 */
  top: calc(56px + 16px);
  align-self: flex-start;
  max-height: calc(100vh - 56px - 16px - var(--space-sm));
  overflow-y: auto;
  box-sizing: border-box;
  padding: var(--space-xs) 0;
}

/* ---- 正文列：吃掉剩余宽度，min-width: 0 防止长代码块撑破布局 ---- */
.post-main {
  flex: 1 1 auto;
  min-width: 0;
}

/* ---- 正文底部：上一篇/下一篇、更新时间等 ---- */
.mian-footer {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid color-mix(in srgb, var(--g-color) 12%, transparent);
}

/* ---- 元信息行：更新时间在左，编辑/历史入口靠右 ---- */
.el {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.links {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

/* ---- 侧栏抽屉遮罩 ---- */
.sidebar-mask {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 199;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.sidebar-mask.show {
  opacity: 1;
  pointer-events: auto;
}

/* ---- 响应式 ---- */
@media (max-width: 1280px) {
  /* [响应式-lg] 大屏：三栏间距略收 */
  .post {
    gap: 24px;
  }
}

@media (max-width: 1024px) {
  /* [响应式-md] 平板：左栏变抽屉，默认移出屏外，.open 时滑入 */
  .post-sidebar {
    display: block;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 200;
    width: 260px;
    max-height: none;
    padding: 72px 16px 24px;
    background: var(--g-bg);
    border-right: 1px solid color-mix(in srgb, var(--g-color) 12%, transparent);
    transform: translateX(-100%);
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    overflow-y: auto;
  }
  .post-sidebar.open {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
  }
  .sidebar-mask {
    display: block;
  }
}

@media (max-width: 768px) {
  /* [响应式-sm] 手机：目录也收起（PostToc 内部已隐藏） */
  .post {
    gap: 0;
    padding: 16px 0;
  }
}

@media (max-width: 480px) {
  /* [响应式-xs] 窄屏：正文上下间距进一步收紧 */
  .post {
    padding: 8px 0;
  }
  .mian-footer {
    margin-top: 32px;
    padding-top: 16px;
  }
}
</style>
