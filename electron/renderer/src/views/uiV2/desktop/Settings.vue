<template>
  <UiV2Page title="系统设置" description="全局配置租赁业务相关规则与功能；本页只保存本地演示设置，不写业务数据库。">
    <section class="settings-layout">
      <div class="settings-main">
        <div class="final-panel">
          <div class="final-panel__head">
            <div>
              <h2>系统设置</h2>
              <p>全局配置租赁业务相关规则与功能</p>
            </div>
          </div>
          <div class="settings-list">
            <SettingsCard v-for="item in settings" :key="item.id" :group="item.group" :title="item.title" :desc="item.desc" :status="item.status" :variant="item.variant" @click="selectedId = item.id" />
          </div>
        </div>

        <div class="final-panel">
          <div class="final-panel__head"><div><h2>本地演示上下文</h2><p>最小权限、角色、商户隔离模型</p></div></div>
          <div class="system-info">
            <div><span>当前角色</span><strong>{{ actorRoleLabel }}</strong></div>
            <div><span>操作人</span><strong>{{ actorContext.id }}</strong></div>
            <div><span>商户</span><strong>{{ actorContext.merchantName || actorContext.merchantId }}</strong></div>
            <div><span>门店</span><strong>{{ actorContext.storeName || actorContext.storeId }}</strong></div>
            <div><span>外部真实调用</span><strong class="warn">关闭</strong></div>
          </div>
          <div class="settings-inline-form">
            <BaseSelect v-model="selectedRole" label="切换演示角色" :options="roleOptions" @change="changeRole" />
            <p class="settings-note">只读查看只能浏览；运营员可执行已开放的内部安全操作；店主可执行内部安全操作并查看外部预览。外部真实调用始终关闭。</p>
          </div>
        </div>

        <div class="final-panel">
          <div class="final-panel__head"><div><h2>系统健康 / 上线准备</h2><p>本地健康检查，不触发外部请求</p></div><BaseButton size="sm" variant="secondary" @click="loadHealth">刷新</BaseButton></div>
          <div class="readiness-grid">
            <div v-for="check in healthChecks" :key="check.key" class="readiness-card" :class="`is-${check.status}`">
              <span>{{ check.label }}</span>
              <strong>{{ healthStatusLabel(check.status) }}</strong>
              <small>{{ check.detail }}</small>
            </div>
          </div>
          <div class="settings-checklist">
            <span v-for="item in healthChecklist" :key="item">{{ item }}</span>
          </div>
          <p v-if="healthError" class="settings-note is-error">{{ healthError }}</p>
        </div>

        <div class="final-panel">
          <div class="final-panel__head"><div><h2>系统信息</h2><p>本地演示环境状态</p></div></div>
          <div class="system-info">
            <div><span>演示版本</span><strong>Phase 04 → 06</strong></div>
            <div><span>安全操作</span><strong>{{ healthSafeModeLabel }}</strong></div>
            <div><span>服务状态</span><strong class="ok">{{ healthStatusLabel(healthStatus) }}</strong></div>
            <div><span>自动回滚</span><strong class="warn">未开放</strong></div>
            <div><span>当前环境</span><strong>本地演示</strong></div>
          </div>
        </div>
      </div>

      <aside class="final-panel settings-form">
        <div class="final-panel__head">
          <div>
            <h2>门店设置</h2>
            <p>基础信息、联系信息与营业设置</p>
          </div>
          <BaseButton size="sm" :disabled="!settingsDirty" @click="saveLocalSettings">保存设置</BaseButton>
        </div>
        <div class="final-panel__body form-stack">
          <h3>基础信息</h3>
          <BaseInput v-model="settingsForm.storeName" label="门店名称" />
          <BaseInput v-model="settingsForm.storeCode" label="门店编码" />
          <BaseSelect v-model="settingsForm.storeType" label="门店类型" :options="storeTypeOptions" />
          <BaseSelect v-model="settingsForm.region" label="所属区域" :options="regionOptions" />
          <BaseInput v-model="settingsForm.address" label="详细地址" />
          <h3>联系信息</h3>
          <div class="form-grid">
            <BaseInput v-model="settingsForm.contactName" label="联系人" />
            <BaseInput v-model="settingsForm.contactPhone" label="联系电话" />
            <BaseInput v-model="settingsForm.backupPhone" label="备用电话" />
            <BaseInput v-model="settingsForm.email" label="联系邮箱" />
          </div>
          <h3>营业设置</h3>
          <button type="button" class="toggle-row" :class="{ 'is-on': settingsForm.businessOpen }" @click="settingsForm.businessOpen = !settingsForm.businessOpen"><span>营业状态</span><strong>{{ settingsForm.businessOpen ? '开启' : '关闭' }}</strong><i></i></button>
          <div class="form-grid">
            <BaseInput v-model="settingsForm.openAt" label="开始时间" />
            <BaseInput v-model="settingsForm.closeAt" label="结束时间" />
          </div>
          <button type="button" class="toggle-row" :class="{ 'is-on': settingsForm.weekendOpen }" @click="settingsForm.weekendOpen = !settingsForm.weekendOpen"><span>周末营业</span><strong>{{ settingsForm.weekendOpen ? '开启' : '关闭' }}</strong><i></i></button>
          <p class="settings-note">{{ saveMessage || '配置项只保存到本地浏览器演示状态，不读取或写入真实商家配置。' }}</p>
        </div>
      </aside>
    </section>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import { SettingsCard } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import { actorContextAdapter, getCurrentActorContext } from '../../../adapters/uiV2/actorContextAdapter.js'
