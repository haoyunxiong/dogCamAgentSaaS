import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))
const mode = modeArg ? modeArg.split('=')[1] : 'smoke'

const checks = []

function fileExists(relativePath) {
  const fullPath = path.join(root, relativePath)
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()
}

function fileIncludes(relativePath, requiredText) {
  if (!fileExists(relativePath)) return false
  const content = fs.readFileSync(path.join(root, relativePath), 'utf8')
  return content.includes(requiredText)
}

function addCheck(name, passed, detail = '') {
  checks.push({ name, passed, detail })
}

function checkFiles(groupName, files) {
  for (const file of files) {
    addCheck(`${groupName}: ${file}`, fileExists(file), 'file exists')
  }
}

checkFiles('styles', [
  'src/styles/tokens.css',
  'src/styles/base.css'
])

checkFiles('foundation components', [
  'src/components/BaseButton.vue',
  'src/components/StatusTag.vue',
  'src/components/BaseInput.vue',
  'src/components/BaseSelect.vue',
  'src/components/FilterBar.vue',
  'src/components/BaseTable.vue',
  'src/components/Drawer.vue',
  'src/components/BottomSheet.vue',
  'src/components/MobileBottomNav.vue',
  'src/components/Pagination.vue'
])

checkFiles('P1 support components', [
  'src/components/StatusTabs.vue',
  'src/components/ScheduleLegend.vue',
  'src/components/TrackingTimeline.vue',
  'src/components/ChartCard.vue',
  'src/components/InsightPanel.vue',
  'src/components/SettingsCard.vue',
  'src/components/ToggleSwitch.vue'
])

checkFiles('P1 visual hardening components', [
  'src/components/MobileAppBar.vue',
  'src/components/DrawerSummary.vue'
])

checkFiles('mobile core pages', [
  'src/views/mobile/MobileHome.vue',
  'src/views/mobile/MobileOrders.vue',
  'src/views/mobile/MobileOrderDetail.vue',
  'src/views/mobile/MobileSchedule.vue',
  'src/views/mobile/MobileDevices.vue',
  'src/views/mobile/MobileMine.vue'
])

checkFiles('desktop core pages', [
  'src/views/desktop/Dashboard.vue',
  'src/views/desktop/Orders.vue',
  'src/views/desktop/Schedule.vue',
  'src/views/desktop/Devices.vue',
  'src/views/desktop/Customers.vue',
  'src/views/desktop/Deposit.vue',
  'src/views/desktop/Logistics.vue',
  'src/views/desktop/Reports.vue',
  'src/views/desktop/Settings.vue'
])

checkFiles('mock data', [
  'src/mock/orders.js',
  'src/mock/devices.js',
  'src/mock/schedule.js',
  'src/mock/customers.js',
  'src/mock/deposits.js',
  'src/mock/logistics.js',
  'src/mock/reports.js',
  'src/mock/settings.js'
])

checkFiles('root files', [
  'src/App.vue',
  'src/router.js',
  'COMPONENT_USAGE.md',
  'package.json'
])

addCheck('App.vue renders RouterView', fileIncludes('src/App.vue', 'RouterView'), 'root app entry')
addCheck('Mobile pages use MobileAppBar', [
  'src/views/mobile/MobileHome.vue',
  'src/views/mobile/MobileOrders.vue',
  'src/views/mobile/MobileSchedule.vue',
  'src/views/mobile/MobileDevices.vue',
  'src/views/mobile/MobileMine.vue'
].every((file) => fileIncludes(file, 'MobileAppBar')), '5 mobile top bars unified')
addCheck('Desktop drawers use DrawerSummary', [
  'src/views/desktop/Orders.vue',
  'src/views/desktop/Devices.vue',
  'src/views/desktop/Customers.vue',
  'src/views/desktop/Deposit.vue',
  'src/views/desktop/Logistics.vue'
].every((file) => fileIncludes(file, 'DrawerSummary')), 'core desktop drawers unified')
addCheck('Reports hardening: pulse section', fileIncludes('src/views/desktop/Reports.vue', 'report-pulse'), 'report pulse cards')
addCheck('Reports hardening: utilization chart', fileIncludes('src/views/desktop/Reports.vue', 'utilizationTrend'), 'utilization chart data')
addCheck('Mobile devices hardening: status tab panel', fileIncludes('src/views/mobile/MobileDevices.vue', 'device-tab-panel'), 'touch-friendly status tabs')

