export function hasElectronApi(win = globalThis.window) {
  return Boolean(win && win.electronAPI)
}

export function isBrowserPreview(win = globalThis.window) {
  return !hasElectronApi(win)
}

export function isUiV2RendererPreview() {
  return import.meta.env.VITE_UI_V2_RENDERER_PREVIEW === 'true'
}
