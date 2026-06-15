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

checkFiles('P0 pages', [
  'src/views/mobile/MobileHome.vue',
  'src/views/mobile/MobileOrders.vue',
  'src/views/mobile/MobileOrderDetail.vue',
  'src/views/desktop/Dashboard.vue',
  'src/views/desktop/Orders.vue'
])

checkFiles('root files', [
  'src/App.vue',
  'src/router.js',
  'COMPONENT_USAGE.md',
  'package.json'
])

addCheck('App.vue renders RouterView', fileIncludes('src/App.vue', 'RouterView'), 'root app entry')

const routeChecks = [
  ['desktop workbench route', "path: '/'"],
  ['desktop orders route', "path: '/orders'"],
  ['mobile workbench route', "path: '/mobile'"],
  ['mobile orders route', "path: '/mobile/orders'"],
  ['mobile order detail route', "path: '/mobile/orders/:id'"]
]

for (const [name, text] of routeChecks) {
  addCheck(`router P0 navigation: ${name}`, fileIncludes('src/router.js', text), text)
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
