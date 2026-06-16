<template>
  <label class="base-input" :class="[`base-input--${size}`, { 'is-error': hasError, 'is-disabled': disabled, 'is-search': search }]">
    <span v-if="label" class="base-input__label">{{ label }}</span>
    <span class="base-input__control">
      <span v-if="$slots.prefix || prefixIcon || search" class="base-input__affix" aria-hidden="true">
        <slot name="prefix">{{ search ? 'search' : prefixIcon }}</slot>
      </span>
      <input
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        class="base-input__native"
        @input="emit('update:modelValue', $event.target.value)"
        @change="emit('change', $event)"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
      >
      <button
        v-if="clearable && modelValue && !disabled"
        type="button"
        class="base-input__clear"
        aria-label="清空"
        @click="clear"
      >
        x
      </button>
      <span v-else-if="$slots.suffix || suffixIcon" class="base-input__affix" aria-hidden="true">
        <slot name="suffix">{{ suffixIcon }}</slot>
      </span>
    </span>
    <span v-if="hasError" class="base-input__message">{{ errorMessage }}</span>
    <span v-else-if="hint" class="base-input__hint">{{ hint }}</span>
  </label>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  error: { type: [Boolean, String], default: false },
  hint: { type: String, default: '' },
  type: { type: String, default: 'text' },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  prefixIcon: { type: String, default: '' },
  suffixIcon: { type: String, default: '' },
  search: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
  autocomplete: { type: String, default: 'off' },
})

const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur', 'clear'])

const hasError = computed(() => Boolean(props.error))
const errorMessage = computed(() => typeof props.error === 'string' ? props.error : '请输入有效内容')

function clear() {
  emit('update:modelValue', '')
  emit('clear')
}
</script>

<style scoped>
.base-input {
  display: grid;
  gap: var(--space-token-4, 4px);
  color: var(--color-text-secondary, #4b5563);
}

.base-input__label {
  font-size: 13px;
  font-weight: 600;
}

.base-input__control {
  display: flex;
  align-items: center;
  min-height: 40px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-8, 8px);
  background: var(--color-surface, #fff);
  transition: border-color var(--duration-fast, 100ms) var(--ease-standard, ease),
              box-shadow var(--duration-fast, 100ms) var(--ease-standard, ease),
              background var(--duration-fast, 100ms) var(--ease-standard, ease);
}

.base-input--sm .base-input__control { min-height: 32px; border-radius: var(--radius-4, 4px); }
.base-input--lg .base-input__control { min-height: 44px; }

.base-input__native {
  min-width: 0;
  width: 100%;
  min-height: 0;
  padding: 0 var(--space-12, 12px);
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: var(--color-text, #111827);
  outline: none;
  box-shadow: none;
}

.base-input__native:hover,
.base-input__native:focus {
  border: 0;
  box-shadow: none;
  background: transparent;
}

.base-input__native::placeholder {
  color: var(--color-text-faint, #9ca3af);
}

.base-input__affix,
.base-input__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 32px;
  color: var(--color-text-muted, #6b7280);
  font-size: 12px;
}

.base-input__clear {
  height: 28px;
  margin-right: 4px;
  border-radius: var(--radius-4, 4px);
  background: transparent;
}

.base-input__clear:hover {
  background: var(--bg-subtle, #f3f4f6);
}

.base-input:focus-within .base-input__control {
  border-color: var(--color-primary, #007f6d);
  box-shadow: 0 0 0 3px rgba(0, 127, 109, 0.12);
}

.base-input.is-error .base-input__control {
  border-color: var(--color-danger, #dc2626);
}

.base-input.is-error:focus-within .base-input__control {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
}

.base-input.is-disabled {
  opacity: 0.58;
}

.base-input.is-disabled .base-input__control {
  background: var(--bg-subtle, #f3f4f6);
}

.base-input__message,
.base-input__hint {
  font-size: 12px;
  line-height: 1.4;
}

.base-input__message {
  color: var(--color-danger, #dc2626);
}

.base-input__hint {
  color: var(--color-text-muted, #6b7280);
}
</style>