import { healthCheckAdapter } from '../../../adapters/uiV2/healthCheckAdapter.js'
import UiV2Page from '../shared/UiV2Page.vue'
import '../shared/uiV2View.css'

const settings = uiV2MockAdapter.getSettings()
const selectedId = ref(settings[0]?.id || '')
const actorContext = ref(actorContextAdapter.getLocalActorContext())
const selectedRole = ref(actorContext.value.role)
const health = ref(null)
const healthError = ref('')
const SETTINGS_STORAGE_KEY = 'ui-v2-local-demo-settings'
const defaultSettingsForm = Object.freeze({
  storeName: '深圳南山店',
  storeCode: 'SZ-NS-001',
  storeType: '直营门店',
  region: '广东省 / 深圳市 / 南山区',
  address: '深圳市南山区科技园南区科苑路8号讯美科技广场B座8楼',
  contactName: '林小姐',
  contactPhone: '138 **** 8899',
  backupPhone: '0755-**** 1234',
  email: 'linxiaoxu@zuling.com',
  businessOpen: true,
  weekendOpen: true,
  openAt: '10:00',
  closeAt: '18:00',
})
const roleOptions = [
  { label: '店主', value: 'owner' },
  { label: '运营员', value: 'operator' },
  { label: '只读查看', value: 'viewer' },
]
const storeTypeOptions = ['直营门店', '加盟门店', '仓储点', '临时展点']
const regionOptions = [
  '广东省 / 深圳市 / 南山区',
  '广东省 / 广州市 / 天河区',
  '上海市 / 上海市 / 徐汇区',
  '北京市 / 北京市 / 朝阳区',
]
const settingsForm = ref(loadLocalSettings())
const savedSettingsSnapshot = ref(JSON.stringify(settingsForm.value))
const saveMessage = ref('')

const healthChecks = computed(() => (Array.isArray(health.value?.checks) ? health.value.checks : []).map((check) => ({
  ...check,
  label: healthCheckLabel(check),
  detail: healthDetailLabel(check),
})))
const healthChecklist = computed(() => Array.isArray(health.value?.checklist) ? health.value.checklist : [])
const healthStatus = computed(() => health.value?.status || 'checking')
const healthSafeMode = computed(() => health.value?.safeOps?.safeMode || 'gated-internal-write')
const healthSafeModeLabel = computed(() => healthSafeModeLabelText(healthSafeMode.value))
const actorRoleLabel = computed(() => actorContext.value?.roleLabel || actorContextAdapter.getRoleLabel(actorContext.value?.role))
const settingsDirty = computed(() => JSON.stringify(settingsForm.value) !== savedSettingsSnapshot.value)

function loadLocalSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return { ...defaultSettingsForm, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return { ...defaultSettingsForm }
  }
}

function saveLocalSettings() {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsForm.value))
    savedSettingsSnapshot.value = JSON.stringify(settingsForm.value)
    saveMessage.value = '设置已保存（本地演示），不会写入业务数据库。'
  } catch {
    saveMessage.value = '本地保存失败；未写入业务数据库。'
  }
}

