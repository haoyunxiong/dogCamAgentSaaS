export const settingsGroups = [
  {
    id: 'merchant',
    group: '组织',
    title: '商家信息',
    status: '已配置',
    desc: '商家名称、联系人、经营主体和默认仓库。',
    enabled: true,
    fields: [
      { label: '商家名称', value: '小狗相机助手商户版' },
      { label: '默认仓库', value: '深圳总仓' },
      { label: '运营负责人', value: '阿宁' }
    ],
    note: '商户资料用于统一默认展示名称、联系人和仓库选择。'
  },
  {
    id: 'stores',
    group: '组织',
    title: '门店与仓库',
    status: '已配置',
    desc: '门店、仓库、发货地址和归还地址。',
    enabled: true,
    fields: [
      { label: '门店数量', value: '3' },
      { label: '默认发货地', value: '深圳总仓' },
      { label: '合作仓', value: '杭州合作仓' }
    ],
    note: '默认地址用于发货、归还和门店筛选的展示联动。'
  },
  {
    id: 'staff',
    group: '权限',
    title: '员工角色',
    status: '需处理',
    desc: '员工账号、角色、操作范围和交接班。',
    enabled: false,
    fields: [
      { label: '员工数量', value: '12' },
      { label: '待确认角色', value: '2' },
      { label: '默认角色', value: '履约运营' }
    ],
    note: '员工角色用于区分履约、客服、店长和管理入口。'
  },
  {
    id: 'logistics',
    group: '履约',
    title: '物流设置',
    status: '已配置',
    desc: '顺丰寄件模板、保价规则、发货备注。',
    enabled: true,
    fields: [
      { label: '默认承运商', value: '顺丰速运' },
      { label: '默认保价', value: '按押金取高值' },
      { label: '揽收窗口', value: '16:00-20:00' }
    ],
    note: '物流模板用于统一发货备注、保价策略和揽收偏好。'
  },
  {
    id: 'deposit',
    group: '风控',
    title: '押金/免押规则',
    status: '未配置',
    desc: '押金标准、免押审核、人工复核条件。',
    enabled: false,
    fields: [
      { label: '押金规则', value: '按型号模板' },
      { label: '免押策略', value: '待确认' },
      { label: '人工复核', value: '开启' }
    ],
    note: '免押规则用于提示审核重点和人工复核条件。'
  },
  {
    id: 'notify',
    group: '触达',
    title: '通知模板',
    status: '需处理',
    desc: '发货、归还、逾期和验机通知模板。',
    enabled: true,
    fields: [
      { label: '发货模板', value: '已配置' },
      { label: '逾期模板', value: '需处理' },
      { label: '验机模板', value: '未配置' }
    ],
    note: '后续员工 SOP 阶段再展开模板和话术。'
  }
]
