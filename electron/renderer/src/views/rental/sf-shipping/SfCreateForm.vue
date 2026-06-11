<template>
  <div class="sf-main">
    <StepProgress :steps="steps" :current="step" @change="$emit('go-step', $event)" />

    <section v-show="step === 'address'" class="panel">
      <div class="section-head">
        <h3>填写寄收件地址</h3>
        <p>粘贴收货信息自动识别，或手动填写</p>
      </div>

      <div class="paste-box">
        <textarea
          v-model="pasteText"
          placeholder="粘贴收货信息，例如：张三 13812345678 四川省成都市金牛区xx路xx号"
          rows="4"
        ></textarea>
        <div class="paste-btns">
          <button class="btn btn-primary btn-sm" @click="$emit('parse-recipient-paste')">识别并填入</button>
          <button class="btn btn-ghost btn-sm" @click="$emit('clear-receiver')">清空</button>
        </div>
      </div>

      <div class="addr-dual">
        <AddressCard title="寄件人" tone="info">
          <template #actions>
            <button class="btn btn-ghost btn-sm" @click="senderPanelOpen = !senderPanelOpen">
              {{ senderPanelOpen ? '收起' : '修改' }}
            </button>
          </template>
          <div v-if="!senderPanelOpen" class="ac-summary" @click="senderPanelOpen = true">
            <b v-if="form.senderName">{{ form.senderName }} {{ form.senderMobile }}</b>
            <b v-else class="placeholder-text">点击填写寄件人</b>
            <span>{{ senderAddrText || '寄件地址待填写' }}</span>
          </div>
          <div v-else class="ac-form">
            <input v-model="form.senderName" placeholder="姓名" />
            <input v-model="form.senderMobile" placeholder="手机号" />
            <div class="ac-form-row">
              <input v-model="form.senderProvince" placeholder="省" class="f3" />
              <input v-model="form.senderCity" placeholder="市" class="f3" />
              <input v-model="form.senderDistrict" placeholder="区/县" class="f3" />
            </div>
            <input v-model="form.senderAddress" placeholder="详细地址" />
            <label class="check-sm">
              <input v-model="form.saveSenderAsDefault" type="checkbox" /> 保存为默认寄件地址
            </label>
          </div>
        </AddressCard>

        <div class="addr-arrow">→</div>

        <AddressCard title="收件人" tone="warning">
          <div class="ac-form">
            <input v-model="form.receiverName" placeholder="姓名" />
            <input v-model="form.receiverMobile" placeholder="手机号" />
            <div class="ac-form-row">
              <input v-model="form.receiverProvince" placeholder="省" class="f3" />
              <input v-model="form.receiverCity" placeholder="市" class="f3" />
              <input v-model="form.receiverDistrict" placeholder="区/县" class="f3" />
            </div>
            <input v-model="form.receiverAddress" placeholder="详细地址" />
          </div>
        </AddressCard>
      </div>

      <div class="pickup-block">
        <h4>预约取件时间</h4>
        <div class="pickup-row">
          <input
            v-model="form.plannedSendAt"
            type="datetime-local"
            class="pickup-dt"
            @change="$emit('validate-planned-send-at')"
          />
          <div class="pickup-presets">
            <button :class="['btn', 'btn-sm', pickupPresetActive('10:00') ? 'btn-primary' : 'btn-secondary']" @click="$emit('apply-pickup-preset', '10:00')">
              上午 10:00-11:00
            </button>
            <button :class="['btn', 'btn-sm', pickupPresetActive('17:00') ? 'btn-primary' : 'btn-secondary']" @click="$emit('apply-pickup-preset', '17:00')">
              傍晚 17:00
            </button>
          </div>
        </div>
        <span class="minor-text">取件时间范围：每天 08:00 - 20:00</span>
      </div>

      <div class="step-footer">
        <span class="minor-text">{{ addressStepHint }}</span>
      </div>
    </section>

    <section v-show="step === 'service'" class="panel">
      <div class="section-head">
        <h3>选择服务</h3>
        <p>填写货物信息并选择寄件产品，系统实时预估时效与费用</p>
      </div>

      <div class="pkg-bar">
        <label>
          <span>货物名称</span>
          <input v-model="form.cargoName" placeholder="租赁设备" />
        </label>
        <label>
          <span>重量（kg）</span>
          <input v-model.number="form.weightKg" type="number" min="0.1" step="0.1" />
        </label>
      </div>

      <div class="service-cards">
        <div
          v-for="service in serviceOptions"
          :key="service.code"
          :class="['svc-card', {
            selected: form.productCode === service.code,
            unavailable: svcAvailable(service.code) === false,
          }]"
          @click="svcAvailable(service.code) !== false ? $emit('select-service', service.code) : null"
        >
          <div class="svc-top">
            <span class="svc-name">{{ service.name }}</span>
            <span v-if="form.productCode === service.code" class="svc-check">✓</span>
            <span v-else-if="svcAvailable(service.code) === false" class="svc-unavailable">暂不可用</span>
          </div>
          <p class="svc-desc">{{ service.desc }}</p>
          <span v-if="svcAvailable(service.code) === false" class="svc-tag svc-tag-err">该路线不支持</span>
          <span v-else class="svc-tag">{{ service.tag }}</span>
        </div>
      </div>

      <div v-if="quoteChecked && serviceUnavailableHint" class="banner banner-warning">{{ serviceUnavailableHint }}</div>

      <div v-if="!isIntraCity" class="quote-block" :class="{ loading: quoteLoading }">
        <div class="qb-item">
          <span class="qb-label">取件时间</span>
          <span class="qb-value">{{ form.plannedSendAt ? form.plannedSendAt.replace('T', ' ') : '-' }}</span>
        </div>
        <div class="qb-item">
          <span class="qb-label">预计送达</span>
          <span class="qb-value">{{ quoteLoading ? '查询中...' : (quoteResult?.expectedArriveAt || (quoteChecked ? '暂无数据' : '完善信息后自动查询')) }}</span>
        </div>
        <div class="qb-item">
          <span class="qb-label">预计费用</span>
          <span class="qb-value qb-price">{{ feeLabel(quoteResult?.estimatedFee) }}</span>
        </div>
      </div>

      <div v-if="!isIntraCity && !monthlyCardConfigured" class="banner banner-warning">未配置月结卡号，将按寄付现结</div>
      <div v-if="isIntraCity && !intraCityConfigured" class="banner banner-error">请先在设置页配置顺丰同城凭据</div>
      <div v-if="!isIntraCity && senderConfigMissingFields.length" class="banner banner-error">
        寄件人设置不完整：{{ senderConfigMissingFields.join('、') }}
        <router-link to="/settings">前往设置</router-link>
      </div>

      <div class="step-footer">
        <button class="btn btn-ghost" @click="$emit('go-step', 'address')">← 上一步</button>
        <div class="step-footer-main passive">
          <span class="minor-text">{{ serviceStepHint }}</span>
        </div>
      </div>
    </section>

    <section v-show="step === 'confirm'" class="panel">
      <div class="section-head">
        <h3>确认寄件信息</h3>
      </div>

      <div class="confirm-grid">
        <div class="cf-card">
          <div class="cf-row"><span>寄件人</span><b>{{ form.senderName }} {{ form.senderMobile }}</b></div>
          <div class="cf-row"><span>寄件地址</span><b>{{ senderAddrText }}</b></div>
          <div class="cf-row"><span>收件人</span><b>{{ form.receiverName }} {{ form.receiverMobile }}</b></div>
          <div class="cf-row"><span>收件地址</span><b>{{ receiverAddrText }}</b></div>
        </div>
        <div class="cf-card">
          <div class="cf-row"><span>产品</span><b>{{ productLabel(form.productCode) }}</b></div>
          <div class="cf-row"><span>货物</span><b>{{ form.cargoName }} · {{ form.weightKg }}kg</b></div>
          <div class="cf-row"><span>取件时间</span><b>{{ form.plannedSendAt.replace('T', ' ') }}</b></div>
          <div class="cf-row"><span>付款方式</span><b>{{ monthlyCardConfigured ? '月结优先' : '寄付现结' }}</b></div>
        </div>
      </div>

      <div v-if="!isIntraCity" class="cf-quote">
        <div><span>预计送达</span><b class="text-primary">{{ quoteResult?.expectedArriveAt || deliveryEstimate?.expectedArriveAt || '-' }}</b></div>
        <div><span>预计费用</span><b class="cf-price">{{ feeLabel(quoteResult?.estimatedFee ?? currentShipment?.estimated_fee) }}</b></div>
      </div>

      <div class="step-footer">
        <button class="btn btn-ghost" @click="$emit('go-step', 'service')">← 上一步</button>
        <button class="btn btn-secondary" :disabled="busy" @click="$emit('save-draft')">保存草稿</button>
      </div>

      <div v-if="currentShipment" class="result-bar">
        <StatusBadge :label="statusLabel(currentShipment.status)" :variant="shipmentStatusVariant(currentShipment.status)" />
        <template v-if="currentShipment.tracking_no">
          <code class="tracking-code">{{ currentShipment.tracking_no }}</code>
          <span v-if="currentShipment.expected_arrive_at" class="minor-text">预计 {{ currentShipment.expected_arrive_at }} 送达</span>
        </template>
        <span v-if="currentShipment.service_message" class="minor-text">{{ currentShipment.service_message }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AddressCard from '../../../components/AddressCard.vue'
import StepProgress from '../../../components/StepProgress.vue'
import StatusBadge from '../../../components/StatusBadge.vue'

const props = defineProps({
  steps: { type: Array, required: true },
  step: { type: String, required: true },
  form: { type: Object, required: true },
  recipientPaste: { type: String, default: '' },
  senderEditing: { type: Boolean, default: false },
  serviceOptions: { type: Array, required: true },
  quoteChecked: { type: Boolean, default: false },
  serviceUnavailableHint: { type: String, default: '' },
  quoteLoading: { type: Boolean, default: false },
  quoteResult: { type: Object, default: null },
  monthlyCardConfigured: { type: Boolean, default: false },
  intraCityConfigured: { type: Boolean, default: false },
  senderConfigMissingFields: { type: Array, default: () => [] },
  senderAddrText: { type: String, default: '' },
  receiverAddrText: { type: String, default: '' },
  isIntraCity: { type: Boolean, default: false },
  addressStepHint: { type: String, default: '' },
  serviceStepHint: { type: String, default: '' },
  currentShipment: { type: Object, default: null },
  deliveryEstimate: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  svcAvailable: { type: Function, required: true },
  pickupPresetActive: { type: Function, required: true },
  productLabel: { type: Function, required: true },
  feeLabel: { type: Function, required: true },
  statusLabel: { type: Function, required: true },
  shipmentStatusVariant: { type: Function, required: true },
})

const emit = defineEmits([
  'update:recipientPaste',
  'update:senderEditing',
  'go-step',
  'parse-recipient-paste',
  'clear-receiver',
  'validate-planned-send-at',
  'apply-pickup-preset',
  'select-service',
  'save-draft',
])

const pasteText = computed({
  get: () => props.recipientPaste,
  set: (value) => emit('update:recipientPaste', value),
})

const senderPanelOpen = computed({
  get: () => props.senderEditing,
  set: (value) => emit('update:senderEditing', value),
})
</script>

<style scoped>
.sf-main {
  min-width: 0;
}
.step-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-light);
}
.step-footer-main.passive {
  display: flex;
  justify-content: flex-end;
}
.paste-box {
  padding: 12px;
  margin-bottom: 12px;
  border: 1px dashed rgba(120, 135, 128, 0.28);
  background: #fbfcfc;
  border-radius: var(--radius-md);
  transition: border-color .2s, background .2s;
}
.paste-box:focus-within {
  border-color: var(--bg-primary);
}
.paste-box textarea {
  width: 100%;
  min-height: 88px;
  padding: 4px 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-main);
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
}
.paste-box textarea::placeholder {
  color: var(--text-faint);
}
.paste-btns {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.addr-dual {
  display: grid;
  grid-template-columns: 1fr 28px 1fr;
  gap: 12px;
  align-items: stretch;
  margin-bottom: 12px;
}
.addr-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 40px;
  color: var(--text-faint);
  font-size: 20px;
}
.ac-summary {
  padding: var(--space-3);
  background: var(--bg-panel);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.ac-summary b,
.ac-summary span {
  display: block;
}
.ac-summary span {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 13px;
}
.placeholder-text {
  color: var(--text-faint);
  font-weight: 400;
}
.ac-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ac-form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}
.check-sm {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}
.check-sm input {
  width: auto;
}
.pickup-block {
  padding: 12px;
  margin-top: 8px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel);
  border-radius: var(--radius-md);
}
.pickup-block h4 {
  margin: 0 0 var(--space-3);
  color: var(--text-main);
  font-size: 15px;
}
.pickup-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.pickup-dt {
  flex: 1;
}
.pickup-presets {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}
.pkg-bar {
  display: grid;
  grid-template-columns: 1fr 160px;
  gap: 12px;
  margin-bottom: var(--space-4);
}
.pkg-bar label span,
.pkg-bar span {
  display: block;
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}
.service-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.svc-card {
  position: relative;
  padding: var(--space-5);
  border: 2px solid var(--border-light);
  background: var(--bg-panel);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all .15s;
}
.svc-card:hover {
  border-color: var(--border-medium);
}
.svc-card.selected {
  border-color: var(--bg-primary);
  background: rgba(219, 246, 241, 0.72);
}
.svc-card.unavailable {
  border-color: var(--border-light);
  background: var(--bg-panel-muted);
  cursor: not-allowed;
  opacity: .45;
}
.svc-card.unavailable:hover {
  border-color: var(--border-light);
}
.svc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.svc-name {
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 600;
}
.svc-card.unavailable .svc-name {
  color: var(--text-faint);
}
.svc-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--bg-primary);
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
}
.svc-unavailable {
  color: var(--text-danger);
  font-size: 12px;
  font-weight: 600;
}
.svc-desc {
  margin: 0 0 8px;
  color: var(--text-muted);
  font-size: 13px;
}
.svc-tag {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-panel-muted);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.svc-tag-err {
  background: var(--bg-danger-soft);
  color: var(--text-danger);
}
.quote-block {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
  padding: 12px;
  border: 1px solid #dbe4e8;
  background: #f8fafc;
  border-radius: var(--radius-md);
}
.quote-block.loading {
  opacity: .5;
}
.qb-label {
  display: block;
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 12px;
}
.qb-value {
  color: var(--text-strong);
  font-size: 15px;
}
.qb-price {
  font-size: 22px;
  font-weight: 700;
}
.confirm-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}
.cf-card {
  padding: var(--space-4);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}
