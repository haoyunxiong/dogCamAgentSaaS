export function hasElectronApi(win = globalThis.window) {
  return Boolean(win && win.electronAPI)
}

export function isBrowserPreview(win = globalThis.window) {
  return !hasElectronApi(win)
}
