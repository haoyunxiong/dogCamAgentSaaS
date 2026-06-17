<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="" subtitle="" tone="light">
        <template #actions>
          <span class="mine-bell">12</span>
          <span class="mine-setting">设</span>
        </template>
      </MobileAppBar>
      <section class="company-card">
        <div class="company-logo">租</div>
        <div>
          <strong>深圳优租科技有限公司</strong>
          <span>当前门店：深圳南山店⌄</span>
          <p>普通会员</p>
        </div>
        <b>›</b>
      </section>

      <section class="menu-card">
        <RouterLink v-for="item in menuItems.slice(0, 4)" :key="item.title" :to="item.to">
          <span>{{ item.icon }}</span>
          <div><strong>{{ item.title }}</strong><small>{{ item.desc }}</small></div>
          <b>›</b>
        </RouterLink>
      </section>

      <section class="menu-card">
        <RouterLink v-for="item in menuItems.slice(4)" :key="item.title" :to="item.to">
          <span>{{ item.icon }}</span>
          <div><strong>{{ item.title }}</strong><small>{{ item.desc }}</small></div>
          <b>›</b>
        </RouterLink>
      </section>

      <section class="ui-v2-mobile-card">
        <h2>更多工具</h2>
        <div class="tool-grid">
          <RouterLink v-for="tool in tools" :key="tool.title" :to="tool.to">
            <span>{{ tool.icon }}</span>
            <strong>{{ tool.title }}</strong>
          </RouterLink>
        </div>
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import { MobileAppBar, MobileShell } from '../../../components/mobile'
import '../shared/uiV2View.css'

const menuItems = [
  { title: '门店与账号', desc: '门店信息、员工管理、角色权限', icon: '店', to: '/ui-v2/settings' },
  { title: '客户管理', desc: '客户列表、客户标签、客户分组', icon: '客', to: '/ui-v2/customers' },
  { title: '资金中心', desc: '账户余额、收支明细、发票管理', icon: '资', to: '/ui-v2/reports' },
  { title: '经营报表', desc: '经营数据、账单统计、报表导出', icon: '报', to: '/ui-v2/reports' },
  { title: '系统设置', desc: '基础设置、功能设置、打印设置', icon: '设', to: '/ui-v2/settings' },
  { title: '消息中心', desc: '系统消息、业务通知、提醒设置', icon: '消', to: '/ui-v2/mobile/orders' },
  { title: '帮助与反馈', desc: '使用帮助、常见问题、意见反馈', icon: '帮', to: '/ui-v2/mobile' },
]
const tools = [
  { title: '设备管理', icon: '设', to: '/ui-v2/mobile/devices' },
  { title: '租赁商品', icon: '商', to: '/ui-v2/devices' },
  { title: '调拨管理', icon: '调', to: '/ui-v2/schedule' },
  { title: '库存管理', icon: '库', to: '/ui-v2/devices' },
  { title: '财务中心', icon: '财', to: '/ui-v2/reports' },
  { title: '电子合同', icon: '合', to: '/ui-v2/orders' },
  { title: '优惠券', icon: '券', to: '/ui-v2/orders' },
  { title: '数据报表', icon: '数', to: '/ui-v2/reports' },
]
</script>

<style scoped>
.mine-bell,
.mine-setting {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #fff;
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 850;
}
.mine-bell {
  position: relative;
  color: #fff;
  background: var(--color-danger);
}
.company-card {
  min-height: 148px;
  padding: 20px;
  border-radius: 16px;
  background:
    radial-gradient(circle at 100% 0%, rgba(20, 184, 166, 0.3), transparent 36%),
    linear-gradient(135deg, #007f6d, #075e54);
  color: #fff;
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
}
.company-logo {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ui-brand);
  font-size: 24px;
  font-weight: 900;
}
.company-card strong,
.company-card span,
.company-card p {
  display: block;
}
.company-card strong {
  font-size: 19px;
}
.company-card span {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 13px;
}
.company-card p {
  width: max-content;
  margin: 10px 0 0;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
}
.menu-card {
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(16, 24, 40, 0.045);
}
.menu-card a {
  min-height: 76px;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #edf1f5;
}
.menu-card a:last-child {
  border-bottom: 0;
}
.menu-card a > span,
.tool-grid span {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--ui-brand-soft);
  color: var(--ui-brand);
  font-weight: 900;
}
.menu-card strong,
.menu-card small {
  display: block;
}
.menu-card strong {
  color: var(--ui-text);
  font-size: 16px;
}
.menu-card small {
  margin-top: 4px;
  color: var(--ui-text-muted);
  font-size: 12px;
}
.tool-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px 8px;
}
.tool-grid a {
  min-height: 76px;
  display: grid;
  gap: 8px;
  place-items: center;
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 820;
}
</style>
