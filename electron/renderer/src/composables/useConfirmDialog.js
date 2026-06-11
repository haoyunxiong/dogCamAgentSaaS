import { reactive } from 'vue'

const defaultOptions = {
  title: '确认操作',
  message: '',
  details: [],
  confirmText: '确认',
  cancelText: '取消',
  danger: false,
  loading: false,
}

const state = reactive({
  open: false,
  ...defaultOptions,
})

let activeResolver = null

function normalizeDetails(details) {
  if (Array.isArray(details)) return details.filter(Boolean).map(String)
  if (details) return [String(details)]
  return []
}

function resetState() {
  Object.assign(state, {
    open: false,
    ...defaultOptions,
  })
}

function resolveConfirm(value) {
  const resolver = activeResolver
  activeResolver = null
  resetState()
  if (resolver) resolver(Boolean(value))
}

function close() {
  resolveConfirm(false)
}

function confirm(options = {}) {
  if (activeResolver) {
    resolveConfirm(false)
  }

  Object.assign(state, {
    ...defaultOptions,
    ...options,
    details: normalizeDetails(options.details),
    open: true,
  })

  return new Promise((resolve) => {
    activeResolver = resolve
  })
}

export function useConfirmDialog() {
  return {
    state,
    confirm,
    close,
    resolveConfirm,
  }
}
