<template>
  <MobileShell>
    <div class="mobile-page">
      <header class="mine-card">
        <div class="avatar">运营</div>
        <div>
          <h1>阿宁</h1>
          <p>深圳总仓 · 履约运营</p>
        </div>
      </header>

      <section class="info-block">
        <h2>商家信息</h2>
        <div class="info-row"><span>商家</span><strong>小狗相机助手商户版</strong></div>
        <div class="info-row"><span>门店</span><strong>深圳总仓 / 广州门店 / 杭州合作仓</strong></div>
      </section>

      <section class="menu-list">
        <RouterLink v-for="item in items" :key="item.title" :to="item.to">
          <span>{{ item.title }}</span>
          <small>{{ item.desc }}</small>
        </RouterLink>
      </section>

      <section class="demo-note">
        <BaseBadge label="UI-V2 Demo" tone="info" />
        <p>当前移动端只使用 mock 数据，用于验证一线运营工作台体验。</p>
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import MobileShell from '../../components/MobileShell.vue'
import BaseBadge from '../../components/BaseBadge.vue'

const items = [
  { title: '门店入口', desc: '查看仓库与门店信息', to: '/mobile/mine' },
  { title: '设置入口', desc: '物流、押金、通知模板', to: '/mobile/mine' },
  { title: '员工入口', desc: '角色和操作范围', to: '/mobile/mine' },
  { title: '切换到 PC 工作台', desc: '打开完整管理后台', to: '/' }
]
</script>

<style scoped>
.mobile-page {
  display: grid;
  gap: 12px;
}

.mine-card,
.info-block,
.menu-list,
.demo-note {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.mine-card {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--ink);
  color: #fff;
  font-weight: 800;
}

.mine-card h1 {
  margin: 0 0 3px;
  font-size: 22px;
}

.mine-card p,
.demo-note p {
  margin: 0;
  color: var(--text-muted);
}

.info-block {
  display: grid;
  gap: 9px;
}

.info-block h2 {
  margin: 0;
  font-size: 15px;
}

.info-row {
  display: grid;
  gap: 3px;
}

.info-row span {
  color: var(--text-muted);
  font-size: 12px;
}

.menu-list {
  display: grid;
  padding: 0 14px;
}

.menu-list a {
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
  display: grid;
  gap: 3px;
}

.menu-list a:last-child {
  border-bottom: 0;
}

.menu-list span {
  font-weight: 760;
}

.menu-list small {
  color: var(--text-muted);
}

.demo-note {
  display: grid;
  gap: 8px;
}
</style>
