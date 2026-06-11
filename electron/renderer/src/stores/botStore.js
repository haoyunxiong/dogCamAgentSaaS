import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBotStore = defineStore('bot', () => {
  const running = ref(false)
  const logs = ref([])
  const maxLogs = ref(500)

  function setRunning(val) {
    running.value = val
  }

  function setMaxLogs(val) {
    const parsed = Number(val)
    maxLogs.value = Number.isFinite(parsed) && parsed >= 50 ? Math.floor(parsed) : 500
    if (logs.value.length > maxLogs.value) {
      logs.value.splice(0, logs.value.length - maxLogs.value)
    }
  }

  function addLog(entry) {
    logs.value.push({
      ...entry,
      id: Date.now() + Math.random(),
    })
    if (logs.value.length > maxLogs.value) {
      logs.value.splice(0, logs.value.length - maxLogs.value)
    }
  }

  function clearLogs() {
    logs.value = []
  }

  return { running, logs, maxLogs, setRunning, setMaxLogs, addLog, clearLogs }
})