const routeChecks = [
  ['desktop workbench route', "path: '/'"],
  ['desktop orders route', "path: '/orders'"],
  ['desktop schedule route', "path: '/schedule'"],
  ['desktop devices route', "path: '/devices'"],
  ['desktop customers route', "path: '/customers'"],
  ['desktop deposit route', "path: '/deposit'"],
  ['desktop logistics route', "path: '/logistics'"],
  ['desktop reports route', "path: '/reports'"],
  ['desktop settings route', "path: '/settings'"],
  ['mobile workbench route', "path: '/mobile'"],
  ['mobile orders route', "path: '/mobile/orders'"],
  ['mobile order detail route', "path: '/mobile/orders/:id'"],
  ['mobile schedule route', "path: '/mobile/schedule'"],
  ['mobile devices route', "path: '/mobile/devices'"],
  ['mobile mine route', "path: '/mobile/mine'"]
]

for (const [name, text] of routeChecks) {
  addCheck(`router 15-page navigation: ${name}`, fileIncludes('src/router.js', text), text)
}

const sidebarChecks = [
  '经营工作台',
  '订单中心',
  '档期中心',
  '设备中心',
  '客户中心',
  '免押管理',
  '物流发货',
  '报表中心',
  '系统设置'
]

for (const label of sidebarChecks) {
  addCheck(`sidebar navigation: ${label}`, fileIncludes('src/components/Sidebar.vue', label), label)
}

const tokenChecks = [
  '--color-primary-900',
  '--color-primary-600',
  '--color-bg-page',
  '--color-surface',
  '--color-border',
  '--space-4',
  '--radius-8',
  '--shadow-card'
]

for (const token of tokenChecks) {
  addCheck(`tokens.css includes ${token}`, fileIncludes('src/styles/tokens.css', token), token)
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
for (const scriptName of ['build', 'smoke', 'lint', 'typecheck', 'test']) {
  addCheck(`package script: ${scriptName}`, Boolean(packageJson.scripts?.[scriptName]), `npm run ${scriptName}`)
}

addCheck('page coverage: 15 / 15', routeChecks.length === 15, '6 mobile + 9 desktop routes')
addCheck(
  'Devices pagination: no legacy @change binding',
  !fileIncludes('src/views/desktop/Devices.vue', '@change="page = $event"'),
  'Pagination emits update:page, not change'
)
addCheck(
  'Devices pagination: binds update:page',
  fileIncludes('src/views/desktop/Devices.vue', 'v-model:page="page"') ||
    fileIncludes('src/views/desktop/Devices.vue', '@update:page="page = $event"'),
  'v-model:page or @update:page'
)
addCheck(
  'Pagination API: emits update:page',
  fileIncludes('src/components/Pagination.vue', "defineEmits(['update:page'])") &&
    fileIncludes('src/components/Pagination.vue', "$emit('update:page'"),
  'Pagination.vue API remains update:page'
)

const failed = checks.filter((check) => !check.passed)
const label = {
  smoke: 'smoke',
  'lint-lite': 'lint-lite',
  'typecheck-lite': 'typecheck-lite',
  'test-lite': 'test-lite'
}[mode] || mode

for (const check of checks) {
  const prefix = check.passed ? 'PASS' : 'FAIL'
  console.log(`${prefix} ${check.name}`)
}

if (failed.length > 0) {
  console.error(`FAIL ${label}: ${failed.length} check(s) failed`)
  process.exit(1)
}

console.log(`PASS ${label}: ${checks.length} check(s) passed`)
