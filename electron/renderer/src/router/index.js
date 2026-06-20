import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Settings from '../views/Settings.vue'
import Prompts from '../views/Prompts.vue'
import KnowledgeBase from '../views/KnowledgeBase.vue'
import TakeoverBoard from '../views/rental/TakeoverBoard.vue'
import ScheduleCalendar from '../views/rental/ScheduleCalendar.vue'
import OrderFulfillment from '../views/rental/OrderFulfillment.vue'
import DeviceManagement from '../views/rental/DeviceManagement.vue'
import LearningReview from '../views/rental/LearningReview.vue'
import FeishuPending from '../views/rental/FeishuPending.vue'
import Reports from '../views/rental/Reports.vue'
import MarketMonitor from '../views/rental/MarketMonitor.vue'
import Pricing from '../views/rental/Pricing.vue'
import ItemModelMapping from '../views/rental/ItemModelMapping.vue'
import InquiryAnalytics from '../views/rental/InquiryAnalytics.vue'
import SfShippingWorkbench from '../views/rental/SfShippingWorkbench.vue'
import DepositManagement from '../views/rental/DepositManagement.vue'
import UiV2Dashboard from '../views/uiV2/desktop/Dashboard.vue'
import UiV2Orders from '../views/uiV2/desktop/Orders.vue'
import UiV2Schedule from '../views/uiV2/desktop/Schedule.vue'
import UiV2Devices from '../views/uiV2/desktop/Devices.vue'
import UiV2Customers from '../views/uiV2/desktop/Customers.vue'
import UiV2Deposit from '../views/uiV2/desktop/Deposit.vue'
import UiV2Logistics from '../views/uiV2/desktop/Logistics.vue'
import UiV2Reports from '../views/uiV2/desktop/Reports.vue'
import UiV2Settings from '../views/uiV2/desktop/Settings.vue'
import UiV2MobileHome from '../views/uiV2/mobile/MobileHome.vue'
import UiV2MobileOrders from '../views/uiV2/mobile/MobileOrders.vue'
import UiV2MobileOrderDetail from '../views/uiV2/mobile/MobileOrderDetail.vue'
import UiV2MobileSchedule from '../views/uiV2/mobile/MobileSchedule.vue'
import UiV2MobileDevices from '../views/uiV2/mobile/MobileDevices.vue'
import UiV2MobileMine from '../views/uiV2/mobile/MobileMine.vue'

const routes = [
  { path: '/', component: Dashboard },
  { path: '/settings', component: Settings },
  { path: '/prompts', component: Prompts },
  { path: '/knowledge', component: KnowledgeBase },
  { path: '/takeovers', component: TakeoverBoard },
  { path: '/devices', component: DeviceManagement },
  { path: '/schedule', component: ScheduleCalendar },
  { path: '/orders', component: OrderFulfillment },
  { path: '/learning', component: LearningReview },
  { path: '/pending', component: FeishuPending },
  { path: '/reports', component: Reports },
  { path: '/inquiries', component: InquiryAnalytics },
  { path: '/market', component: MarketMonitor },
  { path: '/pricing', component: Pricing },
  { path: '/item-mapping', component: ItemModelMapping },
  { path: '/sf-shipping', component: SfShippingWorkbench },
  { path: '/deposits', component: DepositManagement },
  { path: '/ui-v2', component: UiV2Dashboard, meta: { uiV2: true } },
  { path: '/ui-v2/dashboard', component: UiV2Dashboard, meta: { uiV2: true } },
  { path: '/ui-v2/orders', component: UiV2Orders, meta: { uiV2: true } },
  { path: '/ui-v2/schedule', component: UiV2Schedule, meta: { uiV2: true } },
  { path: '/ui-v2/devices', component: UiV2Devices, meta: { uiV2: true } },
  { path: '/ui-v2/customers', component: UiV2Customers, meta: { uiV2: true } },
  { path: '/ui-v2/deposit', component: UiV2Deposit, meta: { uiV2: true } },
  { path: '/ui-v2/logistics', component: UiV2Logistics, meta: { uiV2: true } },
  { path: '/ui-v2/reports', component: UiV2Reports, meta: { uiV2: true } },
  { path: '/ui-v2/settings', component: UiV2Settings, meta: { uiV2: true } },
  { path: '/ui-v2/mobile', component: UiV2MobileHome, meta: { uiV2: true, uiV2Mobile: true } },
  { path: '/ui-v2/mobile/orders', component: UiV2MobileOrders, meta: { uiV2: true, uiV2Mobile: true } },
  { path: '/ui-v2/mobile/orders/:id', component: UiV2MobileOrderDetail, meta: { uiV2: true, uiV2Mobile: true } },
  { path: '/ui-v2/mobile/schedule', component: UiV2MobileSchedule, meta: { uiV2: true, uiV2Mobile: true } },
  { path: '/ui-v2/mobile/devices', component: UiV2MobileDevices, meta: { uiV2: true, uiV2Mobile: true } },
  { path: '/ui-v2/mobile/mine', component: UiV2MobileMine, meta: { uiV2: true, uiV2Mobile: true } },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
