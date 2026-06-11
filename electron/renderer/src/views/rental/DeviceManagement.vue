<template>
  <div class="page device-page">
    <PageHeader
      title="设备管理"
      subtitle="按型号管理租赁设备：快速掌握每个型号有几台空闲、当前在哪、买入成本和残值。"
      :breadcrumb="['经营管理', '设备管理']"
    >
      <template #actions>
        <div class="view-toggle">
          <button class="vt-btn" :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'">卡片</button>
          <button class="vt-btn" :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">表格</button>
        </div>
        <button class="btn btn-secondary" @click="loadUnits">刷新</button>
        <button class="btn btn-primary" @click="openCreateModal">新增型号 / 设备</button>
      </template>
    </PageHeader>

    <!-- 汇总 KPI -->
    <div class="kpi-strip">
      <button class="kpi kpi-total" :class="{ active: filters.status === '' }" @click="setStatus('')">
        <div class="kpi-icon">总</div>
        <div class="kpi-body">
          <div class="kpi-val">{{ units.length }}</div>
          <div class="kpi-lbl">设备总数</div>
        </div>
      </button>
      <button class="kpi kpi-idle" :class="{ active: filters.status === 'idle' }" @click="setStatus('idle')">
        <div class="kpi-icon">租</div>
        <div class="kpi-body">
          <div class="kpi-val">{{ countsByStatus.idle || 0 }}</div>
          <div class="kpi-lbl">可租赁</div>
        </div>
      </button>
      <button class="kpi kpi-busy" :class="{ active: filters.status === 'busy' }" @click="setStatus('busy')">
        <div class="kpi-icon">出</div>
        <div class="kpi-body">
          <div class="kpi-val">{{ countsByStatus.busy || 0 }}</div>
          <div class="kpi-lbl">已出租</div>
        </div>
      </button>
      <button class="kpi kpi-repair" :class="{ active: filters.status === 'repair' }" @click="setStatus('repair')">
        <div class="kpi-icon">修</div>
        <div class="kpi-body">
          <div class="kpi-val">{{ countsByStatus.repair || 0 }}</div>
          <div class="kpi-lbl">维修中</div>
        </div>
      </button>
      <button class="kpi kpi-lost" :class="{ active: filters.status === 'offline' }" @click="setStatus('offline')">
        <div class="kpi-icon">停</div>
        <div class="kpi-body">
          <div class="kpi-val">{{ countsByStatus.offline || 0 }}</div>
          <div class="kpi-lbl">停用 / 已损失</div>
        </div>
      </button>
      <div class="kpi kpi-money">
        <div class="kpi-icon">资</div>
        <div class="kpi-body">
          <div class="kpi-val">¥{{ formatMoney(totalAssetValue) }}</div>
          <div class="kpi-lbl">资产总值</div>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <section class="panel filter-panel">
      <div class="filter-row">
        <div class="filter-field">
          <span class="ff-icon">搜</span>
          <input v-model="filters.keyword" placeholder="搜索设备编码 / 序列号 / 城市 / 备注" @keyup.enter="loadUnits" />
        </div>
        <div class="filter-field short">
          <span class="ff-icon">型</span>
          <select v-model="filters.modelCode" @change="loadUnits">
            <option value="">全部型号</option>
            <option v-for="model in modelFilterOptions" :key="model" :value="model">{{ model }}</option>
          </select>
        </div>
        <div class="status-chips">
          <button v-for="s in statusOptions" :key="s.key"
            class="sc-chip" :class="[`sc-${s.key || 'all'}`, { active: filters.status === s.key }]"
            @click="setStatus(s.key)">
            <span class="sc-dot"></span>
            {{ s.label }}
            <span v-if="s.key" class="sc-num">{{ countsByStatus[s.key] || 0 }}</span>
          </button>
        </div>
        <button v-if="hasActiveFilter" class="btn btn-secondary btn-sm" @click="resetFilters">重置</button>
      </div>
    </section>

    <div v-if="message" class="banner">{{ message }}</div>

    <!-- 卡片视图 -->
    <section v-if="viewMode === 'card'" class="model-grid">
      <article v-for="group in groupedUnits" :key="group.modelCode" class="model-card">
        <header class="mc-head">
          <div class="mc-title">
            <div class="mc-ico">型</div>
            <div>
              <div class="mc-code">{{ group.modelCode }}</div>
              <div class="mc-meta">{{ group.count }} 台 · ¥{{ formatMoney(group.assetValue) }}</div>
            </div>
          </div>
          <div class="mc-actions">
            <button class="btn btn-sm btn-secondary" @click="openModelEditModal(group.modelCode)" title="编辑该型号的统一信息">编辑型号</button>
            <button class="btn btn-sm btn-secondary" @click="quickAdd(group.modelCode)" title="为该型号追加设备">追加一台</button>
          </div>
        </header>

        <!-- 占用条 -->
        <div class="mc-bar" :title="`可租 ${group.idleCount} / 已出租 ${group.busyCount} / 维修 ${group.repairCount} / 停用 ${group.offlineCount}`">
          <div class="mcb-seg mcb-idle"    :style="{ flex: group.idleCount }"    v-if="group.idleCount > 0"></div>
          <div class="mcb-seg mcb-busy"    :style="{ flex: group.busyCount }"    v-if="group.busyCount > 0"></div>
          <div class="mcb-seg mcb-repair"  :style="{ flex: group.repairCount }"  v-if="group.repairCount > 0"></div>
          <div class="mcb-seg mcb-offline" :style="{ flex: group.offlineCount }" v-if="group.offlineCount > 0"></div>
          <div class="mcb-seg mcb-idle mcb-empty" v-if="group.count === 0"></div>
        </div>
        <div class="mc-stats">
          <span class="mcs-item mcs-idle">● 可租 <b>{{ group.idleCount }}</b></span>
          <span class="mcs-item mcs-busy">● 已出租 <b>{{ group.busyCount }}</b></span>
          <span class="mcs-item mcs-repair" v-if="group.repairCount > 0">● 维修 <b>{{ group.repairCount }}</b></span>
          <span class="mcs-item mcs-offline" v-if="group.offlineCount > 0">● 停用 <b>{{ group.offlineCount }}</b></span>
        </div>

        <!-- 设备胶囊 -->
        <div class="unit-chips">
          <button v-for="unit in group.rows" :key="unit.id"
            class="unit-chip"
            :class="`uc-${unit.status || 'idle'}`"
            :title="unitTitle(unit)"
            @click="openEditModal(unit)">
            <span class="uc-dot"></span>
            <span class="uc-code">{{ unit.unit_code }}</span>
            <span v-if="unit.city" class="uc-city">· {{ unit.city }}</span>
          </button>
          <button class="unit-chip uc-add" @click="quickAdd(group.modelCode)">＋ 追加一台</button>
        </div>
      </article>

      <EmptyState
        v-if="groupedUnits.length === 0"
        icon="📦"
        tone="primary"
        title="还没有任何设备"
        hint="先创建一个型号，后续同型号设备可以直接追加一台或批量追加。"
      >
        <button class="btn btn-primary" @click="openCreateModal">＋ 新增型号 / 第一台设备</button>
      </EmptyState>
    </section>

    <!-- 表格视图 -->
    <section v-else class="panel">
      <div class="panel-header">
        <div>
          <h3>设备资产清单</h3>
          <div class="panel-tip">传统表格视图，适合批量查看或导出。</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>型号</th>
              <th>设备编码</th>
              <th>序列号</th>
              <th>城市</th>
              <th>状态</th>
              <th class="t-right">买入费用</th>
              <th class="t-right">机器残值</th>
              <th>备注</th>
              <th>创建时间</th>
              <th class="t-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="unit in flatFilteredUnits" :key="unit.id">
              <td><b>{{ unit.model_code }}</b></td>
              <td>{{ unit.unit_code }}</td>
              <td>{{ unit.serial_no || '-' }}</td>
              <td>{{ unit.city || '-' }}</td>
              <td><span class="status-tag" :class="`st-${unit.status || 'idle'}`">{{ statusLabel(unit.status) }}</span></td>
              <td class="t-right">¥{{ formatMoney(unit.purchase_cost) }}</td>
              <td class="t-right">¥{{ formatMoney(unit.residual_value) }}</td>
              <td class="text-cell">{{ unit.note || '-' }}</td>
              <td>{{ formatDateTime(unit.created_at) }}</td>
              <td class="actions t-right">
                <button class="btn btn-secondary btn-sm" @click="openEditModal(unit)">编辑</button>
                <button class="btn btn-danger btn-sm" @click="removeUnit(unit)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-if="flatFilteredUnits.length === 0" icon="📭" title="没有匹配的设备" hint="尝试调整筛选条件或重置。" compact />
      </div>
    </section>

    <div v-if="showModelModal" class="modal-overlay" @click.self="closeModelModal">
      <div class="modal cardish model-edit-modal">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeModelModal">✕</button>
        </div>
        <div class="panel-header">
          <div>
            <h3>编辑型号</h3>
            <div class="panel-tip">统一修改当前设备池内该型号的价格和默认信息。</div>
          </div>
        </div>
        <div class="model-edit-summary">
          <div class="append-title">{{ modelForm.modelCode }}</div>
          <div class="append-tip">本次只会批量更新当前设备池内的 {{ modelUnitCount }} 台设备；历史导入/已退出现役的设备不参与维护。</div>
        </div>
        <div class="form-grid device-form-grid">
          <div class="form-group">
            <label>统一买入费用 (¥)</label>
            <input v-model="modelForm.purchaseCost" type="number" min="0" placeholder="留空则不覆盖" />
            <div class="field-hint">留空表示保留每台设备各自的真实买入价。</div>
          </div>
          <div class="form-group">
            <label>统一机器残值 (¥)</label>
            <input v-model="modelForm.residualValue" type="number" min="0" placeholder="留空则不覆盖" />
            <div class="field-hint">留空表示不批量覆盖单机残值。</div>
          </div>
          <div class="form-group">
            <label>统一所在城市</label>
            <input v-model="modelForm.city" placeholder="如 成都 / 深圳" />
          </div>
          <div class="form-group span-2">
            <label>统一备注</label>
            <input v-model="modelForm.note" placeholder="会覆盖这个型号下所有设备的备注" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" @click="saveModelSettings" :disabled="!modelForm.modelCode">保存型号设置</button>
          <button class="btn btn-secondary" @click="closeModelModal">取消</button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal cardish device-modal">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeModal">✕</button>
        </div>
        <div class="panel-header">
          <div>
            <h3>{{ editingUnit ? '编辑设备' : (form.modelCode ? `追加 ${form.modelCode}` : '新增型号 / 设备') }}</h3>
            <div class="panel-tip">{{ editingUnit ? '单独维护这台设备的状态、成本和备注。' : '先填型号；设备编号可自动按现有编号递增。' }}</div>
          </div>
        </div>
        <div v-if="!editingUnit" class="append-box">
          <div>
            <div class="append-title">{{ existingModelCount ? `当前型号已有 ${existingModelCount} 台` : '新型号会创建第一台设备' }}</div>
            <div class="append-tip">留空设备编码时，将自动生成 {{ previewUnitCodes.join('、') || '下一台编号' }}。</div>
          </div>
          <div class="form-group quantity-field">
            <label>新增台数</label>
            <input v-model.number="form.quantity" type="number" min="1" max="50" />
          </div>
        </div>
        <div class="form-grid device-form-grid">
          <div class="form-group">
            <label>型号编码 *</label>
            <input v-model="form.modelCode" placeholder="如 大疆Pocket4 / 佳能G12" />
          </div>
          <div class="form-group">
            <label>{{ editingUnit ? '设备编码 *' : '首台设备编码' }}</label>
            <input v-model="form.unitCode" :placeholder="previewUnitCodes[0] || '留空自动生成'" />
          </div>
          <div class="form-group">
            <label>序列号</label>
            <input v-model="form.serialNo" placeholder="序列号 / 机身号" />
          </div>
          <div class="form-group">
            <label>所在城市</label>
            <input v-model="form.city" placeholder="如 深圳 / 上海" />
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status">
              <option value="idle">可租赁</option>
              <option value="busy">已出租</option>
              <option value="repair">维修中</option>
              <option value="offline">停用</option>
            </select>
          </div>
          <div class="form-group">
            <label>买入费用 (¥)</label>
            <input v-model.number="form.purchaseCost" type="number" min="0" placeholder="0" />
          </div>
          <div class="form-group">
            <label>机器残值 (¥)</label>
            <input v-model.number="form.residualValue" type="number" min="0" placeholder="默认免押押金" />
          </div>
          <div class="form-group span-2">
            <label>备注</label>
            <input v-model="form.note" placeholder="如 附送闪光灯 / 有小划痕" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" @click="saveUnit" :disabled="!form.modelCode || (editingUnit && !form.unitCode)">
            {{ editingUnit ? '保存修改' : createButtonLabel }}
          </button>
          <button v-if="editingUnit" class="btn btn-danger" @click="removeFromModal">删除此设备</button>
          <button class="btn btn-secondary" @click="closeModal">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '../../components/PageHeader.vue'
