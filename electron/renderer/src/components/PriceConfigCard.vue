<template>
  <article class="price-config-card">
    <div class="price-config-card__head">
      <div>
        <div class="price-config-card__title">{{ group.modelCode }}</div>
        <div class="price-config-card__sub">
          {{ group.tiers?.length || 0 }} 个阶梯
          <span class="dot">•</span>
          {{ group.remark || '未填写备注' }}
        </div>
      </div>
      <span class="status-pill" :class="group.active ? 'is-active' : 'is-inactive'">
        {{ group.active ? '启用' : '停用' }}
      </span>
    </div>

    <div class="price-config-card__section">
      <div class="price-config-card__section-label">基础阶梯价格</div>
      <div class="price-config-card__tiers">
        <span
          v-for="tier in group.tiers || []"
          :key="`${group.modelCode}-${tier.day}`"
          class="tier-chip"
        >
          {{ tier.day }}天 ¥{{ Number(tier.totalPrice || 0).toFixed(2) }}
        </span>
      </div>
    </div>

    <div class="price-config-card__meta">
      <div class="meta-item">
        <span class="meta-label">加价规则</span>
        <strong class="meta-value">¥{{ Number(group.extensionDailyPrice || 0).toFixed(2) }}</strong>
        <span class="meta-hint">超出已配天数后按日补算</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">押金规则</span>
        <strong class="meta-value">¥{{ Number(group.deposit || 0).toFixed(2) }}</strong>
        <span class="meta-hint">兼容旧字段展示</span>
      </div>
    </div>

    <div class="price-config-card__actions">
      <div class="price-config-card__action-main">
        <button type="button" class="btn btn-secondary btn-sm" @click="$emit('edit', group)">编辑</button>
        <button type="button" class="btn btn-primary btn-sm" @click="$emit('toggle', group)">
          {{ group.active ? '停用' : '启用' }}
        </button>
      </div>
      <RowActionMenu :items="menuItems" @select="$emit('menu', $event)" />
    </div>
  </article>
</template>

<script setup>
import RowActionMenu from './RowActionMenu.vue'

defineProps({
  group: { type: Object, default: () => ({}) },
  menuItems: { type: Array, default: () => [] },
})

defineEmits(['edit', 'toggle', 'menu'])
</script>

<style scoped>
.price-config-card {
  display: grid;
  grid-template-rows: auto auto auto 1fr auto;
  gap: 12px;
  min-height: 100%;
  padding: 16px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 12px;
  background: #fff;
}

.price-config-card__head,
.price-config-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.price-config-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.price-config-card__sub,
.meta-label {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
}

.price-config-card__section {
  display: grid;
  gap: 8px;
}

.price-config-card__section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary, #6b7280);
}

.dot {
  margin: 0 6px;
}

.price-config-card__tiers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tier-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
  font-size: 12px;
}

.price-config-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.meta-item {
  display: grid;
  gap: 3px;
  padding: 12px;
  border-radius: 10px;
  background: #f8fafc;
}

.meta-value {
  font-size: 15px;
  color: var(--text-primary, #111827);
}

.meta-hint {
  font-size: 11px;
  color: var(--text-secondary, #6b7280);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-pill.is-active {
  background: #dcfce7;
  color: #166534;
}

.status-pill.is-inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.price-config-card__actions {
  margin-top: auto;
  align-items: flex-end;
}

.price-config-card__action-main {
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .price-config-card__head,
  .price-config-card__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .price-config-card__action-main {
    width: 100%;
  }

  .price-config-card__meta {
    grid-template-columns: 1fr;
  }
}
</style>
