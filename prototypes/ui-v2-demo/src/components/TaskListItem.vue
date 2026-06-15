<template>
  <button :class="['task-item', `priority-${task.priority}`]" type="button" @click="$emit('click', task)">
    <span :class="['priority', task.priority]" />
    <span class="task-main">
      <strong>{{ task.title }}</strong>
      <small>{{ task.type }} · {{ task.orderId }} · {{ task.dueAt }}</small>
    </span>
    <span class="task-action">{{ task.actionLabel }}</span>
  </button>
</template>

<script setup>
defineProps({
  task: { type: Object, required: true }
})

defineEmits(['click'])
</script>

<style scoped>
.task-item {
  width: 100%;
  padding: 11px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  text-align: left;
}

.task-item:hover {
  background: rgba(255, 255, 255, 0.62);
  border-color: var(--border);
}

.priority-high {
  background: rgba(248, 232, 229, 0.56);
}

.priority {
  width: 6px;
  height: 28px;
  border-radius: 999px;
  background: var(--border-strong);
}

.priority.high { background: var(--danger); }
.priority.medium { background: var(--warning); }
.priority.low { background: var(--info); }

.task-main {
  min-width: 0;
}

.task-main strong,
.task-main small {
  display: block;
}

.task-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 13px;
}

.task-main small {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 12px;
}

.task-action {
  color: var(--brand);
  font-size: 12px;
  font-weight: 760;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--brand-soft);
}
</style>
