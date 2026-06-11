<template>
  <header class="page-header-v2" :class="{ compact }">
    <div class="ph-main">
      <div class="ph-breadcrumb" v-if="breadcrumb && breadcrumb.length">
        <template v-for="(item, idx) in breadcrumb" :key="idx">
          <span class="ph-crumb" :class="{ last: idx === breadcrumb.length - 1 }">{{ item }}</span>
          <span v-if="idx < breadcrumb.length - 1" class="ph-crumb-sep">/</span>
        </template>
      </div>
      <div class="ph-title-row">
        <h1 class="ph-title">
          <span v-if="icon" class="ph-icon">{{ icon }}</span>
          {{ title }}
          <span v-if="badge != null && badge !== ''" class="ph-badge">{{ badge }}</span>
        </h1>
        <div class="ph-actions">
          <slot name="actions" />
        </div>
      </div>
      <p v-if="subtitle" class="ph-subtitle">{{ subtitle }}</p>
      <div v-if="$slots.meta" class="ph-meta">
        <slot name="meta" />
      </div>
    </div>
    <div v-if="$slots.filters" class="ph-filters">
      <slot name="filters" />
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  badge: { type: [String, Number], default: null },
  breadcrumb: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
})
</script>

<style scoped>
.page-header-v2 {
  position: relative;
  overflow: hidden;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.page-header-v2.compact { padding: 12px 16px; }

.ph-main,
.ph-filters {
  position: relative;
  z-index: 1;
}

.ph-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
}
.ph-crumb.last { color: var(--text-secondary); font-weight: 700; }
.ph-crumb-sep { color: var(--text-faint); }

.ph-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.ph-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-strong);
  letter-spacing: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}
.page-header-v2.compact .ph-title { font-size: 18px; }

.ph-icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(20, 184, 166, 0.12);
  color: #0f766e;
  font-size: 16px;
  line-height: 1;
}

.ph-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(20, 184, 166, 0.14);
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
}

.ph-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.72);
  border: 1px solid rgba(229, 231, 235, 0.92);
}

.ph-subtitle {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  max-width: 960px;
  margin: 0;
}

.ph-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px dashed rgba(148, 163, 184, 0.18);
  font-size: 13px;
  color: var(--text-secondary);
}

.ph-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.68);
}

@media (max-width: 840px) {
  .ph-title-row {
    align-items: flex-start;
  }
  .ph-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
