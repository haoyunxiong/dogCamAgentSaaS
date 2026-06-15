import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from './views/desktop/Dashboard.vue'
import Orders from './views/desktop/Orders.vue'
import Schedule from './views/desktop/Schedule.vue'
import Devices from './views/desktop/Devices.vue'
import Customers from './views/desktop/Customers.vue'
import Deposit from './views/desktop/Deposit.vue'
import Logistics from './views/desktop/Logistics.vue'
import Reports from './views/desktop/Reports.vue'
import Settings from './views/desktop/Settings.vue'
import MobileHome from './views/mobile/MobileHome.vue'
import MobileOrders from './views/mobile/MobileOrders.vue'
import MobileOrderDetail from './views/mobile/MobileOrderDetail.vue'
import MobileSchedule from './views/mobile/MobileSchedule.vue'
import MobileDevices from './views/mobile/MobileDevices.vue'
import MobileMine from './views/mobile/MobileMine.vue'

const routes = [
  { path: '/', component: Dashboard, meta: { title: '经营工作台' } },
  { path: '/orders', component: Orders, meta: { title: '订单中心' } },
  { path: '/schedule', component: Schedule, meta: { title: '档期中心' } },
  { path: '/devices', component: Devices, meta: { title: '设备中心' } },
  { path: '/customers', component: Customers, meta: { title: '客户中心' } },
  { path: '/deposit', component: Deposit, meta: { title: '免押管理' } },
  { path: '/logistics', component: Logistics, meta: { title: '物流发货' } },
  { path: '/reports', component: Reports, meta: { title: '报表中心' } },
  { path: '/settings', component: Settings, meta: { title: '系统设置' } },
  { path: '/mobile', component: MobileHome, meta: { title: '今日工作台' } },
  { path: '/mobile/orders', component: MobileOrders, meta: { title: '订单列表' } },
  { path: '/mobile/orders/:id', component: MobileOrderDetail, meta: { title: '订单详情' } },
  { path: '/mobile/schedule', component: MobileSchedule, meta: { title: '档期查询' } },
  { path: '/mobile/devices', component: MobileDevices, meta: { title: '设备快查' } },
  { path: '/mobile/mine', component: MobileMine, meta: { title: '我的' } }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
