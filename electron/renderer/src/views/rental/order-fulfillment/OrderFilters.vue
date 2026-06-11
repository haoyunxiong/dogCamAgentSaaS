<template>
  <FilterBar
    title="筛选工作台"
    hint="基础筛选常驻，高级条件按需展开。"
  >
    <template #actions>
      <button class="btn btn-secondary btn-sm" @click="$emit('toggle-advanced')">
        高级筛选
      </button>
    </template>
    <div class="quick-filter-tabs">
      <button
        v-for="tab in quickFilterTabs"
        :key="tab.key"
        type="button"
        class="quick-filter-tab"
        :class="{ active: filters.quickFilter === tab.key }"
        @click="$emit('apply-quick-filter', tab.key)"
      >
        <span>{{ tab.label }}</span>
        <strong>{{ tab.value }}</strong>
      </button>
    </div>
    <div class="order-filter-grid order-filter-grid--basic">
      <div class="form-group keyword-group">
        <label>关键词</label>
        <input v-model="filters.keyword" placeholder="订单号 / 客户 / 手机号 / 设备 / 地址">
      </div>
      <div class="form-group">
        <label>店铺</label>
        <select v-model="filters.storeId">
          <option value="">全部店铺</option>
          <option v-for="store in storeOptions" :key="store.id" :value="String(store.id)">{{ store.name }}</option>
        </select>
      </div>
      <div class="form-group">
        <label>主状态</label>
        <select v-model="filters.status">
          <option value="">全部状态</option>
          <option value="waiting_payment">待付款</option>
          <option value="paid">已付款</option>
          <option value="shipping">配送中</option>
          <option value="active">进行中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>
      <div class="filter-actions">
        <button class="btn btn-primary" @click="$emit('submit')">筛选</button>
        <button class="btn btn-secondary" @click="$emit('reset')">重置</button>
      </div>
    </div>
  </FilterBar>

  <AdvancedFilterDrawer
    :model-value="showAdvancedFilters"
    title="高级筛选"
    hint="按型号、支付状态、免押状态和日期范围做精细筛选。"
    @update:model-value="$emit('update:showAdvancedFilters', $event)"
  >
    <div class="order-filter-grid order-filter-grid--advanced">
      <div class="form-group">
        <label>型号编码</label>
        <select v-model="filters.modelCode">
          <option value="">全部型号</option>
          <option v-for="model in availableModelCodes" :key="model" :value="model">{{ model }}</option>
        </select>
      </div>
      <div class="form-group">
        <label>支付状态</label>
        <select v-model="filters.paymentStatus">
          <option value="">全部支付状态</option>
          <option value="waiting_payment">待付款</option>
          <option value="paid">已付款</option>
        </select>
      </div>
      <div class="form-group">
        <label>免押状态</label>
        <select v-model="filters.depositStatus">
          <option value="">全部免押状态</option>
          <option value="none">未创建</option>
          <option value="pending_review">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
          <option value="cancelled">已取消</option>
          <option value="completed">已完结</option>
        </select>
      </div>
      <div class="form-group">
        <label>日期字段</label>
        <select v-model="filters.dateField">
          <option value="created_at">订单创建时间</option>
          <option value="rent_start_date">租期开始日期</option>
          <option value="rent_end_date">租期结束日期</option>
          <option value="rent_overlap">租期覆盖区间</option>
        </select>
      </div>
      <div class="form-group">
        <label>快捷日期</label>
        <select v-model="filters.datePreset" @change="$emit('apply-date-preset', filters.datePreset)">
          <option value="custom">自定义</option>
          <option value="today">今天</option>
          <option value="last7">近 7 天</option>
          <option value="thisMonth">本月</option>
          <option value="nextMonth">下月</option>
        </select>
      </div>
      <div class="form-group">
        <label>起始日期</label>
        <ClickOpenDateInput v-model="filters.from" />
      </div>
      <div class="form-group">
        <label>结束日期</label>
        <ClickOpenDateInput v-model="filters.to" />
      </div>
    </div>
    <template #footer>
      <button class="btn btn-secondary" @click="$emit('update:showAdvancedFilters', false)">关闭</button>
      <button class="btn btn-primary" @click="$emit('apply-advanced')">应用筛选</button>
    </template>
  </AdvancedFilterDrawer>
</template>

<script setup>
import AdvancedFilterDrawer from '../../../components/AdvancedFilterDrawer.vue'
import ClickOpenDateInput from '../../../components/ClickOpenDateInput.vue'
import FilterBar from '../../../components/FilterBar.vue'

defineEmits([
  'toggle-advanced',
  'apply-quick-filter',
  'submit',
  'reset',
  'apply-date-preset',
  'apply-advanced',
  'update:showAdvancedFilters',
])

defineProps({
  filters: { type: Object, required: true },
  showAdvancedFilters: { type: Boolean, default: false },
  quickFilterTabs: { type: Array, default: () => [] },
  storeOptions: { type: Array, default: () => [] },
  availableModelCodes: { type: Array, default: () => [] },
})
</script>

<style scoped>
.quick-filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-filter-tab {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 999px;
  background: #fff;
  color: var(--text-secondary, #6b7280);
  font-size: 12px;
  font-weight: 700;
}

.quick-filter-tab strong {
  color: var(--text-strong, #17211d);
}

.quick-filter-tab.active {
  border-color: rgba(15, 118, 110, 0.24);
  background: rgba(230, 246, 243, 0.92);
  color: #0f766e;
}

.order-filter-grid {
  display: grid;
  align-items: end;
  gap: 14px;
}

.order-filter-grid--basic {
  grid-template-columns: minmax(280px, 1.4fr) minmax(150px, 0.85fr) minmax(150px, 0.85fr) auto;
  gap: 10px;
}

.order-filter-grid--advanced {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 12px;
}

.keyword-group {
  min-width: 0;
}

.filter-actions {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 10px;
}

.order-filter-grid .form-group:has(.click-date-input) {
  max-width: 220px;
}

@media (max-width: 1320px) {
  .order-filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .filter-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 960px) {
  .order-filter-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    justify-content: flex-start;
  }
}
</style>
