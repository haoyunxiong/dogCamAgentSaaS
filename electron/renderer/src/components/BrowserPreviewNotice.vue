<template>
  <section class="browser-preview">
    <div class="preview-hero">
      <span class="preview-kicker">浏览器预览模式</span>
      <h1>这个页面依赖 Electron 桌面运行时</h1>
      <p>
        当前打开的是普通浏览器页面，`preload` 没有注入，`window.electronAPI` 不存在。
        桌面版订单、设置、知识库、顺丰寄件等模块需要本地桥接能力；手机端请使用移动工作台。
      </p>
    </div>

    <div class="preview-grid">
      <article class="preview-card">
        <h2>当前路由</h2>
        <p class="preview-route">{{ routePath || '#/' }}</p>
        <p class="preview-note">壳层能显示，但页面内部的数据加载、IPC 调用和本地能力都不会工作。</p>
      </article>

      <article class="preview-card">
        <h2>手机查看方式</h2>
        <ol class="preview-steps">
          <li>手机访问内网穿透域名的 `/mobile` 路径。</li>
          <li>开发环境可访问 `http://localhost:5177/mobile`。</li>
          <li>桌面完整模块仍在 Electron 窗口中使用。</li>
        </ol>
      </article>
    </div>
  </section>
</template>

<script setup>
defineProps({
  routePath: {
    type: String,
    default: '#/',
  },
})
</script>

<style scoped>
.browser-preview {
  min-height: calc(100vh - 104px);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(15, 118, 110, 0.08), rgba(250, 204, 21, 0.08)),
    var(--bg-surface, #fff);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}

.preview-hero {
  max-width: 760px;
}

.preview-kicker {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(20, 184, 166, 0.12);
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
}

.preview-hero h1 {
  margin: 14px 0 10px;
  font-size: 32px;
  line-height: 1.2;
  color: var(--text-strong, #17211d);
}

.preview-hero p {
  max-width: 680px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary, #52615b);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.preview-card {
  padding: 20px;
  border-radius: 14px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  background: rgba(255, 255, 255, 0.88);
}

.preview-card h2 {
  margin: 0 0 10px;
  font-size: 16px;
  color: var(--text-strong, #17211d);
}

.preview-route {
  margin: 0 0 8px;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  color: #0f766e;
}

.preview-note {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary, #52615b);
}

.preview-steps {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary, #52615b);
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .browser-preview {
    min-height: auto;
    padding: 20px;
  }

  .preview-hero h1 {
    font-size: 26px;
  }

  .preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