import EmptyState from '../../components/EmptyState.vue'
import { runViewInitialization } from '../../utils/viewInitialization.mjs'

const units = ref([])
const unitCodeSourceUnits = ref([])
const unitCodeOccupiedUnits = ref([])
const modelFilterOptions = ref([])
const message = ref('')
const showModal = ref(false)
const showModelModal = ref(false)
const editingUnit = ref(null)
const viewMode = ref('card')
const filters = reactive({ modelCode: '', status: '', keyword: '' })
const form = reactive({ modelCode: '', unitCode: '', serialNo: '', city: '', status: 'idle', note: '', purchaseCost: 0, residualValue: 0, quantity: 1 })
const modelForm = reactive({ modelCode: '', city: '', note: '', purchaseCost: '', residualValue: '' })

const statusOptions = [
  { key: '', label: '全部' },
  { key: 'idle', label: '可租赁' },
  { key: 'busy', label: '已出租' },
  { key: 'repair', label: '维修中' },
  { key: 'offline', label: '停用' },
]

const idleCount = computed(() => units.value.filter((u) => u.status === 'idle').length)
const busyCount = computed(() => units.value.filter((u) => u.status === 'busy' || u.status === 'offline').length)
const totalAssetValue = computed(() => Number(units.value.reduce((s, u) => s + Number(u.purchase_cost || 0), 0).toFixed(2)))

