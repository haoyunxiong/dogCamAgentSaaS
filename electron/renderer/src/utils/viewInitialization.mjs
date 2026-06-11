export function describeViewError(error, fallbackMessage = '页面加载失败，请稍后重试') {
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error?.message && String(error.message).trim()) return String(error.message).trim()
  return fallbackMessage
}

export function logViewError(scope, error) {
  console.error(`[renderer] ${scope}`, error)
}

export async function runViewInitialization(scope, task, options = {}) {
  const {
    fallbackMessage = '页面加载失败，请稍后重试',
    toastMessage = `${scope}加载失败`,
    onError,
  } = options

  try {
    return await task()
  } catch (error) {
    const message = describeViewError(error, fallbackMessage)
    logViewError(scope, error)
    onError?.(message, error)
    if (toastMessage) {
      window.$toast?.(toastMessage, 'error')
    }
    return null
  }
}

let globalHandlersInstalled = false

export function installGlobalRendererErrorHandlers() {
  if (globalHandlersInstalled || typeof window === 'undefined') return
  globalHandlersInstalled = true

  window.addEventListener('unhandledrejection', (event) => {
    logViewError('unhandledrejection', event.reason)
  })

  window.addEventListener('error', (event) => {
    logViewError('window.error', event.error || event.message)
  })
}
