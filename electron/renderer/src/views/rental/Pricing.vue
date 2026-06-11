<template>
  <div class="page pricing-page">
    <PageHeader
      title="租赁定价与免押规则"
      subtitle="按型号一次性维护阶梯总价。超过已配置天数后，自动按续租日价补算。"
      icon="💰"
      :breadcrumb="['经营管理', '租赁报价']"
    >
      <template #actions>
        <button class="btn btn-secondary" @click="loadAll">刷新</button>
        <button class="btn btn-primary" @click="openCreate">新增报价</button>
      </template>
    </PageHeader>

    <KpiStrip :items="pricingValidationItems" />

    <section class="pricing-overview" :class="{ risk: !coverageStatus.complete }">
      <div>
        <strong>{{ coverageStatus.complete ? '免押规则区间已覆盖' : `区间覆盖风险：${coverageStatus.label}` }}</strong>
        <p>{{ coverageStatus.hint }}，当前启用规则 {{ enabledRuleCount }} 条。</p>
      </div>
      <button class="btn btn-secondary btn-sm" @click="scrollToRules">查看免押规则</button>
    </section>

    <FilterBar>
      <div class="filter-row">
        <div class="filter-field">
          <span class="ff-icon">🔍</span>
          <input v-model="filters.keyword" placeholder="搜索机型 / 备注" @keyup.enter="loadAll" />
        </div>
        <select v-model="filters.modelCode" class="ff-select wide" @change="loadAll">
          <option value="">全部型号</option>
          <option v-for="model in modelOptions" :key="model" :value="model">{{ model }}</option>
        </select>
        <select v-model="filters.active" class="ff-select" @change="loadAll">
          <option value="">全部状态</option>
          <option value="1">启用</option>
          <option value="0">禁用</option>
        </select>
        <button v-if="hasFilter" class="btn btn-secondary btn-sm" @click="resetFilters">重置</button>
      </div>
    </FilterBar>

    <div v-if="message" class="banner">{{ message }}</div>

    <section class="panel">
      <div class="section-head">
        <div>
          <h3>阶梯报价配置</h3>
          <p>按机型维护总价区间和续租日价，运营侧直接查看状态并处理启停。</p>
        </div>
        <button class="btn btn-primary" @click="openCreate">新增报价</button>
      </div>
      <div v-if="groupedRows.length" class="price-card-grid">
        <PriceConfigCard
          v-for="group in groupedRows"
          :key="group.modelCode"
          :group="group"
          :menu-items="groupMenuItems(group)"
          @edit="openEdit"
          @toggle="toggleGroupActive"
          @menu="handleGroupMenu(group, $event)"
        />
      </div>
      <div v-else class="empty-block">暂无报价配置</div>
    </section>

    <section ref="ruleSectionRef" class="panel">
      <div class="section-head">
        <div>
          <h3>免押规则</h3>
          <p>按设备价值区间定义芝麻分门槛。查询档期时会直接带出对应说明。</p>
        </div>
        <button class="btn btn-primary" @click="openCreateRule">新增规则</button>
      </div>
      <DataTable>
        <thead>
          <tr>
            <th>设备价值区间</th>
            <th class="num">最低芝麻分</th>
            <th>备注</th>
            <th>状态</th>
            <th class="op">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in ruleRows" :key="row.id">
            <td>{{ formatAssetRange(row) }}</td>
            <td class="num">{{ row.min_zhima_score }}</td>
            <td class="remark">{{ row.remark || '—' }}</td>
            <td>
              <StatusBadge :label="row.active ? '启用' : '禁用'" :variant="row.active ? 'success' : 'neutral'" />
            </td>
            <td class="op">
              <button class="btn btn-sm btn-secondary" @click="openEditRule(row)">编辑</button>
              <RowActionMenu :items="ruleMenuItems(row)" @select="handleRuleMenu(row, $event)" />
            </td>
          </tr>
          <tr v-if="!ruleRows.length">
            <td colspan="5" class="empty">暂无免押规则</td>
          </tr>
        </tbody>
      </DataTable>
    </section>

    <div v-if="modal.show" class="modal-mask" @click.self="closeModal">
      <div class="modal-card modal-card-wide">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeModal">✕</button>
        </div>
        <header class="modal-head">
          <h3>{{ modal.editing ? '编辑报价' : '新增报价' }}</h3>
        </header>
        <div class="modal-body">
          <div class="form-row">
            <label>机型 <span class="req">*</span></label>
            <select v-model="modal.form.modelCode" class="form-select">
              <option value="" disabled>选择型号</option>
              <option v-for="model in modelOptions" :key="model" :value="model">{{ model }}</option>
            </select>
          </div>

          <div class="form-row">
            <div class="ladder-head">
              <label>阶梯总价 <span class="req">*</span></label>
              <div class="ladder-actions">
                <button class="btn btn-secondary btn-sm" @click="addTier">增加一天</button>
                <button class="btn btn-secondary btn-sm" :disabled="modal.form.tiers.length <= 1" @click="removeLastTier">删除最后一天</button>
              </div>
            </div>
            <div class="tier-editor">
              <div v-for="tier in modal.form.tiers" :key="tier.day" class="tier-editor-row">
                <div class="tier-day">第 {{ tier.day }} 天</div>
                <input v-model.number="tier.totalPrice" type="number" min="0" step="0.01" placeholder="输入该租期总价" />
              </div>
            </div>
            <p class="hint">这里填的是该租期的固定总价，不是平均日价。例如 3 天总价 90，就直接填 90。</p>
          </div>

          <div class="form-row-2">
            <div class="form-row">
              <label>续租每天加价 (元)</label>
              <input type="number" step="0.01" min="0" v-model.number="modal.form.extensionDailyPrice" />
              <p class="hint">例如当前只配到 5 天，6 天起就在 5 天总价基础上按这里每天继续加。</p>
            </div>
            <div class="form-row">
              <label>旧押金字段 (元)</label>
              <input type="number" step="0.01" min="0" v-model.number="modal.form.deposit" />
              <p class="hint">兼容老数据，免押说明以后面规则表为准。</p>
            </div>
          </div>

          <div class="form-row">
            <label>备注</label>
            <input v-model="modal.form.remark" placeholder="如 标准价、节假日价、含配件" />
          </div>
          <div class="form-row">
            <label>
              <input type="checkbox" v-model="modal.form.active" />
              启用
            </label>
          </div>
        </div>
        <footer class="modal-foot">
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
        </footer>
      </div>
    </div>

    <div v-if="ruleModal.show" class="modal-mask" @click.self="closeRuleModal">
      <div class="modal-card modal-card-wide">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeRuleModal">✕</button>
        </div>
        <header class="modal-head">
          <h3>{{ ruleModal.editing ? '编辑免押规则' : '新增免押规则' }}</h3>
        </header>
        <div class="modal-body">
          <div class="form-row-2">
            <div class="form-row">
              <label>最低设备价值 (元) <span class="req">*</span></label>
              <input type="number" step="0.01" min="0" v-model.number="ruleModal.form.minAssetValue" />
            </div>
            <div class="form-row">
              <label>最高设备价值 (元)</label>
              <input type="number" step="0.01" min="0" v-model.number="ruleModal.form.maxAssetValue" placeholder="留空表示无上限" />
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-row">
              <label>最低芝麻分 <span class="req">*</span></label>
              <input type="number" min="0" step="1" v-model.number="ruleModal.form.minZhimaScore" />
            </div>
            <div class="form-row">
              <label>排序</label>
              <input type="number" min="0" step="1" v-model.number="ruleModal.form.sortOrder" />
            </div>
          </div>
          <div class="form-row">
            <label>备注</label>
            <input v-model="ruleModal.form.remark" placeholder="如 高价值机型、旗舰机" />
          </div>
          <div class="form-row">
            <label>
              <input type="checkbox" v-model="ruleModal.form.active" />
              启用
            </label>
          </div>
        </div>
        <footer class="modal-foot">
          <button class="btn btn-secondary" @click="closeRuleModal">取消</button>
          <button class="btn btn-primary" :disabled="savingRule" @click="saveRule">{{ savingRule ? '保存中…' : '保存' }}</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import FilterBar from '../../components/FilterBar.vue'