const countsByStatus = computed(() => {
  const acc = { idle: 0, busy: 0, offline: 0, repair: 0 }
  for (const u of units.value) {
    if (acc[u.status] != null) acc[u.status] += 1
  }
  return acc
})

const hasActiveFilter = computed(() => !!(filters.modelCode || filters.status || filters.keyword))

const existingModelUnits = computed(() => {
  const modelCode = form.modelCode.trim()
  if (!modelCode) return []
  return units.value.filter((unit) => unit.model_code === modelCode)
})

const existingModelCount = computed(() => existingModelUnits.value.length)

const previewUnitCodes = computed(() => {
  if (editingUnit.value || !form.modelCode.trim()) return []
  const sourceUnits = unitCodeSourceUnits.value.length ? unitCodeSourceUnits.value : units.value
  const occupiedUnits = unitCodeOccupiedUnits.value.length ? unitCodeOccupiedUnits.value : units.value
  return generateUnitCodes(form.modelCode, normalizeQuantity(form.quantity), form.unitCode, sourceUnits, occupiedUnits)
})

const createButtonLabel = computed(() => {
  const quantity = normalizeQuantity(form.quantity)
  if (quantity > 1) return `新增 ${quantity} 台设备`
  return existingModelCount.value ? '追加一台设备' : '新增第一台设备'
})