.cf-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
}
.cf-row:last-child {
  border-bottom: none;
}
.cf-row span {
  color: var(--text-muted);
  font-size: 13px;
}
.cf-row b {
  color: var(--text-main);
  font-size: 14px;
}
.cf-quote {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  border: 1px solid #dbe4e8;
  background: #f8fafc;
  border-radius: var(--radius-md);
}
.cf-quote span {
  display: block;
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 12px;
}
.cf-price {
  color: var(--text-strong) !important;
  font-size: 24px !important;
  font-weight: 700;
}
.result-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-4);
  background: var(--bg-panel-muted);
  border-radius: var(--radius-sm);
}
.tracking-code {
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.minor-text {
  color: var(--text-muted);
  font-size: 13px;
}
.text-primary {
  color: var(--text-primary);
}
.banner {
  padding: 10px 14px;
  margin-bottom: var(--space-4);
  border-radius: var(--radius-sm);
  font-size: 14px;
}
.banner-error {
  border: 1px solid #fecaca;
  background: var(--bg-danger-soft);
  color: var(--text-danger);
}
.banner-warning {
  border: 1px solid #fde68a;
  background: var(--bg-warning-soft);
  color: var(--text-warning);
}
.banner a {
  color: inherit;
  font-weight: 600;
}
.btn-ghost {
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover {
  background: var(--bg-panel-muted);
}
@media (max-width: 1180px) {
  .addr-dual {
    grid-template-columns: 1fr;
  }
  .addr-arrow {
    transform: rotate(90deg);
    padding-top: 0;
  }
  .pkg-bar {
    grid-template-columns: 1fr;
  }
  .service-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 820px) {
  .addr-dual,
  .confirm-grid {
    grid-template-columns: 1fr;
  }
  .addr-arrow {
    transform: rotate(90deg);
    padding-top: 0;
  }
  .service-cards,
  .pkg-bar,
  .quote-block,
  .cf-quote {
    grid-template-columns: 1fr;
  }
  .pickup-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
