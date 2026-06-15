<template>
  <MobileShell>
    <div class="mobile-page">
      <header class="merchant-card">
        <div class="avatar">运营</div>
        <div>
          <span>我的 / 商家中心</span>
          <h1>小狗相机助手商户版</h1>
          <p>阿宁 · 履约运营</p>
        </div>
      </header>

      <section class="store-card">
        <div>
          <span>当前门店</span>
          <strong>深圳总仓</strong>
          <p>今日发货 9 单 · 待归还 7 单 · 风险 5 项</p>
        </div>
        <StatusTag label="已启用" />
      </section>

      <section class="tool-grid">
        <RouterLink v-for="tool in tools" :key="tool.title" :to="tool.to">
          <strong>{{ tool.title }}</strong>
          <span>{{ tool.desc }}</span>
        </RouterLink>
      </section>

      <section class="settings-group" v-for="group in settingGroups" :key="group.title">
        <h2>{{ group.title }}</h2>
        <RouterLink v-for="item in group.items" :key="item.title" :to="item.to" class="setting-row">
          <div>
            <strong>{{ item.title }}</strong>
            <span>{{ item.desc }}</span>
          </div>
          <StatusTag :label="item.status" />
        </RouterLink>
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import MobileShell from '../../components/MobileShell.vue'
import StatusTag from '../../components/StatusTag.vue'

const tools = [
  { title: '切到 PC', desc: '完整管理后台', to: '/' },
  { title: '门店', desc: '仓库与地址', to: '/mobile/mine' },
  { title: '员工', desc: '角色与交接', to: '/mobile/mine' },
  { title: '帮助', desc: 'SOP 与说明', to: '/mobile/mine' }
]

const settingGroups = [
  {
    title: '低频入口',
    items: [
      { title: '物流设置', desc: '承运商、保价和揽收窗口', status: '已配置', to: '/mobile/mine' },
      { title: '押金/免押规则', desc: '规则只做 UI 展示', status: '未配置', to: '/mobile/mine' }
    ]
  },
  {
    title: '设置组',
    items: [
      { title: '通知模板', desc: '发货、归还、逾期提醒', status: '需处理', to: '/mobile/mine' },
      { title: '商家资料', desc: '经营主体和负责人', status: '已配置', to: '/mobile/mine' }
    ]
  }
]
</script>

<style scoped>
.mobile-page {
  display: grid;
  gap: var(--space-12);
}

.merchant-card,
.store-card,
.tool-grid,
.settings-group {
  padding: var(--space-14, 14px);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  box-shadow: var(--shadow-subtle);
}

.merchant-card {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.avatar {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-12);
  background: var(--ink);
  color: var(--color-text-inverse);
  font-weight: 800;
}

.merchant-card span,
.store-card span,
.tool-grid span,
.setting-row span {
  color: var(--text-muted);
  font-size: var(--font-caption-size);
}

.merchant-card h1 {
  margin: var(--space-4) 0 2px;
  font-size: 18px;
  line-height: var(--font-mobile-card-title-line);
}

.merchant-card p,
.store-card p {
  margin: 0;
  color: var(--text-muted);
}

.store-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-12);
}

.store-card strong {
  display: block;
  margin: var(--space-4) 0;
  font-size: var(--font-mobile-card-title-size);
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-8);
}

.tool-grid a {
  min-height: 74px;
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  display: grid;
  align-content: center;
  gap: var(--space-4);
  background: var(--surface-soft);
}

.settings-group {
  display: grid;
  gap: var(--space-8);
}

.settings-group h2 {
  margin: 0;
  font-size: var(--font-mobile-card-title-size);
}

.setting-row {
  padding: var(--space-12) 0;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}

.setting-row strong {
  display: block;
  margin-bottom: 2px;
}
</style>
