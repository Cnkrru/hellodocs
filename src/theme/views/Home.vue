<script setup lang="ts">
/*
 * 首页：Hero + 分类卡片网格 + 最近更新
 *
 * 数据来源三处，全是编译期就确定的静态数据，故 SSG 阶段能完整渲染：
 *  Hero 文案   src/theme/config/site.ts 的 SITE_TITLE / SITE_DESCRIPTION
 *  分类卡片    src/theme/config/site.ts 的 HOME_CARDS（手写在配置里，link 统一指向该分类首篇）
 *  最近更新    .cache/post.json 的 updated × composables/sidebar 的 flatPosts
 *              —— 前者给时间、后者给标题与链接，按 id 关联后取时间最新的 8 条
 * 用 glob 而非静态 import 读 post.json —— 首次构建该文件可能尚未生成，glob 返回空对象而非编译报错
 */
import { computed } from 'vue'
import { site } from '@/composables/site'
import { flatPosts } from '@/composables/sidebar'

type PostMeta = { title: string; date: string; updated: string }

const metaMap = import.meta.glob<PostMeta>('/.cache/post.json', { eager: true, import: 'default' })
const postMeta = metaMap['/.cache/post.json'] as Record<string, PostMeta> | undefined

/** 最近更新：侧栏有序表中带 updated 的文档，按时间取最新 8 条 */
const recent = computed(() =>
  flatPosts
    .map((post) => ({ ...post, updated: postMeta?.[post.id]?.updated ?? '' }))
    .filter((post) => post.updated !== '')
    .sort((a, b) => (a.updated < b.updated ? 1 : -1))
    .slice(0, 8),
)

/** 「快速开始」的去向：侧栏第一篇，即全站从头读起的入口 */
const firstPost = computed(() => flatPosts[0]?.link ?? '')
</script>

<template>
  <div class="home">
    <p class="home-logo">{{ site.SITE_TITLE }}</p>
    <p class="home-text">{{ site.SITE_DESCRIPTION }}</p>
    <router-link v-if="firstPost" class="home-btn" :to="firstPost">快速开始</router-link>

    <section class="cards">
      <router-link v-for="card in site.HOME_CARDS" :key="card.text" class="card" :to="card.link">
        <span class="card-title">{{ card.text }}</span>
        <span class="card-desc">{{ card.desc }}</span>
      </router-link>
    </section>

    <section v-if="recent.length > 0" class="recent">
      <h2 class="sec-title">最近更新</h2>
      <ul class="recent-list">
        <li v-for="post in recent" :key="post.link" class="recent-item">
          <router-link class="recent-link" :to="post.link">{{ post.title }}</router-link>
          <time class="recent-date" :datetime="post.updated">{{ post.updated }}</time>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
/* ---- 首页 hero ---- */
.home {
  position: relative;
  padding: 80px 24px 48px;
  text-align: center;
  overflow: hidden;
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

/* ---- 站名 ---- */
.home-logo {
  margin: 0;
  display: inline-block;
  font-size: 3.2em;
  font-weight: 750;
  letter-spacing: -0.03em;
  font-family: 'Noto Serif SC', 'Songti SC', 'SimSun', serif;
  color: var(--g-text);
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

/* 标题下方朱砂装饰线 */
.home-logo::after {
  content: '';
  display: block;
  width: 48px;
  height: 3px;
  background: var(--g-color);
  border-radius: 2px;
  margin: 0.35em auto 0;
  opacity: 0.5;
}

/* ---- 副标题 ---- */
.home-text {
  margin: 24px auto 0;
  max-width: 520px;
  color: color-mix(in srgb, var(--g-text) 62%, transparent);
  font-size: 1.125rem;
  line-height: 1.6;
  font-family: 'Noto Serif SC', 'Songti SC', 'SimSun', serif;
  animation: fadeInUp 0.5s 0.08s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* ---- CTA 按钮 ---- */
.home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 32px;
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: var(--g-color);
  color: #fff;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--g-color) 12%, transparent);
  animation: fadeInUp 0.5s 0.16s cubic-bezier(0.16, 1, 0.3, 1) both;
  transition:
    background 0.12s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
.home-btn:hover {
  background: var(--g-hover);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--g-color) 20%, transparent);
  transform: translateY(-1px);
}
.home-btn:active {
  transform: scale(0.97);
}

/* ---- 分类卡片网格 ---- */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
  max-width: 1080px;
  margin: 56px auto 0;
  text-align: left;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--g-color) 12%, transparent);
  border-radius: 8px;
  text-decoration: none;
  background: color-mix(in srgb, var(--g-bg) 60%, transparent);
  transition:
    border-color 0.12s cubic-bezier(0.16, 1, 0.3, 1),
    background 0.12s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}

.card:hover {
  border-color: var(--g-color);
  background: color-mix(in srgb, var(--g-color) 6%, transparent);
  transform: translateY(-2px);
}

.card-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--g-text);
}

.card:hover .card-title {
  color: var(--g-color);
}

.card-desc {
  font-size: 0.75rem;
  line-height: 1.5;
  color: color-mix(in srgb, var(--g-text) 55%, transparent);
}

/* ---- 最近更新 ---- */
.recent {
  max-width: 1080px;
  margin: 48px auto 0;
  text-align: left;
}

.sec-title {
  margin: 0 0 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--g-text) 55%, transparent);
}

.recent-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid color-mix(in srgb, var(--g-color) 10%, transparent);
}

.recent-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--g-color) 10%, transparent);
}

.recent-link {
  font-size: 0.875rem;
  color: var(--g-text);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-link:hover {
  color: var(--g-color);
}

/* 日期用等宽字体，与文章页「最后编辑于」的日期同一套观感 */
.recent-date {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: color-mix(in srgb, var(--g-text) 45%, transparent);
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

@media (max-width: 1024px) {
  /* [响应式-md] 平板：卡片网格最小宽略减，间距收窄 */
  .cards {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 768px) {
  /* [响应式-sm] 手机 */
  .home {
    padding: 48px 16px 32px;
  }
  .home-logo {
    font-size: 2.4em;
  }
  .home::before {
    width: 100%;
    height: 240px;
  }
  .cards {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    margin-top: 40px;
  }
  .recent {
    margin-top: 36px;
  }
}

@media (max-width: 480px) {
  /* [响应式-xs] 窄屏：卡片单列全宽，间距进一步收紧 */
  .home {
    padding: 32px 8px 24px;
  }
  .home-logo {
    font-size: 2em;
  }
  .cards {
    grid-template-columns: 1fr;
    gap: 12px;
    margin-top: 24px;
  }
  .recent {
    margin-top: 24px;
  }
}
</style>