function healthStatusLabel(status) {
  const labels = {
    ready: '就绪',
    blocked: '已阻断',
    'preview-only': '仅预览',
    checking: '检查中',
    'ready-for-local-demo': '本地演示就绪',
  }
  return labels[String(status || '')] || String(status || '检查中')
}

function healthSafeModeLabelText(mode) {
  const labels = {
    'gated-internal-write': '内部安全写入已门禁开放',
    'dry-run-only': '仅安全预览',
  }
  return labels[String(mode || '')] || String(mode || '内部安全写入已门禁开放')
}

function healthCheckLabel(check = {}) {
  const labels = {
    db: '本地数据库连接',
    db_connection: '本地数据库连接',
    schema_migrations: '迁移记录',
    safeops_tables: '安全操作表',
    external_gateway: '外部真实调用',
    rollback: '自动回滚执行器',
  }
  return labels[check.key] || check.label || '本地检查'
}

function healthDetailLabel(check = {}) {
  const detail = String(check.detail || '')
  if (!detail) return '等待检查结果。'
  return detail
    .replace('Checked through safeOps policy fallback.', '已通过安全策略降级检查。')
    .replace('real mode and external writes must remain disabled.', '真实模式和外部写入保持关闭。')
    .replace('rollback executor unavailable by design.', '自动回滚执行器按设计未开放。')
}

async function loadActorContext() {
  const result = await getCurrentActorContext({ role: selectedRole.value, source: 'settings-page' })
  actorContext.value = result?.current || actorContextAdapter.getLocalActorContext({ role: selectedRole.value })
}

async function loadHealth() {
  healthError.value = ''
  const result = await healthCheckAdapter.getLocalDemoHealthCheck()
  health.value = result
  if (!result?.ok) healthError.value = result?.message || '健康检查返回阻断状态'
}

async function changeRole() {
  actorContext.value = actorContextAdapter.setDemoRole(selectedRole.value)
  await loadActorContext()
  await loadHealth()
}

onMounted(async () => {
  await loadActorContext()
  await loadHealth()
})

watch(settingsForm, () => {
  if (saveMessage.value) saveMessage.value = ''
}, { deep: true })
</script>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 520px;
  gap: 14px;
  align-items: start;
}

.settings-main {
  display: grid;
  gap: 14px;
}

.settings-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 18px;
}

.settings-note {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.settings-note.is-error {
  color: var(--color-danger);
}

.settings-inline-form {
  padding: 0 18px 18px;
  display: grid;
  grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
  gap: 14px;
  align-items: end;
}

.system-info {
  padding: 18px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
}

.system-info div {
  display: grid;
  gap: 6px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.system-info strong {
  color: var(--ui-text);
  font-size: 14px;
}

.system-info .ok {
  color: var(--color-status-success);
}

.system-info .warn {
  color: var(--color-status-warning);
}

.readiness-grid {
  padding: 18px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.readiness-card {
  min-height: 112px;
  padding: 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-8);
  background: var(--ui-surface);
  display: grid;
  gap: 6px;
}

.readiness-card span {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 720;
}

.readiness-card strong {
  color: var(--ui-text);
  font-size: 16px;
}

.readiness-card small {
  color: var(--ui-text-muted);
  line-height: 1.5;
}

.readiness-card.is-ready {
  border-color: var(--brand-primary-border);
  background: rgba(232, 247, 243, 0.72);
}

.readiness-card.is-blocked {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.78);
}

.readiness-card.is-preview-only {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(255, 251, 235, 0.78);
}

.settings-checklist {
  padding: 0 18px 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settings-checklist span {
  min-height: 24px;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 720;
}

.settings-form {
  position: sticky;
  top: 76px;
}

.form-stack {
  display: grid;
  gap: 14px;
}

.form-stack h3 {
  margin: 0;
  color: var(--ui-text);
  font-size: 14px;
  font-weight: 850;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.toggle-row {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.toggle-row strong {
  margin-left: auto;
  color: var(--ui-text);
}

.toggle-row i {
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: #d0d5dd;
  position: relative;
  transition: background 140ms ease;
}

.toggle-row i::after {
  content: "";
  position: absolute;
  top: 3px;
  right: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 140ms ease;
}

.toggle-row.is-on i {
  background: var(--ui-brand);
}

.toggle-row:not(.is-on) i::after {
  transform: translateX(-16px);
}

@media (max-width: 1380px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-form {
    position: static;
  }

  .settings-inline-form,
  .readiness-grid {
    grid-template-columns: 1fr;
  }
}
</style>
