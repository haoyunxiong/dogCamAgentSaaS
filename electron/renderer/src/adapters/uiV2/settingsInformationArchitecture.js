export const SETTINGS_MODULES = Object.freeze([
  {
    id: 'merchant-store',
    group: '业务配置',
    title: '商户与门店',
    desc: '门店名称、区域、类型、联系信息和营业状态。',
    status: '可编辑',
    variant: 'success',
    kind: 'store',
  },
  {
    id: 'staff-permission',
    group: '权限',
    title: '员工与权限',
    desc: '本地 Demo 角色切换与权限说明。',
    status: '演示模式',
    variant: 'info',
    kind: 'staff',
  },
  {
    id: 'logistics-sf',
    group: '外部服务',
    title: '物流与顺丰',
    desc: '顺丰真实配置、时效测试和真实下单开关。',
    status: '本地测试配置',
    variant: 'warning',
    kind: 'logistics',
  },
  {
    id: 'deposit',
    group: '风控',
    title: '押金与免押',
    desc: '免押接口配置、连接校验和真实创建/完结开关。',
    status: '本地测试配置',
    variant: 'warning',
    kind: 'deposit',
  },
  {
    id: 'xianyu-xgj',
    group: '业务接入',
    title: '闲鱼/闲管家',
    desc: '闲管家配置状态、Cookie/Session 状态和同步开关。',
    status: '写同步关闭',
    variant: 'warning',
    kind: 'xianyu',
  },
  {
    id: 'notification',
    group: '运营',
    title: '通知模板',
    desc: '发货、归还、异常提醒模板占位，不自动发送。',
    status: '本地草案',
    variant: 'neutral',
    kind: 'notify',
  },
  {
    id: 'external-credentials',
    group: '安全',
    title: '外部接口状态',
    desc: '配置完整度、当前模式、最近测试和最近错误。',
    status: '脱敏展示',
    variant: 'warning',
    kind: 'externalStatus',
  },
  {
    id: 'system-health',
    group: '系统',
    title: '系统健康',
    desc: 'DB、migration、safeOps、external gateway、rollback 状态。',
    status: '只读检查',
    variant: 'info',
    kind: 'health',
  },
])

export function getSettingsModules() {
  return SETTINGS_MODULES.map((item) => ({ ...item }))
}

export function findSettingsModule(moduleId) {
  return SETTINGS_MODULES.find((item) => item.id === moduleId) || SETTINGS_MODULES[0]
}

export function buildCredentialStatusRows(configOverview = {}) {
  const groups = configOverview?.externalCredentials || configOverview?.config?.credentialGroups || configOverview?.credentialGroups || []
  if (Array.isArray(groups) && groups.length) {
    return groups.map((group) => ({
      provider: group.provider || group.key || 'unknown',
      label: group.label || group.provider || '外部接口',
      configuredCount: Number(group.configuredCount || 0),
      totalCount: Number(group.totalCount || group.total || 0),
      status: Number(group.configuredCount || 0) > 0 ? '已配置' : '未配置',
    }))
  }
  const configured = Number(configOverview?.config?.sensitiveConfiguredCount || 0)
  const total = Number(configOverview?.config?.sensitiveCount || 0)
  return [
    { provider: 'sf_express', label: '顺丰', configuredCount: configured, totalCount: total, status: configured > 0 ? '已配置' : '未配置' },
    { provider: 'deposit_service', label: '免押服务', configuredCount: 0, totalCount: 0, status: '未配置' },
    { provider: 'xianyu_platform', label: '闲鱼', configuredCount: 0, totalCount: 0, status: '未配置' },
  ]
}
