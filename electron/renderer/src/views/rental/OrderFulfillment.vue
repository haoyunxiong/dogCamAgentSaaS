<template>
  <div class="page fulfillment-page">
    <PageHeader
      title="订单履约"
      subtitle="从新建订单到物流查单再到到期归还，串起整条租赁业务主线。"
      icon="📦"
      :breadcrumb="['经营管理', '订单履约']"
    >
      <template #actions>
        <span class="pill" :class="logisticsEnabled ? 'pill-success' : 'pill-warning'">
          {{ logisticsEnabled ? '● 真实物流已启用' : '○ 真实物流未启用' }}
        </span>
        <button class="btn btn-secondary" @click="openImportPreview" :disabled="importLoading">{{ importLoading ? '解析中…' : '📥 导入 Excel' }}</button>
        <button class="btn btn-secondary" @click="loadOrders">↻ 刷新</button>
        <button class="btn btn-secondary" @click="openAvailabilityDrawer">查档期</button>
        <button class="btn btn-primary" @click="openCreateModal">＋ 新建订单</button>
      </template>
    </PageHeader>

    <section class="panel kpi-panel">
      <div class="panel-header compact-panel-header">
        <div>
          <h3>今日任务</h3>
          <div class="panel-tip">优先处理发货、归还与异常订单，减少首屏噪音。</div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="openActionModal">任务中心</button>
      </div>
      <KpiStrip :items="primaryStripItems" :active-key="filters.quickFilter" @select="applyQuickFilter" />
      <div class="compact-kpi-row">
        <button
          v-for="item in secondaryKpiItems"
          :key="item.key"
          class="compact-kpi-chip"
          :class="{ active: filters.quickFilter === item.key }"
          @click="applyQuickFilter(item.key)"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </button>
      </div>
    </section>

    <OrderFilters
      :filters="filters"
      :show-advanced-filters="showAdvancedFilters"
      :quick-filter-tabs="quickFilterTabs"
      :store-options="storeOptions"
      :available-model-codes="availableModelCodes"
      @update:show-advanced-filters="showAdvancedFilters = $event"
      @toggle-advanced="toggleAdvancedFilters"
      @apply-quick-filter="applyQuickFilter"
      @submit="loadOrders"
      @reset="resetFilters"
      @apply-date-preset="applyDatePreset"
      @apply-advanced="applyAdvancedFilters"
    />

    <div v-if="message" class="banner">{{ message }}</div>

    <div class="workspace-grid">
      <section class="panel workspace-panel order-board-panel">
        <div class="panel-header">
          <div>
            <h3>订单工作区</h3>
            <div class="panel-tip">以表格为主视图，优先暴露高频处理动作。</div>
          </div>
          <div class="board-head-meta">
            <span class="meta-chip">当前筛选：{{ currentQuickFilterLabel }}</span>
            <span class="meta-chip">共 {{ flatOrders.length }} 单</span>
            <span class="meta-chip">已选 {{ selectedOrderIds.length }} 单</span>
          </div>
        </div>
        <div class="bulk-order-bar">
          <label class="select-all-line">
            <input type="checkbox" :checked="allVisibleSelected" :disabled="!visibleOrderIds.length" @change="toggleVisibleSelection" />
            <span>已选 {{ selectedOrderIds.length }} / 当前 {{ visibleOrderIds.length }}</span>
          </label>
          <div class="bulk-order-actions">
            <button class="btn btn-secondary btn-sm" :disabled="!selectedOrderIds.length || shipActionLoading" @click="shipSelectedWithSf">
              顺丰寄件
            </button>
            <button class="btn btn-secondary btn-sm" :disabled="!selectedOrderIds.length" @click="openBatchExtendForSelected">
              延期
            </button>
            <button class="btn btn-secondary btn-sm" :disabled="!selectedOrderIds.length" @click="completeSelectedOrders">
              完结
            </button>
            <button class="btn btn-danger btn-sm" :disabled="!selectedOrderIds.length" @click="deleteSelectedOrders">
              删除
            </button>
            <button class="btn btn-secondary btn-sm" :disabled="!selectedOrderIds.length" @click="clearOrderSelection">清空</button>
          </div>
        </div>

        <OrderTable
          :orders="flatOrders"
          :selected-order-id="selectedOrderId"
          :selected-order-ids="selectedOrderIds"
          :all-visible-selected="allVisibleSelected"
          :ship-action-loading="shipActionLoading"
          :default-store-name="defaultStoreName"
          :shipping-mode-label="shippingModeLabel"
          :calc-rent-days="calcRentDays"
          :payment-status-badge="paymentStatusBadge"
          :fulfillment-status-badge="fulfillmentStatusBadge"
          :deposit-status-badge="depositStatusBadge"
          :map-status-variant="mapStatusVariant"
          :get-order-completion-state="getOrderCompletionState"
          :is-primary-action-disabled="isPrimaryActionDisabled"
          :primary-action-label="primaryActionLabel"
          :action-menu-items="actionMenuItems"
          @select-order="selectOrder"
          @toggle-order-selection="toggleOrderSelection"
          @toggle-visible-selection="toggleVisibleSelection"
          @primary-action="runPrimaryAction"
          @menu-action="handleActionMenu"
        />
      </section>
    </div>

    <OrderDetailDrawer
      v-model="showDetailModal"
      :order="selectedOrder"
      :latest-deposit-order="latestDepositOrder"
      :shipping-form="shippingForm"
      :shipping-records="shippingRecords"
      :default-store-name="defaultStoreName"
      :advisor-message="advisorMessage"
      :advisor-severity="advisorSeverity"
      :deposit-header-label="depositHeaderLabel"
      :deposit-header-variant="depositHeaderVariant"
      :logistics-status-summary="logisticsStatusSummary"
      :logistics-last-update="logisticsLastUpdate"
      :completion-state="selectedOrderCompletionState"
      :ship-action-loading="shipActionLoading"
      :logistics-loading="logisticsLoading"
      :order-status-label="orderStatusLabel"
      :is-pending-ship-order="isPendingShipOrder"
      :is-pending-return-order="isPendingReturnOrder"
      :map-status-variant="mapStatusVariant"
      :calc-rent-days="calcRentDays"
      :source-channel-label="sourceChannelLabel"
      :format-order-address="formatOrderAddress"
      :get-deposit-status-label="getDepositStatusLabel"
      :shipping-mode-label="shippingModeLabel"
      :format-date-time="formatDateTime"
      @close="closeDetailModal"
      @edit-order="openEditOrderDrawer"
      @copy-shipping-info="copyShippingInfo"
      @open-create-deposit="openCreateDeposit"
      @copy-deposit-review-url="copyDepositReviewUrl"
      @save-deposit-poster="saveDepositPoster"
      @ship-order-with-sf="shipOrderWithSf"
      @query-logistics="queryLogistics"
      @reset-shipping-draft="resetShippingDraft"
      @save-shipping="saveShipping"
    />

    <div v-if="showBatchExtendModal" class="modal-overlay" @click.self="closeBatchExtendModal">
      <div class="modal cardish batch-extend-modal">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeBatchExtendModal">✕</button>
        </div>
        <div class="panel-header">
          <div>
            <h3>批量延期</h3>
            <div class="panel-tip">将当前勾选订单统一延期，适合客户续租或临时改期。</div>
          </div>
          <span class="meta-chip">已选 {{ selectedOrderIds.length }} 单</span>
        </div>

        <div class="bulk-extend-editor">
          <div class="form-grid two-cols">
            <div class="form-group">
              <label>统一延期到</label>
              <ClickOpenDateInput v-model="batchExtendForm.rentEndDate" />
            </div>
            <div class="form-group">
              <label>追加租金</label>
              <input v-model.number="batchExtendForm.extraFee" type="number" min="0" placeholder="0" />
            </div>
          </div>
        </div>

        <div class="selected-order-preview">
          <div v-for="order in selectedOrders" :key="`extend-preview-${order.id}`" class="selected-order-item">
            <div>
              <strong>#{{ order.id }} {{ order.order_no || '未填订单号' }}</strong>
              <span>{{ order.customer_name || '-' }} · {{ order.model_code || '-' }}</span>
            </div>
            <span>{{ order.rent_start_date }} ~ {{ order.rent_end_date }}</span>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" :disabled="!selectedOrderIds.length || !batchExtendForm.rentEndDate" @click="extendSelectedOrders">
            确认延期
          </button>
          <button class="btn btn-secondary" @click="closeBatchExtendModal">取消</button>
        </div>
      </div>
    </div>

    <BaseDrawer
      v-model="showCreateModal"
      :title="createDrawerTitle"
      :subtitle="createDrawerSubtitle"
      :width="960"
      @close="closeCreateModal"
    >
      <div class="create-order-drawer">

        <section v-if="createDrawerMode === 'order'" class="paste-panel">
          <div class="paste-head">
            <div>
              <div class="section-head">粘贴收货信息</div>
              <div class="section-tip">自动识别姓名、电话、省市区和详细地址。</div>
            </div>
            <div class="paste-actions">
              <button class="btn btn-primary btn-sm" @click="parseRecipientPaste">识别填入</button>
              <button class="btn btn-secondary btn-sm" @click="clearRecipientPaste">清空</button>
              <button class="btn btn-secondary btn-sm" @click="clearAddressPrefill">清空地址</button>
            </div>
          </div>
          <textarea
            v-model="recipientPasteText"
            class="paste-textarea"
            placeholder="李双双 13800138000 四川省成都市武侯区天府长岛50号"
            @paste="handleRecipientPaste"
            @input="pasteParseMessage = ''"
          ></textarea>
          <div v-if="pasteParseMessage" class="paste-result">{{ pasteParseMessage }}</div>
        </section>

        <section v-if="createDrawerMode === 'availability'" class="create-flow-panel">
          <div class="section-head-row">
            <div>
              <div class="section-head">档期查询</div>
              <div class="section-tip">可先查可用机器并复用租期、报价和预计发货；也可以直接在下方创建订单。</div>
            </div>
            <div class="availability-mode">
              <button
                v-for="mode in availabilityModes"
                :key="mode.key"
                class="mode-btn"
                :class="{ active: availabilityMode === mode.key }"
                @click="availabilityMode = mode.key"
              >{{ mode.label }}</button>
            </div>
          </div>

          <div class="form-grid create-query-grid">
            <div class="form-group">
              <label>店铺</label>
              <select v-model.number="form.storeId">
                <option :value="null">选择店铺</option>
                <option v-for="store in storeOptions" :key="store.id" :value="Number(store.id)">{{ store.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>型号编码</label>
              <select v-model="form.modelCode">
                <option value="">选择型号</option>
                <option v-for="model in availableModelCodes" :key="model" :value="model">{{ model }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>物流方式</label>
              <select v-model="form.shippingMode">
                <option value="land">陆运</option>
                <option value="express">普通快递</option>
                <option value="next_morning">次晨达</option>
              </select>
            </div>
            <div class="form-group">
              <label>开始日期</label>
              <ClickOpenDateInput v-model="form.rentStartDate" />
            </div>
            <div class="form-group">
              <label>租赁天数</label>
              <RentDaysInput v-model="availabilityRentDays" />
            </div>
            <div class="form-group">
              <label>结束日期</label>
              <ClickOpenDateInput v-model="form.rentEndDate" />
            </div>
            <div class="form-group">
              <label>归还缓冲</label>
              <input v-model.number="availabilityReturnBufferDays" type="number" min="0" max="10" />
            </div>
            <div v-if="availabilityMode === 'days'" class="form-group">
              <label>运输天数</label>
              <input v-model.number="availabilityTransitDays" type="number" min="1" max="15" />
            </div>
          </div>

          <div class="form-grid create-query-grid address-grid">
            <div class="form-group">
              <label>省份</label>
              <input v-model="form.province" placeholder="四川省" />
            </div>
            <div class="form-group">
              <label>城市</label>
              <input v-model="form.city" placeholder="成都市" />
            </div>
            <div class="form-group">
              <label>区县</label>
              <input v-model="form.district" placeholder="金牛区" />
            </div>
            <div class="form-group span-2">
              <label>详细地址</label>
              <input v-model="form.address" placeholder="详细地址可不填；模糊查档期可只填到市/区" />
            </div>
          </div>

          <div class="availability-actions inline-actions">
            <button class="btn btn-primary" @click="runAvailabilityCheck" :disabled="availabilityLoading">
              {{ availabilityLoading ? '查询中...' : '查询可用机器' }}
            </button>
            <button class="btn btn-secondary" @click="resetAvailabilityQuery">重置查询条件</button>
          </div>

          <div v-if="availabilityError" class="availability-error">{{ availabilityError }}</div>
          <div v-else-if="availabilityResult && availabilityDirty" class="availability-note stale-note">查询条件已变更，请重新查询档期。</div>

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

            <div v-if="availabilityResult.plan.fallbackReason" class="availability-note">
              {{ availabilityResult.plan.fallbackReason }}
            </div>

            <div v-if="availabilityResult.availableUnits.length" class="available-units">
              <button
                v-for="unit in availabilityResult.availableUnits"
                :key="unit.id"
                class="available-unit"
                :class="{ active: form.unitId === unit.id }"
                @click="selectAvailableUnit(unit)"
              >
                <span class="unit-main">{{ unit.unitCode }}</span>
                <span class="unit-sub">{{ form.unitId === unit.id ? '已选中' : '可直接建单' }}</span>
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
        </section>

        <section v-if="createDrawerMode === 'order'" class="create-flow-panel">
          <div class="section-head-row">
            <div>
              <div class="section-head">创建订单</div>
              <div class="section-tip">保存必填：设备、租期、来源；客户收货信息可后补，发货前必须补齐。</div>
            </div>
            <div class="create-section-actions">
              <button class="btn btn-secondary btn-sm" @click="switchToAvailabilityMode">先查档期</button>
              <div v-if="selectedAvailableUnit" class="selection-chip">
                已锁定 {{ selectedAvailableUnit.unitCode }}
              </div>
            </div>
          </div>

          <div class="requirement-strip">
            <span class="requirement-chip required">保存必填：店铺 / 型号 / 设备 / 租期 / 来源</span>
            <span class="requirement-chip warning">发货前必填：姓名 / 电话 / 详细地址</span>
            <span class="requirement-chip optional">可后补：平台订单号 / 运单号 / 备注</span>
          </div>

          <div class="form-grid create-confirm-grid">
            <div class="form-group">
              <label>店铺 <span class="field-mark required">保存必填</span></label>
              <select v-model.number="form.storeId">
                <option :value="null">选择店铺</option>
                <option v-for="store in storeOptions" :key="store.id" :value="Number(store.id)">{{ store.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>型号编码 <span class="field-mark required">保存必填</span></label>
              <select v-model="form.modelCode">
                <option value="">选择型号</option>
                <option v-for="model in availableModelCodes" :key="model" :value="model">{{ model }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>设备编号 <span class="field-mark required">保存必填</span></label>
              <select v-model.number="form.unitId" :disabled="!form.modelCode" @change="applyDefaultAmounts(form, selectedAvailableUnit, { force: true, notifyMissingRent: true })">
                <option :value="null">请选择设备</option>
                <option v-for="unit in createDeviceOptions" :key="unit.id" :value="unit.id">
                  {{ unit.unitCode }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>物流方式</label>
              <select v-model="form.shippingMode">
                <option value="land">陆运</option>
                <option value="express">普通快递</option>
                <option value="next_morning">次晨达</option>
              </select>
            </div>
            <div class="form-group">
              <label>开始日期 <span class="field-mark required">保存必填</span></label>
              <ClickOpenDateInput v-model="form.rentStartDate" />
            </div>
            <div class="form-group">
              <label>租赁天数</label>
              <RentDaysInput v-model="availabilityRentDays" />
            </div>
            <div class="form-group">
              <label>结束日期 <span class="field-mark required">保存必填</span></label>
              <ClickOpenDateInput v-model="form.rentEndDate" />
            </div>
            <div class="form-group">
              <label>来源渠道 <span class="field-mark required">保存必填</span></label>
              <select v-model="form.sourceChannel">
                <option v-for="source in sourceChannelOptions" :key="source.key" :value="source.key">{{ source.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>来源名称 <span class="field-mark required">保存必填</span></label>
              <input v-model="form.sourceName" placeholder="闲鱼昵称 / 微信备注 / 小红书账号" />
            </div>
            <div class="form-group">
              <label>客户姓名 <span class="field-mark warning">发货前必填</span></label>
              <input v-model="form.customerName" placeholder="收件人姓名" />
            </div>
            <div class="form-group">
              <label>客户手机号 <span class="field-mark warning">发货前必填</span></label>
              <input v-model="form.customerPhone" placeholder="收件人手机号" />
            </div>
            <div class="form-group">
              <label>省份</label>
              <input v-model="form.province" placeholder="四川省" />
            </div>
            <div class="form-group">
              <label>城市</label>
              <input v-model="form.city" placeholder="成都市" />
            </div>
            <div class="form-group">
              <label>区县</label>
              <input v-model="form.district" placeholder="金牛区" />
            </div>
            <div class="form-group">
              <label>详细地址 <span class="field-mark warning">发货前必填</span></label>
              <input v-model="form.address" placeholder="详细地址" />
            </div>
            <div class="form-group">
              <label>订单号</label>
              <input v-model="form.orderNo" placeholder="平台订单号" />
            </div>
            <div class="form-group">
              <label>运单号</label>
              <input v-model="form.trackingNo" placeholder="可选" />
            </div>
            <div class="form-group">
              <label>费用</label>
              <input v-model.number="form.fee" type="number" min="0" placeholder="0" />
            </div>
            <div class="form-group">
              <label>押金</label>
              <input v-model.number="form.deposit" type="number" min="0" placeholder="0" />
            </div>
            <div class="form-group span-2">
              <label>订单备注</label>
              <input v-model="form.remark" placeholder="补充说明 / 特殊约定 / 地址不完整原因" />
            </div>
          </div>

          <div v-if="activeShippingPreview" class="preview-panel shipping-preview-panel">
            <div class="preview-grid">
              <div class="preview-item cardish">
                <div class="summary-label">预计发货</div>
                <div class="preview-value">{{ formatDateTime(activeShippingPreview.plannedShipAt) }}</div>
              </div>
              <div class="preview-item cardish">
                <div class="summary-label">预计送达</div>
                <div class="preview-value">{{ formatDateTime(activeShippingPreview.expectedArriveAt) }}</div>
              </div>
              <div class="preview-item cardish">
                <div class="summary-label">时效来源</div>
                <div class="preview-value small">{{ shippingPreviewSourceLabel }}</div>
              </div>
              <div class="preview-item cardish">
                <div class="summary-label">物流说明</div>
                <div class="preview-value small">{{ logisticsEnabled ? '已开启真实物流查询配置' : '当前轨迹查询未开启' }}</div>
              </div>
            </div>
            <div v-if="activeShippingPreview.fallbackReason" class="banner subtle-banner">回退原因：{{ activeShippingPreview.fallbackReason }}</div>
            <div class="xhs-line">
              <div>
                <div class="summary-label">小红书推荐词</div>
                <div class="preview-value small">{{ xiaohongshuKeyword || '-' }}</div>
              </div>
              <button class="link-btn" @click="openXiaohongshuSearch" :disabled="!xiaohongshuKeyword">打开搜索</button>
            </div>
          </div>
        </section>

      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="closeCreateModal">取消</button>
        <button v-if="createDrawerMode === 'availability'" class="btn btn-primary" @click="reuseAvailabilityForCreate" :disabled="!availabilityResult?.ok || !selectedAvailableUnit">
          复用条件创建订单
        </button>
        <button v-else class="btn btn-primary" @click="create" :disabled="!canCreateOrder">新建订单</button>
      </template>
    </BaseDrawer>

    <div v-if="showImportModal" class="modal-overlay" @click.self="closeImportModal">
      <div class="modal cardish import-modal">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeImportModal">✕</button>
        </div>
        <div class="panel-header">
          <div>
            <h3>Excel 导入预览</h3>
            <div class="panel-tip">先预览设备和订单草稿，再确认导入。</div>
          </div>
        </div>

        <div v-if="importPreview?.message" class="banner">{{ importPreview.message }}</div>

        <template v-else-if="importPreview">
          <div class="summary import-summary">
            <StatsCard label="月份" :value="importPreview.month" hint="当前导入账期" />
            <StatsCard label="设备数" :value="importPreview.totalUnits" hint="预览设备总数" tone="info" />
            <StatsCard label="可导入" :value="importPreview.validDrafts" hint="可直接入库" tone="success" />
            <StatsCard label="失败" :value="importPreview.invalidDrafts" hint="需先修正异常" tone="warning" />
          </div>

          <DataTable class="import-preview-table" min-width="1040px" compact>
            <table>
              <thead>
                <tr>
                  <th>行</th><th>设备</th><th>型号</th><th>租客</th><th>租期</th><th>天数</th><th>分摊收益</th><th>边界</th><th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in importPreview.previews" :key="item.draftId">
                  <td>{{ item.rowIndex }}</td>
                  <td>{{ item.unitCode }}</td>
                  <td>{{ item.modelCode }}</td>
                  <td>{{ item.customerName }}</td>
                  <td>{{ item.rentStartDate }} ~ {{ item.rentEndDate }}</td>
                  <td>{{ item.segmentDays || 0 }}</td>
                  <td>{{ item.fee || 0 }}</td>
                  <td>{{ item.boundarySummary || '-' }}</td>
                  <td>
                    <StatusBadge
                      :label="item.canImport ? '可导入' : item.error"
                      :variant="item.canImport ? 'success' : 'warning'"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </DataTable>

          <div class="form-actions">
            <button class="btn btn-primary" @click="executeImport" :disabled="!importPreview.validDrafts || importExecuting">{{ importExecuting ? '导入中...' : '确认导入' }}</button>
            <button class="btn btn-secondary" @click="closeImportModal">取消</button>
          </div>
        </template>
      </div>
    </div>

    <div v-if="showActionModal" class="modal-overlay" @click.self="closeActionModal">
      <div class="modal cardish action-modal">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeActionModal">✕</button>
        </div>
        <div class="panel-header">
          <div>
            <h3>任务中心</h3>
            <div class="panel-tip">集中处理待发货、待归还与延期任务。</div>
          </div>
        </div>

        <div class="summary action-summary-grid">
          <StatsCard label="待发货" :value="actionAlerts.pendingShip.length" hint="待确认发货" tone="warning" />
          <StatsCard label="待归还" :value="actionAlerts.pendingReturn.length" hint="待回收设备" tone="info" />
          <StatsCard label="逾期" :value="overdueReturnCount" hint="需优先跟进" tone="danger" />
          <StatsCard label="已勾选" :value="shipSelection.length + returnSelection.length" hint="当前批量操作数" />
        </div>

        <div class="action-board">
          <div class="alert-section task-pane" v-if="actionAlerts.pendingShip.length">
            <div class="section-head-row">
              <div>
                <div class="section-head">待发货（{{ actionAlerts.pendingShip.length }}）</div>
                <div class="section-tip">勾选后可一键确认已发货。</div>
              </div>
              <button class="link-btn" @click="toggleShipSelectionAll">
                {{ shipSelection.length === actionAlerts.pendingShip.length ? '取消全选' : '全选本组' }}
              </button>
            </div>
            <div class="alert-list task-scroll">
              <div v-for="order in actionAlerts.pendingShip" :key="`ship-${order.id}`" class="alert-card task-card">
                <label class="alert-check-row">
                  <input type="checkbox" v-model="shipSelection" :value="order.id" />
                  <div class="alert-main">
                    <div class="task-head-row">
                      <div class="alert-title">{{ order.model_code }} · {{ order.customer_name || '-' }}</div>
                      <StatusBadge label="待发货" variant="warning" />
                    </div>
                    <div class="alert-meta">店铺 {{ order.store_name || defaultStoreName }} · 订单 #{{ order.id }} · 设备 {{ order.unit_code || '-' }}</div>
                    <div class="alert-meta">应发货 {{ formatDateTime(order.planned_ship_at) }}</div>
                  </div>
                </label>
              </div>
            </div>
            <div class="form-actions sticky-actions">
              <button class="btn btn-primary" @click="batchShip" :disabled="!shipSelection.length || shipActionLoading">
                {{ shipActionLoading ? '处理中...' : `批量确认已发货（${shipSelection.length}）` }}
              </button>
            </div>
          </div>

          <div class="alert-section task-pane" v-if="actionAlerts.pendingReturn.length">
            <div class="section-head-row">
              <div>
                <div class="section-head">待归还 / 逾期（{{ actionAlerts.pendingReturn.length }}）</div>
                <div class="section-tip">可批量确认已归还，也可统一延期。</div>
              </div>
              <button class="link-btn" @click="toggleReturnSelectionAll">
                {{ returnSelection.length === actionAlerts.pendingReturn.length ? '取消全选' : '全选本组' }}
              </button>
            </div>
            <div class="bulk-extend-bar cardish">
              <div class="bulk-extend-grid">
                <div class="form-group compact-field">
                  <label>统一延期到</label>
                  <ClickOpenDateInput v-model="batchExtendForm.rentEndDate" />
                </div>
                <div class="form-group compact-field">
                  <label>统一延期租金</label>
                  <input v-model.number="batchExtendForm.extraFee" type="number" min="0" placeholder="0" />
                </div>
              </div>
              <div class="form-actions bulk-extend-actions">
                <button class="btn btn-secondary" @click="applyBatchExtendDraft" :disabled="!returnSelection.length">填充到已勾选（{{ returnSelection.length }}）</button>
                <button class="btn btn-primary" @click="batchExtendSelected" :disabled="!returnSelection.length || !batchExtendForm.rentEndDate">批量延期（{{ returnSelection.length }}）</button>
                <button class="btn btn-primary" @click="batchReturn" :disabled="!returnSelection.length">批量确认已归还（{{ returnSelection.length }}）</button>
              </div>
            </div>
            <div class="alert-list task-scroll">
              <div v-for="order in actionAlerts.pendingReturn" :key="`return-${order.id}`" class="alert-card alert-card-stack task-card">
                <label class="alert-check-row">
                  <input type="checkbox" v-model="returnSelection" :value="order.id" />
                  <div class="alert-main">
                    <div class="task-head-row">
                      <div class="alert-title">{{ order.model_code }} · {{ order.customer_name || '-' }}</div>
                      <StatusBadge
                        :label="isOverdueOrder(order) ? '已逾期' : '待归还'"
                        :variant="isOverdueOrder(order) ? 'danger' : 'warning'"
                      />
                    </div>
                    <div class="alert-meta">店铺 {{ order.store_name || defaultStoreName }} · 订单 #{{ order.id }} · 设备 {{ order.unit_code || '-' }}</div>
                    <div class="alert-meta">截止 {{ order.rent_end_date }} · {{ order.latest_logistics_status || '待处理' }}</div>
                  </div>
                </label>
                <div class="extend-inline">
                  <ClickOpenDateInput v-model="extendForms[order.id].rentEndDate" />
                  <input v-model.number="extendForms[order.id].extraFee" type="number" min="0" placeholder="延期租金" />
                  <button class="btn btn-secondary btn-sm" @click="extendSingle(order.id)">单条延期</button>
                  <button class="btn btn-secondary btn-sm" @click="markReturned(order.id)">单条归还</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!actionAlerts.pendingShip.length && !actionAlerts.pendingReturn.length" class="empty-state cardish">
          <div class="empty-title">当前没有待处理订单</div>
          <div class="panel-tip">发货、归还和延期提醒会在这里集中出现。</div>
        </div>
      </div>
    </div>
  </div>

    <BaseDrawer
      v-model="showEditDrawer"
      :title="editForm.orderId ? `编辑订单 #${editForm.orderId}` : '编辑订单'"
      :width="680"
    >
      <div class="order-edit-body">
        <section class="paste-panel paste-panel--compact">
          <div class="paste-head">
            <div>
              <div class="section-head">粘贴收货信息</div>
              <div class="section-tip">直接粘贴姓名、电话、地址，识别后只覆盖识别出的字段。</div>
            </div>
            <div class="paste-actions">
              <button class="btn btn-primary btn-sm" @click="parseEditRecipientPaste">识别填入</button>
              <button class="btn btn-secondary btn-sm" @click="clearEditRecipientPaste">清空</button>
            </div>
          </div>
          <textarea
            v-model="editRecipientPasteText"
            class="paste-textarea paste-textarea--compact"
            placeholder="李双双 13800138000 四川省成都市武侯区天府长岛50号"
            @paste="handleEditRecipientPaste"
            @input="editPasteParseMessage = ''"
          ></textarea>
          <div v-if="editPasteParseMessage" class="paste-result">{{ editPasteParseMessage }}</div>
        </section>

        <section v-if="editCompletionState.missingFields.length" class="missing-fields-panel">
          <div>
            <div class="section-head">资料状态：{{ editCompletionState.label }}</div>
            <div class="section-tip">缺失字段会影响后续寄件或对账，保存后也会在订单列表中提示。</div>
          </div>
          <div class="missing-field-list">
            <span v-for="field in editCompletionState.missingFields" :key="field" class="missing-field-chip">{{ field }}</span>
          </div>
        </section>

        <section class="drawer-section-card">
          <div class="drawer-section-head">
            <div class="drawer-section-title">基础信息</div>
          </div>
          <div class="form-grid create-confirm-grid">
            <div class="form-group">
              <label>店铺</label>
              <select v-model.number="editForm.storeId">
                <option :value="null">选择店铺</option>
                <option v-for="store in storeOptions" :key="store.id" :value="Number(store.id)">{{ store.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>订单号</label>
              <input v-model="editForm.orderNo" placeholder="平台订单号" />
            </div>
            <div class="form-group">
              <label>来源渠道 *</label>
              <select v-model="editForm.sourceChannel">
                <option v-for="source in sourceChannelOptions" :key="source.key" :value="source.key">{{ source.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>来源名称 *</label>
              <input v-model="editForm.sourceName" placeholder="闲鱼昵称 / 微信备注 / 小红书账号" />
            </div>
            <div class="form-group">
              <label>客户姓名</label>
              <input v-model="editForm.customerName" placeholder="收件人姓名" />
            </div>
            <div class="form-group">
              <label>客户手机号</label>
              <input v-model="editForm.customerPhone" placeholder="收件人手机号" />
            </div>
          </div>
        </section>

        <section class="drawer-section-card">
          <div class="drawer-section-head">
            <div class="drawer-section-title">设备与租期</div>
          </div>
          <div class="form-grid create-confirm-grid">
            <div class="form-group">
              <label>型号编码</label>
              <select v-model="editForm.modelCode">
                <option value="">选择型号</option>
                <option v-for="model in availableModelCodes" :key="model" :value="model">{{ model }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>设备编号</label>
              <select v-model.number="editForm.unitId" :disabled="!editForm.modelCode" @change="applyDefaultAmounts(editForm, selectedEditUnit, { notifyMissingRent: true })">
                <option :value="null">请选择设备</option>
                <option v-for="unit in editDeviceOptions" :key="unit.id" :value="unit.id">{{ unit.unitCode }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>开始日期</label>
              <ClickOpenDateInput v-model="editForm.rentStartDate" />
            </div>
            <div class="form-group">
              <label>结束日期</label>
              <ClickOpenDateInput v-model="editForm.rentEndDate" />
            </div>
            <div class="form-group">
              <label>费用</label>
              <input v-model.number="editForm.fee" type="number" min="0" placeholder="0" />
            </div>
            <div class="form-group">
              <label>押金</label>
              <input v-model.number="editForm.deposit" type="number" min="0" placeholder="0" />
            </div>
          </div>
        </section>

        <section class="drawer-section-card">
          <div class="drawer-section-head">
            <div class="drawer-section-title">收货与物流</div>
          </div>
          <div class="form-grid create-confirm-grid">
            <div class="form-group">
              <label>省份</label>
              <input v-model="editForm.province" placeholder="四川省" />
            </div>
            <div class="form-group">
              <label>城市</label>
              <input v-model="editForm.city" placeholder="成都市" />
            </div>
            <div class="form-group">
              <label>区县</label>
              <input v-model="editForm.district" placeholder="金牛区" />
            </div>
            <div class="form-group">
              <label>物流方式</label>
              <select v-model="editForm.shippingMode">
                <option value="land">陆运</option>
                <option value="express">普通快递</option>
                <option value="next_morning">次晨达</option>
              </select>
            </div>
            <div class="form-group">
              <label>运单号</label>
              <input v-model="editForm.trackingNo" placeholder="可选" />
            </div>
            <div class="form-group">
              <label>物流状态</label>
              <input v-model="editForm.latestLogisticsStatus" placeholder="待更新" />
            </div>
            <div class="form-group span-2">
              <label>详细地址</label>
              <input v-model="editForm.address" placeholder="详细地址" />
            </div>
            <div class="form-group span-2">
              <label>订单备注</label>
              <input v-model="editForm.remark" placeholder="补充说明 / 特殊约定" />
            </div>
          </div>
        </section>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showEditDrawer = false">取消</button>
        <button class="btn btn-primary" :disabled="editSaving" @click="saveEditedOrder">
          {{ editSaving ? '保存中...' : '保存订单' }}
        </button>
      </template>
    </BaseDrawer>

    <CreateDepositDrawer
      v-model="showCreateDepositDrawer"
      :order="depositSourceOrder"
      @close="showCreateDepositDrawer = false"
      @created="onDepositCreated"
    />

</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import ClickOpenDateInput from '../../components/ClickOpenDateInput.vue'
import BaseDrawer from '../../components/BaseDrawer.vue'
import CreateDepositDrawer from '../../components/CreateDepositDrawer.vue'
import DataTable from '../../components/DataTable.vue'
import KpiStrip from '../../components/KpiStrip.vue'
import PageHeader from '../../components/PageHeader.vue'
import RentDaysInput from '../../components/RentDaysInput.vue'
import StatsCard from '../../components/StatsCard.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { useConfirmDialog } from '../../composables/useConfirmDialog'
import { downloadDepositPoster } from '../../utils/depositPosterCanvas.js'
import { runViewInitialization } from '../../utils/viewInitialization.mjs'
import { applyDepositStatusPush, completeDepositOrder, getDepositOrder, getDepositOrdersBySourceOrder, getDepositStatusLabel, initDepositMode } from '../../services/depositApiService.js'
import OrderDetailDrawer from './order-fulfillment/OrderDetailDrawer.vue'
import OrderFilters from './order-fulfillment/OrderFilters.vue'
import OrderTable from './order-fulfillment/OrderTable.vue'
import { getOrderCompletionState, parseRecipientInfo as parseRecipientInfoFromPaste } from './order-fulfillment/orderFulfillmentUtils.js'
import { useOrderActions } from './order-fulfillment/useOrderActions.js'
import { createDefaultOrderFilters, useOrderFilters } from './order-fulfillment/useOrderFilters.js'

const rawOrderGroups = ref([])
const { confirm: confirmDialog } = useConfirmDialog()
const scheduleUnits = ref([])
const stats = reactive({ all: 0, pendingShip: 0, active: 0, pendingReturn: 0, finished: 0 })
const selectedOrderId = ref(null)
const selectedOrder = ref(null)
const selectedOrderIds = ref([])
const message = ref('')
const xiaohongshuKeyword = ref('')
const shippingRecords = ref([])
const shippingPreview = ref(null)
const defaultShippingMode = ref('land')
const logisticsEnabled = ref(false)
const logisticsLoading = ref(false)
const shipActionLoading = ref(false)
const importLoading = ref(false)
const importExecuting = ref(false)
const showImportModal = ref(false)
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const showEditDrawer = ref(false)
const editSaving = ref(false)
const showActionModal = ref(false)
const showBatchExtendModal = ref(false)
const showCreateDepositDrawer = ref(false)
const depositSourceOrder = ref(null)
const depositOrdersForCurrent = ref([])
let disposeDepositStatusListener = null
const showAdvancedFilters = ref(false)
const importPreview = ref(null)
const actionAlerts = reactive({ pendingShip: [], pendingReturn: [] })
const shipSelection = ref([])
const returnSelection = ref([])
const stores = ref([])
const recipientPasteText = ref('')
const pasteParseMessage = ref('')
const editRecipientPasteText = ref('')
const editPasteParseMessage = ref('')
const availabilityLoading = ref(false)
const availabilityResult = ref(null)
const availabilityError = ref('')
const availabilityDirty = ref(false)
const createDrawerMode = ref('order')
const availabilityMode = ref('sf')
const availabilityRentDays = ref(4)
const availabilityTransitDays = ref(2)
const availabilityReturnBufferDays = ref(2)
const extendForms = reactive({})
const batchExtendForm = reactive({ rentEndDate: '', extraFee: 0 })

const defaultStoreName = '小狗相机'
const DEFAULT_AVAILABILITY_PROVINCE = '四川省'
const DEFAULT_AVAILABILITY_CITY = '成都市'
const DEFAULT_AVAILABILITY_DISTRICT = '金牛区'
const DEFAULT_AVAILABILITY_REGION_TEXT = `${DEFAULT_AVAILABILITY_PROVINCE}${DEFAULT_AVAILABILITY_CITY}${DEFAULT_AVAILABILITY_DISTRICT}`
const filters = reactive(createDefaultOrderFilters())
const form = reactive({ storeId: null, modelCode: '', unitId: null, orderNo: '', customerName: '', customerPhone: '', province: DEFAULT_AVAILABILITY_PROVINCE, city: DEFAULT_AVAILABILITY_CITY, district: DEFAULT_AVAILABILITY_DISTRICT, address: '', shippingMode: 'land', rentStartDate: '', rentEndDate: '', fee: 0, deposit: 0, trackingNo: '', sourceChannel: 'xianyu', sourceName: '', remark: '' })
const editForm = reactive({ orderId: null, storeId: null, modelCode: '', unitId: null, orderNo: '', customerName: '', customerPhone: '', province: '', city: '', district: '', address: '', shippingMode: 'land', rentStartDate: '', rentEndDate: '', fee: 0, deposit: 0, trackingNo: '', latestLogisticsStatus: '', sourceChannel: 'xianyu', sourceName: '', remark: '' })
const shippingForm = reactive({ orderId: null, trackingNo: '', shippingMode: '', latestLogisticsStatus: '', actualShipAt: '', expectedArriveAt: '' })
const {
  primaryActionLabel,
  isPrimaryActionDisabled,
  runPrimaryAction,
  actionMenuItems,
  handleActionMenu,
} = useOrderActions({
  shipActionLoading,
  isPendingShipOrder,
  isPendingReturnOrder,
  isOverdueOrder,
  isActiveOrder,
  isFinishedOrder,
  openDetailModal,
  markReturned,
  openExtendModal,
  openEditOrderDrawer,
  shipOrderWithSf,
  copyOrderNo,
  deleteOrder,
  openCreateDeposit,
})
let pasteParseTimer = null

const quickFilterLabelMap = {
  all: '全部',
  pending_ship: '待发货',
  active: '进行中',
  pending_return: '待归还',
  finished: '已结束',
  overdue: '逾期异常',
}

const currentQuickFilterLabel = computed(() => quickFilterLabelMap[filters.quickFilter] || '全部')
const allOrders = computed(() => rawOrderGroups.value.flatMap((group) => group.rows || []))
const scopedOrders = computed(() => allOrders.value.filter((order) => matchesFrontendFilters(order, { includeQuickFilter: false })))
const orderGroups = computed(() => normalizeGroups(applyFrontendFiltersToGroups(rawOrderGroups.value)))
const visibleOrderIds = computed(() => orderGroups.value.flatMap((group) => group.rows.map((order) => order.id)))
const flatOrders = computed(() => orderGroups.value.flatMap((group) => group.rows || []))
const selectedOrders = computed(() => selectedOrderIds.value.map((id) => findOrderById(id)).filter(Boolean))
const allVisibleSelected = computed(() => visibleOrderIds.value.length > 0
  && visibleOrderIds.value.every((id) => selectedOrderIds.value.includes(id)))
const {
  applyDatePreset,
  applyDefaultMonthFilters,
  applyQuickFilter,
  resetFilters,
} = useOrderFilters({
  filters,
  orderGroups,
  selectedOrderIds,
  showAdvancedFilters,
  refreshSelectedOrder,
  loadOrders,
})
const overdueReturnCount = computed(() => actionAlerts.pendingReturn.filter((order) => isOverdueOrder(order)).length)
const primaryKpiItems = computed(() => [
  { key: 'pending_ship', label: '待发货', value: scopedOrders.value.filter((order) => isPendingShipOrder(order)).length, hint: '今天需要安排寄件', tone: 'warning' },
  { key: 'pending_return', label: '待归还', value: scopedOrders.value.filter((order) => isPendingReturnOrder(order)).length, hint: '待回收与验机处理', tone: 'primary' },
  { key: 'overdue', label: '逾期异常', value: scopedOrders.value.filter((order) => isOverdueOrder(order)).length, hint: '优先跟进异常订单', tone: 'danger' },
])
const primaryStripItems = computed(() => primaryKpiItems.value.map((item) => ({
  ...item,
  tone: item.tone === 'primary' ? 'info' : item.tone,
})))
const secondaryKpiItems = computed(() => [
  { key: 'all', label: '全部订单', value: scopedOrders.value.length },
  { key: 'active', label: '租用中', value: scopedOrders.value.filter((order) => isActiveOrder(order)).length },
  { key: 'finished', label: '已结束', value: scopedOrders.value.filter((order) => isFinishedOrder(order)).length },
])
const quickFilterTabs = computed(() => [
  { key: 'all', label: '全部', value: scopedOrders.value.length },
  { key: 'pending_ship', label: '待发货', value: scopedOrders.value.filter((order) => isPendingShipOrder(order)).length },
  { key: 'active', label: '租用中', value: scopedOrders.value.filter((order) => isActiveOrder(order)).length },
  { key: 'pending_return', label: '待归还', value: scopedOrders.value.filter((order) => isPendingReturnOrder(order)).length },
  { key: 'finished', label: '已结束', value: scopedOrders.value.filter((order) => isFinishedOrder(order)).length },
])

// ── Drawer Status Advisor ──
const advisorMessage = computed(() => {
  if (!selectedOrder.value) return '请选择一笔订单查看详情'
  if (isPendingShipOrder(selectedOrder.value)) {
    return '该订单已付款待发货，建议确认免押或押金后安排寄件'
  }
  if (isPendingReturnOrder(selectedOrder.value)) {
    return '订单待归还，请及时跟进归还与验机'
  }
  if (isActiveOrder(selectedOrder.value)) {
    return '设备租赁中，请关注归还时间'
  }
  if (isFinishedOrder(selectedOrder.value)) {
    return '订单已结束，可查看物流和操作记录'
  }
  return '请根据订单状态完成下一步处理'
})

const advisorSeverity = computed(() => {
  if (!selectedOrder.value) return 'neutral'
  if (isPendingShipOrder(selectedOrder.value)) return 'warning'
  if (isPendingReturnOrder(selectedOrder.value)) return 'warning'
  if (isActiveOrder(selectedOrder.value)) return 'info'
  if (isFinishedOrder(selectedOrder.value)) return 'neutral'
  return 'info'
})

// ── 免押数据（Drawer 内） ──
const latestDepositOrder = computed(() => {
  const orders = depositOrdersForCurrent.value || []
  if (!orders.length) return null
  const latest = orders.find((o) => o.isLatest)
  return latest || orders[0] || null
})

// ── Header 免押 Badge 联动 ──
const depositHeaderLabel = computed(() => {
  if (!latestDepositOrder.value) return '免押未创建'
  return '免押' + getDepositStatusLabel(latestDepositOrder.value.status)
})

const depositHeaderVariant = computed(() => {
  if (!latestDepositOrder.value) return 'subtle'
  const map = {
    pending_review: 'warning',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'subtle',
    completed: 'subtle',
  }
  return map[latestDepositOrder.value.status] || 'subtle'
})

// ── 物流状态摘要（Drawer 内） ──
const logisticsStatusSummary = computed(() => {
  if (!selectedOrder.value) return { status: '未发货', badge: 'neutral', label: '未发货' }
  const hasTrackingNo = !!(shippingForm.trackingNo || selectedOrder.value.tracking_no)
  const hasTraces = shippingRecords.value.length > 0
  if (isFinishedOrder(selectedOrder.value)) return { status: '已完成', badge: 'neutral', label: '已完成' }
  if (hasTrackingNo && hasTraces) return { status: '运输中', badge: 'info', label: '运输中' }
  if (hasTrackingNo && !hasTraces) return { status: '待查询', badge: 'warning', label: '待查询' }
  return { status: '未发货', badge: 'neutral', label: '未发货' }
})

const logisticsLastUpdate = computed(() => {
  if (!shippingRecords.value.length) return null
  const latest = shippingRecords.value[0]
  return formatDateTime(latest.actual_ship_at || latest.actual_arrive_at || latest.expected_arrive_at || latest.created_at)
})

const storeOptions = computed(() => (stores.value || []).filter((store) => store.status !== 'inactive'))
const xiaogouStoreId = computed(() => {
  const preferred = storeOptions.value.find((store) => store.code === 'xiaogou')
  return preferred?.id != null ? Number(preferred.id) : null
})
const defaultStoreId = computed(() => {
  if (xiaogouStoreId.value != null) return xiaogouStoreId.value
  const preferred = storeOptions.value.find((store) => Number(store.is_default) === 1)
  const fallbackId = preferred?.id ?? storeOptions.value[0]?.id
  return fallbackId != null ? Number(fallbackId) : null
})
const availableModelCodes = computed(() => {
  const values = new Set()
  for (const unit of scheduleUnits.value || []) {
    if (unit?.model_code && unit.status !== 'offline') values.add(unit.model_code)
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b))
})
const availabilityModes = [
  { key: 'sf', label: '按地址试算' },
  { key: 'days', label: '运输天数' },
]
const sourceChannelOptions = [
  { key: 'xianyu', label: '闲鱼' },
  { key: 'wechat', label: '微信' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'other', label: '其他' },
]
const availableUnitsFromQuery = computed(() => availabilityResult.value?.availableUnits || [])
const createDeviceOptions = computed(() => {
  if (availableUnitsFromQuery.value.length) return availableUnitsFromQuery.value
  return (scheduleUnits.value || [])
    .filter((unit) => unit.model_code === form.modelCode && !['offline', 'repair'].includes(unit.status))
    .map((unit) => ({
      id: unit.id,
      modelCode: unit.model_code,
      unitCode: unit.unit_code,
      purchaseCost: Number(unit.purchase_cost || 0),
      residualValue: Number(unit.residual_value || 0),
      status: unit.status,
    }))
})
const editDeviceOptions = computed(() => (scheduleUnits.value || [])
  .filter((unit) => unit.model_code === editForm.modelCode && !['offline', 'repair'].includes(unit.status))
  .map((unit) => ({
    id: unit.id,
    modelCode: unit.model_code,
    unitCode: unit.unit_code,
    purchaseCost: Number(unit.purchase_cost || 0),
    residualValue: Number(unit.residual_value || 0),
    status: unit.status,
  })))
const selectedAvailableUnit = computed(() => createDeviceOptions.value.find((unit) => unit.id === form.unitId) || null)
const selectedEditUnit = computed(() => editDeviceOptions.value.find((unit) => unit.id === editForm.unitId) || null)
const selectedOrderCompletionState = computed(() => getOrderCompletionState(selectedOrder.value || {}))
const editCompletionState = computed(() => getOrderCompletionState({
  order_no: editForm.orderNo,
  customer_name: editForm.customerName,
  customer_phone: editForm.customerPhone,
  province: editForm.province,
  city: editForm.city,
  district: editForm.district,
  address: editForm.address,
  fee: editForm.fee,
  deposit: editForm.deposit,
  unit_id: editForm.unitId,
  rent_start_date: editForm.rentStartDate,
  rent_end_date: editForm.rentEndDate,
  tracking_no: editForm.trackingNo,
  planned_ship_at: selectedOrder.value?.planned_ship_at,
  actual_ship_at: selectedOrder.value?.actual_ship_at,
}))
const createDrawerTitle = computed(() => createDrawerMode.value === 'availability' ? '查档期' : '新建订单')
const createDrawerSubtitle = computed(() => createDrawerMode.value === 'availability'
  ? '只用型号、租期、物流方式和大概地址判断可用机器。'
  : '从档期结果复用条件，或先创建占用单后补客户资料。')
const activeShippingPreview = computed(() => {
  if (availabilityResult.value?.plan) {
    return {
      plannedShipAt: availabilityResult.value.plan.shipDate || '',
      expectedArriveAt: availabilityResult.value.plan.arriveDate || '',
      source: availabilityResult.value.plan.source || '',
      fallbackReason: availabilityResult.value.plan.fallbackReason || '',
    }
  }
  return shippingPreview.value
})
const shippingPreviewSourceLabel = computed(() => {
  const source = activeShippingPreview.value?.source
  if (source === 'sf_deliver_time') return '顺丰时效标准接口'
  if (source === 'manual_transit_days') return '手动运输天数'
  if (source === 'local_estimate') return '本地兜底估算'
  return '待查询'
})

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

function resolvePricingTotal(rows = [], rentDays = 0) {
  const days = Math.max(1, Number.parseInt(String(rentDays || 0), 10) || 0)
  const activeRows = (rows || [])
    .filter((row) => Number(row.active ?? 1) !== 0)
    .map((row) => ({
      ...row,
      minDays: Number(row.min_days || row.minDays || 0),
      maxDays: Number(row.max_days || row.maxDays || 0),
      dailyPrice: Number(row.daily_price || row.dailyPrice || 0),
      totalPrice: row.total_price ?? row.totalPrice,
      extensionDailyPrice: Number(row.extension_daily_price || row.extensionDailyPrice || 0),
    }))
    .sort((a, b) => a.maxDays - b.maxDays)
  const exact = activeRows.find((row) => days >= row.minDays && days <= row.maxDays)
  if (exact) {
    const total = exact.totalPrice !== null && exact.totalPrice !== undefined && exact.totalPrice !== ''
      ? Number(exact.totalPrice)
      : exact.dailyPrice * days
    return Number.isFinite(total) ? Number(total.toFixed(2)) : 0
  }
  const base = [...activeRows]
    .filter((row) => row.maxDays > 0 && row.maxDays < days && row.extensionDailyPrice > 0)
    .sort((a, b) => b.maxDays - a.maxDays)[0]
  if (!base) return 0
  const baseTotal = base.totalPrice !== null && base.totalPrice !== undefined && base.totalPrice !== ''
    ? Number(base.totalPrice)
    : base.dailyPrice * base.maxDays
  const total = baseTotal + (days - base.maxDays) * base.extensionDailyPrice
  return Number.isFinite(total) ? Number(total.toFixed(2)) : 0
}

async function lookupDefaultRent(modelCode, rentStartDate, rentEndDate) {
  const days = calcInclusiveRentDays(rentStartDate, rentEndDate)
  if (!modelCode || !days) return 0
  const quoteTotal = Number(availabilityResult.value?.quote?.totalPrice || 0)
  if (quoteTotal > 0 && availabilityResult.value?.modelCode === modelCode) return quoteTotal
  try {
    const rows = await window.electronAPI.listPricing({ modelCode, active: 1 })
    return resolvePricingTotal(rows, days)
  } catch {
    return 0
  }
}

async function applyDefaultAmounts(targetForm, selectedUnit, options = {}) {
  if (!targetForm) return
  const deviceValue = Number(selectedUnit?.residualValue ?? selectedUnit?.residual_value ?? selectedUnit?.purchaseCost ?? selectedUnit?.purchase_cost ?? 0)
  if (deviceValue > 0 && (options.force || !Number(targetForm.deposit || 0))) {
    targetForm.deposit = deviceValue
  }
  const rent = await lookupDefaultRent(targetForm.modelCode, targetForm.rentStartDate, targetForm.rentEndDate)
  if (rent > 0 && (options.force || !Number(targetForm.fee || 0))) {
    targetForm.fee = rent
  } else if (!rent && options.notifyMissingRent) {
    window.$toast?.('未找到该型号和租期的默认租金，请手动填写', 'warning')
  }
}

function deriveRentEndDate(startDate, rentDays) {
  if (!startDate || !Number(rentDays)) return ''
  return formatLocalDate(addDays(parseLocalDate(startDate), Math.max(0, Number(rentDays) - 1)))
}


const canCreateOrder = computed(() => {
  return Boolean(
    form.modelCode
      && form.rentStartDate
      && form.rentEndDate
      && selectedAvailableUnit.value?.id
      && form.sourceChannel
      && form.sourceName.trim(),
  )
})

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

function sourceChannelLabel(channel) {
  return sourceChannelOptions.find((item) => item.key === channel)?.label || channel || '未填写'
}

function unitStatusLabel(status) {
  if (status === 'idle') return '可租赁'
  if (status === 'busy') return '已出租'
  if (status === 'repair') return '维修中'
  if (status === 'offline') return '停用'
  return status || '-'
}

function logisticsStatusLabel(status) {
  return status || '待更新'
}

function formatOrderStatusWithShipping(order) {
  return orderStatusLabel(order?.order_status)
}

function toDateTimeLocal(value) {
  return value ? String(value).replace(' ', 'T').slice(0, 16) : ''
}

function defaultExtendDate() {
  const next = new Date()
  next.setDate(next.getDate() + 1)
  return next.toISOString().slice(0, 10)
}

function getTodayText() {
  return new Date().toISOString().slice(0, 10)
}

function calcRentDays(order) {
  if (!order?.rent_start_date || !order?.rent_end_date) return '-'
  const start = new Date(`${order.rent_start_date}T00:00:00`)
  const end = new Date(`${order.rent_end_date}T00:00:00`)
  return Math.max(1, Math.floor((end - start) / 86400000) + 1)
}

function formatOrderAddress(order) {
  return [order?.province, order?.city, order?.district, order?.address].filter(Boolean).join(' ') || '-'
}

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

function applyRecipientInfo(parsed = {}, targetForm = form) {
  if (!targetForm) return
  if (parsed.name) targetForm.customerName = parsed.name
  if (parsed.phone) targetForm.customerPhone = parsed.phone
  if (parsed.province) targetForm.province = parsed.province
  if (parsed.city) targetForm.city = parsed.city
  if (parsed.district) targetForm.district = parsed.district
  if (parsed.address) targetForm.address = parsed.address
}

function parseRecipientPaste() {
  const parsed = parseRecipientInfoFromPaste(recipientPasteText.value)
  applyRecipientInfo(parsed)
  const fields = [
    parsed.name && '姓名',
    parsed.phone && '电话',
    parsed.province && '省份',
    parsed.city && '城市',
    parsed.district && '区县',
    parsed.address && '地址',
  ].filter(Boolean)
  pasteParseMessage.value = fields.length ? `已识别：${fields.join('、')}` : '未识别到有效收货信息'
}

function handleRecipientPaste(event) {
  const text = event?.clipboardData?.getData('text')
  if (text) {
    event.preventDefault()
    recipientPasteText.value = text
  }
  if (pasteParseTimer) window.clearTimeout(pasteParseTimer)
  pasteParseTimer = window.setTimeout(parseRecipientPaste, 0)
}

function clearRecipientPaste() {
  recipientPasteText.value = ''
  pasteParseMessage.value = ''
}

function clearAddressPrefill() {
  recipientPasteText.value = ''
  pasteParseMessage.value = ''
  form.province = ''
  form.city = ''
  form.district = ''
  form.address = ''
}

function parseEditRecipientPaste() {
  const parsed = parseRecipientInfoFromPaste(editRecipientPasteText.value)
  applyRecipientInfo(parsed, editForm)
  const fields = [
    parsed.name && '姓名',
    parsed.phone && '电话',
    parsed.province && '省份',
    parsed.city && '城市',
    parsed.district && '区县',
    parsed.address && '地址',
  ].filter(Boolean)
  editPasteParseMessage.value = fields.length ? `已识别：${fields.join('、')}` : '未识别到有效收货信息'
}

function handleEditRecipientPaste(event) {
  const text = event?.clipboardData?.getData('text')
  if (text) {
    event.preventDefault()
    editRecipientPasteText.value = text
  }
  window.setTimeout(parseEditRecipientPaste, 0)
}

function clearEditRecipientPaste() {
  editRecipientPasteText.value = ''
  editPasteParseMessage.value = ''
}

function blockTypeLabel(blockType) {
  if (blockType === 'rent') return '租期'
  if (blockType === 'shipping') return '发货'
  if (blockType === 'return_shipping') return '归还'
  if (blockType === 'buffer') return '缓冲'
  return blockType || '占用'
}

function invalidateAvailability() {
  availabilityError.value = ''
  if (availabilityResult.value) availabilityDirty.value = true
}

function buildAvailabilityPayload() {
  const payload = {
    modelCode: form.modelCode.trim(),
    rentStartDate: form.rentStartDate,
    rentEndDate: form.rentEndDate,
    returnBufferDays: Number(availabilityReturnBufferDays.value) || 0,
    shippingMode: form.shippingMode,
  }
  if (availabilityMode.value === 'sf') {
    payload.province = form.province.trim()
    payload.city = form.city.trim()
    payload.district = form.district.trim()
    payload.address = form.address.trim()
  } else {
    payload.transitDays = Number(availabilityTransitDays.value) || 1
  }
  return payload
}

async function selectAvailableUnit(unit) {
  form.unitId = unit?.id || null
  await applyDefaultAmounts(form, unit, { force: true, notifyMissingRent: true })
}

function resetAvailabilityQuery() {
  availabilityMode.value = 'sf'
  availabilityRentDays.value = 4
  availabilityTransitDays.value = 2
  availabilityReturnBufferDays.value = 2
  availabilityResult.value = null
  availabilityError.value = ''
  availabilityDirty.value = false
}

async function runAvailabilityCheck() {
  availabilityError.value = ''
  availabilityResult.value = null
  availabilityDirty.value = false
  const payload = buildAvailabilityPayload()
  if (!payload.modelCode) {
    availabilityError.value = '请先选择型号编码'
    return
  }
  if (!payload.rentStartDate || !payload.rentEndDate) {
    availabilityError.value = '请先填写租期开始和结束日期'
    return
  }
  if (availabilityMode.value === 'sf' && (!payload.province || !payload.city)) {
    availabilityError.value = '按地址试算时，至少填写省份和城市'
    return
  }
  availabilityLoading.value = true
  try {
    const result = await window.electronAPI.checkScheduleAvailability(payload)
    availabilityResult.value = result
    if (result?.ok && Array.isArray(result.availableUnits)) {
      const preferred = result.availableUnits.find((unit) => unit.id === form.unitId)
      form.unitId = preferred?.id || result.availableUnits[0]?.id || null
      const unit = result.availableUnits.find((item) => item.id === form.unitId)
      await applyDefaultAmounts(form, unit, { force: true })
    } else {
      form.unitId = null
    }
  } catch (e) {
    availabilityError.value = e?.message || String(e)
    form.unitId = null
  } finally {
    availabilityLoading.value = false
  }
}

function isPendingShipOrder(order) {
  const today = getTodayText()
  return !['completed', 'cancelled'].includes(order?.order_status) && !!order?.planned_ship_at && String(order.planned_ship_at).slice(0, 10) <= today && !order?.actual_ship_at
}

function isPendingReturnOrder(order) {
  const today = getTodayText()
  return !['completed', 'cancelled'].includes(order?.order_status) && !!order?.rent_end_date && order.rent_end_date <= today
}

function isActiveOrder(order) {
  const today = getTodayText()
  return !['completed', 'cancelled'].includes(order?.order_status) && order?.rent_start_date <= today && order?.rent_end_date >= today
}

function isFinishedOrder(order) {
  return ['completed', 'cancelled'].includes(order?.order_status)
}

function isOverdueOrder(order) {
  const today = getTodayText()
  return !['completed', 'cancelled'].includes(order?.order_status) && !!order?.rent_end_date && order.rent_end_date < today
}

function paymentStatusBadge(order) {
  if (order?.order_status === 'waiting_payment') {
    return { label: '待付款', variant: 'warning' }
  }
  if (order?.order_status === 'cancelled') {
    return { label: '已取消', variant: 'subtle' }
  }
  return { label: '已付款', variant: 'success' }
}

function fulfillmentStatusBadge(order) {
  if (isOverdueOrder(order)) return { label: '逾期异常', variant: 'danger' }
  if (isPendingReturnOrder(order)) return { label: '待归还', variant: 'warning' }
  if (isPendingShipOrder(order)) return { label: '待发货', variant: 'warning' }
  if (isActiveOrder(order)) return { label: '租用中', variant: 'primary' }
  if (isFinishedOrder(order)) return { label: '已结束', variant: 'subtle' }
  return { label: orderStatusLabel(order?.order_status), variant: 'subtle' }
}

function getOrderDepositStatus(order) {
  const latest = getLinkedDepositOrdersForOrder(order)[0]
  if (!latest?.status) return { status: 'none', label: '免押未创建', variant: 'subtle' }
  const map = {
    pending_review: { label: '免押待审核', variant: 'warning' },
    approved: { label: '免押通过', variant: 'success' },
    rejected: { label: '免押拒绝', variant: 'danger' },
    cancelled: { label: '免押取消', variant: 'subtle' },
    completed: { label: '免押完结', variant: 'subtle' },
  }
  const resolved = map[latest.status] || { label: '免押' + getDepositStatusLabel(latest.status), variant: 'subtle' }
  return { status: latest.status, ...resolved }
}

function depositStatusBadge(order) {
  return getOrderDepositStatus(order)
}

function matchesQuickFilter(order) {
  if (filters.quickFilter === 'pending_ship') return isPendingShipOrder(order)
  if (filters.quickFilter === 'active') return isActiveOrder(order)
  if (filters.quickFilter === 'pending_return') return isPendingReturnOrder(order)
  if (filters.quickFilter === 'finished') return isFinishedOrder(order)
  if (filters.quickFilter === 'overdue') return isOverdueOrder(order)
  return true
}

function matchesFrontendFilters(order, options = {}) {
  const includeQuickFilter = options.includeQuickFilter !== false
  if (filters.keyword.trim() && !matchesKeyword(order, filters.keyword.trim())) return false
  if (filters.status && order?.order_status !== filters.status) return false
  if (filters.paymentStatus && paymentStatusBadge(order).label !== (filters.paymentStatus === 'waiting_payment' ? '待付款' : '已付款')) return false
  if (filters.depositStatus && getOrderDepositStatus(order).status !== filters.depositStatus) return false
  if (includeQuickFilter && !matchesQuickFilter(order)) return false
  return true
}

function applyFrontendFiltersToGroups(groups = []) {
  return (groups || []).map((group) => ({
    ...group,
    rows: (group.rows || []).filter((order) => matchesFrontendFilters(order)),
  })).filter((group) => group.rows.length > 0)
}

function matchesKeyword(order, keyword) {
  if (!keyword) return true
  const text = [
    order?.order_no,
    order?.customer_name,
    order?.customer_phone,
    order?.unit_code,
    order?.model_code,
    order?.tracking_no,
    order?.store_name,
    order?.province,
    order?.city,
    order?.district,
    order?.address,
  ].filter(Boolean).join(' ').toLowerCase()
  return text.includes(keyword.toLowerCase())
}

function normalizeGroups(groups = []) {
  return groups
    .map((group) => {
      const rows = group.rows || []
      const totalFee = rows.reduce((sum, order) => sum + Number(order.fee || 0), 0)
      return {
        ...group,
        rows,
        count: rows.length,
        activeCount: rows.filter(isActiveOrder).length,
        pendingShipCount: rows.filter(isPendingShipOrder).length,
        pendingReturnCount: rows.filter(isPendingReturnOrder).length,
        totalFee: Number(totalFee.toFixed(2)),
      }
    })
    .filter((group) => group.rows.length > 0)
}

function toggleOrderSelection(orderId) {
  if (selectedOrderIds.value.includes(orderId)) {
    selectedOrderIds.value = selectedOrderIds.value.filter((id) => id !== orderId)
  } else {
    selectedOrderIds.value = [...selectedOrderIds.value, orderId]
  }
}

function toggleVisibleSelection() {
  selectedOrderIds.value = allVisibleSelected.value ? [] : [...visibleOrderIds.value]
}

function clearOrderSelection() {
  selectedOrderIds.value = []
}

function toggleAdvancedFilters() {
  showAdvancedFilters.value = !showAdvancedFilters.value
}

function applyAdvancedFilters() {
  showAdvancedFilters.value = false
  loadOrders()
}

function mapStatusVariant(variant) {
  const map = {
    warning: 'warning',
    danger: 'danger',
    success: 'success',
    subtle: 'neutral',
    primary: 'info',
  }
  return map[variant] || 'neutral'
}

function showActionToast(text, type = 'success') {
  if (!text) return
  window.$toast?.(text, type)
}

function openCreateDeposit(order) {
  depositSourceOrder.value = order
  showCreateDepositDrawer.value = true
}

function onDepositCreated(depositOrder) {
  window.$toast?.('免押单 ' + depositOrder.depositOrderNo + ' 已创建', 'success')
  // 刷新当前订单的免押数据
  if (selectedOrder.value) loadDepositDataForOrder(selectedOrder.value)
}

function onDepositStatusChanged(payload = {}) {
  applyDepositStatusPush(payload)
  if (!selectedOrder.value) return
  loadDepositDataForOrder(selectedOrder.value)
}

function getDepositLinkCandidates(order) {
  if (!order) return []
  return [order.id, order.order_no]
    .filter((value) => value !== undefined && value !== null && value !== '')
}

function compareDepositOrderPriority(a, b) {
  return (
    Number(Boolean(b?.isLatest)) - Number(Boolean(a?.isLatest))
    || new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
  )
}

function getLinkedDepositOrdersForOrder(order) {
  const linked = []
  const seen = new Set()
  for (const key of getDepositLinkCandidates(order)) {
    for (const depositOrder of getDepositOrdersBySourceOrder(key) || []) {
      if (!depositOrder?.depositOrderNo || seen.has(depositOrder.depositOrderNo)) continue
      seen.add(depositOrder.depositOrderNo)
      linked.push(depositOrder)
    }
  }
  return linked.sort(compareDepositOrderPriority)
}

function loadDepositDataForOrder(order) {
  if (!order) {
    depositOrdersForCurrent.value = []
    return
  }
  try {
    const results = getLinkedDepositOrdersForOrder(order)
    depositOrdersForCurrent.value = Array.isArray(results) ? results : []
  } catch {
    depositOrdersForCurrent.value = []
  }
}

async function copyShippingInfo(order) {
  const text = [
    '客户：' + (order.customer_name || '-'),
    '手机：' + (order.customer_phone || '-'),
    '地址：' + formatOrderAddress(order),
    '订单：' + (order.order_no || '#' + order.id),
  ].join('\n')
  try {
    await navigator.clipboard.writeText(text)
    window.$toast?.('收货信息已复制', 'success')
  } catch {
    window.$toast?.('复制失败，请手动复制', 'error')
  }
}

async function resolveLatestDepositOrderForAction(options = {}) {
  const order = latestDepositOrder.value
  if (!order?.depositOrderNo) return null
  const requireReviewUrl = Boolean(options.requireReviewUrl)
  const requireRentRange = Boolean(options.requireRentRange)
  const needDetail = (
    (requireReviewUrl && !String(order.reviewUrl || '').trim())
    || (requireRentRange && (!order.rentStartDate || !order.rentEndDate))
  )
  if (!needDetail) return order
  const freshOrder = await getDepositOrder(order.depositOrderNo)
  if (freshOrder && selectedOrder.value) {
    loadDepositDataForOrder(selectedOrder.value)
  }
  return freshOrder || order
}

async function copyDepositReviewUrl() {
  try {
    const order = await resolveLatestDepositOrderForAction({ requireReviewUrl: true })
    const url = order?.reviewUrl
    if (!url) {
      window.$toast?.('未获取到邀约文本', 'error')
      return
    }
    await navigator.clipboard.writeText(url)
    window.$toast?.('邀约文本已复制', 'success')
  } catch (e) {
    window.$toast?.(e.message || '复制失败，请手动复制', 'error')
  }
}

async function saveDepositPoster() {
  try {
    const order = await resolveLatestDepositOrderForAction({ requireReviewUrl: true, requireRentRange: true })
    if (!order?.depositOrderNo) {
      window.$toast?.('未找到免押单', 'error')
      return
    }
    const ok = await downloadDepositPoster(order, `免押单_${order.depositOrderNo}.png`)
    if (ok) {
      window.$toast?.('海报已保存', 'success')
    } else {
      window.$toast?.('保存失败，请重试', 'error')
    }
  } catch (e) {
    window.$toast?.(e.message || '保存失败，请重试', 'error')
  }
}

async function copyOrderNo(order) {
  const text = order.order_no || String(order.id)
  try {
    await navigator.clipboard.writeText(text)
    window.$toast?.('已复制 ' + text, 'success', 1600)
  } catch (e) {
    window.$toast?.('复制失败', 'error')
  }
}

function syncShippingForm(order) {
  if (!order) return
  shippingForm.orderId = order.id
  shippingForm.trackingNo = order.tracking_no || ''
  shippingForm.shippingMode = order.shipping_mode || ''
  shippingForm.latestLogisticsStatus = order.latest_logistics_status || ''
  shippingForm.actualShipAt = toDateTimeLocal(order.actual_ship_at)
  shippingForm.expectedArriveAt = toDateTimeLocal(order.expected_arrive_at)
}

function applyShippingResult(result) {
  if (!result) return
  if (result.order) {
    selectedOrder.value = result.order
    selectedOrderId.value = result.order.id
    syncShippingForm(result.order)
  }
  if (Array.isArray(result.traces)) shippingRecords.value = result.traces
}

function ensureExtendForms() {
  if (!batchExtendForm.rentEndDate) batchExtendForm.rentEndDate = defaultExtendDate()
  for (const order of actionAlerts.pendingReturn) {
    if (!extendForms[order.id]) {
      extendForms[order.id] = { rentEndDate: defaultExtendDate(), extraFee: 0 }
    }
  }
}

function syncAlertSelections() {
  const pendingShipIds = new Set(actionAlerts.pendingShip.map((order) => order.id))
  const pendingReturnIds = new Set(actionAlerts.pendingReturn.map((order) => order.id))
  shipSelection.value = shipSelection.value.filter((id) => pendingShipIds.has(id))
  returnSelection.value = returnSelection.value.filter((id) => pendingReturnIds.has(id))
}

function cleanupExtendForms() {
  const pendingReturnIds = new Set(actionAlerts.pendingReturn.map((order) => order.id))
  for (const orderId of Object.keys(extendForms)) {
    if (!pendingReturnIds.has(Number(orderId))) delete extendForms[orderId]
  }
}

function findOrderById(orderId) {
  for (const group of orderGroups.value) {
    const found = group.rows.find((order) => order.id === orderId)
    if (found) return found
  }
  return null
}

async function refreshSelectedOrder() {
  if (!selectedOrderId.value) return
  const next = findOrderById(selectedOrderId.value)
  if (!next) {
    selectedOrderId.value = null
    selectedOrder.value = null
    shippingRecords.value = []
    return
  }
  selectedOrder.value = next
  syncShippingForm(next)
  shippingRecords.value = await window.electronAPI.listShippingRecords({ orderId: next.id })
  loadDepositDataForOrder(next)
}

async function selectOrder(order) {
  selectedOrderId.value = order.id
  selectedOrder.value = order
  syncShippingForm(order)
  shippingRecords.value = await window.electronAPI.listShippingRecords({ orderId: order.id })
  loadDepositDataForOrder(order)
}

async function openDetailModal(order) {
  await selectOrder(order)
  showDetailModal.value = true
}

function closeDetailModal() {
  showDetailModal.value = false
}

async function openEditOrderDrawer(order) {
  if (!order) return
  await loadScheduleUnits()
  editForm.orderId = order.id
  editForm.storeId = order.store_id != null ? Number(order.store_id) : defaultStoreId.value
  editForm.modelCode = order.model_code || ''
  editForm.unitId = order.unit_id != null ? Number(order.unit_id) : null
  editForm.orderNo = order.order_no || ''
  editForm.customerName = order.customer_name || ''
  editForm.customerPhone = order.customer_phone || ''
  editForm.province = order.province || ''
  editForm.city = order.city || ''
  editForm.district = order.district || ''
  editForm.address = order.address || ''
  editForm.shippingMode = order.shipping_mode || defaultShippingMode.value
  editForm.rentStartDate = order.rent_start_date || ''
  editForm.rentEndDate = order.rent_end_date || ''
  editForm.fee = Number(order.fee || 0)
  editForm.deposit = Number(order.deposit || 0)
  editForm.trackingNo = order.tracking_no || ''
  editForm.latestLogisticsStatus = order.latest_logistics_status || ''
  editForm.sourceChannel = order.source_channel || 'xianyu'
  editForm.sourceName = order.source_name || ''
  editForm.remark = order.remark || order.note || ''
  clearEditRecipientPaste()
  showEditDrawer.value = true
}

async function saveEditedOrder() {
  if (!editForm.orderId) return
  if (!editForm.modelCode || !editForm.rentStartDate || !editForm.rentEndDate || !editForm.unitId || !editForm.sourceChannel || !editForm.sourceName.trim()) {
    message.value = '请填写型号、租期、设备、来源渠道和来源名称'
    showActionToast(message.value, 'error')
    return
  }
  editSaving.value = true
  try {
    const result = await window.electronAPI.updateOrder({
      orderId: editForm.orderId,
      storeId: editForm.storeId || defaultStoreId.value,
      modelCode: editForm.modelCode,
      unitId: editForm.unitId,
      orderNo: editForm.orderNo,
      customerName: editForm.customerName,
      customerPhone: editForm.customerPhone,
      province: editForm.province,
      city: editForm.city,
      district: editForm.district,
      address: editForm.address,
      rentStartDate: editForm.rentStartDate,
      rentEndDate: editForm.rentEndDate,
      fee: Number(editForm.fee) || 0,
      deposit: Number(editForm.deposit) || 0,
      shippingMode: editForm.shippingMode,
      trackingNo: editForm.trackingNo || undefined,
      latestLogisticsStatus: editForm.latestLogisticsStatus || undefined,
      sourceChannel: editForm.sourceChannel,
      sourceName: editForm.sourceName,
      remark: editForm.remark,
    })
    if (!result?.ok) {
      message.value = result?.message || '订单保存失败'
      showActionToast(message.value, 'error')
      return
    }
    message.value = `订单 ${editForm.orderId} 已保存`
    showActionToast(message.value, 'success')
    showEditDrawer.value = false
    await loadOrders()
    await loadAlerts()
    if (result.order) {
      selectedOrderId.value = result.order.id
      selectedOrder.value = result.order
      syncShippingForm(result.order)
      loadDepositDataForOrder(result.order)
    }
  } finally {
    editSaving.value = false
  }
}

function resetShippingDraft() {
  syncShippingForm(selectedOrder.value)
}

async function refreshAssistPreview() {
  try {
    shippingPreview.value = await window.electronAPI.estimateShipping({
      province: form.province,
      city: form.city,
      district: form.district,
      address: form.address,
      rentStartDate: form.rentStartDate,
      shippingMode: form.shippingMode,
    })
  } catch (e) {
    shippingPreview.value = null
  }
  try {
    const keyword = await window.electronAPI.getXiaohongshuKeyword({
      modelCode: form.modelCode,
      userMessage: `${form.modelCode} ${form.city} 使用教程`,
    })
    xiaohongshuKeyword.value = keyword?.keyword || ''
  } catch (e) {
    xiaohongshuKeyword.value = ''
  }
}

watch(() => [form.province, form.city, form.district, form.address, form.rentStartDate, form.shippingMode, form.modelCode], refreshAssistPreview)
watch(storeOptions, ensureCreateFormDefaults)
watch(
  () => [form.rentStartDate, availabilityRentDays.value],
  ([rentStartDate, rentDays]) => {
    if (!rentStartDate || !Number(rentDays)) return
    const nextEndDate = deriveRentEndDate(rentStartDate, rentDays)
    if (form.rentEndDate !== nextEndDate) form.rentEndDate = nextEndDate
  },
)
watch(
  () => [form.rentStartDate, form.rentEndDate],
  ([rentStartDate, rentEndDate]) => {
    const nextRentDays = calcInclusiveRentDays(rentStartDate, rentEndDate)
    if (nextRentDays && availabilityRentDays.value !== nextRentDays) {
      availabilityRentDays.value = nextRentDays
    }
  },
)
watch(
  () => [
    form.modelCode,
    form.rentStartDate,
    form.rentEndDate,
    form.province,
    form.city,
    form.district,
    form.address,
    form.shippingMode,
    availabilityMode.value,
    availabilityRentDays.value,
    availabilityTransitDays.value,
    availabilityReturnBufferDays.value,
  ],
  invalidateAvailability,
)

function openXiaohongshuSearch() {
  if (!xiaohongshuKeyword.value) return
  window.electronAPI.openUrl(`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(xiaohongshuKeyword.value)}`)
}

function resetCreateForm() {
  form.storeId = defaultStoreId.value
  form.modelCode = ''
  form.unitId = null
  form.orderNo = ''
  form.customerName = ''
  form.customerPhone = ''
  form.province = DEFAULT_AVAILABILITY_PROVINCE
  form.city = DEFAULT_AVAILABILITY_CITY
  form.district = DEFAULT_AVAILABILITY_DISTRICT
  form.address = ''
  form.shippingMode = defaultShippingMode.value
  form.rentStartDate = ''
  form.rentEndDate = ''
  form.fee = 0
  form.deposit = 0
  form.trackingNo = ''
  form.sourceChannel = 'xianyu'
  form.sourceName = ''
  form.remark = ''
  shippingPreview.value = null
  xiaohongshuKeyword.value = ''
  clearRecipientPaste()
  resetAvailabilityQuery()
}

async function openCreateModal() {
  await Promise.all([loadStores(), loadScheduleUnits()])
  resetCreateForm()
  createDrawerMode.value = 'order'
  showCreateModal.value = true
  await nextTick()
  ensureCreateFormDefaults()
}

async function openAvailabilityDrawer() {
  await Promise.all([loadStores(), loadScheduleUnits()])
  resetCreateForm()
  createDrawerMode.value = 'availability'
  showCreateModal.value = true
  await nextTick()
  ensureCreateFormDefaults()
}

function switchToAvailabilityMode() {
  createDrawerMode.value = 'availability'
}

function reuseAvailabilityForCreate() {
  if (!availabilityResult.value?.ok || !selectedAvailableUnit.value) return
  createDrawerMode.value = 'order'
}

function closeCreateModal() {
  showCreateModal.value = false
  resetAvailabilityQuery()
}

function closeImportModal() {
  showImportModal.value = false
}

function closeActionModal() {
  showActionModal.value = false
}

function closeBatchExtendModal() {
  showBatchExtendModal.value = false
}

async function openActionModal() {
  showActionModal.value = true
  await loadAlerts()
}

function toggleShipSelectionAll() {
  if (shipSelection.value.length === actionAlerts.pendingShip.length) {
    shipSelection.value = []
    return
  }
  shipSelection.value = actionAlerts.pendingShip.map((order) => order.id)
}

function toggleReturnSelectionAll() {
  if (returnSelection.value.length === actionAlerts.pendingReturn.length) {
    returnSelection.value = []
    return
  }
  returnSelection.value = actionAlerts.pendingReturn.map((order) => order.id)
}

function applyBatchExtendDraft() {
  for (const orderId of returnSelection.value) {
    if (!extendForms[orderId]) extendForms[orderId] = { rentEndDate: defaultExtendDate(), extraFee: 0 }
    extendForms[orderId].rentEndDate = batchExtendForm.rentEndDate
    extendForms[orderId].extraFee = Number(batchExtendForm.extraFee) || 0
  }
}

async function openImportPreview() {
  importLoading.value = true
  try {
    const result = await window.electronAPI.previewOrderImportExcel()
    if (result?.canceled) return
    importPreview.value = result
    showImportModal.value = true
  } finally {
    importLoading.value = false
  }
}

async function executeImport() {
  if (!importPreview.value?.filePath) return
  importExecuting.value = true
  try {
    const result = await window.electronAPI.executeOrderImportExcel({ filePath: importPreview.value.filePath })
    message.value = `Excel 导入完成，成功 ${result.successCount || 0} 条，失败 ${result.failedCount || 0} 条`
    showActionToast(message.value, Number(result.failedCount || 0) > 0 ? 'error' : 'success')
    showImportModal.value = false
    await loadOrders()
  } finally {
    importExecuting.value = false
  }
}

async function loadStats() {
  const result = await window.electronAPI.getOrderOverviewStats({
    modelCode: filters.modelCode.trim() || undefined,
    storeId: filters.storeId ? Number(filters.storeId) : undefined,
    dateField: filters.dateField,
    from: filters.from || undefined,
    to: filters.to || undefined,
  })
  stats.all = result?.all || 0
  stats.pendingShip = result?.pendingShip || 0
  stats.active = result?.active || 0
  stats.pendingReturn = result?.pendingReturn || 0
  stats.finished = result?.finished || 0
}

async function loadAlerts() {
  const result = await window.electronAPI.getOrderActionAlerts()
  actionAlerts.pendingShip = result?.pendingShip || []
  actionAlerts.pendingReturn = result?.pendingReturn || []
  cleanupExtendForms()
  ensureExtendForms()
  syncAlertSelections()
  if (showActionModal.value && !actionAlerts.pendingShip.length && !actionAlerts.pendingReturn.length) {
    showActionModal.value = false
  }
}

async function loadScheduleUnits() {
  scheduleUnits.value = await window.electronAPI.listScheduleUnits({ activeInventoryOnly: true })
}

async function loadStores() {
  stores.value = await window.electronAPI.listStores({ status: 'active' })
  if (!form.storeId) form.storeId = Number(defaultStoreId.value) || null
}

function ensureCreateFormDefaults() {
  if (!form.storeId && defaultStoreId.value != null) {
    form.storeId = Number(defaultStoreId.value)
  }
}

async function loadOrders() {
  const groups = await window.electronAPI.listOrderGroups({
    modelCode: filters.modelCode.trim() || undefined,
    storeId: filters.storeId ? Number(filters.storeId) : undefined,
    dateField: filters.dateField,
    from: filters.from || undefined,
    to: filters.to || undefined,
  })
  rawOrderGroups.value = groups || []
  const visibleIds = new Set(orderGroups.value.flatMap((group) => group.rows.map((order) => order.id)))
  selectedOrderIds.value = selectedOrderIds.value.filter((id) => visibleIds.has(id))
  await loadStats()
  await refreshSelectedOrder()
}

async function create() {
  if (!canCreateOrder.value) {
    message.value = '请填写型号、租期、设备、来源渠道和来源名称'
    showActionToast(message.value, 'error')
    return
  }
  const result = await window.electronAPI.createOrder({
    storeId: form.storeId || defaultStoreId.value,
    modelCode: form.modelCode,
    unitId: selectedAvailableUnit.value?.id || undefined,
    orderNo: form.orderNo,
    customerName: form.customerName,
    customerPhone: form.customerPhone,
    province: form.province,
    city: form.city,
    district: form.district,
    address: form.address,
    rentStartDate: form.rentStartDate,
    rentEndDate: form.rentEndDate,
    fee: Number(form.fee) || 0,
    deposit: Number(form.deposit) || 0,
    orderStatus: 'waiting_payment',
    shippingMode: form.shippingMode,
    trackingNo: form.trackingNo || undefined,
    sourceChannel: form.sourceChannel,
    sourceName: form.sourceName,
    remark: form.remark,
  })
  if (!result?.ok) {
    message.value = result?.message || '订单创建失败，请重试'
    showActionToast(message.value, 'error')
    return
  }
  message.value = `订单已创建，锁定设备 ${result.unitId || '-'}，预计 ${formatDateTime(result.plannedShipAt)} 发货`
  showActionToast(message.value, 'success')
  closeCreateModal()
  await loadOrders()
  await loadAlerts()
}

async function saveShipping() {
  const result = await window.electronAPI.updateOrderShipping({
    orderId: shippingForm.orderId,
    trackingNo: shippingForm.trackingNo || undefined,
    shippingMode: shippingForm.shippingMode || undefined,
    latestLogisticsStatus: shippingForm.latestLogisticsStatus || undefined,
    actualShipAt: shippingForm.actualShipAt || undefined,
    expectedArriveAt: shippingForm.expectedArriveAt || undefined,
  })
  applyShippingResult(result)
  if (!shippingRecords.value.length) shippingRecords.value = await window.electronAPI.listShippingRecords({ orderId: shippingForm.orderId })
  message.value = `订单 ${shippingForm.orderId} 物流已更新`
  showActionToast(message.value, 'success')
  await loadOrders()
  await loadAlerts()
}

async function queryLogistics() {
  logisticsLoading.value = true
  try {
    const result = await window.electronAPI.queryLogistics({ orderId: shippingForm.orderId, trackingNo: shippingForm.trackingNo || undefined })
    if (!result?.ok) {
      message.value = result?.message || '物流查询失败'
      showActionToast(message.value, 'error')
      return
    }
    applyShippingResult(result)
    message.value = result.message || `订单 ${shippingForm.orderId} 物流已查询`
    showActionToast(message.value, 'success')
    await loadOrders()
  } finally {
    logisticsLoading.value = false
  }
}

async function batchShip() {
  if (!shipSelection.value.length) return
  shipActionLoading.value = true
  try {
    const result = await window.electronAPI.batchShipOrders({ orderIds: shipSelection.value })
    const successCount = result.results?.filter((item) => item.ok).length || 0
    const failed = result.results?.filter((item) => !item.ok) || []
    message.value = failed.length
      ? `批量发货完成，成功 ${successCount} 条，失败 ${failed.length} 条：${failed[0]?.message || '未知错误'}`
      : `批量发货完成，成功 ${successCount} 条`
    showActionToast(message.value, failed.length ? 'error' : 'success')
    shipSelection.value = []
    await loadOrders()
    await loadAlerts()
  } finally {
    shipActionLoading.value = false
  }
}

async function shipSingle(order) {
  if (!order?.id) return
  shipSelection.value = [order.id]
  await batchShip()
}

async function shipSelectedWithSf() {
  if (!selectedOrderIds.value.length) return
  const blockedOrders = selectedOrders.value
    .map((order) => ({ order, state: getOrderCompletionState(order) }))
    .filter((item) => !item.state.canCreateSfShipment)
  if (blockedOrders.length) {
    const first = blockedOrders[0]
    const fields = first.state.blockingFields.join('、')
    message.value = `订单 #${first.order.id} 缺少${fields}，请先补齐收货资料再创建顺丰运单`
    showActionToast(message.value, 'error')
    if (blockedOrders.length === 1) openEditOrderDrawer(first.order)
    return
  }
  const ok = await confirmDialog({
    title: '确认创建顺丰运单',
    message: `将对 ${selectedOrderIds.value.length} 个订单创建真实顺丰运单。`,
    details: ['成功后会产生真实寄件任务，请确认收件信息和取件时间无误。'],
    confirmText: '创建运单',
    danger: true,
  })
  if (!ok) return
  shipActionLoading.value = true
  try {
    const result = await window.electronAPI.batchPlaceSfShipments({ orderIds: selectedOrderIds.value })
    const successCount = result.results?.filter((item) => item.ok).length || 0
    const failed = result.results?.filter((item) => !item.ok) || []
    message.value = failed.length
      ? `顺丰寄件完成，成功 ${successCount} 单，失败 ${failed.length} 单：${failed[0]?.message || '未知错误'}`
      : `顺丰寄件完成，成功 ${successCount} 单`
    showActionToast(message.value, failed.length ? 'error' : 'success')
    selectedOrderIds.value = []
    await loadOrders()
    await loadAlerts()
  } finally {
    shipActionLoading.value = false
  }
}

async function shipOrderWithSf(order) {
  if (!order?.id) return
  selectedOrderIds.value = [order.id]
  await shipSelectedWithSf()
}

async function batchReturn() {
  const orderIds = [...returnSelection.value]
  const result = await window.electronAPI.batchReturnOrders({ orderIds: returnSelection.value })
  const successIds = (result.results || []).filter((item) => item.ok).map((item) => item.orderId).filter(Boolean)
  const linked = await completeLinkedDepositsForOrders(successIds)
  message.value = `批量归还完成，成功 ${result.results?.filter((item) => item.ok).length || 0} 条${linked}`
  showActionToast(message.value, 'success')
  returnSelection.value = []
  await loadOrders()
  await loadAlerts()
}

async function completeSelectedOrders() {
  if (!selectedOrderIds.value.length) return
  const ok = await confirmDialog({
    title: '确认完结订单',
    message: `将完结 ${selectedOrderIds.value.length} 个订单。`,
    details: ['该操作会标记订单归还，并尝试联动完结关联免押单。'],
    confirmText: '确认完结',
    danger: true,
  })
  if (!ok) return
  const orderIds = [...selectedOrderIds.value]
  const result = await window.electronAPI.batchReturnOrders({ orderIds: selectedOrderIds.value })
  const successCount = result.results?.filter((item) => item.ok).length || 0
  const failed = result.results?.filter((item) => !item.ok) || []
  const successIds = (result.results || []).filter((item) => item.ok).map((item) => item.orderId).filter(Boolean)
  const linked = await completeLinkedDepositsForOrders(successIds)
  message.value = failed.length
    ? `批量完结完成，成功 ${successCount} 条，失败 ${failed.length} 条：${failed[0]?.message || '未知错误'}${linked}`
    : `批量完结完成，成功 ${successCount} 条${linked}`
  showActionToast(message.value, failed.length ? 'error' : 'success')
  selectedOrderIds.value = []
  await loadOrders()
  await loadAlerts()
}

async function extendSingle(orderId) {
  const payload = extendForms[orderId]
  const result = await window.electronAPI.extendOrder({
    orderId,
    rentEndDate: payload.rentEndDate,
    extraFee: Number(payload.extraFee) || 0,
  })
  message.value = result?.ok ? `订单 ${orderId} 已延期` : (result?.message || '延期失败')
  showActionToast(message.value, result?.ok ? 'success' : 'error')
  await loadOrders()
  await loadAlerts()
}

async function batchExtendSelected() {
  const items = returnSelection.value.map((orderId) => ({
    orderId,
    rentEndDate: extendForms[orderId]?.rentEndDate || batchExtendForm.rentEndDate,
    extraFee: Number(extendForms[orderId]?.extraFee ?? batchExtendForm.extraFee) || 0,
  })).filter((item) => item.rentEndDate)
  const result = await window.electronAPI.batchExtendOrders({ items })
  message.value = `批量延期完成，成功 ${result.results?.filter((item) => item.ok).length || 0} 条`
  showActionToast(message.value, 'success')
  returnSelection.value = []
  await loadOrders()
  await loadAlerts()
}

function openExtendModal(order) {
  if (!extendForms[order.id]) {
    extendForms[order.id] = { rentEndDate: defaultExtendDate(), extraFee: 0 }
  }
  showActionModal.value = true
  if (!returnSelection.value.includes(order.id)) returnSelection.value.push(order.id)
}

function openBatchExtendForSelected() {
  if (!selectedOrderIds.value.length) return
  if (!batchExtendForm.rentEndDate) batchExtendForm.rentEndDate = defaultExtendDate()
  batchExtendForm.extraFee = Number(batchExtendForm.extraFee) || 0
  showBatchExtendModal.value = true
}

async function extendSelectedOrders() {
  if (!selectedOrderIds.value.length || !batchExtendForm.rentEndDate) return
  const items = selectedOrderIds.value.map((orderId) => ({
    orderId,
    rentEndDate: batchExtendForm.rentEndDate,
    extraFee: Number(batchExtendForm.extraFee) || 0,
  }))
  const result = await window.electronAPI.batchExtendOrders({ items })
  const successCount = result.results?.filter((item) => item.ok).length || 0
  const failed = result.results?.filter((item) => !item.ok) || []
  message.value = failed.length
    ? `批量延期完成，成功 ${successCount} 条，失败 ${failed.length} 条：${failed[0]?.message || '未知错误'}`
    : `批量延期完成，成功 ${successCount} 条`
  showActionToast(message.value, failed.length ? 'error' : 'success')
  selectedOrderIds.value = []
  showBatchExtendModal.value = false
  await loadOrders()
  await loadAlerts()
}

async function markReturned(orderId) {
  const result = await window.electronAPI.markOrderReturned({ orderId })
  const linked = result?.ok ? await completeLinkedDepositsForOrders([orderId]) : ''
  message.value = result?.ok ? `订单 ${orderId} 已归还${linked}` : (result?.message || '归还失败')
  showActionToast(message.value, result?.ok ? 'success' : 'error')
  await loadOrders()
  await loadAlerts()
}

async function completeLinkedDepositsForOrders(orderIds = []) {
  let successCount = 0
  let failedCount = 0
  for (const orderId of orderIds) {
    const sourceOrder = findOrderById(orderId) || { id: orderId }
    const linkedOrders = getLinkedDepositOrdersForOrder(sourceOrder)
      .filter((order) => ['pending_review', 'approved'].includes(order.status))
      .sort(compareDepositOrderPriority)
    const latest = linkedOrders[0]
    if (!latest?.depositOrderNo) continue
    try {
      const result = await completeDepositOrder(latest.depositOrderNo)
      if (result.success) successCount += 1
      else failedCount += 1
    } catch {
      failedCount += 1
    }
  }
  if (!successCount && !failedCount) return ''
  if (failedCount) return `；联动完结免押成功 ${successCount} 个，失败 ${failedCount} 个`
  return `；已联动完结免押 ${successCount} 个`
}

async function deleteOrder(order) {
  if (!order?.id) return
  const label = order.order_no || `#${order.id}`
  const ok = await confirmDialog({
    title: '删除订单',
    message: `确认删除订单 ${label}？`,
    details: ['相关档期和物流记录会一起删除，此操作不可撤销。'],
    confirmText: '删除订单',
    danger: true,
  })
  if (!ok) return
  const result = await window.electronAPI.deleteOrder({ orderId: order.id })
  message.value = result?.message || (result?.ok ? '订单已删除' : '删除失败')
  if (result?.ok) {
    showActionToast(message.value, 'success')
    if (selectedOrderId.value === order.id) {
      selectedOrderId.value = null
      selectedOrder.value = null
      shippingRecords.value = []
      showDetailModal.value = false
    }
    await loadOrders()
    await loadAlerts()
  } else {
    showActionToast(message.value, 'error')
  }
}

async function deleteSelectedOrders() {
  if (!selectedOrderIds.value.length) return
  const ok = await confirmDialog({
    title: '批量删除订单',
    message: `确认删除 ${selectedOrderIds.value.length} 个订单？`,
    details: ['相关档期和物流记录会一起删除，此操作不可撤销。'],
    confirmText: '批量删除',
    danger: true,
  })
  if (!ok) return
  const ids = [...selectedOrderIds.value]
  const results = []
  for (const orderId of ids) {
    results.push(await window.electronAPI.deleteOrder({ orderId }))
  }
  const successCount = results.filter((item) => item?.ok).length
  const failed = results.filter((item) => !item?.ok)
  message.value = failed.length
    ? `批量删除完成，成功 ${successCount} 条，失败 ${failed.length} 条：${failed[0]?.message || '未知错误'}`
    : `批量删除完成，成功 ${successCount} 条`
  showActionToast(message.value, failed.length ? 'error' : 'success')
  if (selectedOrderId.value && ids.includes(selectedOrderId.value)) {
    selectedOrderId.value = null
    selectedOrder.value = null
    shippingRecords.value = []
    showDetailModal.value = false
  }
  selectedOrderIds.value = []
  await loadOrders()
  await loadAlerts()
}

watch(() => form.modelCode, () => {
  if (!createDeviceOptions.value.some((unit) => unit.id === form.unitId)) {
    form.unitId = null
  }
})
watch(() => editForm.modelCode, () => {
  if (!editDeviceOptions.value.some((unit) => unit.id === editForm.unitId)) {
    editForm.unitId = null
  }
})
watch(() => [form.unitId, form.rentStartDate, form.rentEndDate], async () => {
  if (selectedAvailableUnit.value) await applyDefaultAmounts(form, selectedAvailableUnit.value)
})
watch(() => [editForm.unitId, editForm.rentStartDate, editForm.rentEndDate], async () => {
  if (selectedEditUnit.value) await applyDefaultAmounts(editForm, selectedEditUnit.value)
})

onMounted(() => {
  runViewInitialization('订单履约', async () => {
    applyDefaultMonthFilters()
    const config = await window.electronAPI.getConfig()
    initDepositMode(config.DEPOSIT_API_MODE)
    defaultShippingMode.value = config.DEFAULT_SHIPPING_MODE || 'land'
    form.shippingMode = defaultShippingMode.value
    logisticsEnabled.value = String(config.LOGISTICS_QUERY_ENABLED || 'False').toLowerCase() === 'true'
    await loadStores()
    await loadScheduleUnits()
    await refreshAssistPreview()
    await loadOrders()
    await loadAlerts()
    disposeDepositStatusListener = window.electronAPI?.onDepositStatusChanged?.(onDepositStatusChanged) || null
  })
})

onUnmounted(() => {
  disposeDepositStatusListener?.()
  disposeDepositStatusListener = null
})
</script>

<style scoped>
.fulfillment-page {
  gap: 18px;
}

.hero-header {
  padding: 24px;
  border-radius: 24px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}

.summary-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.kpi-panel,
.filter-panel {
  display: grid;
  gap: 12px;
}

.compact-panel-header {
  margin-bottom: 0;
}

.compact-kpi-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.compact-kpi-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  background: #fff;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.compact-kpi-chip strong {
  color: var(--text-strong);
  font-size: 13px;
}

.compact-kpi-chip.active {
  color: #14532d;
  border-color: rgba(20, 83, 45, 0.2);
  background: rgba(20, 83, 45, 0.06);
}

.quick-filter-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle, #e5e7eb);
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

.store-badge {
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
}

.filter-panel {
  padding: 14px 16px;
}

.filter-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.order-filter-grid,
.preview-grid,
.bulk-extend-grid,
.detail-top-cards,
.action-summary-grid {
  display: grid;
  gap: 14px;
}

.order-filter-grid {
  align-items: end;
}

.order-filter-grid--basic {
  grid-template-columns: minmax(280px, 1.4fr) minmax(150px, 0.85fr) minmax(150px, 0.85fr) auto;
  gap: 10px;
}

.order-filter-grid--advanced {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.keyword-group {
  min-width: 0;
}

.filter-actions,
.actions,
.group-title-row,
.extend-inline,
.board-head-meta,
.group-metrics,
.detail-actions,
.detail-actions-row,
.task-head-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-actions {
  justify-content: flex-end;
  flex-wrap: nowrap;
}

.workspace-grid {
  display: block;
  min-width: 0;
}

.order-edit-body {
  display: grid;
  gap: 14px;
}

.workspace-panel {
  min-height: 100%;
}

.meta-chip,
.metric-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
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

.group-title,
.group-count,
.cell-strong,
.alert-title,
.empty-title {
  color: var(--text-strong);
  font-weight: 700;
}

.order-card-list {
  display: grid;
  gap: 8px;
}

.bulk-order-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: rgba(248, 250, 252, 0.92);
}

.bulk-order-actions,
.select-all-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.select-all-line {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.select-all-line input,
.order-select input {
  width: 16px;
  height: 16px;
  margin: 0;
}

.order-card-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  padding: 13px 14px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.94);
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.order-card-row.checked {
  border-color: rgba(20, 184, 166, 0.5);
  background: rgba(240, 253, 250, 0.86);
}

.order-select {
  display: grid;
  place-items: center;
  padding-top: 4px;
}

.order-card-row:hover {
  border-color: rgba(20, 184, 166, 0.2);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.order-card-row.selected {
  border-color: rgba(37, 99, 235, 0.55);
  background: rgba(239, 246, 255, 0.9);
}

.order-main {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.order-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.order-id {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.order-no {
  max-width: 260px;
  color: var(--text-strong);
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-sub-grid {
  display: grid;
  grid-template-columns: minmax(92px, 0.7fr) minmax(110px, 0.85fr) minmax(220px, 1.35fr) minmax(170px, 1fr) minmax(190px, 1.1fr) minmax(84px, 0.62fr);
  gap: 10px 14px;
  align-items: start;
}

.wide-meta {
  min-width: 0;
}

.meta-label {
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.meta-value {
  min-width: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.truncate-line {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 176px;
}

.detail-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: #fff;
}

.detail-title-block {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.detail-order-no {
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.detail-status-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-summary-strip {
  display: grid;
  grid-template-columns: 0.9fr 0.8fr 1.35fr 0.9fr;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: rgba(248, 250, 252, 0.82);
}

.detail-summary-strip div,
.detail-kv div {
  min-width: 0;
}

.detail-summary-strip span,
.detail-kv dt {
  display: block;
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.detail-summary-strip strong,
.detail-kv dd {
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.detail-work-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.2fr);
  gap: 12px;
  margin-top: 12px;
}

.detail-block {
  padding: 14px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: #fff;
}

.detail-block-title,
.form-section-title {
  margin-bottom: 12px;
  color: var(--text-strong);
  font-weight: 800;
}

.detail-kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}


.detail-top-cards {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.order-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.detail-card {
  padding: 14px 16px;
}

.compact-card {
  min-height: 98px;
}

.detail-card.span-2 {
  grid-column: span 2;
}

.detail-value {
  margin-top: 8px;
  color: var(--text-strong);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.detail-section {
  margin-top: 14px;
  padding: 16px;
}

.detail-section-head {
  margin-bottom: 12px;
}

.side-shipping-grid {
  margin-bottom: 12px;
}

.detail-modal {
  width: min(1120px, calc(100vw - 48px));
}

.detail-panel {
  min-width: 0;
}

.preview-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.preview-item {
  min-height: 112px;
}

.preview-value {
  margin-top: 10px;
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
}

.preview-value.small {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.status-pill.enabled {
  background: var(--bg-success-soft);
  color: var(--text-success);
}

.status-pill.disabled {
  background: var(--bg-warning-soft);
  color: var(--text-warning);
}

.subtle-banner {
  margin-top: 14px;
}

.xhs-line {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.import-modal,
.action-modal {
  width: min(1180px, 100%);
}

.create-order-drawer {
  display: grid;
  gap: 16px;
}

.batch-extend-modal {
  width: min(720px, calc(100vw - 48px));
}

.bulk-extend-editor {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: rgba(248, 250, 252, 0.86);
}

.selected-order-preview {
  display: grid;
  gap: 8px;
  max-height: 280px;
  margin-top: 14px;
  overflow: auto;
}

.selected-order-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.94);
  color: var(--text-secondary);
  font-size: 13px;
}

.selected-order-item div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.selected-order-item strong {
  color: var(--text-strong);
}

.create-flow-panel {
  display: grid;
  gap: 14px;
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.94);
}

.paste-panel {
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: rgba(248, 250, 252, 0.82);
}

.paste-panel--compact {
  margin-bottom: 0;
}

.paste-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.paste-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.paste-textarea {
  min-height: 88px;
  resize: vertical;
}

.paste-textarea--compact {
  min-height: 58px;
}

.paste-result {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.missing-fields-panel {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: var(--radius-md);
  background: rgba(255, 251, 235, 0.72);
}

.missing-field-list,
.requirement-strip,
.create-section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.missing-field-chip,
.requirement-chip {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.86);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.requirement-chip.required {
  border-color: rgba(15, 118, 110, 0.22);
  background: rgba(240, 253, 250, 0.9);
  color: #0f766e;
}

.requirement-chip.warning {
  border-color: rgba(245, 158, 11, 0.22);
  background: rgba(255, 251, 235, 0.9);
  color: #b45309;
}

.field-mark {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.field-mark.required {
  background: rgba(20, 184, 166, 0.1);
  color: #0f766e;
}

.field-mark.warning {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.form-section-title {
  margin-top: 16px;
}

.form-section-title:first-of-type {
  margin-top: 0;
}

.create-query-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.create-query-grid .span-2 {
  grid-column: span 2;
}

.order-filter-grid .form-group:has(.click-date-input),
.create-query-grid .form-group:has(.click-date-input),
.bulk-extend-grid .form-group:has(.click-date-input),
.extend-inline .form-group:has(.click-date-input) {
  max-width: 220px;
}

.create-confirm-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.create-confirm-grid .span-2 {
  grid-column: span 2;
}

.order-grid {
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
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

.inline-actions {
  align-items: center;
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
  background: rgba(255, 255, 255, 0.72);
}

.stale-note {
  border: 1px solid rgba(245, 158, 11, 0.2);
  background: rgba(255, 251, 235, 0.9);
  color: #b45309;
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
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.14);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.available-units {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.available-unit {
  display: grid;
  gap: 4px;
  min-width: 128px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(20, 184, 166, 0.18);
  background: rgba(255, 255, 255, 0.92);
  text-align: left;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.available-unit:hover {
  transform: translateY(-1px);
  border-color: rgba(13, 148, 136, 0.34);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.06);
}

.available-unit.active {
  border-color: rgba(13, 148, 136, 0.52);
  background: rgba(240, 253, 250, 0.96);
}

.unit-main {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
}

.unit-sub {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.conflict-details {
  display: grid;
  gap: 10px;
}

.conflict-details summary {
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.conflict-list {
  display: grid;
  gap: 10px;
}

.conflict-item {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.78);
}

.conflict-unit {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
}

.conflict-blocks {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.conflict-block {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.14);
  color: var(--text-secondary);
  font-size: 12px;
}

.selection-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(20, 184, 166, 0.12);
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
}

.import-summary,
.action-summary-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.import-preview-table {
  margin-top: 16px;
  max-height: 420px;
}

.action-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.alert-section {
  display: grid;
  gap: 12px;
}

.task-pane {
  min-height: 0;
}

.section-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.section-head {
  font-weight: 700;
  color: var(--text-strong);
}

.section-tip,
.alert-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.task-scroll {
  max-height: 420px;
  overflow: auto;
  padding-right: 4px;
}

.alert-card {
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid var(--border-light);
  background: var(--bg-surface, #fff);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}

.alert-card-stack {
  display: grid;
  gap: 12px;
}

.alert-check-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.alert-check-row input[type='checkbox'] {
  margin-top: 4px;
  flex: 0 0 auto;
}

.alert-main {
  display: grid;
  gap: 4px;
}

.bulk-extend-bar {
  padding: 16px;
  border-radius: 18px;
  display: grid;
  gap: 14px;
  background: var(--bg-panel-muted, #f8fafc);
  border: 1px solid var(--border-subtle, #e5e7eb);
}

.bulk-extend-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.bulk-extend-actions {
  justify-content: flex-end;
}

.compact-field {
  margin-bottom: 0;
}

.sticky-actions {
  position: sticky;
  bottom: 0;
  padding-top: 8px;
  background: var(--bg-surface, #fff);
}

/* ── 任务中心 Modal 视觉统一 ── */
.action-modal .alert-card {
  background: var(--bg-surface, #fff);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}
.action-modal .bulk-extend-bar {
  background: var(--bg-panel-muted, #f7f8fa);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
}
.action-modal .sticky-actions {
  background: var(--bg-surface, #fff);
  border-top: 1px solid var(--border-subtle, #e5e7eb);
  padding-top: 10px;
}

.empty-state {
  padding: 32px 20px;
  text-align: center;
}

.side-empty-state {
  margin-top: 8px;
}

.workspace-empty {
  padding: 24px 12px;
}

/* ── 表格列宽 ── */
.w-10  { width: 44px; }
.w-60  { width: 60px; }
.w-70  { width: 70px; }
.w-80  { width: 80px; }
.w-90  { width: 90px; }
.w-100 { width: 100px; }
.w-110 { width: 110px; }
.w-120 { width: 120px; }
.w-130 { width: 130px; }
.w-140 { width: 140px; }
.w-160 { width: 160px; }
.w-180 { width: 180px; }
.w-220 { width: 220px; }

/* ── 行内操作 ── */
.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.order-table {
  font-size: 13px;
  min-width: 1280px;
}
.order-table th {
  padding: 10px 12px;
  height: 44px;
  white-space: nowrap;
}
.order-table td {
  padding: 12px;
  vertical-align: top;
  line-height: 1.45;
}
.order-table td b {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-table td .minor-text {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-stack {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.status-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.order-table tbody tr:hover {
  background: #f9fafb;
}
.order-table tbody tr.selected {
  background: rgba(20, 184, 166, 0.06);
}

/* ══════════════════════════════════════════
   Drawer — 企业级订单详情工作台
   ══════════════════════════════════════════ */

/* ── 1. Drawer Header ── */
.order-drawer-header {
  margin-bottom: 12px;
}
.order-drawer-header-left {
  min-width: 0;
}
.order-drawer-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}
.order-drawer-id {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-strong);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', monospace);
}
.order-drawer-source-no {
  font-size: 13px;
  color: var(--text-muted);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-drawer-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ── 2. Status Advisor ── */
.status-advisor {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.5;
}
.status-advisor--info {
  background: rgba(20, 184, 166, 0.06);
  border: 1px solid rgba(20, 184, 166, 0.15);
  color: #0f766e;
}
.status-advisor--warning {
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.15);
  color: #b45309;
}
.status-advisor--neutral {
  background: rgba(100, 116, 139, 0.05);
  border: 1px solid rgba(100, 116, 139, 0.12);
  color: var(--text-secondary);
}
.advisor-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-advisor--info .advisor-dot {
  background: #14b8a6;
}
.status-advisor--warning .advisor-dot {
  background: #f59e0b;
}
.status-advisor--neutral .advisor-dot {
  background: #94a3b8;
}
.advisor-text {
  flex: 1;
  min-width: 0;
}

/* ── 3. Mini Summary Grid ── */
.mini-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.mini-summary-card {
  padding: 12px 14px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.mini-summary-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.mini-summary-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-summary-value--accent {
  font-size: 15px;
  font-weight: 800;
  color: #0f766e;
}
.mini-summary-sub {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 物流处理卡 企业级升级 ── */

/* 状态摘要条 */
.logistics-summary-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-subtle, #f9fafb);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 10px;
  margin-bottom: 14px;
}
.logistics-summary-item {
  min-width: 0;
}
.logistics-summary-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}
.logistics-status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  margin-top: 2px;
}
.logistics-status-badge--info {
  background: rgba(20, 184, 166, 0.10);
  color: #0f766e;
}
.logistics-status-badge--warning {
  background: rgba(245, 158, 11, 0.10);
  color: #b45309;
}
.logistics-status-badge--neutral {
  background: rgba(100, 116, 139, 0.08);
  color: #64748b;
}

/* 物流表单面板 */
.logistics-form-panel {
  padding: 14px;
  margin-bottom: 14px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 10px;
}
.logistics-action-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* 物流时间线 */
.logistics-timeline {
  padding: 0;
}
.logistics-timeline-list {
  display: flex;
  flex-direction: column;
}
.logistics-timeline-item {
  display: flex;
  gap: 12px;
  min-height: 52px;
}
.logistics-timeline-item--latest .logistics-timeline-status {
  font-weight: 800;
}
.logistics-timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24px;
  flex-shrink: 0;
  padding-top: 4px;
}
.logistics-timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #d1d5db;
  border: 2px solid #e5e7eb;
  flex-shrink: 0;
}
.logistics-timeline-dot--active {
  background: #14b8a6;
  border-color: #99f6e4;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.14);
}
.logistics-timeline-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  background: #e5e7eb;
  margin: 4px 0;
}
.logistics-timeline-body {
  flex: 1;
  min-width: 0;
  padding-bottom: 14px;
}
.logistics-timeline-status {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
  line-height: 1.4;
}
.logistics-timeline-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
}
.logistics-timeline-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* 空态 */
.logistics-empty-state {
  text-align: center;
  padding: 28px 16px;
}
.logistics-empty-icon {
  font-size: 28px;
  margin-bottom: 8px;
}
.logistics-empty-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
  margin-bottom: 4px;
}
.logistics-empty-desc {
  font-size: 12px;
  color: var(--text-muted);
}

/* 保留原有物流表单字段样式 */
.drawer-logistics-grid input,
.drawer-logistics-grid select {
  min-height: 34px;
  padding: 6px 10px;
  font-size: 13px;
}

@media (max-width: 720px) {
  .mini-summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .drawer-logistics-grid {
    grid-template-columns: 1fr;
  }

  .device-rental-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ── 4-6. Section Card 通用容器 ── */
.drawer-section-card {
  padding: 14px 16px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
  margin-bottom: 12px;
}
.drawer-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.drawer-section-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-strong);
}
/* ── KV Grid 通用键值对 ── */
.kv-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 16px;
}
.kv-grid--2col {
  grid-template-columns: repeat(2, 1fr);
}
.kv-grid--3col {
  grid-template-columns: repeat(3, 1fr);
}
.kv-item {
  min-width: 0;
}
.kv-item--wide {
  grid-column: 1 / -1;
}
.kv-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.kv-value {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.45;
}
.kv-value--accent {
  font-size: 16px;
  font-weight: 800;
  color: #0f766e;
}

/* ── 资金与免押卡 ── */
.deposit-state-panel {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  background: var(--bg-subtle, #f9fafb);
}
.deposit-state-panel--none {
  background: rgba(100, 116, 139, 0.04);
  border-color: rgba(100, 116, 139, 0.12);
}
.deposit-state-panel--pending_review {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.14);
}
.deposit-state-panel--approved {
  background: rgba(20, 184, 166, 0.05);
  border-color: rgba(20, 184, 166, 0.14);
}
.deposit-state-panel--rejected {
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.14);
}
.deposit-state-panel--cancelled {
  background: rgba(100, 116, 139, 0.04);
  border-color: rgba(100, 116, 139, 0.12);
}
.deposit-state-panel--completed {
  background: rgba(100, 116, 139, 0.04);
  border-color: rgba(100, 116, 139, 0.12);
}

.deposit-state-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.deposit-state-badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.deposit-state-badge--none {
  background: rgba(100, 116, 139, 0.10);
  color: #64748b;
}
.deposit-state-badge--pending {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}
.deposit-state-badge--approved {
  background: rgba(20, 184, 166, 0.12);
  color: #0f766e;
}
.deposit-state-badge--rejected {
  background: rgba(239, 68, 68, 0.10);
  color: #b91c1c;
}
.deposit-state-badge--cancelled {
  background: rgba(100, 116, 139, 0.10);
  color: #64748b;
}
.deposit-state-badge--completed {
  background: rgba(100, 116, 139, 0.10);
  color: #64748b;
}
.deposit-state-no {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.deposit-state-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
  line-height: 1.5;
}
.deposit-state-hint--success {
  color: #0f766e;
}
.deposit-state-hint--danger {
  color: #b91c1c;
}
.deposit-action-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* ── 设备与租期卡 ── */
.device-rental-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 16px;
}

@media (max-width: 1440px) {
  .preview-grid,
  .import-summary,
  .summary-grid,
  .action-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .order-sub-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1320px) {
  .order-filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .filter-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 1200px) {
  .action-board {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .order-filter-grid,
  .preview-grid,
  .bulk-extend-grid,
  .create-query-grid,
  .create-confirm-grid,
  .order-sub-grid,
  .detail-top-cards,
  .order-detail-grid,
  .import-summary,
  .summary-grid,
  .action-summary-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-like {
    padding-bottom: 8px;
  }

  .task-btn {
    margin-left: 0;
  }

  .filter-actions,
  .order-actions {
    justify-content: flex-start;
  }

  .bulk-order-bar,
  .order-card-row {
    grid-template-columns: 1fr;
  }

  .order-actions {
    min-width: 0;
  }

  .group-head,
  .detail-hero,
  .paste-head,
  .availability-result-head {
    display: grid;
  }

  .detail-summary-strip,
  .detail-work-grid,
  .detail-kv {
    grid-template-columns: 1fr;
  }

  .detail-card.span-2 {
    grid-column: span 1;
  }

  .xhs-line {
    align-items: flex-start;
  }
}
</style>
