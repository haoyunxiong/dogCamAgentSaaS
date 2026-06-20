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

export function isUiV2MockOverrideAllowed() {
  return isUiV2PreviewMode() || import.meta.env?.VITE_UI_V2_ALLOW_MOCK_OVERRIDE === 'true'
}

export function getDefaultUiV2AdapterMode() {
  if (isUiV2PreviewMode()) return 'mock'
  return 'real'
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
  const defaultMode = getDefaultUiV2AdapterMode()
  const storedMode = getStoredMode()
  if (!storedMode) return defaultMode

  const normalizedMode = normalizeUiV2AdapterMode(storedMode)
  if (normalizedMode === 'auto') return defaultMode
  if (normalizedMode === 'mock' && !isUiV2MockOverrideAllowed()) return defaultMode
  return normalizedMode
}

export function setUiV2AdapterMode(mode) {
  const requestedMode = normalizeUiV2AdapterMode(mode)
  const nextMode = requestedMode === 'mock' && !isUiV2MockOverrideAllowed()
    ? getDefaultUiV2AdapterMode()
    : requestedMode
  memoryMode = nextMode

  try {
    window.localStorage.setItem(ADAPTER_MODE_KEY, nextMode)
  } catch {
    // Runtime storage is optional for renderer previews and tests.
  }

  return nextMode
}