const modelUnitCount = computed(() => units.value.filter((unit) => unit.model_code === modelForm.modelCode).length)

const flatFilteredUnits = computed(() => {
  return units.value
    .slice()
    .sort((a, b) => (a.model_code || '').localeCompare(b.model_code || '') || (a.unit_code || '').localeCompare(b.unit_code || ''))
})

const groupedUnits = computed(() => {
  const map = new Map()
  for (const unit of flatFilteredUnits.value) {
    const code = unit.model_code || '未分类'
    if (!map.has(code)) {
      map.set(code, { modelCode: code, rows: [], count: 0, idleCount: 0, busyCount: 0, repairCount: 0, offlineCount: 0, assetValue: 0 })
    }
    const g = map.get(code)
    g.rows.push(unit)
    g.count += 1
    if (unit.status === 'idle') g.idleCount += 1
    else if (unit.status === 'busy') g.busyCount += 1
    else if (unit.status === 'repair') g.repairCount += 1
    else if (unit.status === 'offline') g.offlineCount += 1
    g.assetValue = Number((g.assetValue + Number(unit.purchase_cost || 0)).toFixed(2))
  }
  return Array.from(map.values()).sort((a, b) => a.modelCode.localeCompare(b.modelCode))
})

function formatDateTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}
function formatMoney(value) { return Number(value || 0).toFixed(2) }
function normalizeOptionalMoney(value) {
  const text = String(value ?? '').trim()
  if (!text) return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}
function statusLabel(status) {
  return { idle: '可租赁', busy: '已出租', repair: '维修中', offline: '停用' }[status] || status || '-'
}
function unitTitle(u) {
  return `${u.model_code} · ${u.unit_code}\n状态：${statusLabel(u.status)}\n${u.city ? '城市：' + u.city + '\n' : ''}${u.note ? '备注：' + u.note : ''}`
}

