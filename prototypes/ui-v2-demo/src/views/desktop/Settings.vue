<template>
  <AppShell>
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">设置中心</h1>
          <p class="page-desc">Demo 只展示设置结构和配置状态，不展开复杂配置逻辑。</p>
        </div>
      </header>

      <section class="settings-layout">
        <aside class="settings-nav">
          <button
            v-for="item in settings"
            :key="item.title"
            :class="{ active: active.title === item.title }"
            type="button"
            @click="active = item"
          >
            <span>{{ item.group }}</span>
            <strong>{{ item.title }}</strong>
            <BaseBadge :label="item.status" :tone="statusTone(item.status)" />
          </button>
        </aside>

        <main class="settings-detail">
          <div class="detail-head">
            <div>
              <BaseBadge :label="active.status" :tone="statusTone(active.status)" />
              <h2>{{ active.title }}</h2>
              <p>{{ active.desc }}</p>
            </div>
            <BaseButton variant="secondary">Demo 暂不展开</BaseButton>
          </div>

          <section class="config-summary">
            <div v-for="row in active.summary" :key="row.label">
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <h3 class="section-title">配置说明</h3>
              <BaseBadge label="Mock" tone="info" />
            </div>
            <div class="panel-body setting-note">
              {{ active.note }}
            </div>
          </section>
        </main>
      </section>
    </div>
  </AppShell>
</template>

<script setup>
import { ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import BaseBadge from '../../components/BaseBadge.vue'
import BaseButton from '../../components/BaseButton.vue'

const settings = [
  {
    group: '组织',
    title: '商家信息',
    status: '已配置',
    desc: '商家名称、联系人、经营主体和默认仓库。',
    note: '正式系统中这里会承载商户基础资料和多门店隔离配置。',
    summary: [{ label: '商家名称', value: '小狗相机助手商户版' }, { label: '默认仓库', value: '深圳总仓' }, { label: '联系人', value: '阿宁' }]
  },
  {
    group: '组织',
    title: '门店',
    status: '已配置',
    desc: '门店、仓库、发货地址和归还地址。',
    note: 'Demo 只展示门店入口，暂不进入地址编辑。',
    summary: [{ label: '门店数量', value: '3' }, { label: '默认发货地', value: '深圳总仓' }, { label: '合作仓', value: '杭州合作仓' }]
  },
  {
    group: '权限',
    title: '员工',
    status: '需处理',
    desc: '员工账号、角色、操作范围和交接班。',
    note: '后续 SaaS 底座阶段再实现真实权限系统。',
    summary: [{ label: '员工数量', value: '12' }, { label: '待确认角色', value: '2' }, { label: '默认角色', value: '履约运营' }]
  },
  {
    group: '履约',
    title: '物流设置',
    status: '已配置',
    desc: '顺丰寄件模板、保价规则、发货备注。',
    note: '当前只做 mock 顺丰寄件，不调用真实 API。',
    summary: [{ label: '默认承运商', value: '顺丰速运' }, { label: '默认保价', value: '按押金取高值' }, { label: '揽收窗口', value: '16:00-20:00' }]
  },
  {
    group: '风控',
    title: '押金/免押规则',
    status: '未配置',
    desc: '押金标准、免押审核、人工复核条件。',
    note: '这里只验证入口和状态，不落真实规则引擎。',
    summary: [{ label: '押金规则', value: '按型号模板' }, { label: '免押策略', value: '待确认' }, { label: '人工复核', value: '开启' }]
  },
  {
    group: '触达',
    title: '通知模板',
    status: '需处理',
    desc: '发货、归还、逾期和验机通知模板。',
    note: '后续员工 SOP 阶段再展开模板和话术。',
    summary: [{ label: '发货模板', value: '已配置' }, { label: '逾期模板', value: '需处理' }, { label: '验机模板', value: '未配置' }]
  }
]

const active = ref(settings[0])

function statusTone(status) {
  return { 已配置: 'success', 未配置: 'neutral', 需处理: 'warning' }[status] || 'neutral'
}
</script>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 14px;
}

.settings-nav {
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(251, 251, 250, 0.82);
  display: grid;
  align-content: start;
  gap: 4px;
}

.settings-nav button {
  min-height: 76px;
  padding: 11px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  display: grid;
  gap: 5px;
}

.settings-nav button.active {
  border-color: #abcfc7;
  background: var(--brand-soft);
}

.settings-nav span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 760;
}

.settings-nav strong {
  font-size: 14px;
}

.settings-detail {
  min-height: 620px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(251, 251, 250, 0.9);
  display: grid;
  align-content: start;
  gap: 16px;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.detail-head h2 {
  margin: 12px 0 5px;
  font-size: 26px;
}

.detail-head p {
  margin: 0;
  color: var(--text-soft);
}

.config-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.config-summary div {
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}

.config-summary span,
.config-summary strong {
  display: block;
}

.config-summary span {
  color: var(--text-muted);
  font-size: 12px;
}

.config-summary strong {
  margin-top: 5px;
  font-size: 16px;
}

.setting-note {
  color: var(--text-soft);
  min-height: 110px;
}

@media (max-width: 1080px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
}
</style>