import DataTable from '../../components/DataTable.vue'
import KpiStrip from '../../components/KpiStrip.vue'
import PageHeader from '../../components/PageHeader.vue'
import PriceConfigCard from '../../components/PriceConfigCard.vue'
import RowActionMenu from '../../components/RowActionMenu.vue'
import StatusBadge from '../../components/StatusBadge.vue'

const rawRows = ref([])
const ruleRows = ref([])
const scheduleUnits = ref([])
const message = ref('')
const saving = ref(false)
const savingRule = ref(false)
const ruleSectionRef = ref(null)
const filters = reactive({ keyword: '', modelCode: '', active: '' })

const hasFilter = computed(() => filters.keyword || filters.modelCode || filters.active !== '')

const modelOptions = computed(() => {
  const set = new Set()
  for (const unit of scheduleUnits.value || []) {
    const modelCode = String(unit.model_code || unit.modelCode || '').trim()
    if (modelCode) set.add(modelCode)
  }
  for (const row of rawRows.value || []) {
    const modelCode = String(row.model_code || '').trim()
    if (modelCode) set.add(modelCode)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
})

const groupedRows = computed(() => summarizePricingRows(rawRows.value))
const enabledGroupCount = computed(() => groupedRows.value.filter((group) => group.active).length)
const enabledRuleCount = computed(() => ruleRows.value.filter((row) => row.active).length)
const coverageStatus = computed(() => getRuleCoverageStatus(ruleRows.value))
const pricingValidationItems = computed(() => [
  {
    key: 'model_count',
    label: '已配置机型数量',
    value: groupedRows.value.length,
    hint: '报价机型',
    tone: 'info',
  },
  {
    key: 'enabled_price_count',
    label: '启用报价数量',
    value: enabledGroupCount.value,
    hint: '当前可用',
    tone: 'success',
  },
  {
    key: 'enabled_rule_count',
    label: '启用免押规则数量',
    value: enabledRuleCount.value,
    hint: '风控门槛',
    tone: 'warning',
  },
  {
    key: 'coverage_status',
    label: '区间覆盖状态',
    value: coverageStatus.value.label,
    hint: coverageStatus.value.hint,
    tone: coverageStatus.value.complete ? 'success' : 'danger',
    emphasis: !coverageStatus.value.complete,
  },
])

const modal = reactive({
  show: false,
  editing: false,
  form: emptyPricingForm(),
})

const ruleModal = reactive({
  show: false,
  editing: false,
  form: emptyRuleForm(),
})

function emptyPricingForm() {
  return {
    sourceModelCode: '',
    modelCode: '',
    tiers: [{ day: 1, totalPrice: 0 }],
    extensionDailyPrice: 0,
    deposit: 0,
    remark: '',
    active: true,
  }
}

function emptyRuleForm() {
  return {
    id: null,
    minAssetValue: 0,
    maxAssetValue: null,
    minZhimaScore: 600,
    remark: '',
    sortOrder: 100,
    active: true,
  }
}

function summarizePricingRows(rows = []) {
  const map = new Map()
  for (const row of rows || []) {
    const modelCode = String(row.model_code || '').trim()
    if (!modelCode) continue
    const day = Number.parseInt(String(row.max_days || row.min_days || 0), 10) || 0
    if (day < 1) continue
    const current = map.get(modelCode) || {
      modelCode,
      tiers: [],
      extensionDailyPrice: 0,
      deposit: 0,
      remark: '',
      active: false,
    }
    current.tiers.push({
      id: row.id,
      day,
      totalPrice: resolveRowTotal(row),
    })
    current.extensionDailyPrice = Math.max(current.extensionDailyPrice, Number(row.extension_daily_price || 0))
    current.deposit = Math.max(current.deposit, Number(row.deposit || 0))
    if (!current.remark && row.remark) current.remark = row.remark
    if (row.active) current.active = true
    map.set(modelCode, current)
  }
  return [...map.values()]
    .map((group) => ({ ...group, tiers: group.tiers.sort((a, b) => a.day - b.day) }))
    .sort((a, b) => a.modelCode.localeCompare(b.modelCode, 'zh-Hans-CN'))
}

function getRuleCoverageStatus(rows = []) {
  const activeRows = [...rows]
    .filter((row) => row.active)
    .sort((a, b) => Number(a.min_asset_value || 0) - Number(b.min_asset_value || 0))
  if (!activeRows.length) {
    return { complete: false, label: '未配置', hint: '暂无启用规则' }
  }
  let cursor = 0
  for (const row of activeRows) {
    const min = Number(row.min_asset_value || 0)
    const max = row.max_asset_value === null || row.max_asset_value === undefined || row.max_asset_value === ''
      ? null
      : Number(row.max_asset_value)
    if (min > cursor) {
      return { complete: false, label: '待补齐', hint: `¥${cursor} - ¥${min} 缺少规则` }
    }
    if (max === null) {
      return { complete: true, label: '已覆盖', hint: '已覆盖到无上限' }
    }
    cursor = Math.max(cursor, max)
  }
  return { complete: false, label: '待补齐', hint: `¥${cursor} 以上未覆盖` }
}

async function loadAll() {
  try {
    const payload = {}
    if (filters.keyword) payload.keyword = filters.keyword
    if (filters.modelCode) payload.modelCode = filters.modelCode
    if (filters.active !== '') payload.active = filters.active
    const [pricingRows, exemptionRows, units] = await Promise.all([
      window.electronAPI.listPricing(payload),
      window.electronAPI.listDepositExemptionRules(filters.active !== '' ? { active: filters.active } : {}),
      window.electronAPI.listScheduleUnits({ activeInventoryOnly: true }),
    ])
    rawRows.value = pricingRows
    ruleRows.value = exemptionRows
    scheduleUnits.value = units || []
    message.value = ''
  } catch (e) {
    message.value = `加载失败：${e.message || e}`
  }
}

function resetFilters() {
  filters.keyword = ''
  filters.modelCode = ''
  filters.active = ''
  loadAll()
}

function scrollToRules() {
  ruleSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function openCreate() {
  Object.assign(modal.form, emptyPricingForm())
  modal.form.modelCode = modelOptions.value[0] || ''
  modal.editing = false
  modal.show = true
}

function groupMenuItems() {
  return [
    { key: 'delete', label: '删除', danger: true },
  ]
}

function ruleMenuItems(row) {
  return [
    { key: 'toggle', label: row.active ? '停用规则' : '启用规则' },
    { key: 'delete', label: '删除', danger: true },
  ]
}

function openEdit(group) {
  modal.form.sourceModelCode = group.modelCode
  modal.form.modelCode = group.modelCode
  modal.form.tiers = group.tiers.map((tier) => ({ day: tier.day, totalPrice: tier.totalPrice }))
  modal.form.extensionDailyPrice = Number(group.extensionDailyPrice || 0)
  modal.form.deposit = Number(group.deposit || 0)
  modal.form.remark = group.remark || ''
  modal.form.active = !!group.active
  modal.editing = true
  modal.show = true
}

function closeModal() {
  modal.show = false
}

function addTier() {
  const nextDay = modal.form.tiers.length + 1
  modal.form.tiers.push({ day: nextDay, totalPrice: 0 })
}

function removeLastTier() {
  if (modal.form.tiers.length <= 1) return
  modal.form.tiers.pop()
}

function normalizeTiers(tiers = []) {
  return tiers.map((tier, index) => ({
    day: index + 1,
    totalPrice: Number(tier.totalPrice || 0),
  }))
}

function openCreateRule() {
  Object.assign(ruleModal.form, emptyRuleForm())
  ruleModal.editing = false
  ruleModal.show = true
}

function openEditRule(row) {
  ruleModal.form.id = row.id
  ruleModal.form.minAssetValue = Number(row.min_asset_value || 0)
  ruleModal.form.maxAssetValue = row.max_asset_value === null || row.max_asset_value === undefined ? null : Number(row.max_asset_value)
  ruleModal.form.minZhimaScore = Number(row.min_zhima_score || 0)
  ruleModal.form.remark = row.remark || ''
  ruleModal.form.sortOrder = Number(row.sort_order || 100)
  ruleModal.form.active = !!row.active
  ruleModal.editing = true
  ruleModal.show = true
}

function closeRuleModal() {
  ruleModal.show = false
}

function formatMoney(value) {
  return `¥${Number(value || 0).toFixed(2)}`
}

function resolveRowTotal(row) {
  const days = Math.max(1, Number(row.max_days || row.min_days || 1))
  return Number(row.total_price ?? 0) > 0 ? Number(row.total_price) : Number(row.daily_price || 0) * days
}

function formatAssetRange(row) {
  const min = Number(row.min_asset_value || 0).toFixed(0)
  const max = row.max_asset_value === null || row.max_asset_value === undefined || row.max_asset_value === ''
    ? '以上'
    : `${Number(row.max_asset_value).toFixed(0)}`
  return max === '以上' ? `¥${min} 及以上` : `¥${min} - ¥${max}`
}

async function toggleGroupActive(group) {
  saving.value = true
  try {
    const payload = {
      sourceModelCode: group.modelCode,
      modelCode: group.modelCode,
      tierPrices: group.tiers.map((tier) => Number(tier.totalPrice || 0)),
      extensionDailyPrice: Number(group.extensionDailyPrice || 0),
      deposit: Number(group.deposit || 0),
      remark: group.remark || '',
      active: group.active ? 0 : 1,
    }
    const res = await window.electronAPI.savePricingLadder(payload)
    if (res?.ok === false) {
      window.$toast?.(res.message || '状态更新失败', 'error')
      return
    }
    window.$toast?.(`报价已${group.active ? '停用' : '启用'}`, 'success')
    await loadAll()
  } catch (e) {
    window.$toast?.(`状态更新失败：${e.message || e}`, 'error')
  } finally {
    saving.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const normalizedTiers = normalizeTiers(modal.form.tiers)
    if (!modal.form.modelCode) {
      window.$toast?.('请先选择型号', 'error')
      return
    }
    if (normalizedTiers.some((tier) => !Number.isFinite(tier.totalPrice) || tier.totalPrice < 0)) {
      window.$toast?.('阶梯价格必须是非负数', 'error')
      return
    }
    const payload = {
      sourceModelCode: modal.form.sourceModelCode || modal.form.modelCode,
      modelCode: modal.form.modelCode.trim(),
      tierPrices: normalizedTiers.map((tier) => tier.totalPrice),
      extensionDailyPrice: modal.form.extensionDailyPrice,
      deposit: modal.form.deposit,
      remark: modal.form.remark,
      active: modal.form.active ? 1 : 0,
    }
    const res = await window.electronAPI.savePricingLadder(payload)
    if (res.ok === false) {
      window.$toast?.(res.message || '保存失败', 'error')
      return
    }
    window.$toast?.('已保存', 'success')
    modal.show = false
    await loadAll()
  } catch (e) {
    window.$toast?.(`保存失败：${e.message || e}`, 'error')
  } finally {
    saving.value = false
  }
}

async function saveRule() {
  savingRule.value = true
  try {
    const payload = {
      id: ruleModal.form.id || undefined,
      minAssetValue: ruleModal.form.minAssetValue,
      maxAssetValue: ruleModal.form.maxAssetValue === null || ruleModal.form.maxAssetValue === '' ? null : ruleModal.form.maxAssetValue,
      minZhimaScore: ruleModal.form.minZhimaScore,
      adultRequired: 1,
      realNameRequired: 1,
      unsupportedCertText: '港澳通行证不支持',
      depositMode: 'asset_value',
      fixedDepositAmount: 0,
      remark: ruleModal.form.remark,
      sortOrder: ruleModal.form.sortOrder,
      active: ruleModal.form.active ? 1 : 0,
    }
    const res = await window.electronAPI.upsertDepositExemptionRule(payload)
    if (res.ok === false) {
      window.$toast?.(res.message || '保存失败', 'error')
      return
    }
    window.$toast?.('已保存', 'success')
    ruleModal.show = false
    await loadAll()
  } catch (e) {
    window.$toast?.(`保存失败：${e.message || e}`, 'error')
  } finally {
    savingRule.value = false
  }
}

async function removeGroup(group) {
  if (!confirm(`确定删除机型 ${group.modelCode} 的整套报价吗？`)) return
  try {
    const res = await window.electronAPI.deletePricingByModel({ modelCode: group.modelCode })
    if (res.ok) {
      window.$toast?.('已删除', 'success')
      await loadAll()
      return
    }
    window.$toast?.(res.message || '删除失败', 'error')
  } catch (e) {
    window.$toast?.(`删除失败：${e.message || e}`, 'error')
  }
}

async function handleGroupMenu(group, item) {
  if (item?.key === 'delete') {
    await removeGroup(group)
  }
}

async function toggleRuleActive(row) {
  savingRule.value = true
  try {
    const payload = {
      id: row.id,
      minAssetValue: Number(row.min_asset_value || 0),
      maxAssetValue: row.max_asset_value === null || row.max_asset_value === undefined || row.max_asset_value === '' ? null : Number(row.max_asset_value),
      minZhimaScore: Number(row.min_zhima_score || 0),
      adultRequired: Number(row.adult_required ?? 1),
      realNameRequired: Number(row.real_name_required ?? 1),
      unsupportedCertText: row.unsupported_cert_text || '港澳通行证不支持',
      depositMode: row.deposit_mode || 'asset_value',
      fixedDepositAmount: Number(row.fixed_deposit_amount || 0),
      remark: row.remark || '',
      sortOrder: Number(row.sort_order || 100),
      active: row.active ? 0 : 1,
    }
    const res = await window.electronAPI.upsertDepositExemptionRule(payload)
    if (res?.ok === false) {
      window.$toast?.(res.message || '状态更新失败', 'error')
      return
    }
    window.$toast?.(`规则已${row.active ? '停用' : '启用'}`, 'success')
    await loadAll()
  } catch (e) {
    window.$toast?.(`状态更新失败：${e.message || e}`, 'error')
  } finally {
    savingRule.value = false
  }
}

async function removeRule(row) {
  if (!confirm(`确定删除设备价值区间 ${formatAssetRange(row)} 的免押规则？`)) return
  try {
    const res = await window.electronAPI.deleteDepositExemptionRule({ id: row.id })
    if (res.ok) {
      window.$toast?.('已删除', 'success')
      await loadAll()
      return
    }
    window.$toast?.(res.message || '删除失败', 'error')
  } catch (e) {
    window.$toast?.(`删除失败：${e.message || e}`, 'error')
  }
}

async function handleRuleMenu(row, item) {
  if (item?.key === 'toggle') {
    await toggleRuleActive(row)
    return
  }
  if (item?.key === 'delete') {
    await removeRule(row)
  }
}

onMounted(loadAll)
</script>

<style scoped>
.page { padding: 12px 18px 24px; }
.panel { background: var(--panel-bg, #fff); border-radius: 12px; padding: 14px; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); margin-bottom: 14px; }
.section-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
.section-head h3 { margin: 0; font-size: 16px; }
.section-head p { margin: 4px 0 0; color: #667085; font-size: 13px; }
.pricing-overview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
}
.pricing-overview strong { display: block; font-size: 14px; color: var(--text-strong); }
.pricing-overview p { margin: 4px 0 0; font-size: 12px; color: var(--text-secondary); }
.pricing-overview.risk {
  border-color: rgba(220, 38, 38, 0.2);
  background: rgba(254, 242, 242, 0.9);
}
.price-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
.empty-block { display: flex; align-items: center; justify-content: center; min-height: 140px; border: 1px dashed #d1d5db; border-radius: 12px; color: #6b7280; background: #fafafa; }

.filter-row { display: grid; grid-template-columns: minmax(240px, 1.4fr) minmax(180px, 1fr) 140px auto; gap: 10px; align-items: center; }
.filter-field { display: flex; align-items: center; background: #f5f6f8; border: 1px solid #e5e7eb; border-radius: 10px; padding: 4px 10px; flex: 1; min-width: 220px; }
.filter-field input { background: transparent; border: none; outline: none; flex: 1; padding: 4px 6px; }
.ff-icon { opacity: 0.6; margin-right: 4px; }
.ff-select, .form-select { background: #fff; border: 1px solid #dcdfe3; border-radius: 10px; padding: 8px 10px; min-width: 0; }
.banner { padding: 10px 14px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; margin-bottom: 12px; }

.pricing-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.pricing-table th, .pricing-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eef0f3; font-size: 13px; vertical-align: top; }
.pricing-table th { background: #fafbfc; font-weight: 600; color: #555; }
.pricing-table td.num, .pricing-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
.pricing-table td.op, .pricing-table th.op { text-align: right; white-space: nowrap; width: 132px; }
.pricing-table td.op .btn + .btn { margin-left: 6px; }
.pricing-table td.remark { color: #666; }
.pricing-table td.empty { text-align: center; color: #999; padding: 28px 0; }
.pricing-table code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px; }

.tier-list { display: flex; flex-wrap: wrap; gap: 6px; }
.tier-chip { display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 999px; background: #f4f6f8; color: #344054; font-size: 12px; }

.pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.pill-on { background: #d1fae5; color: #065f46; }
.pill-off { background: #f3f4f6; color: #6b7280; }

.modal-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-card { background: #fff; border-radius: 10px; width: 560px; max-width: 94vw; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15); overflow: hidden; }
.modal-card-wide { width: 680px; }
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #eef0f3; }
.modal-head h3 { margin: 0; font-size: 16px; }
.btn-close { background: transparent; border: none; cursor: pointer; font-size: 18px; color: #999; }
.modal-body { padding: 16px 18px; max-height: 72vh; overflow: auto; }
.modal-foot { padding: 12px 18px; border-top: 1px solid #eef0f3; display: flex; justify-content: flex-end; gap: 8px; }

.form-row { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.form-row label { font-size: 13px; color: #555; }
.form-row input[type="text"],
.form-row input[type="number"],
.form-row input:not([type]) { padding: 8px 10px; border: 1px solid #dcdfe3; border-radius: 6px; }
.form-row-2 { display: flex; gap: 12px; }
.form-row-2 .form-row { flex: 1; }
.req { color: #dc2626; }
.hint { margin: 0; font-size: 12px; line-height: 1.5; color: #8a94a6; }

.ladder-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ladder-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.tier-editor { display: grid; gap: 8px; }
.tier-editor-row { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 10px; align-items: center; }
.tier-day { font-size: 13px; color: #344054; font-weight: 600; }

.btn { padding: 6px 14px; border-radius: 10px; border: none; cursor: pointer; font-size: 13px; }
.btn-primary { background: #0f766e; color: #fff; }
.btn-primary:hover { background: #0d5f59; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: #f3f4f6; color: #333; }
.btn-danger { background: #fee2e2; color: #b91c1c; }
.btn-sm { padding: 4px 10px; font-size: 12px; }

@media (max-width: 1200px) {
  .pricing-table { table-layout: auto; }
  .filter-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 768px) {
  .page { padding: 12px 14px 28px; }
  .section-head,
  .pricing-overview,
  .form-row-2,
  .ladder-head { flex-direction: column; align-items: stretch; }
  .filter-row { grid-template-columns: 1fr; }
  .tier-editor-row { grid-template-columns: 1fr; }
}
</style>
