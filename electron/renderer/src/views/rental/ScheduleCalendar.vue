<template>
  <div class="page schedule-page">
    <PageHeader
      title="租赁档期"
      subtitle="按型号折叠的设备甘特图：哪台机器哪几天被占用、何时发货、何时归还。"
      :breadcrumb="['经营管理', '租赁档期']"
    >
      <template #actions>
        <div class="month-nav">
          <button class="btn-square" @click="shiftMonth(-1)" title="上月">‹</button>
          <button class="btn-square" @click="shiftMonth(1)" title="下月">›</button>
        </div>
        <button class="btn btn-secondary" @click="loadAll">刷新</button>
        <button class="btn btn-primary" @click="openAvailabilityModal">查询档期</button>
      </template>
    </PageHeader>

    <div class="summary schedule-summary-grid">
      <div class="summary-card">
        <div class="summary-label">设备总数</div>
        <div class="summary-value">{{ monthlyOverview?.summary?.totalUnits ?? 0 }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">本月占用设备</div>
        <div class="summary-value">{{ monthlyOverview?.summary?.occupiedUnits ?? 0 }}</div>
        <div class="summary-sub">利用率 {{ utilizationPct }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">当月租金</div>
        <div class="summary-value">¥{{ monthlyOverview?.summary?.totalFee ?? 0 }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">机器总价值</div>
        <div class="summary-value">¥{{ monthlyOverview?.summary?.totalAssetValue ?? 0 }}</div>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>筛选档期</h3>
          <div class="panel-tip">按月份和型号查看月度矩阵、占用记录与订单详情。</div>
        </div>
      </div>
      <div class="filter-grid schedule-filter-grid">
        <div class="form-group">
          <label>月份</label>
          <input v-model="filters.month" type="month" />
        </div>
        <div class="form-group">
          <label>型号编码</label>
          <select v-model="filters.modelCode">
            <option value="">全部型号</option>
            <option v-for="model in modelOptions" :key="model.modelCode" :value="model.modelCode">
              {{ model.modelCode }}（{{ model.totalUnits }}台）
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>开始日期</label>
          <ClickOpenDateInput v-model="filters.from" />
        </div>
        <div class="form-group">
          <label>结束日期</label>
          <ClickOpenDateInput v-model="filters.to" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" @click="loadAll">筛选</button>
          <button class="btn btn-secondary" @click="resetFilters">重置</button>
        </div>
      </div>
    </section>

    <section class="panel gantt-panel" v-if="monthlyOverview && monthlyOverview.groups.length">
      <div class="panel-header">
        <div>
          <h3>可视化排期</h3>
          <div class="panel-tip">左列按<b>型号</b>分组（点击行折叠/展开），展开后一行一台<b>设备</b>。实心色块=租期占用；虚线条纹+"物流发送/返回/缓冲"胶囊=运输或缓冲段。</div>
        </div>
        <div class="gantt-legend">
          <span class="gl-item"><span class="gl-sw gl-sw-confirmed"></span>已确认</span>
          <span class="gl-item"><span class="gl-sw gl-sw-active"></span>进行中</span>
          <span class="gl-item"><span class="gl-sw gl-sw-completed"></span>已完成</span>
          <span class="gl-item"><span class="gl-sw gl-sw-overdue"></span>已逾期</span>
          <span class="gl-divider"></span>
          <span class="gl-item"><span class="gl-sw gl-sw-ship"></span>物流/缓冲</span>
        </div>
      </div>
      <div class="gantt-wrap">
        <div class="gantt-head"
          :style="{ gridTemplateColumns: `220px repeat(${monthlyOverview.days.length}, 46px)` }">
          <div class="gh-corner">型号 / 设备 · 日期</div>
          <div v-for="day in monthlyOverview.days" :key="`gh-${day.date}`" class="gh-day"
            :class="{ 'gh-weekend': isWeekend(day.date), 'gh-today': isToday(day.date) }">
            <div class="ghd-num">{{ day.label }}</div>
            <div class="ghd-wd">{{ weekdayShort(day.date) }}</div>
          </div>
        </div>

        <template v-for="group in ganttGroups" :key="`gg-${group.modelCode}`">
          <!-- 型号父行：点击折叠/展开 -->
          <div class="gantt-row gantt-model-row"
            :class="{ 'is-collapsed': isGroupCollapsed(group.modelCode) }"
            :style="{ gridTemplateColumns: `220px repeat(${monthlyOverview.days.length}, 46px)` }"
            @click="toggleGroup(group.modelCode)">
            <div class="gr-model-meta">
              <span class="gmm-toggle">{{ isGroupCollapsed(group.modelCode) ? '▶' : '▼' }}</span>
              <span class="gmm-code">{{ group.modelCode }}</span>
              <span class="gmm-count">{{ group.totalUnits }}台</span>
              <span class="gmm-sub">占用{{ group.occupiedUnits }}</span>
            </div>
            <div v-for="day in monthlyOverview.days" :key="`mbg-${group.modelCode}-${day.date}`" class="gr-cell gmr-cell"
              :class="{ 'gr-weekend': isWeekend(day.date), 'gr-today': isToday(day.date) }"></div>
            <!-- 型号汇总：当天占用台数 -->
            <div v-for="(stat, idx) in group.dayStats" :key="`mstat-${group.modelCode}-${idx}`"
              v-show="stat.occupied > 0" class="gr-model-stat"
              :style="{ gridColumn: `${idx + 2} / span 1` }">
              <span class="gms-num" :class="heatDotClass(stat)">{{ stat.occupied }}</span>
            </div>
          </div>

          <!-- 展开的设备子行 -->
          <template v-if="!isGroupCollapsed(group.modelCode)">
            <div v-for="row in group.rows" :key="`gr-${row.unitId}`" class="gantt-row gantt-unit-row"
              :style="{ gridTemplateColumns: `220px repeat(${monthlyOverview.days.length}, 46px)` }">
              <div class="gr-unit-meta">
                <span class="gum-dot"></span>
                <span class="gum-code">{{ row.unitCode }}</span>
                <span v-if="row.unitFee" class="gum-fee">¥{{ row.unitFee }}</span>
              </div>
              <div v-for="day in monthlyOverview.days" :key="`bg-${row.unitId}-${day.date}`" class="gr-cell"
                :class="{ 'gr-weekend': isWeekend(day.date), 'gr-today': isToday(day.date) }"></div>
              <div v-for="(seg, idx) in row.segments" :key="`seg-${row.unitId}-${idx}`"
                class="gr-seg"
                :class="[`gr-seg-${seg.kind}`, `gr-status-${seg.statusKey}`]"
                :style="{ gridColumn: `${seg.startCol + 2} / span ${seg.span}` }"
                :title="seg.tooltip"
                @click="seg.orderId && openOrderDetail({ orderId: seg.orderId })">
                <template v-if="seg.kind === 'rent'">
                  <div class="grs-line1">
                    <span class="grs-name">{{ seg.customerName || '客户' }}</span>
                    <span class="grs-days">{{ seg.totalDays }}天</span>
                  </div>
                  <div class="grs-line2">{{ seg.orderNo || ('#' + seg.orderId) }}</div>
                </template>
                <span v-else class="grs-ship-pill">
                  {{ seg.kind === 'shipping' ? '物流发送' : seg.kind === 'return_shipping' ? '物流返回' : '缓冲' }}
                </span>
              </div>
            </div>
          </template>
        </template>
      </div>
    </section>

    <section class="panel" v-if="monthlyOverview">
      <div class="panel-header">
        <div>
          <h3>月度 × 型号 档期热力</h3>
          <div class="panel-tip">一行一型号，列为当月每一天，格子颜色越深代表占用越满。点击格子可查看当日占用明细。</div>
        </div>
        <div class="legend-row">
          <span class="legend-swatch legend-0"></span><span class="legend-text">空闲</span>
          <span class="legend-swatch legend-1"></span><span class="legend-text">≤ 25%</span>
          <span class="legend-swatch legend-2"></span><span class="legend-text">≤ 50%</span>
          <span class="legend-swatch legend-3"></span><span class="legend-text">≤ 75%</span>
          <span class="legend-swatch legend-4"></span><span class="legend-text">满载</span>
        </div>
      </div>
      <div v-if="modelHeatmap.length" class="table-wrap monthly-table-wrap">
        <table class="data-table heatmap-table">
          <thead>
            <tr>
              <th class="sticky-col heatmap-model-col">型号</th>
              <th class="heatmap-total-col">机器</th>
              <th v-for="day in monthlyOverview.days" :key="`h-${day.date}`" class="day-col"
                  :class="{ 'is-weekend': isWeekend(day.date) }">{{ day.label }}</th>
              <th class="heatmap-avg-col">日均占用</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in modelHeatmap" :key="`hm-${row.modelCode}`">
              <td class="sticky-col heatmap-model-col">
                <div class="unit-code">{{ row.modelCode }}</div>
              </td>
              <td class="heatmap-total-col">{{ row.totalUnits }} 台</td>
              <td v-for="stat in row.dayStats" :key="`${row.modelCode}-${stat.date}`"
                  class="heat-cell" :class="[heatClass(stat.ratio), stat.occupied ? 'heat-clickable' : '']"
                  :title="`${row.modelCode} ${stat.date}\n占用 ${stat.occupied}/${stat.total} 台 (${Math.round(stat.ratio * 100)}%)`"
                  @click="openHeatmapDetail(row, stat)">
                <span class="heat-num">{{ stat.occupied }}</span>
                <span class="heat-sep">/</span>
                <span class="heat-den">{{ stat.total }}</span>
              </td>
              <td class="heatmap-avg-col">{{ row.avgLabel }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty">当前月份暂无设备或档期数据（先在「设备管理」新增型号/机器，或者在「订单详情」导入订单）</div>
    </section>

    <div v-if="availabilityModalOpen" class="modal-overlay" @click.self="closeAvailabilityModal">
      <div class="modal cardish availability-modal">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeAvailabilityModal">✕</button>
        </div>
        <div class="panel-header availability-modal-head">
          <div>
            <h3>查询档期</h3>
            <div class="panel-tip">按型号、租期和物流占用窗口，判断哪些机器可接单。</div>
          </div>
        </div>

        <div class="availability-mode">
          <button
            v-for="mode in availabilityModes"
            :key="mode.key"
            class="mode-btn"
            :class="{ active: availabilityForm.mode === mode.key }"
            @click="availabilityForm.mode = mode.key"
          >{{ mode.label }}</button>
        </div>

        <div class="availability-grid">
          <div class="form-group">
            <label>型号编码</label>
            <select v-model="availabilityForm.modelCode">
              <option value="" disabled>选择型号</option>
              <option v-for="model in modelOptions" :key="model.modelCode" :value="model.modelCode">
                {{ model.modelCode }}（{{ model.totalUnits }}台）
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>开始日期</label>
            <ClickOpenDateInput v-model="availabilityForm.rentStartDate" />
          </div>
          <div class="form-group">
            <label>租赁天数</label>
            <RentDaysInput v-model="availabilityForm.rentDays" />
          </div>
          <div class="form-group">
            <label>结束日期</label>
            <ClickOpenDateInput v-model="availabilityForm.rentEndDate" />
          </div>
          <div class="form-group">
            <label>归还缓冲</label>
            <input v-model.number="availabilityForm.returnBufferDays" type="number" min="0" max="10" />
          </div>

          <template v-if="availabilityForm.mode === 'sf'">
            <div class="form-group span-4">
              <div class="field-head">
                <label>收货信息</label>
                <button class="btn btn-secondary btn-sm" type="button" @click="clearAvailabilityAddressDefaults">清空地址</button>
              </div>
              <textarea
                v-model="availabilityForm.recipientText"
                rows="4"
                placeholder="粘贴姓名、手机号、完整收货地址"
                @paste="handleAvailabilityRecipientPaste"
                @blur="parseAvailabilityRecipientPaste"
              ></textarea>
              <div v-if="recipientParseMessage" class="field-hint">{{ recipientParseMessage }}</div>
            </div>
            <div class="form-group">
              <label>省份</label>
              <input v-model="availabilityForm.province" placeholder="自动识别" />
            </div>
            <div class="form-group">
              <label>城市</label>
              <input v-model="availabilityForm.city" placeholder="自动识别" />
            </div>
            <div class="form-group">
              <label>区县</label>
              <input v-model="availabilityForm.district" placeholder="自动识别" />
            </div>
            <div class="form-group">
              <label>发货方式</label>
              <select v-model="availabilityForm.shippingMode">
                <option value="land">陆运</option>
                <option value="express">普通快递</option>
                <option value="next_morning">次晨达</option>
              </select>
            </div>
            <div class="form-group span-4">
              <label>详细地址</label>
              <input v-model="availabilityForm.address" placeholder="自动识别后可手动修正" />
            </div>
          </template>

          <template v-if="availabilityForm.mode === 'days'">
            <div class="form-group">
              <label>运输天数</label>
              <input v-model.number="availabilityForm.transitDays" type="number" min="1" max="15" />
            </div>
          </template>

          <div class="availability-actions">
            <button class="btn btn-primary" :disabled="availabilityLoading" @click="runAvailabilityCheck">
              {{ availabilityLoading ? '查询中...' : '查询可用机器' }}
            </button>
            <button class="btn btn-secondary" @click="resetAvailabilityForm">清空</button>
          </div>
        </div>

        <div v-if="availabilityError" class="availability-error">{{ availabilityError }}</div>

        <div v-if="availabilityResult?.ok" class="availability-result" :class="{ empty: !availabilityResult.available }">
          <div class="availability-result-head">
            <div>
              <div class="availability-title">
                {{ availabilityResult.available ? '有可用机器' : '当前无可用机器' }}
                <span>{{ availabilityResult.counts.availableUnits }}/{{ availabilityResult.counts.totalUnits }}</span>
              </div>
              <div class="availability-window">
                占用窗口：{{ availabilityResult.plan.requiredStartDate }} 至 {{ availabilityResult.plan.requiredEndDate }}
                <span v-if="availabilityResult.plan.sourceLabel"> · {{ availabilityResult.plan.sourceLabel }}</span>
              </div>
            </div>
            <div class="availability-plan">
              <span>发货 {{ availabilityResult.plan.shipDate || '-' }}</span>
              <span>到货 {{ availabilityResult.plan.arriveDate || '-' }}</span>
              <span>租期 {{ availabilityResult.plan.rentStartDate }} 至 {{ availabilityResult.plan.rentEndDate }}</span>
            </div>
          </div>
          <div v-if="availabilityResult.plan.fallbackReason" class="availability-note">{{ availabilityResult.plan.fallbackReason }}</div>

          <div v-if="availabilityResult.availableUnits.length" class="available-units">
            <button
              v-for="unit in availabilityResult.availableUnits"
              :key="unit.id"
              class="available-unit"
              @click="focusAvailabilityUnit(unit)"
            >
              <span class="unit-main">{{ unit.unitCode }}</span>
              <span v-if="unit.city" class="unit-sub">{{ unit.city }}</span>
            </button>
          </div>

          <details v-if="availabilityResult.conflictUnits.length" class="conflict-details">
            <summary>查看冲突机器 {{ availabilityResult.conflictUnits.length }} 台</summary>
            <div class="conflict-list">
              <div v-for="unit in availabilityResult.conflictUnits" :key="unit.id" class="conflict-item">
                <div class="conflict-unit">{{ unit.unitCode }}</div>
                <div class="conflict-blocks">
                  <span v-for="block in unit.conflicts" :key="block.blockId" class="conflict-block">
                    {{ blockTypeLabel(block.blockType) }} {{ block.startDate }}~{{ block.endDate }}
                    <b v-if="block.storeName">{{ block.storeName }}</b>
                    <b v-if="block.customerName">{{ block.customerName }}</b>
                  </span>
                </div>
              </div>
            </div>
          </details>
        </div>

        <div v-else-if="availabilityResult && !availabilityResult.ok" class="availability-error">
          {{ availabilityResult.message || '查询失败' }}
        </div>
      </div>
    </div>

    <div v-if="detailModalOpen" class="modal-overlay" @click.self="closeOrderDetail">
      <div class="modal cardish order-detail-modal">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeOrderDetail">✕</button>
        </div>
        <div class="panel-header">
          <div>
            <h3>订单详情</h3>
            <div class="panel-tip">查看当前格子对应的订单信息。</div>
          </div>
        </div>

        <template v-if="selectedOrder">
          <div class="detail-grid">
            <div class="cardish detail-item"><div class="summary-label">订单号</div><div class="detail-value">{{ selectedOrder.order_no || selectedOrder.id }}</div></div>
            <div class="cardish detail-item"><div class="summary-label">型号</div><div class="detail-value">{{ selectedOrder.model_code }}</div></div>
            <div class="cardish detail-item"><div class="summary-label">设备</div><div class="detail-value">{{ selectedOrder.unit_code || '-' }}</div></div>
            <div class="cardish detail-item"><div class="summary-label">店铺</div><div class="detail-value">{{ selectedOrder.store_name || '小狗相机' }}</div></div>
            <div class="cardish detail-item"><div class="summary-label">租客</div><div class="detail-value">{{ selectedOrder.customer_name || '-' }}</div></div>
            <div class="cardish detail-item"><div class="summary-label">租期</div><div class="detail-value">{{ selectedOrder.rent_start_date }} ~ {{ selectedOrder.rent_end_date }}</div></div>
            <div class="cardish detail-item"><div class="summary-label">金额</div><div class="detail-value">{{ selectedOrder.fee || 0 }}</div></div>
            <div class="cardish detail-item span-2"><div class="summary-label">地址</div><div class="detail-value">{{ selectedOrder.province || '' }} {{ selectedOrder.city || '' }} {{ selectedOrder.district || '' }} {{ selectedOrder.address || '-' }}</div></div>
            <div class="cardish detail-item"><div class="summary-label">状态</div><div class="detail-value">{{ orderStatusLabel(selectedOrder.order_status) }}</div></div>
            <div class="cardish detail-item"><div class="summary-label">物流</div><div class="detail-value">{{ selectedOrder.latest_logistics_status || '-' }}</div></div>
          </div>

          <section class="detail-traces">
            <div class="panel-header detail-traces-head">
              <div>
                <h3>物流时间线</h3>
                <div class="panel-tip">展示该订单已记录的物流节点。</div>
              </div>
            </div>
            <div v-if="detailLoading" class="empty">物流加载中...</div>
            <div v-else-if="detailShippingRecords.length" class="trace-list">
              <div v-for="(record, index) in detailShippingRecords" :key="record.id" class="trace-item cardish" :class="{ 'trace-item-latest': index === 0 }">
                <div class="trace-main">
                  <div class="trace-status-row">
                    <div class="trace-status">{{ record.latest_status || '已记录物流更新' }}</div>
                    <span v-if="index === 0" class="trace-badge">最新</span>
                  </div>
                  <div class="trace-time">{{ formatDateTime(record.actual_ship_at || record.actual_arrive_at || record.expected_arrive_at || record.created_at) }}</div>
                </div>
                <div class="trace-meta">
                  <span>运单号：{{ record.tracking_no || '-' }}</span>
                  <span>方式：{{ shippingModeLabel(record.shipping_mode) }}</span>
                  <span>预计送达：{{ formatDateTime(record.expected_arrive_at) }}</span>
                  <span>实际发货：{{ formatDateTime(record.actual_ship_at) }}</span>
                  <span>实际签收：{{ formatDateTime(record.actual_arrive_at) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty">暂无物流记录</div>
          </section>
        </template>
      </div>
    </div>

    <div v-if="heatmapDetail" class="modal-overlay" @click.self="heatmapDetail = null">
      <div class="modal cardish heatmap-detail-modal">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="heatmapDetail = null">✕</button>
        </div>
        <div class="panel-header">
          <div>
            <h3>{{ heatmapDetail.modelCode }} · {{ heatmapDetail.date }}</h3>
            <div class="panel-tip">当日占用 {{ heatmapDetail.occupied }}/{{ heatmapDetail.total }} 台，点击设备可查看订单。</div>
          </div>
        </div>
        <div class="heat-detail-list">
          <div v-for="item in heatmapDetail.items" :key="item.unitId" class="cardish heat-detail-item"
               :class="[`cell-${item.blockType || 'empty'}`, item.orderId ? 'cell-clickable' : '']"
               @click="item.orderId && openOrderDetail({ orderId: item.orderId })">
            <div class="heat-detail-unit">{{ item.unitCode }}</div>
            <div class="heat-detail-state">
              <span class="state-tag" :class="`state-${item.blockType || 'idle'}`">{{ stateLabel(item.blockType) }}</span>
              <span class="heat-detail-label">{{ item.label || '—' }}</span>
            </div>
          </div>
          <div v-if="!heatmapDetail.items.length" class="empty">无设备数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import ClickOpenDateInput from '../../components/ClickOpenDateInput.vue'
import PageHeader from '../../components/PageHeader.vue'
import RentDaysInput from '../../components/RentDaysInput.vue'

const blocks = ref([])
const monthlyOverview = ref(null)
const scheduleUnits = ref([])
const orderMap = ref({})
const detailModalOpen = ref(false)
const detailLoading = ref(false)
const selectedOrder = ref(null)
const detailShippingRecords = ref([])
const collapsedGroups = ref({})
const heatmapDetail = ref(null)
const filters = reactive({ modelCode: '', month: defaultMonth(), from: '', to: '' })
const availabilityModalOpen = ref(false)
const availabilityLoading = ref(false)
const availabilityResult = ref(null)
const availabilityError = ref('')
const recipientParseMessage = ref('')
let recipientParseTimer = null
const availabilityModes = [
  { key: 'sf', label: '按地址试算' },
  { key: 'days', label: '运输天数' },
]
const availabilityForm = reactive({
  mode: 'sf',
  modelCode: '',
  rentStartDate: formatLocalDate(new Date()),
  rentEndDate: formatLocalDate(addDays(new Date(), 3)),
  rentDays: 4,
  returnBufferDays: 2,
  province: '四川省',
  city: '成都市',
  district: '金牛区',
  address: '',
  recipientText: '四川省成都市金牛区',
  customerName: '',
  customerPhone: '',
  shippingMode: 'land',
  transitDays: 2,
})

const provinceAliases = [
  ['北京市', '北京'],
  ['天津市', '天津'],
  ['上海市', '上海'],
  ['重庆市', '重庆'],
  ['河北省', '河北'],
  ['山西省', '山西'],
  ['辽宁省', '辽宁'],
  ['吉林省', '吉林'],
  ['黑龙江省', '黑龙江'],
  ['江苏省', '江苏'],
  ['浙江省', '浙江'],
  ['安徽省', '安徽'],
  ['福建省', '福建'],
  ['江西省', '江西'],
  ['山东省', '山东'],
  ['河南省', '河南'],
  ['湖北省', '湖北'],
  ['湖南省', '湖南'],
  ['广东省', '广东'],
  ['海南省', '海南'],
  ['四川省', '四川'],
  ['贵州省', '贵州'],
  ['云南省', '云南'],
  ['陕西省', '陕西'],
  ['甘肃省', '甘肃'],
  ['青海省', '青海'],
  ['台湾省', '台湾'],
  ['内蒙古自治区', '内蒙古'],
  ['广西壮族自治区', '广西'],
  ['西藏自治区', '西藏'],
  ['宁夏回族自治区', '宁夏'],
  ['新疆维吾尔自治区', '新疆'],
  ['香港特别行政区', '香港'],
  ['澳门特别行政区', '澳门'],
]

const cityAliases = {
  成都: '成都市',
  绵阳: '绵阳市',
  德阳: '德阳市',
  宜宾: '宜宾市',
  乐山: '乐山市',
  南充: '南充市',
  泸州: '泸州市',
  达州: '达州市',
  自贡: '自贡市',
  北京: '北京市',
  上海: '上海市',
  天津: '天津市',
  重庆: '重庆市',
  广州: '广州市',
  深圳: '深圳市',
  杭州: '杭州市',
  南京: '南京市',
  武汉: '武汉市',
  西安: '西安市',
}

const activeBlocksCount = computed(() => blocks.value.filter((block) => block.status === 'active').length)

const utilizationPct = computed(() => {
  const total = monthlyOverview.value?.summary?.totalUnits || 0
  const occ = monthlyOverview.value?.summary?.occupiedUnits || 0
  if (!total) return '—'
  return `${Math.round((occ / total) * 100)}%`
})

const modelOptions = computed(() => {
  const modelMap = new Map()
  for (const unit of scheduleUnits.value || []) {
    const modelCode = String(unit.model_code || unit.modelCode || '').trim()
    if (!modelCode) continue
    const current = modelMap.get(modelCode) || { modelCode, totalUnits: 0 }
    current.totalUnits += 1
    modelMap.set(modelCode, current)
  }
  for (const group of monthlyOverview.value?.groups || []) {
    const modelCode = String(group.modelCode || '').trim()
    if (!modelCode) continue
    const current = modelMap.get(modelCode) || { modelCode, totalUnits: 0 }
    current.totalUnits = Math.max(current.totalUnits, Number(group.totalUnits || 0))
    modelMap.set(modelCode, current)
  }
  return [...modelMap.values()].sort((a, b) => a.modelCode.localeCompare(b.modelCode, 'zh-Hans-CN'))
})

function isToday(date) {
  if (!date) return false
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  return date === today
}

function weekdayShort(date) {
  if (!date) return ''
  const w = new Date(date).getDay()
  return ['日', '一', '二', '三', '四', '五', '六'][w]
}

const modelHeatmap = computed(() => {
  const groups = monthlyOverview.value?.groups || []
  const days = monthlyOverview.value?.days || []
  return groups.map((group) => {
    const dayStats = days.map((day, idx) => {
      let occupied = 0
      for (const row of group.rows) {
        const cell = row.cells?.[idx]
        if (cell && (cell.blockType === 'rent' || cell.blockType === 'shipping')) occupied += 1
      }
      const total = group.totalUnits || group.rows.length || 0
      const ratio = total > 0 ? occupied / total : 0
      return { date: day.date, day: day.day, occupied, total, ratio }
    })
    const totalRatio = dayStats.length
      ? dayStats.reduce((sum, s) => sum + s.ratio, 0) / dayStats.length
      : 0
    return {
      modelCode: group.modelCode,
      totalUnits: group.totalUnits || group.rows.length || 0,
      dayStats,
      avgLabel: `${Math.round(totalRatio * 100)}%`,
    }
  })
})

function heatClass(ratio) {
  if (!ratio || ratio <= 0) return 'heat-0'
  if (ratio <= 0.25) return 'heat-1'
  if (ratio <= 0.5) return 'heat-2'
  if (ratio <= 0.75) return 'heat-3'
  return 'heat-4'
}

function heatDotClass(stat) {
  const total = Number(stat?.total || 0)
  const occupied = Number(stat?.occupied || 0)
  if (!total) return 'gms-open'
  const available = Math.max(0, total - occupied)
  if (available <= 0) return 'gms-full'
  if ((available / total) < (1 / 3)) return 'gms-tight'
  return 'gms-open'
}

// 型号→设备 甘特树：按 monthlyOverview.groups 派生，每台设备的 cells 合并为连续 segments
const ganttGroups = computed(() => {
  const days = monthlyOverview.value?.days || []
  const groups = monthlyOverview.value?.groups || []
  if (!days.length || !groups.length) return []
  const today = formatLocalDate(new Date())

  function deriveStatus(orderId, segStart, segEnd) {
    const o = orderMap.value?.[orderId]
    const st = o?.order_status || ''
    const rentStart = o?.rent_start_date || segStart
    const rentEnd = o?.rent_end_date || segEnd
    if (st === 'completed') return { statusKey: 'completed', statusLabel: '已完成' }
    if (st === 'cancelled') return { statusKey: 'completed', statusLabel: '已取消' }
    if (rentEnd && rentEnd < today) return { statusKey: 'overdue', statusLabel: '已逾期' }
    if (rentStart && rentStart <= today && (!rentEnd || rentEnd >= today)) return { statusKey: 'active', statusLabel: '进行中' }
    return { statusKey: 'confirmed', statusLabel: '已确认' }
  }

  return groups.map((group) => {
    // 每天统计占用台数（rent/shipping 都算）
    const dayStats = days.map((_, idx) => {
      let occupied = 0
      for (const row of group.rows) {
        const c = row.cells?.[idx]
        if (c && (c.blockType === 'rent' || c.blockType === 'shipping')) occupied += 1
      }
      return { occupied, total: group.totalUnits }
    })

    // 每台设备：将连续同 (blockType, orderId) 的 cell 合并为 segment
    const rows = group.rows.map((row) => {
      const segs = []
      let cur = null
      for (let i = 0; i < row.cells.length; i += 1) {
        const c = row.cells[i]
        if (!c.blockType) {
          if (cur) { segs.push(cur); cur = null }
          continue
        }
        const key = `${c.blockType}::${c.orderId || ''}`
        if (cur && cur._key === key) {
          cur.span += 1
        } else {
          if (cur) segs.push(cur)
          cur = {
            _key: key,
            kind: c.blockType,
            orderId: c.orderId || null,
            startCol: i,
            span: 1,
            label: c.label || '',
          }
        }
      }
      if (cur) segs.push(cur)

      // 补齐订单元数据 + 状态
      return {
        unitId: row.unitId,
        unitCode: row.unitCode,
        unitFee: row.unitFee,
        segments: segs.map((s) => {
          const o = s.orderId ? orderMap.value?.[s.orderId] : null
          const { statusKey, statusLabel } = deriveStatus(s.orderId, null, null)
          const orderNo = o?.order_no || ''
          const customerName = o?.customer_name || s.label || ''
          let totalDays = 0
          if (o?.rent_start_date && o?.rent_end_date) {
            totalDays = Math.max(1, Math.round((new Date(o.rent_end_date) - new Date(o.rent_start_date)) / 86400000) + 1)
          }
          const kindLabel = s.kind === 'rent' ? '租期' : s.kind === 'shipping' ? '物流发送' : s.kind === 'return_shipping' ? '物流返回' : '缓冲'
          const tooltip = `${row.unitCode} · ${kindLabel}\n订单 ${orderNo || s.orderId || '-'}${customerName ? '\n客户 ' + customerName : ''}`
          return { ...s, statusKey, statusLabel, orderNo, customerName, totalDays, tooltip }
        }),
      }
    })

    return {
      modelCode: group.modelCode,
      totalUnits: group.totalUnits,
      occupiedUnits: group.occupiedUnits,
      dayStats,
      rows,
    }
  })
})

function formatLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseLocalDate(dateText) {
  return new Date(`${dateText}T00:00:00`)
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function calcInclusiveRentDays(startDate, endDate) {
  if (!startDate || !endDate) return 0
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  return Math.max(1, Math.round((end - start) / 86400000) + 1)
}

function deriveRentEndDate(startDate, rentDays) {
  if (!startDate || !Number(rentDays)) return ''
  return formatLocalDate(addDays(parseLocalDate(startDate), Math.max(0, Number(rentDays) - 1)))
}

function isWeekend(date) {
  if (!date) return false
  const d = new Date(date)
  const w = d.getDay()
  return w === 0 || w === 6
}

function stateLabel(blockType) {
  if (blockType === 'rent') return '出租中'
  if (blockType === 'shipping') return '发货中'
  if (blockType === 'return_shipping') return '寄回中'
  if (blockType === 'buffer') return '归还缓冲'
  return '空闲'
}

function blockTypeLabel(blockType) {
  if (blockType === 'rent') return '租期'
  if (blockType === 'shipping') return '发货'
  if (blockType === 'return_shipping') return '归还'
  if (blockType === 'buffer') return '缓冲'
  return blockType || '占用'
}

function stageIcon(blockType) {
  if (blockType === 'shipping') return '🚚'
  if (blockType === 'rent') return '🏠'
  if (blockType === 'return_shipping') return '📦'
  if (blockType === 'buffer') return '⏳'
  return ''
}

function openHeatmapDetail(row, stat) {
  if (!stat.total) return
  const group = (monthlyOverview.value?.groups || []).find((g) => g.modelCode === row.modelCode)
  if (!group) return
  const dayIdx = (monthlyOverview.value?.days || []).findIndex((d) => d.date === stat.date)
  if (dayIdx < 0) return
  const items = group.rows.map((r) => {
    const cell = r.cells?.[dayIdx] || {}
    return {
      unitId: r.unitId,
      unitCode: r.unitCode,
      blockType: cell.blockType || '',
      label: cell.label || '',
      orderId: cell.orderId || null,
    }
  })
  heatmapDetail.value = {
    modelCode: row.modelCode,
    date: stat.date,
    occupied: stat.occupied,
    total: stat.total,
    items,
  }
}

function defaultMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function isGroupCollapsed(modelCode) {
  return Boolean(collapsedGroups.value[modelCode])
}

function toggleGroup(modelCode) {
  collapsedGroups.value = { ...collapsedGroups.value, [modelCode]: !collapsedGroups.value[modelCode] }
}

function syncCollapsedGroups(groups = []) {
  const next = {}
  for (const group of groups) {
    const modelCode = String(group?.modelCode || '').trim()
    if (!modelCode) continue
    next[modelCode] = collapsedGroups.value[modelCode] ?? true
  }
  collapsedGroups.value = next
}

function shiftMonth(delta) {
  const [year, month] = String(filters.month || defaultMonth()).split('-').map(Number)
  const next = new Date(year, month - 1 + delta, 1)
  filters.month = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  loadAll()
}

function shortCellLabel(label) {
  if (!label) return ''
  return String(label).length > 4 ? `${String(label).slice(0, 4)}` : String(label)
}

function buildCellTitle(row, cell) {
  if (!cell.blockType) return `${row.unitCode} ${cell.date}`
  return `${row.unitCode}\n${cell.date}\n${cell.label || '-'}\n${cell.blockType}\n￥${cell.feePortion || 0}`
}

function formatDateTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

function orderStatusLabel(status) {
  if (status === 'waiting_payment') return '待付款'
  if (status === 'paid') return '已付款'
  if (status === 'shipping') return '配送中'
  if (status === 'active') return '进行中'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  return status || '-'
}

function shippingModeLabel(mode) {
  if (mode === 'land') return '陆运'
  if (mode === 'express') return '普通快递'
  if (mode === 'next_morning') return '次晨达'
  return mode || '-'
}

function stripContactLabels(text) {
  return String(text || '')
    .replace(/(收货人|收件人|联系人|姓名|电话|手机|手机号|收货地址|详细地址|地址)\s*[:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseChinaAddress(text) {
  let rest = String(text || '').replace(/\s+/g, '').trim()
  const source = rest
  const result = { province: '', city: '', district: '', address: '' }
  if (!rest) return result

  for (const [full, short] of provinceAliases) {
    if (rest.startsWith(full)) {
      result.province = full
      rest = rest.slice(full.length)
      break
    }
    if (rest.startsWith(short)) {
      result.province = full
      rest = rest.slice(short.length)
      break
    }
  }

  if (['北京市', '天津市', '上海市', '重庆市'].includes(result.province)) {
    result.city = result.province
  } else {
    const cityMatch = rest.match(/^([\u4e00-\u9fa5]{2,12}?(?:市|州|盟|地区))/)
    if (cityMatch) {
      result.city = cityMatch[1]
      rest = rest.slice(cityMatch[1].length)
    } else {
      const cityKey = Object.keys(cityAliases).find((key) => rest.startsWith(key))
      if (cityKey) {
        result.city = cityAliases[cityKey]
        rest = rest.slice(cityKey.length)
      }
    }
  }

  const districtMatch = rest.match(/^([\u4e00-\u9fa5]{1,12}?(?:区|县|市|旗|镇|乡))/)
  if (districtMatch) {
    result.district = districtMatch[1]
    rest = rest.slice(districtMatch[1].length)
  }
  result.address = rest
  if (!result.province && !result.city && !result.district) result.address = source
  return result
}

function parseRecipientInfo(text) {
  const raw = String(text || '').trim()
  if (!raw) return {}
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const compact = raw.replace(/[，,]/g, ' ').replace(/\s+/g, ' ').trim()
  const phoneMatch = compact.match(/(?:\+?86[-\s]?)?(1[3-9]\d{9})/) || compact.match(/\b(\d{7,14})\b/)
  const phone = phoneMatch?.[1] || ''
  const nameFromLabel = raw.match(/(?:收货人|收件人|联系人|姓名)\s*[:：]\s*([^\s，,;；\n]{2,20})/)
  const addressFromLabel = raw.match(/(?:收货地址|详细地址|地址)\s*[:：]\s*([^\n]+)/)

  let name = nameFromLabel?.[1] || ''
  if (!name && phone) {
    const beforePhone = compact.slice(0, compact.indexOf(phone)).trim()
    const tokens = stripContactLabels(beforePhone).split(/\s+/).filter(Boolean)
    name = tokens[tokens.length - 1] || ''
  }
  if (!name) {
    const firstLine = stripContactLabels(lines[0] || '')
    name = firstLine.split(/\s+/).find((item) => !/\d/.test(item) && item.length <= 20) || ''
  }

  let addressText = addressFromLabel?.[1] || ''
  if (!addressText && phone) {
    addressText = compact.slice(compact.indexOf(phone) + phone.length).trim()
  }
  if (!addressText) {
    addressText = lines.find((line) => /(省|市|区|县|镇|街道|路|号|栋|单元)/.test(line)) || compact
  }
  addressText = stripContactLabels(addressText)
    .replace(phone, '')
    .replace(name, '')
    .trim()

  return {
    name,
    phone,
    ...parseChinaAddress(addressText),
  }
}

function applyAvailabilityRecipientInfo(parsed = {}) {
  if (parsed.name) availabilityForm.customerName = parsed.name
  if (parsed.phone) availabilityForm.customerPhone = parsed.phone
  if (parsed.province) availabilityForm.province = parsed.province
  if (parsed.city) availabilityForm.city = parsed.city
  if (parsed.district) availabilityForm.district = parsed.district
  if (parsed.address) availabilityForm.address = parsed.address
}

function parseAvailabilityRecipientPaste() {
  const parsed = parseRecipientInfo(availabilityForm.recipientText)
  applyAvailabilityRecipientInfo(parsed)
  const fields = [
    parsed.name && '姓名',
    parsed.phone && '电话',
    parsed.province && '省份',
    parsed.city && '城市',
    parsed.district && '区县',
    parsed.address && '地址',
  ].filter(Boolean)
  recipientParseMessage.value = fields.length ? `已识别：${fields.join('、')}` : '未识别到有效收货信息'
}

function handleAvailabilityRecipientPaste(event) {
  const text = event?.clipboardData?.getData('text')
  if (text) {
    event.preventDefault()
    availabilityForm.recipientText = text
  }
  if (recipientParseTimer) window.clearTimeout(recipientParseTimer)
  recipientParseTimer = window.setTimeout(parseAvailabilityRecipientPaste, 0)
}

function openAvailabilityModal() {
  availabilityModalOpen.value = true
  availabilityError.value = ''
}

function closeAvailabilityModal() {
  availabilityModalOpen.value = false
}

function focusAvailabilityUnit(unit) {
  filters.modelCode = unit.modelCode
  loadAll()
  closeAvailabilityModal()
}

function buildAvailabilityPayload() {
  if (availabilityForm.mode === 'sf' && availabilityForm.recipientText.trim()) {
    parseAvailabilityRecipientPaste()
  }
  const payload = {
    modelCode: availabilityForm.modelCode.trim(),
    rentStartDate: availabilityForm.rentStartDate,
    rentEndDate: availabilityForm.rentEndDate,
    returnBufferDays: Number(availabilityForm.returnBufferDays) || 0,
  }
  if (availabilityForm.mode === 'sf') {
    payload.province = availabilityForm.province.trim()
    payload.city = availabilityForm.city.trim()
    payload.district = availabilityForm.district.trim()
    payload.address = availabilityForm.address.trim()
    payload.customerName = availabilityForm.customerName.trim()
    payload.customerPhone = availabilityForm.customerPhone.trim()
    payload.shippingMode = availabilityForm.shippingMode
  } else {
    payload.transitDays = Number(availabilityForm.transitDays) || 1
    payload.shippingMode = availabilityForm.shippingMode
  }
  return payload
}

async function runAvailabilityCheck() {
  availabilityError.value = ''
  availabilityResult.value = null
  const payload = buildAvailabilityPayload()
  if (!payload.modelCode) {
    availabilityError.value = '请先填写型号编码'
    return
  }
  if (!payload.rentStartDate || !payload.rentEndDate) {
    availabilityError.value = '请填写租期开始和结束日期'
    return
  }
  availabilityLoading.value = true
  try {
    availabilityResult.value = await window.electronAPI.checkScheduleAvailability(payload)
    if (availabilityResult.value?.ok && payload.modelCode) {
      filters.modelCode = payload.modelCode
      filters.month = String(payload.rentStartDate).slice(0, 7) || filters.month
      await loadAll()
    }
  } catch (e) {
    availabilityError.value = e?.message || String(e)
  } finally {
    availabilityLoading.value = false
  }
}

function resetAvailabilityForm() {
  availabilityForm.modelCode = ''
  availabilityForm.rentStartDate = formatLocalDate(new Date())
  availabilityForm.rentEndDate = formatLocalDate(addDays(new Date(), 3))
  availabilityForm.rentDays = 4
  availabilityForm.returnBufferDays = 2
  availabilityForm.province = '四川省'
  availabilityForm.city = '成都市'
  availabilityForm.district = '金牛区'
  availabilityForm.address = ''
  availabilityForm.recipientText = '四川省成都市金牛区'
  availabilityForm.customerName = ''
  availabilityForm.customerPhone = ''
  availabilityForm.shippingMode = 'land'
  availabilityForm.transitDays = 2
  availabilityResult.value = null
  availabilityError.value = ''
  recipientParseMessage.value = ''
}

function clearAvailabilityAddressDefaults() {
  availabilityForm.province = ''
  availabilityForm.city = ''
  availabilityForm.district = ''
  availabilityForm.address = ''
  availabilityForm.recipientText = ''
  availabilityForm.customerName = ''
  availabilityForm.customerPhone = ''
  recipientParseMessage.value = ''
}

async function openOrderDetail(cell) {
  if (!cell?.orderId) return
  detailLoading.value = true
  detailModalOpen.value = true
  try {
    const [order, records] = await Promise.all([
      window.electronAPI.getOrderDetail({ orderId: cell.orderId }),
      window.electronAPI.listShippingRecords({ orderId: cell.orderId }),
    ])
    selectedOrder.value = order
    detailShippingRecords.value = records || []
  } finally {
    detailLoading.value = false
  }
}

function closeOrderDetail() {
  detailModalOpen.value = false
  detailLoading.value = false
  selectedOrder.value = null
  detailShippingRecords.value = []
}

async function loadAll() {
  const query = {
    modelCode: filters.modelCode.trim() || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  }
  const [nextBlocks, nextOverview, nextUnits] = await Promise.all([
    window.electronAPI.listScheduleBlocks(query),
    window.electronAPI.getScheduleMonthlyOverview({
      month: filters.month || defaultMonth(),
      modelCode: query.modelCode,
    }),
    window.electronAPI.listScheduleUnits({}),
  ])
  blocks.value = nextBlocks
  monthlyOverview.value = nextOverview
  scheduleUnits.value = nextUnits || []
  syncCollapsedGroups(nextOverview?.groups || [])
  // 预取本月订单元数据用于甘特图(状态、订单号、客户名)
  try {
    const month = filters.month || defaultMonth()
    const [y, m] = month.split('-').map(Number)
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    const orders = await window.electronAPI.listOrders({
      modelCode: query.modelCode,
      from: monthStart,
      to: monthEnd,
    })
    const map = {}
    for (const o of orders || []) map[o.id] = o
    orderMap.value = map
  } catch (e) {
    orderMap.value = {}
  }
}

function resetFilters() {
  filters.modelCode = ''
  filters.month = defaultMonth()
  filters.from = ''
  filters.to = ''
  loadAll()
}

watch(
  () => [availabilityForm.rentStartDate, availabilityForm.rentDays],
  ([rentStartDate, rentDays]) => {
    if (!rentStartDate || !Number(rentDays)) return
    const nextEndDate = deriveRentEndDate(rentStartDate, rentDays)
    if (availabilityForm.rentEndDate !== nextEndDate) {
      availabilityForm.rentEndDate = nextEndDate
    }
  },
)

watch(
  () => [availabilityForm.rentStartDate, availabilityForm.rentEndDate],
  ([rentStartDate, rentEndDate]) => {
    const nextRentDays = calcInclusiveRentDays(rentStartDate, rentEndDate)
    if (nextRentDays && availabilityForm.rentDays !== nextRentDays) {
      availabilityForm.rentDays = nextRentDays
    }
  },
)

watch(() => filters.month, () => {
  if (filters.month) loadAll()
})

onMounted(loadAll)
</script>

<style scoped>
.schedule-page {
  gap: 18px;
}

.schedule-summary-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.availability-modal {
  width: min(980px, calc(100vw - 48px));
  max-height: min(820px, calc(100vh - 48px));
  overflow: auto;
  display: grid;
  gap: 14px;
}

.availability-modal-head {
  align-items: flex-start;
}

.availability-mode {
  display: inline-flex;
  width: fit-content;
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.82);
}

.mode-btn {
  min-height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.mode-btn.active {
  background: #fff;
  color: #0f766e;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.06);
}

.availability-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}

.availability-grid .span-2 {
  grid-column: span 2;
}

.availability-grid .span-4 {
  grid-column: 1 / -1;
}

.availability-grid textarea {
  min-height: 96px;
  resize: vertical;
  line-height: 1.55;
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.field-head label {
  margin: 0;
}

.field-hint {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.availability-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.availability-error {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.18);
  background: rgba(254, 242, 242, 0.86);
  color: #b91c1c;
  font-size: 13px;
  font-weight: 700;
}

.availability-result {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(20, 184, 166, 0.2);
  background: var(--bg-primary-soft, rgba(20, 184, 166, 0.08));
}

.availability-result.empty {
  border-color: rgba(249, 115, 22, 0.2);
  background: var(--color-warning-soft, #fffbeb);
}

.availability-result-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.availability-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 800;
}

.availability-title span {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(20, 184, 166, 0.12);
  color: #0f766e;
  font-size: 12px;
}

.availability-window,
.availability-note {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.availability-note {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--bg-surface, #fff);
}

.availability-plan {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.availability-plan span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.available-units {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.available-unit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--brand-primary-border, rgba(20, 184, 166, 0.24));
  background: var(--bg-surface, #fff);
  color: #0f766e;
  font-size: 12px;
  font-weight: 800;
}

.available-unit:hover {
  background: #fff;
  transform: translateY(-1px);
}

.unit-sub {
  color: var(--text-muted);
  font-weight: 600;
}

.conflict-details {
  padding-top: 4px;
}

.conflict-details summary {
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.conflict-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.conflict-item {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
}

.conflict-unit {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
}

.conflict-blocks {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.conflict-block {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.92);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.filter-grid,
.detail-grid {
  display: grid;
  gap: 14px;
  align-items: end;
}

.schedule-filter-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.detail-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.filter-actions,
.group-title-row,
.group-metrics {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.overview-groups {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}

.group-card {
  display: grid;
  gap: 14px;
}

.group-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.group-title,
.unit-code,
.group-fee,
.fee-value,
.detail-value {
  color: var(--text-strong);
  font-weight: 700;
}

.group-toggle {
  min-width: auto;
  padding: 0;
}

.metric-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.metric-pill.emphasis {
  color: var(--text-primary);
  background: var(--bg-primary-soft);
  border-color: rgba(96, 165, 250, 0.36);
}

.monthly-table-wrap {
  overflow: auto;
}

.monthly-table {
  min-width: max-content;
}

.sticky-col {
  position: sticky;
  left: 0;
  z-index: 2;
  background: #fff;
}

.monthly-table thead .sticky-col {
  z-index: 3;
  background: #f8fbff;
}

.unit-col {
  min-width: 140px;
}

.day-col,
.calendar-cell {
  min-width: 56px;
  text-align: center;
}

.fee-col {
  min-width: 110px;
  white-space: nowrap;
}

.day-head-num {
  font-weight: 700;
  font-size: 13px;
  line-height: 1.1;
}
.day-head-wd {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-top: 2px;
}
.day-col.is-weekend { background: #fff7ed; color: #9a3412; }
.day-col.is-today { background: #fef3c7; color: #92400e; border-bottom: 2px solid #f59e0b; }
.cell-weekend { background: #fffbeb; }
.cell-today { outline: 2px solid #f59e0b; outline-offset: -2px; position: relative; z-index: 1; }

.summary-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.calendar-cell {
  padding: 8px 6px;
}

.cell-text {
  display: inline-block;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.cell-empty {
  background: #fff;
}

.cell-rent {
  background: #dbeafe;
  color: #1d4ed8;
}

.cell-shipping {
  background: #dcfce7;
  color: #166534;
}

.cell-buffer {
  background: #fef3c7;
  color: #b45309;
}

.cell-return_shipping {
  background: #fce7f3;
  color: #9d174d;
}

/* ============== 可视化排期(甘特图 · CamSaaS风) ============== */
.gantt-panel { padding-bottom: 10px; }

.gantt-legend {
  display: flex; gap: 12px; flex-wrap: wrap;
  font-size: 12px; font-weight: 600;
  color: var(--text-secondary);
  align-items: center;
}
.gl-item { display: inline-flex; align-items: center; gap: 5px; }
.gl-sw { width: 14px; height: 10px; border-radius: 3px; display: inline-block; }
.gl-sw-confirmed { background: #3b82f6; }
.gl-sw-active    { background: #22c55e; }
.gl-sw-completed { background: #14b8a6; }
.gl-sw-overdue   { background: #ef4444; }
.gl-sw-ship {
  background: repeating-linear-gradient(-45deg, #fecaca 0, #fecaca 3px, #fff 3px, #fff 6px);
  border: 1px dashed #ef4444;
}
.gl-divider { width: 1px; height: 14px; background: var(--border-light); margin: 0 2px; }

.gantt-wrap {
  overflow-x: auto;
  max-height: 640px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  background: #fff;
}

/* 表头 */
.gantt-head {
  display: grid;
  position: sticky; top: 0; z-index: 4;
  background: #f8fafc;
  border-bottom: 2px solid var(--border-light);
}
.gh-corner {
  grid-column: 1;
  position: sticky; left: 0; z-index: 5;
  padding: 10px 12px;
  font-size: 12px; font-weight: 700;
  color: var(--text-secondary);
  background: #f8fafc;
  border-right: 2px solid var(--border-light);
}
.gh-day {
  padding: 6px 0 8px;
  text-align: center;
  font-size: 11px;
  border-right: 1px solid #eef2f7;
  color: var(--text-secondary);
}
.ghd-num { font-size: 15px; font-weight: 700; color: var(--text-primary); line-height: 1.1; }
.ghd-wd  { font-size: 10px; margin-top: 1px; color: var(--text-muted); }
.gh-day.gh-weekend { background: #fff7ed; }
.gh-day.gh-weekend .ghd-num { color: #9a3412; }
.gh-day.gh-today { background: #fef3c7; }
.gh-day.gh-today .ghd-num { color: #b45309; }

/* 行 */
.gantt-row {
  display: grid;
  position: relative;
  border-bottom: 1px solid #f1f5f9;
  min-height: 56px;
}
.gantt-row:hover { background: #fafcff; }

.gr-meta {
  grid-column: 1;
  position: sticky; left: 0; z-index: 3;
  background: #fff;
  border-right: 2px solid var(--border-light);
  padding: 10px 12px;
  cursor: pointer;
  display: flex; flex-direction: column; justify-content: center; gap: 2px;
  transition: background 0.12s;
}
.gantt-row:hover .gr-meta { background: #fafcff; }
.grm-title {
  display: flex; align-items: center; gap: 4px;
  font-weight: 700; font-size: 13px; color: var(--text-primary);
}
.grm-model { color: #1d4ed8; }
.grm-sep { color: var(--text-muted); }
.grm-sub {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-size: 11px; color: var(--text-secondary);
  margin-top: 2px;
}
.grm-customer { }
.grm-status {
  display: inline-flex; align-items: center;
  padding: 1px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 700;
}
.gs-confirmed { background: #dbeafe; color: #1d4ed8; }
.gs-active    { background: #dcfce7; color: #15803d; }
.gs-completed { background: #ccfbf1; color: #115e59; }
.gs-overdue   { background: #fee2e2; color: #b91c1c; }

/* 型号父行 */
.gantt-model-row {
  background: #eef5ff;
  cursor: pointer;
  min-height: 42px;
  border-bottom: 1px solid #dbeafe;
}
.gantt-model-row:hover { background: #dbeafe; }
.gr-model-meta {
  grid-column: 1;
  position: sticky; left: 0; z-index: 3;
  background: inherit;
  border-right: 2px solid var(--border-light);
  padding: 8px 12px;
  display: flex; align-items: center; gap: 8px;
  font-size: 13px;
}
.gmm-toggle { color: #1d4ed8; font-size: 11px; width: 12px; flex-shrink: 0; }
.gmm-code { font-weight: 800; color: #1d4ed8; letter-spacing: 0.3px; }
.gmm-count {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 800;
}
.gmm-sub { color: var(--text-secondary); font-size: 11px; font-weight: 600; }
.gmr-cell { background: transparent; }
.gr-model-stat {
  grid-row: 1;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.gms-num {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 22px; padding: 0 6px;
  border-radius: 999px; font-size: 11px; font-weight: 700;
  color: #fff;
}
.gms-num.gms-open {
  background: #16a34a;
}
.gms-num.gms-tight {
  background: #eab308;
  color: #422006;
}
.gms-num.gms-full {
  background: #dc2626;
}

/* 设备子行 */
.gantt-unit-row { min-height: 56px; }
.gr-unit-meta {
  grid-column: 1;
  position: sticky; left: 0; z-index: 3;
  background: #fff;
  border-right: 2px solid var(--border-light);
  padding: 10px 12px 10px 28px;
  display: flex; align-items: center; gap: 8px;
  font-size: 12px;
}
.gantt-unit-row:hover .gr-unit-meta { background: #fafcff; }
.gum-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #94a3b8; flex-shrink: 0;
}
.gum-code { font-weight: 600; color: var(--text-primary); }
.gum-fee {
  margin-left: auto;
  font-weight: 700; color: #059669; font-size: 11px;
}

/* 格子 */
.gr-cell {
  border-right: 1px solid #f1f5f9;
  height: 100%;
}
.gr-cell.gr-weekend { background: rgba(255, 237, 213, 0.4); }
.gr-cell.gr-today { background: rgba(254, 243, 199, 0.55); box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.35); }

/* 段(实心=租期,虚线=物流) */
.gr-seg {
  position: relative;
  grid-row: 1;
  margin: 10px 2px;
  min-height: 36px;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  color: #fff;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.12s, filter 0.12s;
  display: flex; flex-direction: column; justify-content: center;
}
.gr-seg:hover { transform: translateY(-1px); filter: brightness(1.06); z-index: 2; }

/* 租期段按订单状态染色 */
.gr-seg-rent.gr-status-confirmed { background: #3b82f6; }
.gr-seg-rent.gr-status-active    { background: #22c55e; }
.gr-seg-rent.gr-status-completed { background: #14b8a6; }
.gr-seg-rent.gr-status-overdue   { background: #ef4444; }
.gr-seg-rent .grs-line1 {
  display: flex; align-items: baseline; gap: 6px;
  font-weight: 700; font-size: 12px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gr-seg-rent .grs-name { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; }
.gr-seg-rent .grs-days {
  flex: 0 0 auto;
  font-size: 10px;
  background: rgba(255,255,255,0.22);
  padding: 0 5px; border-radius: 3px;
  font-weight: 700;
}
.gr-seg-rent .grs-line2 {
  font-size: 9.5px; opacity: 0.9;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  margin-top: 1px;
}

/* 物流段:虚线框 + 斜纹底 */
.gr-seg-shipping,
.gr-seg-return_shipping,
.gr-seg-buffer {
  background: repeating-linear-gradient(-45deg, #fee2e2 0, #fee2e2 4px, #fff 4px, #fff 8px);
  border: 1.5px dashed #ef4444;
  color: #991b1b;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 4px;
}
.gr-seg-buffer {
  background: repeating-linear-gradient(-45deg, #fef3c7 0, #fef3c7 4px, #fff 4px, #fff 8px);
  border-color: #f59e0b;
  color: #92400e;
}
.grs-ship-pill {
  display: inline-flex; align-items: center;
  padding: 3px 8px;
  background: var(--bg-surface, #fff);
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.cell-clickable {
  cursor: pointer;
}

.heatmap-table {
  min-width: max-content;
}
.heatmap-model-col {
  min-width: 140px;
  background: #f8fbff;
}
.heatmap-total-col,
.heatmap-avg-col {
  min-width: 84px;
  white-space: nowrap;
  text-align: center;
  color: var(--text-strong);
  font-weight: 700;
}
.heat-cell {
  min-width: 56px;
  padding: 6px 4px;
  text-align: center;
  font-size: 12px;
  line-height: 1.2;
  color: #1f2937;
  transition: filter 0.15s ease;
}
.heat-cell .heat-num { font-weight: 700; }
.heat-cell .heat-sep { opacity: 0.55; margin: 0 1px; }
.heat-cell .heat-den { opacity: 0.7; }
.heat-clickable { cursor: pointer; }
.heat-clickable:hover { filter: brightness(0.92); }
.heat-0 { background: #f9fafb; color: #9ca3af; }
.heat-1 { background: #dbeafe; color: #1e40af; }
.heat-2 { background: #93c5fd; color: #0c2f6f; }
.heat-3 { background: #3b82f6; color: #fff; }
.heat-4 { background: #1d4ed8; color: #fff; }
.day-col.is-weekend { background: #fff7ed; color: #9a3412; }

.legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-secondary);
}
.legend-swatch {
  display: inline-block;
  width: 16px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--border-light);
}
.legend-swatch.legend-0 { background: #f9fafb; }
.legend-swatch.legend-1 { background: #dbeafe; }
.legend-swatch.legend-2 { background: #93c5fd; }
.legend-swatch.legend-3 { background: #3b82f6; }
.legend-swatch.legend-4 { background: #1d4ed8; }
.legend-text { margin-right: 8px; }

.heatmap-detail-modal {
  width: min(680px, 100%);
}
.heat-detail-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.heat-detail-item {
  display: grid;
  gap: 6px;
  padding: 12px;
}
.heat-detail-unit {
  font-weight: 700;
  color: var(--text-strong);
}
.heat-detail-state {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-secondary);
}
.state-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 11px;
}
.state-rent { background: #dbeafe; color: #1d4ed8; }
.state-shipping { background: #dcfce7; color: #166534; }
.state-return_shipping { background: #fce7f3; color: #9d174d; }
.state-buffer { background: #fef3c7; color: #b45309; }
.state-idle { background: #f3f4f6; color: #6b7280; }

.order-detail-modal {
  width: min(920px, 100%);
}

.detail-item {
  min-height: 96px;
}

.detail-traces {
  margin-top: 18px;
}

.detail-traces-head {
  margin-bottom: 12px;
}

.trace-list {
  display: grid;
  gap: 10px;
}

.trace-item {
  display: grid;
  gap: 8px;
}

.trace-item-latest {
  border: 1px solid rgba(37, 99, 235, 0.28);
  background: #eff6ff;
}

.trace-main,
.trace-meta,
.trace-status-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.trace-status,
.trace-time {
  color: var(--text-strong);
  font-weight: 700;
}

.trace-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
}

.trace-meta {
  color: var(--text-secondary);
  font-size: 13px;
}

@media (max-width: 1280px) {
  .schedule-summary-grid,
  .availability-grid,
  .schedule-filter-grid,
  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .schedule-summary-grid,
  .availability-grid,
  .schedule-filter-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .availability-grid .span-2 {
    grid-column: span 1;
  }
  .availability-grid .span-4 {
    grid-column: span 1;
  }
  .availability-modal {
    width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
  }
  .conflict-item {
    grid-template-columns: 1fr;
  }
}
</style>
