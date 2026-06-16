<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="我的" subtitle="员工信息、商家信息和低频工具入口" status-label="Demo" status-variant="info" />
      <section class="profile-card">
        <div class="avatar">小</div>
        <div>
          <strong>阿宁</strong>
          <span>店长 / 深圳总仓</span>
          <p>小狗相机助手商户版 · UI-V2 Mock</p>
        </div>
      </section>
      <section class="ui-v2-mobile-card">
        <h2>商家信息</h2>
        <div class="info-row"><span>商家</span><strong>小狗相机助手商户版</strong></div>
        <div class="info-row"><span>门店</span><strong>深圳总仓 / 广州门店 / 杭州合作仓</strong></div>
        <div class="info-row"><span>运行模式</span><strong>Mock UI，无真实接口</strong></div>
      </section>
      <section class="tool-grid">
        <RouterLink to="/ui-v2/settings">设置中心</RouterLink>
        <RouterLink to="/ui-v2/logistics">物流发货</RouterLink>
        <RouterLink to="/ui-v2/deposit">免押管理</RouterLink>
        <RouterLink to="/ui-v2/reports">经营报表</RouterLink>
      </section>
      <section class="ui-v2-mobile-card">
        <h2>Demo 说明</h2>
        <p>该移动端只展示 UI-V2 mock 体验，不读取 Electron 真实业务数据，不连接 Python、数据库或真实接口。</p>
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import { MobileAppBar, MobileShell } from '../../../components/mobile'
import '../shared/uiV2View.css'
</script>

<style scoped>
.profile-card {
  padding: var(--space-16);
  border-radius: var(--radius-16);
  background: var(--color-primary-900);
  color: #fff;
  display: flex;
  gap: var(--space-12);
}
.avatar {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-12);
  background: rgba(255, 255, 255, 0.16);
  font-weight: 800;
}
.profile-card strong,
.profile-card span {
  display: block;
}
.profile-card span,
.profile-card p {
  color: #c9deda;
  font-size: 12px;
}
.profile-card p {
  margin: var(--space-token-4) 0 0;
}
.info-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
  padding: 8px 0;
  color: var(--ui-text-muted);
  font-size: 13px;
}
.info-row strong {
  color: var(--ui-text);
  text-align: right;
}
.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-token-8);
}
.tool-grid a {
  min-height: 74px;
  display: grid;
  place-items: center;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  color: var(--ui-brand);
  font-weight: 760;
}
</style>
