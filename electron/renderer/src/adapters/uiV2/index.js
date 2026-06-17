export {
  createUiV2AdapterMeta,
  createUiV2MockAdapter,
  UI_V2_ADAPTER_METHODS,
  uiV2MockAdapter,
} from './mockAdapter.js'
export { createUiV2RealAdapter, UiV2RealAdapterNotImplementedError } from './realAdapter.js'
export {
  getUiV2AdapterMode,
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
  normalizeUiV2AdapterMode,
  setUiV2AdapterMode,
} from './mode.js'
export { createUiV2Adapter } from './fallback.js'

import { createUiV2Adapter } from './fallback.js'

export const uiV2Adapter = createUiV2Adapter()
