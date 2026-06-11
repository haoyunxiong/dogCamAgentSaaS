<template>
  <StickySummaryPanel title="寄件摘要">
    <div class="sf-summary-body">
      <div class="sf-summary-item">
        <span class="sfl">寄件人</span>
        <span class="sfv">{{ form.senderName || '未填写' }} {{ form.senderMobile }}</span>
        <span v-if="senderAddrText" class="sfv mono">{{ senderAddrText }}</span>
      </div>

      <div class="sf-summary-item">
        <span class="sfl">收件人</span>
        <span class="sfv">{{ form.receiverName || '未填写' }} {{ form.receiverMobile }}</span>
        <span v-if="receiverAddrText" class="sfv mono">{{ receiverAddrText }}</span>
      </div>

      <div class="sf-summary-item">
        <span class="sfl">取件时间</span>
        <span class="sfv">{{ form.plannedSendAt ? form.plannedSendAt.replace('T', ' ') : '未设置' }}</span>
      </div>

      <div class="sf-summary-item">
        <span class="sfl">已选服务</span>
        <span class="sfv">{{ productLabel(form.productCode) }}</span>
      </div>

      <div class="sf-summary-item">
        <span class="sfl">货物</span>
        <span class="sfv">{{ form.cargoName }} · {{ form.weightKg }}kg</span>
      </div>

      <div v-if="!isIntraCity" class="sf-summary-item">
        <span class="sfl">预计费用</span>
        <span v-if="quoteResult?.estimatedFee != null" class="sf-summary-fee">{{ feeLabel(quoteResult.estimatedFee) }}</span>
        <span v-else class="sfv">待报价</span>
      </div>

      <div :class="['sf-summary-status', currentStepState.ok ? 'ok' : 'pending']">
        <strong>{{ currentStepState.text }}</strong>
      </div>
    </div>

    <template #footer>
      <div class="sf-summary-foot">
        <span v-if="currentStepState.reason" class="summary-disabled-reason">{{ currentStepState.reason }}</span>
        <button
          v-if="step === 'address'"
          class="btn btn-primary sf-summary-primary"
          :disabled="Boolean(addressStepDisabledReason)"
          @click.stop="$emit('go-step', 'service')"
        >
          下一步：选择服务
        </button>

        <button
          v-if="step === 'service'"
          class="btn btn-primary sf-summary-primary"
          :disabled="Boolean(serviceStepDisabledReason)"
          @click.stop="$emit('go-step', 'confirm')"
        >
          下一步：确认下单
        </button>

        <button
          v-if="step === 'confirm' && !isIntraCity"
          class="btn btn-primary btn-lg sf-summary-primary"
          :disabled="busy || Boolean(confirmStepDisabledReason)"
          @click.stop="$emit('place-order')"
        >
          确认下单
        </button>

        <button
          v-if="step === 'confirm' && isIntraCity"
          class="btn btn-primary sf-summary-primary"
          :disabled="busy || Boolean(confirmStepDisabledReason)"
          @click.stop="$emit('precheck')"
        >
          查询同城费用
        </button>
      </div>
    </template>
  </StickySummaryPanel>
</template>

<script setup>
import StickySummaryPanel from '../../../components/StickySummaryPanel.vue'

defineEmits(['go-step', 'place-order', 'precheck'])

defineProps({
  form: { type: Object, required: true },
  senderAddrText: { type: String, default: '' },
  receiverAddrText: { type: String, default: '' },
  step: { type: String, default: 'address' },
  isIntraCity: { type: Boolean, default: false },
  quoteResult: { type: Object, default: null },
  currentStepState: { type: Object, default: () => ({ ok: false, text: '', reason: '' }) },
  addressStepDisabledReason: { type: String, default: '' },
  serviceStepDisabledReason: { type: String, default: '' },
  confirmStepDisabledReason: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  productLabel: { type: Function, required: true },
  feeLabel: { type: Function, required: true },
})
</script>

<style scoped>
.sf-summary-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  padding: 10px 14px;
}
.sf-summary-foot {
  padding: 10px 14px;
  border-top: 1px solid var(--border-subtle, #e5e7eb);
}
.sf-summary-primary {
  width: 100%;
}
.sf-summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.8);
}
.sf-summary-item:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}
.sfl {
  color: var(--text-muted, #6f8078);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.sfv {
  color: var(--text-strong, #17211d);
  font-size: 13px;
}
.sfv.mono {
  color: var(--text-secondary, #52615b);
  font-family: var(--font-mono, "IBM Plex Mono", "SF Mono", monospace);
  font-size: 12px;
}
.sf-summary-fee {
  color: var(--text-strong, #17211d);
  font-size: 20px;
  font-weight: 700;
}
.sf-summary-status {
  display: grid;
  gap: 4px;
  padding: 9px 12px;
  border-radius: var(--radius-sm, 8px);
  font-size: 12px;
  font-weight: 600;
}
.sf-summary-status.ok {
  background: var(--bg-success-soft, #e9f8ee);
  color: var(--text-success, #137a42);
}
.sf-summary-status.pending {
  background: #fff7ed;
  color: #b45309;
}
.summary-disabled-reason {
  display: block;
  margin-bottom: 8px;
  color: #b45309;
  font-size: 12px;
  line-height: 1.5;
}
.btn-lg {
  min-height: 44px;
  padding: 0 22px;
  font-size: 15px;
  font-weight: 600;
}
</style>
