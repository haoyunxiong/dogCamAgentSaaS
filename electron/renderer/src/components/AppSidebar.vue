<template>
  <aside class="app-sidebar-v2" :class="{ collapsed: ui.sidebarCollapsed }">
    <div class="sb-top">
      <div class="brand-card" :class="{ mini: ui.sidebarCollapsed }">
        <img class="brand-mark" :src="brandDog" alt="小狗相机助手图标" />
        <div v-if="!ui.sidebarCollapsed" class="brand-txt">
          <div class="brand-title">小狗相机助手</div>
          <div class="brand-subtitle">相机租赁运营工作台</div>
        </div>
      </div>
      <div class="sb-nav-scroll">
        <nav class="sb-nav">
          <template v-for="grp in groups" :key="grp.label">
            <div v-if="!ui.sidebarCollapsed" class="sb-group-label">{{ grp.label }}</div>
            <router-link
              v-for="item in grp.items"
              :key="item.to"
              :to="item.to"
              class="nav-item"
              active-class="active"
              :exact="item.exact"
              :title="item.label"
            >
              <span class="nav-ic">
                <component :is="item.icon" class="nav-icon-svg" aria-hidden="true" />
              </span>
              <span v-if="!ui.sidebarCollapsed" class="nav-label">{{ item.label }}</span>
              <span
                v-if="!ui.sidebarCollapsed && item.badgeKey && ui.badges[item.badgeKey] > 0"
                class="nav-badge"
              >{{ ui.badges[item.badgeKey] > 99 ? '99+' : ui.badges[item.badgeKey] }}</span>
              <span
                v-else-if="ui.sidebarCollapsed && item.badgeKey && ui.badges[item.badgeKey] > 0"
                class="nav-badge-dot"
              ></span>
            </router-link>
          </template>
        </nav>
      </div>
    </div>

    <div class="sb-bottom">
      <div v-if="!ui.sidebarCollapsed" class="sb-account">
        <div class="sb-account-main">
          <div class="sb-account-avatar">小</div>
          <div class="sb-account-copy">
            <div class="sb-account-store">成都小狗相机租赁</div>
            <div class="sb-account-role">当前账号 / 店长</div>
          </div>
        </div>
        <div class="sb-account-meta">
          <span>本地运行</span>
          <span v-if="ui.totalPending > 0" class="sb-pending-pill">待办 {{ ui.totalPending > 99 ? '99+' : ui.totalPending }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import {
  BookOpen,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileCheck,
  Flag,
  Home,
  Link2,
  Mail,
  MessageSquareText,
  Package,
  Radar,
  Settings,
  SquarePen,
  Truck,
} from '@lucide/vue'
import brandDog from '../assets/brand-dog.jpg'
import { useUiStore } from '../stores/uiStore'
const ui = useUiStore()

const groups = [
  {
    label: 'UI-V2 Mock',
    items: [
      { to: '/ui-v2', label: 'V2 工作台', icon: Home, exact: true },
      { to: '/ui-v2/orders', label: 'V2 订单中心', icon: Package },
      { to: '/ui-v2/schedule', label: 'V2 档期中心', icon: CalendarDays },
      { to: '/ui-v2/devices', label: 'V2 设备中心', icon: Boxes },
      { to: '/ui-v2/mobile', label: 'V2 手机端', icon: MessageSquareText },
    ],
  },
  {
    label: '核心运营',
    items: [
      { to: '/',         label: '控制台 / 工作台', icon: Home, exact: true },
      { to: '/orders',   label: '订单履约', icon: Package, badgeKey: 'orders' },
      { to: '/schedule', label: '租赁档期', icon: CalendarDays },
      { to: '/devices',  label: '设备管理', icon: Boxes },
      { to: '/sf-shipping', label: '顺丰寄件', icon: Truck },
      { to: '/deposits', label: '免押管理', icon: FileCheck },
    ],
  },
  {
    label: '增长与分析',
    items: [
      { to: '/reports',  label: '报表中心', icon: ChartNoAxesCombined },
      { to: '/inquiries', label: '询单分析', icon: ChartNoAxesCombined },
      { to: '/market', label: '市场监控', icon: Radar },
      { to: '/pricing',  label: '定价', icon: CircleDollarSign },
    ],
  },
  {
    label: '自动化与知识',
    items: [
      { to: '/prompts',   label: '提示词',  icon: SquarePen },
      { to: '/knowledge', label: '知识库',  icon: BookOpen },
      { to: '/takeovers', label: '人工接管', icon: MessageSquareText, badgeKey: 'takeovers' },
      { to: '/pending',   label: '消息审批', icon: Mail, badgeKey: 'pending' },
      { to: '/learning',  label: '学习审核', icon: Flag, badgeKey: 'learning' },
    ],
  },
  {
    label: '系统配置',
    items: [
      { to: '/settings',  label: '设置',    icon: Settings },
      { to: '/item-mapping', label: '商品型号绑定', icon: Link2 },
    ],
  },
]
</script>

<style scoped>
.app-sidebar-v2 {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  max-width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-16, 16px) var(--space-12, 12px) var(--space-12, 12px);
  background:
    radial-gradient(circle at 12% 0%, rgba(0, 168, 137, 0.16), transparent 30%),
    var(--color-bg-sidebar, #06211f);
  color: var(--text-on-dark, #edf3f0);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 1px 0 0 rgba(6, 33, 31, 0.28);
  transition: width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease;
}
.app-sidebar-v2.collapsed {
  width: 72px;
  min-width: 72px;
  max-width: 72px;
  padding: 20px 8px 16px;
}

.sb-top { display: flex; flex-direction: column; gap: var(--space-12, 12px); flex: 1 1 auto; min-height: 0; }
.sb-nav-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.sb-nav-scroll::-webkit-scrollbar { width: 6px; }
.sb-nav-scroll::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.24); border-radius: 3px; }
.sb-nav-scroll::-webkit-scrollbar-thumb:hover { background: rgba(107, 114, 128, 0.42); }

