/**
 * 设备价值查询服务
 * 从设备管理（schedule_units）中查找设备残值 / 买入价，
 * 用于免押单创建时的押金默认值。
 *
 * 查找优先级：
 * 1. 通过 IPC 获取真实设备数据，按 unit_code 精确匹配
 * 2. 按 model_code 查找同型号任意设备的价值
 * 3. 降级使用 mock 数据
 * 4. 返回 null（调用方显示"请手动填写"）
 */

// Mock 设备数据 —— 当 IPC 不可用或数据库无数据时降级使用
// 仅覆盖已知设备，未知设备返回 null
const MOCK_DEVICES = [
  { unit_code: 'acepro2-01', model_code: 'acepro2', purchase_cost: 2500 },
  { unit_code: 'acepro2-02', model_code: 'acepro2', purchase_cost: 2500 },
  { unit_code: 'acepro2-03', model_code: 'acepro2', purchase_cost: 2500 },
  { unit_code: 'acepro2-04', model_code: 'acepro2', purchase_cost: 2500 },
  { unit_code: 'acepro2-05', model_code: 'acepro2', purchase_cost: 2500 },
  { unit_code: 'gopro12-01', model_code: 'gopro12', purchase_cost: 1800 },
  { unit_code: 'gopro12-02', model_code: 'gopro12', purchase_cost: 1800 },
  { unit_code: 'gopro12-03', model_code: 'gopro12', purchase_cost: 1800 },
  { unit_code: 'dji-m4p-01', model_code: 'dji-m4p', purchase_cost: 3500 },
  { unit_code: 'dji-m4p-02', model_code: 'dji-m4p', purchase_cost: 3500 },
  { unit_code: 'insta360-x4-01', model_code: 'insta360-x4', purchase_cost: 2200 },
  { unit_code: 'insta360-x4-02', model_code: 'insta360-x4', purchase_cost: 2200 },
  { unit_code: 'insta360-x4-03', model_code: 'insta360-x4', purchase_cost: 2200 },
  { unit_code: 'insta360-oneRS-01', model_code: 'insta360-oneRS', purchase_cost: 1500 },
  { unit_code: 'insta360-oneRS-02', model_code: 'insta360-oneRS', purchase_cost: 1500 },
]

// 型号默认价值（精确匹配不到具体设备时使用）
const MOCK_MODEL_DEFAULTS = {}
for (const d of MOCK_DEVICES) {
  if (!MOCK_MODEL_DEFAULTS[d.model_code]) {
    MOCK_MODEL_DEFAULTS[d.model_code] = d.purchase_cost
  }
}

/**
 * 查找设备价值
 * @param {string|null|undefined} unitCode - 设备编号 (unit_code)
 * @param {string|null|undefined} modelCode - 型号编码 (model_code)
 * @returns {Promise<number|null>} residual_value / purchase_cost 数值，查不到返回 null
 */
export async function lookupDeviceValue(unitCode, modelCode) {
  // 优先尝试 IPC 获取真实设备数据
  try {
    if (window.electronAPI?.listScheduleUnits) {
      const units = await window.electronAPI.listScheduleUnits({ activeInventoryOnly: true })
      if (Array.isArray(units) && units.length > 0) {
        // 按 unit_code 精确匹配，优先残值，缺失时退回买入价
        if (unitCode) {
          const match = units.find(
            (u) => u.unit_code === unitCode && Number(u.residual_value || u.purchase_cost) > 0,
          )
          if (match) return Number(match.residual_value || match.purchase_cost)
        }
        // 按 model_code 找同型号任意设备，优先残值
        if (modelCode) {
          const match = units.find(
            (u) => u.model_code === modelCode && Number(u.residual_value || u.purchase_cost) > 0,
          )
          if (match) return Number(match.residual_value || match.purchase_cost)
        }
      }
    }
  } catch (e) {
    console.warn('[deviceLookup] IPC 查询设备价值失败，降级使用 mock 数据:', e)
  }

  // 降级：mock 数据
  if (unitCode) {
    const device = MOCK_DEVICES.find((d) => d.unit_code === unitCode)
    if (device) return device.purchase_cost
  }
  if (modelCode) {
    if (MOCK_MODEL_DEFAULTS[modelCode] != null) return MOCK_MODEL_DEFAULTS[modelCode]
    const device = MOCK_DEVICES.find((d) => d.model_code === modelCode)
    if (device) return device.purchase_cost
  }

  return null
}
