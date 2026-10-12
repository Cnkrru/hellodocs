<script setup lang="ts">
import { postNeighbor } from '@/composables/post'

const { pre, next } = postNeighbor()
</script>

<template>
  <div class="postnav-area">
    <!-- 上一篇的按钮 -->
    <router-link v-if="pre" :to="pre.link" class="post-btn pre-post">
      <div class="post-label">上一篇</div>
      <div class="post-title">{{ pre.title }}</div>
    </router-link>
    <span v-else class="post-btn pre-post is-disabled">
      <div class="post-label">上一篇</div>
      <div class="post-title">已是第一篇</div>
    </span>

    <!-- 下一篇的按钮 -->
    <router-link v-if="next" :to="next.link" class="post-btn next-post">
      <div class="post-label">下一篇</div>
      <div class="post-title">{{ next.title }}</div>
    </router-link>
    <span v-else class="post-btn next-post is-disabled">
      <div class="post-label">下一篇</div>
      <div class="post-title">已是最后一篇</div>
    </span>
  </div>
</template>

<style scoped>
.postnav-area {
  width: 100%;
  height: fit-content;

  display: flex;
  justify-content: center;
  align-items: stretch;
  flex-direction: row;
  gap: var(--space-md);
}

.post-btn {
  box-sizing: border-box;
  width: 50%;
  height: fit-content;

  padding: var(--space-md) var(--space-lg);
  border: 1px solid color-mix(in srgb, var(--g-color) 15%, transparent);
  border-radius: 8px;

  background: color-mix(in srgb, var(--g-bg) 50%, transparent);

  transition:
    border-color 0.2s ease,
    background 0.2s ease;

  text-decoration: none;
  cursor: pointer;
}

.post-btn:hover {
  border-color: var(--g-color);
  background: color-mix(in srgb, var(--g-color) 5%, transparent);
}

/* 无链接的占位按钮（已是第一篇/最后一篇）降低视觉权重 */
.post-btn.is-disabled {
  opacity: 0.4;
  cursor: default;
}
.post-btn.is-disabled:hover {
  border-color: color-mix(in srgb, var(--g-color) 15%, transparent);
  background: color-mix(in srgb, var(--g-bg) 50%, transparent);
}

.pre-post {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  flex-direction: column;
  gap: var(--space-xs);
}

.next-post {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  flex-direction: column;
  gap: var(--space-xs);
}

.post-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: color-mix(in srgb, var(--g-text) 45%, transparent);
}

.post-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--g-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* ====================<响应式>==================== */
@media (max-width: 1280px) {
  /* [响应式-lg] 大屏 */
}

@media (max-width: 1024px) {
  /* [响应式-md] 平板 */
}

@media (max-width: 768px) {
  /* [响应式-sm] 手机：两按钮保持并排，收紧边距与内边距 */
  .postnav-area {
    gap: var(--space-sm);
  }
  .post-btn {
    padding: var(--space-sm) var(--space-md);
  }
}

@media (max-width: 480px) {
  /* [响应式-xs] 窄屏：并排太挤，改纵向堆叠为全宽按钮 */
  .postnav-area {
    flex-direction: column;
    gap: var(--space-xs);
  }
  .post-btn {
    width: 100%;
  }
}
</style>