.brand-card {
  display: flex;
  gap: var(--space-12, 12px);
  align-items: center;
  padding: 10px var(--space-12, 12px);
  border-radius: var(--radius-12, 12px);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.brand-card.mini { justify-content: center; padding: 10px; }

.brand-mark {
  width: 36px; height: 36px;
  display: block;
  border-radius: 10px;
  flex: 0 0 auto;
  object-fit: cover;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
}
.brand-title  { font-size: 14px; font-weight: 700; color: #f7fbfa; }
.brand-subtitle { margin-top: 2px; font-size: 11px; color: rgba(231, 243, 241, 0.62); }

.sb-nav { display: flex; flex-direction: column; gap: 2px; }

.sb-group-label {
  margin: 14px 10px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  color: rgba(231, 243, 241, 0.54);
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-8, 8px);
  color: rgba(231, 243, 241, 0.72);
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}
.app-sidebar-v2.collapsed .nav-item {
  justify-content: center;
  padding: 0;
  height: 36px;
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f7fbfa;
  border-color: rgba(255, 255, 255, 0.08);
}
.nav-item.active {
  background: rgba(0, 168, 137, 0.14);
  color: #f7fbfa;
  border-color: rgba(0, 168, 137, 0.18);
}
.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 2px;
  background: var(--color-primary-500, #00a889);
}

.nav-ic {
  width: 22px;
  display: inline-flex;
  justify-content: center;
  color: rgba(231, 243, 241, 0.78);
}
.nav-icon-svg {
  width: 16px;
  height: 16px;
  stroke-width: 2.1;
}
.nav-item.active .nav-ic { color: #99f6e4; }

.nav-label { flex: 1; min-width: 0; }

.nav-badge {
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.16);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.nav-badge-dot {
  position: absolute;
  top: 8px; right: 8px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #fb7185;
  box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.16);
}

.sb-bottom { padding: 8px 4px 0; flex-shrink: 0; }
.sb-account {
  padding: var(--space-12, 12px);
  border-radius: var(--radius-12, 12px);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.sb-account-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sb-account-avatar {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-8, 8px);
  background: var(--color-primary-500, #00a889);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  flex: 0 0 auto;
}
.sb-account-copy {
  min-width: 0;
}
.sb-account-store {
  font-size: 12px;
  font-weight: 700;
  color: #f7fbfa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sb-account-role {
  margin-top: 2px;
  font-size: 11px;
  color: rgba(231, 243, 241, 0.58);
}
.sb-account-meta {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: rgba(231, 243, 241, 0.5);
}
.sb-pending-pill {
  height: 20px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.14);
  color: #fde68a;
  font-weight: 700;
}
</style>
