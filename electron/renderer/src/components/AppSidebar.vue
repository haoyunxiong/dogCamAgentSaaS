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
      <div v-if="!ui.sidebarCollapsed" class="sb-hint">
        <div class="sb-hint-head">
          <span class="sb-hint-title">待办总览</span>
          <span class="sb-hint-count">{{ ui.totalPending }}</span>
        </div>
        <div class="sb-hint-txt">接管、审批、学习审核会在这里统一汇总。</div>
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
    label: '工作台',
    items: [
      { to: '/', label: '控制台', icon: Home, exact: true },
    ],
  },
  {
    label: '订单与履约',
    items: [
      { to: '/orders',   label: '订单履约', icon: Package, badgeKey: 'orders' },
      { to: '/sf-shipping', label: '顺丰寄件', icon: Truck },
      { to: '/deposits', label: '免押管理', icon: FileCheck },
      { to: '/devices',  label: '设备管理', icon: Boxes },
      { to: '/schedule', label: '租赁档期', icon: CalendarDays },
      { to: '/pricing',  label: '租赁定价', icon: CircleDollarSign },
    ],
  },
  {
    label: '会话协同',
    items: [
      { to: '/takeovers', label: '人工接管', icon: MessageSquareText, badgeKey: 'takeovers' },
      { to: '/pending',   label: '消息审批', icon: Mail, badgeKey: 'pending' },
      { to: '/learning',  label: '学习审核', icon: Flag, badgeKey: 'learning' },
    ],
  },
  {
    label: '数据与运营',
    items: [
      { to: '/inquiries', label: '询单分析', icon: ChartNoAxesCombined },
      { to: '/item-mapping', label: '商品型号绑定', icon: Link2 },
      { to: '/reports',  label: '报表中心', icon: ChartNoAxesCombined },
      { to: '/market', label: '市场监控', icon: Radar },
    ],
  },
  {
    label: '系统设置',
    items: [
      { to: '/settings',  label: '设置',    icon: Settings },
      { to: '/prompts',   label: '提示词',  icon: SquarePen },
      { to: '/knowledge', label: '知识库',  icon: BookOpen },
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
  padding: 14px 10px 12px;
  background: #0f172a;
  color: var(--text-on-dark);
  border-right: 1px solid rgba(148, 163, 184, 0.08);
  transition: width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease;
}
.app-sidebar-v2.collapsed {
  width: 72px;
  min-width: 72px;
  max-width: 72px;
  padding: 20px 8px 16px;
}

.sb-top { display: flex; flex-direction: column; gap: 12px; flex: 1 1 auto; min-height: 0; }
.sb-nav-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.sb-nav-scroll::-webkit-scrollbar { width: 6px; }
.sb-nav-scroll::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.24); border-radius: 3px; }
.sb-nav-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.4); }

.brand-card {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.brand-card.mini { justify-content: center; padding: 10px; }

.brand-mark {
  width: 36px; height: 36px;
  display: block;
  border-radius: 10px;
  flex: 0 0 auto;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.brand-title  { font-size: 14px; font-weight: 700; color: #f8fafc; }
.brand-subtitle { margin-top: 2px; font-size: 11px; color: rgba(226, 232, 240, 0.66); }

.sb-nav { display: flex; flex-direction: column; gap: 2px; }

.sb-group-label {
  margin: 12px 10px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(203, 213, 225, 0.72);
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  color: rgba(226, 232, 240, 0.72);
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid transparent;
}
.app-sidebar-v2.collapsed .nav-item {
  justify-content: center;
  padding: 0;
  height: 36px;
}
.nav-item:hover {
  background: rgba(148, 163, 184, 0.1);
  color: #e2e8f0;
}
.nav-item.active {
  background: rgba(20, 184, 166, 0.10);
  color: #f1f5f9;
  border-color: rgba(20, 184, 166, 0.12);
}
.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 2px;
  background: var(--brand-primary, #14b8a6);
}

.nav-ic {
  width: 22px;
  display: inline-flex;
  justify-content: center;
  color: rgba(226, 232, 240, 0.82);
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
  background: rgba(248, 113, 113, 0.18);
  border: 1px solid rgba(248, 113, 113, 0.22);
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
  box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.15);
}

.sb-bottom { padding: 8px 4px 0; flex-shrink: 0; }
.sb-hint {
  padding: 9px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.sb-hint-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sb-hint-title {
  font-size: 12px;
  font-weight: 700;
  color: rgba(226, 232, 240, 0.9);
}
.sb-hint-count {
  min-width: 24px;
  height: 20px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(20, 184, 166, 0.18);
  color: #99f6e4;
  font-size: 11px;
  font-weight: 800;
}
.sb-hint-txt {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(226, 232, 240, 0.6);
}
</style>
