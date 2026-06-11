<template>
  <div class="click-date-input" :class="{ disabled }" @click="openPicker">
    <input
      ref="inputRef"
      class="click-date-control"
      :value="modelValue || ''"
      :min="min"
      :max="max"
      :disabled="disabled"
      :placeholder="placeholder"
      type="date"
      @input="handleInput"
      @click.stop="openPicker"
      @focus="openPicker"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  min: { type: String, default: '' },
  max: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const inputRef = ref(null)

function handleInput(event) {
  emit('update:modelValue', event.target.value || '')
}

function openPicker() {
  if (props.disabled) return
  const input = inputRef.value
  if (!input) return
  input.focus({ preventScroll: true })
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
    } catch {
      // Some Chromium builds block repeated calls from the same event.
    }
  }
}
</script>

<style scoped>
.click-date-input {
  width: 100%;
  cursor: pointer;
}

.click-date-input.disabled {
  cursor: not-allowed;
}

.click-date-control {
  width: 100%;
  cursor: pointer;
}
</style>
