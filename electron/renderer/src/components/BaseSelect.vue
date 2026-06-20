<template>
  <label class="base-select" :class="[`base-select--${size}`, { 'is-error': hasError, 'is-disabled': disabled }]">
    <span v-if="label" class="base-select__label">{{ label }}</span>
    <span class="base-select__control">
      <select
        class="base-select__native"
        :value="modelValue"
        :aria-label="label || placeholder || '选择项'"
        :disabled="disabled"
        @change="handleChange"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option
          v-for="option in normalizedOptions"
          :key="String(option.value)"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>
      <span class="base-select__chevron" aria-hidden="true">⌄</span>
    </span>
    <span v-if="hasError" class="base-select__message">{{ errorMessage }}</span>
    <span v-else-if="hint" class="base-select__hint">{{ hint }}</span>
  </label>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  label: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  error: { type: [Boolean, String], default: false },
  hint: { type: String, default: '' },
  optionLabel: { type: String, default: 'label' },
  optionValue: { type: String, default: 'value' },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
})

const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur'])

const normalizedOptions = computed(() => props.options.map((option) => {
  if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
    return { label: String(option), value: option, disabled: false }
  }
  return {
    label: option?.[props.optionLabel] ?? option?.label ?? '',
    value: option?.[props.optionValue] ?? option?.value ?? '',
    disabled: Boolean(option?.disabled),
  }
}))

const hasError = computed(() => Boolean(props.error))
const errorMessage = computed(() => typeof props.error === 'string' ? props.error : '请选择有效选项')

function handleChange(event) {
  emit('update:modelValue', event.target.value)
  emit('change', event)
}
</script>

<style scoped>
.base-select {
  display: grid;
  gap: var(--space-token-4, 4px);
  color: var(--color-text-secondary, #4b5563);
}

.base-select__label {
  font-size: 13px;
  font-weight: 600;
}

.base-select__control {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 40px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-8, 8px);
  background: var(--color-surface, #fff);
  transition: border-color var(--duration-fast, 100ms) var(--ease-standard, ease),
              box-shadow var(--duration-fast, 100ms) var(--ease-standard, ease);
}

.base-select--sm .base-select__control { min-height: 32px; border-radius: var(--radius-4, 4px); }
.base-select--lg .base-select__control { min-height: 44px; }

.base-select__native {
  width: 100%;
  min-height: 0;
  padding: 0 34px 0 var(--space-12, 12px);
  border: 0;
  border-radius: inherit;
  appearance: none;
  background: transparent;
  color: var(--color-text, #111827);
  outline: none;
  box-shadow: none;
}

.base-select__native:hover,
.base-select__native:focus {
  border: 0;
  box-shadow: none;
  background: transparent;
}

.base-select__chevron {
  position: absolute;
  right: var(--space-12, 12px);
  color: var(--color-text-muted, #6b7280);
  font-size: 11px;
  pointer-events: none;
}

.base-select:focus-within .base-select__control {
  border-color: var(--color-primary, #007f6d);
  box-shadow: 0 0 0 3px rgba(0, 127, 109, 0.12);
}

.base-select.is-error .base-select__control {
  border-color: var(--color-danger, #dc2626);
}

.base-select.is-error:focus-within .base-select__control {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
}

.base-select.is-disabled {
  opacity: 0.58;
}

.base-select.is-disabled .base-select__control {
  background: var(--bg-subtle, #f3f4f6);
}

.base-select__message,
.base-select__hint {
  font-size: 12px;
  line-height: 1.4;
}

.base-select__message {
  color: var(--color-danger, #dc2626);
}

.base-select__hint {
  color: var(--color-text-muted, #6b7280);
}
</style>
