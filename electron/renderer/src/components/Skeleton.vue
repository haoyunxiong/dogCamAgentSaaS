<template>
  <div
    class="skeleton-wrap"
    :class="[`skeleton-wrap--${variant}`, { 'is-static': !animated }]"
    :style="{ gap: gap + 'px' }"
    aria-hidden="true"
  >
    <div
      v-for="(w, i) in widths"
      :key="i"
      class="skeleton-bar"
      :style="{ width: w, height: height + 'px', borderRadius: rounded + 'px' }"
    ></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  rows: { type: Number, default: 3 },
  height: { type: Number, default: 14 },
  gap: { type: Number, default: 10 },
  rounded: { type: Number, default: 6 },
  // optional explicit width array like ['80%', '60%']
  widths: { type: Array, default: null },
  variant: { type: String, default: 'text' }, // text | block | avatar | card | table
  animated: { type: Boolean, default: true },
})

const widths = computed(() => {
  if (props.widths) return props.widths
  if (props.variant === 'block') return Array(props.rows).fill('100%')
  if (props.variant === 'card') return ['42%', '100%', '88%', '64%']
  if (props.variant === 'table') return Array(props.rows).fill('100%')
  if (props.variant === 'avatar') return ['40px']
  // Decreasing width pattern for text blocks
  const pattern = ['100%', '92%', '78%', '85%', '60%']
  return Array.from({ length: props.rows }, (_, i) => pattern[i % pattern.length])
})
</script>

<style scoped>
.skeleton-wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.skeleton-wrap--avatar {
  width: 40px;
}
.skeleton-bar {
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.12) 0%,
    rgba(148, 163, 184, 0.22) 50%,
    rgba(148, 163, 184, 0.12) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}
.skeleton-wrap--avatar .skeleton-bar {
  border-radius: 50% !important;
  height: 40px !important;
}
.skeleton-wrap--table .skeleton-bar {
  height: 36px !important;
}
.is-static .skeleton-bar {
  animation: none;
  background: rgba(148, 163, 184, 0.14);
}
@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
