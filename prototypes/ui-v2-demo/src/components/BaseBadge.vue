<template>
  <StatusTag :label="label" :tone="tone">
    <slot>{{ label }}</slot>
  </StatusTag>
</template>

<script setup>
import StatusTag from './StatusTag.vue'

defineProps({
  label: { type: String, default: '' },
  tone: { type: String, default: 'neutral' }
})
</script>
