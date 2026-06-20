const ADAPTER_MODE_KEY = 'ui-v2-adapter-mode'
const VALID_ADAPTER_MODES = new Set(['mock', 'real', 'auto'])
let memoryMode = ''

export function normalizeUiV2AdapterMode(mode) {
  return VALID_ADAPTER_MODES.has(mode) ? mode : 'auto'
}

export function isUiV2PreviewMode() {
  return import.meta.env?.VITE_UI_V2_RENDERER_PREVIEW === 'true'
}

export function hasUiV2RuntimeBridge() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
}

function getStoredMode() {
  if (memoryMode) return memoryMode
  if (typeof window === 'undefined') return ''

  try {
    return window.localStorage.getItem(ADAPTER_MODE_KEY) || ''
  } catch {
    return ''
  }
}

export function getUiV2AdapterMode() {
  return normalizeUiV2AdapterMode(getStoredMode() || 'auto')
}

export function setUiV2AdapterMode(mode) {
  const nextMode = normalizeUiV2AdapterMode(mode)
  memoryMode = nextMode

  try {
    window.localStorage.setItem(ADAPTER_MODE_KEY, nextMode)
  } catch {
    // Runtime storage is optional for renderer previews and tests.
  }

  return nextMode
}