function normalizeQuantity(value) {
  const parsed = Number.parseInt(String(value || 1), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.min(parsed, 50)
}

function getModelUnits(modelCode, sourceUnits = units.value) {
  return sourceUnits.filter((unit) => unit.model_code === modelCode)
}

function getTemplateUnit(modelCode) {
  const rows = getModelUnits(modelCode)
  return rows.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0] || null
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function inferUnitCodeParts(modelCode, manualFirstCode = '', sourceUnits = units.value, currentSourceUnits = sourceUnits) {
  const existingCodes = getModelUnits(modelCode, sourceUnits).map((unit) => String(unit.unit_code || '')).filter(Boolean)
  const baseFromManual = String(manualFirstCode || '').trim().replace(/[-_\s]*\d+$/, '')
  const base = baseFromManual || String(modelCode || '').trim()
  const escapedBase = escapeRegExp(base)
  let width = 2
  const suffixPattern = new RegExp(`^${escapedBase}[-_\\s]?(\\d+)$`, 'i')
  for (const code of existingCodes) {
    const direct = code.match(suffixPattern)
    const loose = code.match(/(\d+)$/)
    const match = direct || loose
    if (!match) continue
    width = Math.max(width, match[1].length)
  }
  let maxNumber = 0
  const currentCodes = getModelUnits(modelCode, currentSourceUnits)
    .filter((unit) => unit.status !== 'offline')
    .map((unit) => String(unit.unit_code || ''))
    .filter(Boolean)
  for (const code of currentCodes) {
    const direct = code.match(suffixPattern)
    const loose = code.match(/(\d+)$/)
    const match = direct || loose
    if (!match) continue
    const value = Number.parseInt(match[1], 10)
    if (Number.isFinite(value)) maxNumber = Math.max(maxNumber, value)
  }
  const manualNumber = String(manualFirstCode || '').match(/(\d+)$/)
  if (manualNumber) {
    maxNumber = Number.parseInt(manualNumber[1], 10) - 1
    width = Math.max(width, manualNumber[1].length)
  }
  return { base, nextNumber: Math.max(1, maxNumber + 1), width }
}

function generateUnitCodes(modelCode, quantity = 1, manualFirstCode = '', sourceUnits = units.value, occupiedSourceUnits = sourceUnits) {
  const normalizedModelCode = String(modelCode || '').trim()
  if (!normalizedModelCode) return []
  const manualCode = String(manualFirstCode || '').trim()
  const occupiedCodes = new Set(occupiedSourceUnits
    .filter((unit) => unit.status !== 'offline')
    .map((unit) => String(unit.unit_code || '')))
  if (manualCode && quantity === 1 && !occupiedCodes.has(manualCode)) return [manualCode]
  const { base, nextNumber, width } = inferUnitCodeParts(normalizedModelCode, manualFirstCode, sourceUnits, occupiedSourceUnits)
  const result = []
  let current = nextNumber
  while (result.length < quantity) {
    const code = `${base}-${String(current).padStart(width, '0')}`
    if (!occupiedCodes.has(code) && !result.includes(code)) result.push(code)
    current += 1
  }
  return result
}

async function loadAllModelUnits(modelCode) {
  const normalizedModelCode = String(modelCode || '').trim()
  if (!normalizedModelCode) return []
  const rows = await window.electronAPI.listScheduleUnits({ modelCode: normalizedModelCode })
  return Array.isArray(rows) ? rows : []
}

async function loadCurrentModelUnits(modelCode) {
  const normalizedModelCode = String(modelCode || '').trim()
  if (!normalizedModelCode) return []
  const rows = await window.electronAPI.listScheduleUnits({ modelCode: normalizedModelCode })
  return Array.isArray(rows) ? rows.filter((row) => row.status !== 'offline') : []
}

function setStatus(key) {
  filters.status = key
  loadUnits()
}

function summarizeModelOptions(list = []) {
  return [...new Set(
    (list || [])
      .map((unit) => String(unit.model_code || unit.modelCode || '').trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

async function loadModelFilterOptions() {
  modelFilterOptions.value = summarizeModelOptions(await window.electronAPI.listScheduleUnits({ activeInventoryOnly: true }))
}

async function loadUnits() {
  units.value = await window.electronAPI.listScheduleUnits({
    modelCode: filters.modelCode.trim() || undefined,
    status: filters.status || undefined,
    keyword: filters.keyword.trim() || undefined,
    activeInventoryOnly: true,
  })
}

function resetFilters() {
  filters.modelCode = ''
  filters.status = ''
  filters.keyword = ''
  loadUnits()
}

function resetForm(modelCode = '') {
  unitCodeSourceUnits.value = []
  unitCodeOccupiedUnits.value = []
  form.modelCode = modelCode
  form.unitCode = ''
  form.serialNo = ''
  form.city = ''
  form.status = 'idle'
  form.note = ''
  form.purchaseCost = 0
  form.residualValue = 0
  form.quantity = 1
}

function resetModelForm(modelCode = '') {
  modelForm.modelCode = modelCode
  modelForm.city = ''
  modelForm.note = ''
  modelForm.purchaseCost = ''
  modelForm.residualValue = ''
}

async function openCreateModal() {
  editingUnit.value = null
  resetForm()
  showModal.value = true
}

async function quickAdd(modelCode) {
  editingUnit.value = null
  resetForm(modelCode)
  const [allRows, currentRows] = await Promise.all([loadAllModelUnits(modelCode), loadCurrentModelUnits(modelCode)])
  unitCodeSourceUnits.value = allRows
  unitCodeOccupiedUnits.value = currentRows
  const template = getTemplateUnit(modelCode)
  form.city = template?.city || ''
  form.purchaseCost = Number(template?.purchase_cost || 0)
  form.residualValue = Number(template?.residual_value || 0)
  form.note = template?.note || ''
  showModal.value = true
}

function openModelEditModal(modelCode) {
  resetModelForm(modelCode)
  const template = getTemplateUnit(modelCode)
  modelForm.city = template?.city || ''
  modelForm.note = template?.note || ''
  showModelModal.value = true
}

function openEditModal(unit) {
  editingUnit.value = unit
  form.modelCode = unit.model_code || ''
  form.unitCode = unit.unit_code || ''
  form.serialNo = unit.serial_no || ''
  form.city = unit.city || ''
  form.status = unit.status || 'idle'
  form.note = unit.note || ''
  form.purchaseCost = Number(unit.purchase_cost || 0)
  form.residualValue = Number(unit.residual_value || 0)
  form.quantity = 1
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingUnit.value = null
}

function closeModelModal() {
  showModelModal.value = false
}

async function saveUnit() {
  const modelCode = form.modelCode.trim()
  if (!modelCode) {
    message.value = '请先填写型号编码'
    window.$toast?.(message.value, 'error')
    return
  }
  try {
    if (editingUnit.value) {
      const unitCode = form.unitCode.trim()
      if (!unitCode) {
        message.value = '请填写设备编码'
        window.$toast?.(message.value, 'error')
        return
      }
      const duplicate = units.value.find((unit) => unit.unit_code === unitCode && unit.id !== editingUnit.value.id)
      if (duplicate) {
        message.value = `设备编码 ${unitCode} 已存在，请换一个编号`
        window.$toast?.(message.value, 'error')
        return
      }
      const result = await window.electronAPI.saveScheduleUnit({
        id: editingUnit.value.id,
        modelCode,
        unitCode,
        serialNo: form.serialNo,
        city: form.city,
        status: form.status,
        note: form.note,
        purchaseCost: Number(form.purchaseCost) || 0,
        residualValue: Number(form.residualValue) || 0,
      })
      if (!result?.ok) throw new Error(result?.message || '设备保存失败')
    } else {
      const [allModelUnits, currentModelUnits] = await Promise.all([loadAllModelUnits(modelCode), loadCurrentModelUnits(modelCode)])
      const codeSourceUnits = allModelUnits.length ? allModelUnits : units.value
      const occupiedUnits = currentModelUnits.length ? currentModelUnits : units.value
      const unitCodes = generateUnitCodes(modelCode, normalizeQuantity(form.quantity), form.unitCode.trim(), codeSourceUnits, occupiedUnits)
      const duplicateCode = unitCodes.find((code) => occupiedUnits.some((unit) => unit.unit_code === code && unit.status !== 'offline'))
      if (duplicateCode) {
        message.value = `设备编码 ${duplicateCode} 已存在，请换一个编号`
        window.$toast?.(message.value, 'error')
        return
      }
      for (const unitCode of unitCodes) {
        const result = await window.electronAPI.saveScheduleUnit({
          modelCode,
          unitCode,
          serialNo: unitCodes.length === 1 ? form.serialNo : '',
          city: form.city,
          status: form.status,
          note: form.note,
          purchaseCost: Number(form.purchaseCost) || 0,
          residualValue: Number(form.residualValue) || 0,
        })
        if (!result?.ok) throw new Error(result?.message || `设备 ${unitCode} 保存失败`)
      }
    }
    const quantity = editingUnit.value ? 1 : normalizeQuantity(form.quantity)
    const flash = editingUnit.value ? '设备已更新' : `已新增 ${quantity} 台设备`
    window.$toast?.(flash, 'success')
    message.value = flash
    closeModal()
    await Promise.all([loadUnits(), loadModelFilterOptions()])
  } catch (error) {
    message.value = error?.message || '设备保存失败，请重试'
    window.$toast?.(message.value, 'error')
  }
}

async function saveModelSettings() {
  const result = await window.electronAPI.updateScheduleUnitsByModel({
    modelCode: modelForm.modelCode,
    city: modelForm.city,
    note: modelForm.note,
    purchaseCost: normalizeOptionalMoney(modelForm.purchaseCost),
    residualValue: normalizeOptionalMoney(modelForm.residualValue),
    activeInventoryOnly: true,
  })
  message.value = result?.message || (result?.ok ? '型号设置已更新' : '更新失败')
  if (result?.ok) {
    window.$toast?.(message.value, 'success')
    closeModelModal()
    await Promise.all([loadUnits(), loadModelFilterOptions()])
  } else {
    window.$toast?.(message.value, 'error')
  }
}

async function removeUnit(unit) {
  if (!confirm(`确认删除设备 ${unit.unit_code}？`)) return
  const result = await window.electronAPI.deleteScheduleUnit({ id: unit.id })
  message.value = result?.message || (result?.ok ? '设备已删除' : '删除失败')
  if (result?.ok) {
    window.$toast?.('设备已删除', 'success')
    await Promise.all([loadUnits(), loadModelFilterOptions()])
  } else {
    window.$toast?.(result?.message || '删除失败', 'error')
  }
}

async function removeFromModal() {
  if (!editingUnit.value) return
  const u = editingUnit.value
  if (!confirm(`确认删除设备 ${u.unit_code}？`)) return
  closeModal()
  await removeUnit(u)
}

onMounted(() => {
  runViewInitialization('设备管理', async () => {
    await Promise.all([loadUnits(), loadModelFilterOptions()])
  })
})
</script>

<style scoped>
.device-page { gap: 18px; }

/* 视图切换 */
.view-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 4px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 12px;
}
.vt-btn {
  min-width: 64px;
  padding: 6px 12px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
}
.vt-btn.active {
  background: var(--bg-surface, #fff);
  color: #0f766e;
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-tertiary, #6b7280);
}

/* KPI 条 */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}
.kpi {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 16px;
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
  text-align: left;
  cursor: pointer;
}
.kpi:hover { transform: translateY(-1px); box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04)); }
.kpi.active {
  border-color: rgba(20, 184, 166, 0.26);
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.12);
}
.kpi.kpi-money { cursor: default; }
.kpi.kpi-money:hover { transform: none; }
.kpi-icon {
  width: 42px; height: 42px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #475569;
  background: var(--bg-subtle, #f3f4f6);
  flex-shrink: 0;
}
.kpi-total  .kpi-icon { background: rgba(99, 102, 241, 0.12); color: #4338ca; }
.kpi-idle   .kpi-icon { background: rgba(20, 184, 166, 0.12); color: #0f766e; }
.kpi-busy   .kpi-icon { background: rgba(59, 130, 246, 0.1); color: #1d4ed8; }
.kpi-repair .kpi-icon { background: rgba(245, 158, 11, 0.12); color: #b45309; }
.kpi-lost   .kpi-icon { background: rgba(239, 68, 68, 0.1); color: #b91c1c; }
.kpi-money  .kpi-icon { background: rgba(124, 58, 237, 0.1); color: #6d28d9; }
.kpi-val { font-size: 22px; font-weight: 800; color: var(--text-strong); line-height: 1.1; }
.kpi-lbl { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

/* 筛选栏 */
.filter-panel {
  padding: 14px 16px;
  background: var(--bg-surface, #fff);
  border-color: var(--border-subtle, #e5e7eb);
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.filter-field {
  display: flex; align-items: center; gap: 6px;
  height: 40px;
  padding: 0 12px;
  background: rgba(248, 250, 252, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 12px;
  flex: 1 1 280px;
  min-width: 180px;
}
.filter-field.short { flex: 0 0 220px; }
.filter-field input,
.filter-field select {
  flex: 1; border: none; background: transparent; outline: none;
  font-size: 13px; color: var(--text-primary);
}
.ff-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: rgba(226, 232, 240, 0.86);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 800;
}

.status-chips {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(248, 250, 252, 0.84);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 12px;
}
.sc-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 11px; border-radius: 8px;
  background: transparent; color: var(--text-secondary);
  font-size: 12px; font-weight: 600;
  transition: background 0.15s, color 0.15s;
}
.sc-chip:hover { background: rgba(0,0,0,0.04); color: var(--text-primary); }
.sc-chip.active {
  background: var(--bg-surface, #fff);
  color: var(--text-strong);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}
.sc-dot { width: 6px; height: 6px; border-radius: 50%; background: #cbd5e1; }
.sc-chip.sc-idle .sc-dot     { background: #22c55e; }
.sc-chip.sc-busy .sc-dot     { background: #3b82f6; }
.sc-chip.sc-repair .sc-dot   { background: #f59e0b; }
.sc-chip.sc-offline .sc-dot  { background: #ef4444; }
.sc-num {
  min-width: 18px; height: 16px; padding: 0 5px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(15,23,42,0.06); border-radius: 999px;
  font-size: 10px; font-weight: 800;
}

/* 型号卡片网格 */
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}
.model-card {
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 18px;
  padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
  transition: box-shadow 0.15s, transform 0.15s;
}
.model-card:hover { box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04)); transform: translateY(-1px); }

.mc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mc-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.mc-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.mc-ico {
  width: 48px; height: 48px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #0f766e;
  background: rgba(20, 184, 166, 0.12);
}
.mc-code { font-size: 18px; font-weight: 800; color: var(--text-strong); line-height: 1.2; }
.mc-meta { font-size: 12px; color: var(--text-secondary); margin-top: 3px; }

/* 占用条 */
.mc-bar {
  display: flex; width: 100%; height: 10px;
  border-radius: 999px; overflow: hidden;
  background: #edf2f7;
}
.mcb-seg { height: 100%; transition: flex 0.3s ease; }
.mcb-idle    { background: #22c55e; }
.mcb-busy    { background: #3b82f6; }
.mcb-repair  { background: #f59e0b; }
.mcb-offline { background: #ef4444; }
.mcb-empty   { flex: 1; background: #e2e8f0; }

.mc-stats { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; }
.mcs-item { color: var(--text-secondary); font-weight: 600; }
.mcs-item b { color: var(--text-primary); font-weight: 800; margin-left: 2px; }
.mcs-idle    { color: #16a34a; }
.mcs-busy    { color: #2563eb; }
.mcs-repair  { color: #d97706; }
.mcs-offline { color: #b91c1c; }

/* 设备胶囊 */
.unit-chips { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 6px; border-top: 1px dashed rgba(148, 163, 184, 0.18); }
.unit-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 11px;
  background: var(--bg-subtle, #f3f4f6);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 999px;
  font-size: 12px; font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.unit-chip:hover { background: #fff; border-color: rgba(20, 184, 166, 0.24); transform: translateY(-1px); }
.unit-chip:active { transform: translateY(0); }
.uc-dot { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; }
.uc-idle    .uc-dot { background: #22c55e; box-shadow: 0 0 0 2px rgba(34,197,94,0.18); }
.uc-busy    .uc-dot { background: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.18); }
.uc-repair  .uc-dot { background: #f59e0b; box-shadow: 0 0 0 2px rgba(245,158,11,0.22); }
.uc-offline .uc-dot { background: #ef4444; }
.uc-busy    { background: var(--color-info-soft, #eff6ff); border-color: var(--color-info-border, #bfdbfe); }
.uc-repair  { background: var(--color-warning-soft, #fffbeb); border-color: var(--color-warning-border, #fed7aa); }
.uc-offline { background: var(--color-danger-soft, #fef2f2); color: #b91c1c; border-color: var(--color-danger-border, #fecaca); }
.uc-city { color: var(--text-secondary); font-weight: 500; }
.uc-add {
  color: #0f766e; background: transparent;
  border: 1px dashed rgba(20, 184, 166, 0.42);
}
.uc-add:hover { background: rgba(240, 253, 250, 0.82); }

/* 表格状态标签 */
.status-tag {
  display: inline-block; padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px; font-weight: 700;
}
.st-idle    { background: #dcfce7; color: #15803d; }
.st-busy    { background: #dbeafe; color: #1d4ed8; }
.st-repair  { background: #fef3c7; color: #b45309; }
.st-offline { background: #fee2e2; color: #b91c1c; }

.t-right { text-align: right; }
.text-cell { max-width: 240px; }

.device-modal { width: min(760px, 100%); }
.model-edit-modal { width: min(680px, 100%); }
.model-edit-summary {
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.9);
}
.append-box {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.9);
}
.append-title {
  color: var(--text-primary);
  font-weight: 800;
}
.append-tip {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.quantity-field {
  width: 130px;
  margin-bottom: 0;
  flex: 0 0 auto;
}
.form-grid { display: grid; gap: 14px; }
.device-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.span-2 { grid-column: span 2; }
.form-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }

@media (max-width: 1280px) {
  .kpi-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .kpi-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .append-box { display: grid; }
  .quantity-field { width: 100%; }
  .device-form-grid { grid-template-columns: 1fr; }
  .span-2 { grid-column: span 1; }
}
</style>
