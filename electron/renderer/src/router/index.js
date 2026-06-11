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
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
