<template>
  <UiV2Page title="系统设置" description="商户、权限、物流、免押、通知、凭证和健康检查按模块管理。">
    <template #actions>
      <BaseButton variant="secondary" :loading="loading" @click="loadSettings">刷新</BaseButton>
      <BaseButton :disabled="selectedModule.kind !== 'store' || saving" :loading="saving" @click="saveStore">保存门店</BaseButton>
    </template>

    <section class="settings-shell">
      <aside class="settings-nav">
        <SettingsCard
          v-for="item in modules"
          :key="item.id"
          :group="item.group"
          :title="item.title"
          :desc="item.desc"
          :status="moduleStatus(item)"
          :variant="item.variant"
          :active="selectedId === item.id"
          :test-id="`settings-module-${item.id}`"
          @click="selectModule(item.id)"
        />
      </aside>

      <main class="settings-content">
        <div class="final-panel">
          <div class="final-panel__head">
            <div>
              <h2>{{ selectedModule.title }}</h2>
              <p>{{ selectedModule.desc }}</p>
            </div>
            <StatusBadge :label="moduleStatus(selectedModule)" size="sm" />
          </div>
          <div class="final-panel__body">
            <section v-if="selectedModule.kind === 'store'" class="settings-section">
              <div class="settings-form-grid">
                <BaseSelect v-model="storeForm.defaultStoreId" label="默认门店" :options="storeOptions" />
                <BaseInput v-model="storeForm.storeName" label="门店名称" />
                <BaseInput v-model="storeForm.storeCode" label="门店编码" disabled hint="本轮不变更门店编码。" />
                <BaseSelect v-model="storeForm.storeType" label="门店类型" :options="storeTypeOptions" />
                <BaseSelect v-model="storeForm.region" label="区域" :options="regionOptions" />
                <BaseInput v-model="storeForm.contactName" label="联系人" />
                <BaseInput v-model="storeForm.contactPhone" label="联系电话" placeholder="可留空；保存后仅作本地业务配置" />
                <BaseInput v-model="storeForm.email" label="联系邮箱" />
              </div>
              <div class="settings-toggle-row">
                <button type="button" :class="{ 'is-on': storeForm.businessOpen }" @click="storeForm.businessOpen = !storeForm.businessOpen">
                  <span>营业状态</span><strong>{{ storeForm.businessOpen ? '营业中' : '已关闭' }}</strong>
                </button>
                <button type="button" :class="{ 'is-on': storeForm.weekendOpen }" @click="storeForm.weekendOpen = !storeForm.weekendOpen">
                  <span>周末营业</span><strong>{{ storeForm.weekendOpen ? '开启' : '关闭' }}</strong>
                </button>
              </div>
              <p class="settings-note">保存只更新门店与非敏感配置；不会调用顺丰、免押或闲鱼。</p>
            </section>

            <section v-else-if="selectedModule.kind === 'staff'" class="settings-section">
              <div class="settings-form-grid is-narrow">
                <BaseSelect v-model="selectedRole" label="当前 Demo 角色" :options="roleOptions" @change="changeRole" />
              </div>
              <div class="settings-info-grid">
                <div v-for="role in roleMatrix" :key="role.role">
                  <span>{{ role.label }}</span>
                  <strong>{{ rolePermissionLabel(role) }}</strong>
                  <small>外部 real execute：关闭</small>
                </div>
              </div>
              <p class="settings-note">当前没有真实登录系统；这是本地 Demo actor/role/merchant context。</p>
            </section>

            <section v-else-if="selectedModule.kind === 'logistics'" class="settings-section">
              <div class="settings-info-grid">
                <div><span>本地物流记录</span><strong>已开放安全创建</strong><small>仅写本地 shipping_records。</small></div>
                <div><span>顺丰预览</span><strong>mock / sandbox</strong><small>不发送外部请求。</small></div>
                <div><span>顺丰真实下单</span><strong>未开放</strong><small>real disabled。</small></div>
                <div><span>配置值</span><strong>脱敏</strong><small>只显示凭证状态。</small></div>
              </div>
              <CredentialList :items="credentialRows.filter((item) => item.provider === 'sf_express')" />
            </section>

            <section v-else-if="selectedModule.kind === 'deposit'" class="settings-section">
              <div class="settings-info-grid">
                <div><span>免押数据源</span><strong>接口同步 / 本地缓存</strong><small>失败时降级展示缓存。</small></div>
                <div><span>免押预览</span><strong>mock / sandbox</strong><small>不真实创建或完结。</small></div>
                <div><span>真实审核</span><strong>未开放</strong><small>real disabled。</small></div>
                <div><span>免押规则</span><strong>{{ depositRuleLabel }}</strong><small>只读概览。</small></div>
              </div>
              <CredentialList :items="credentialRows.filter((item) => item.provider === 'deposit_service')" />
            </section>

            <section v-else-if="selectedModule.kind === 'notify'" class="settings-section">
              <div class="settings-info-grid">
                <div><span>发货提醒</span><strong>本地草案</strong><small>不会自动发送。</small></div>
                <div><span>归还提醒</span><strong>本地草案</strong><small>后续接通知服务前需审核。</small></div>
                <div><span>异常提醒</span><strong>本地草案</strong><small>不接短信或 OAuth。</small></div>
              </div>
              <p class="settings-note">通知模板当前只作为产品入口占位，不执行真实推送。</p>
            </section>

            <section v-else-if="selectedModule.kind === 'credentials'" class="settings-section">
              <CredentialList :items="credentialRows" />
              <p class="settings-note">本页不展示 token、cookie、secret、API key 或月结卡号原文；需要真实接入时必须走后续 CredentialService 方案。</p>
            </section>

            <section v-else class="settings-section">
              <div class="settings-info-grid">
                <div v-for="check in healthChecks" :key="check.key" :class="`is-${check.status}`">
                  <span>{{ check.label }}</span>
                  <strong>{{ healthStatusLabel(check.status) }}</strong>
                  <small>{{ check.detail }}</small>
                </div>
              </div>
              <details class="advanced-health">
                <summary>高级信息</summary>
                <div class="settings-checklist">
                  <span v-for="item in healthChecklist" :key="item">{{ item }}</span>
                </div>
                <p class="settings-note">production migration、外部 real API、rollback executor 均未开启。</p>
              </details>
            </section>
          </div>
        </div>

        <div class="final-panel">
          <div class="final-panel__head"><div><h2>当前上下文</h2><p>本地演示用户与商户隔离信息</p></div></div>
          <div class="final-panel__body settings-info-grid">
            <div><span>角色</span><strong>{{ actorContext.roleLabel }}</strong><small>{{ actorContext.id }}</small></div>
            <div><span>商户</span><strong>{{ actorContext.merchantName || actorContext.merchantId }}</strong><small>{{ actorContext.merchantId }}</small></div>
            <div><span>门店</span><strong>{{ actorContext.storeName || actorContext.storeId }}</strong><small>{{ configSourceLabel }}</small></div>
            <div><span>外部真实调用</span><strong>关闭</strong><small>所有 provider real disabled。</small></div>
          </div>
        </div>

        <p v-if="message" class="settings-message">{{ message }}</p>
        <p v-if="errorMessage" class="settings-message is-error">{{ errorMessage }}</p>
      </main>
    </section>
  </UiV2Page>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { SettingsCard } from '../../../components/ui'
import { actorContextAdapter } from '../../../adapters/uiV2/actorContextAdapter.js'
import { configCenterAdapter } from '../../../adapters/uiV2/configCenterAdapter.js'
import { healthCheckAdapter } from '../../../adapters/uiV2/healthCheckAdapter.js'
import {
  buildCredentialStatusRows,
  findSettingsModule,
  getSettingsModules,
} from '../../../adapters/uiV2/settingsInformationArchitecture.js'
import UiV2Page from '../shared/UiV2Page.vue'
import '../shared/uiV2View.css'

const CredentialList = defineComponent({
  name: 'CredentialList',
  props: { items: { type: Array, default: () => [] } },
  setup(props) {
    return () => h('div', { class: 'credential-list' }, props.items.length
      ? props.items.map((item) => h('div', { class: 'credential-list__item', key: item.provider }, [
        h('span', item.label),
        h('strong', item.configuredCount > 0 ? '已配置' : '未配置'),
        h('small', `已配置 ${item.configuredCount}/${item.totalCount}，不显示凭证值`),
      ]))
      : h('div', { class: 'credential-list__item' }, [
        h('span', '外部接口凭证'),
        h('strong', '未配置'),
        h('small', '未发现可展示的脱敏状态。'),
      ]))
  },
})

const modules = getSettingsModules()
const selectedId = ref('merchant-store')
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const errorMessage = ref('')
const overview = ref(null)
const health = ref(null)
const actorContext = ref(actorContextAdapter.getLocalActorContext())
const selectedRole = ref(actorContext.value.role)
const roleOptions = [
  { label: '店主', value: 'owner' },
  { label: '运营员', value: 'operator' },
  { label: '只读查看', value: 'viewer' },
]
const storeTypeOptions = [
  { label: '相机租赁', value: 'camera-rental' },
  { label: '综合租赁', value: 'rental-general' },
  { label: '本地演示', value: 'local-demo' },
]
const regionOptions = [
  { label: '本地演示', value: 'local-demo' },
  { label: '华南', value: 'south-china' },
  { label: '华东', value: 'east-china' },
  { label: '华北', value: 'north-china' },
]
const storeForm = ref({
  defaultStoreId: '',
  storeName: '',
  storeCode: '',
  storeType: 'camera-rental',
  region: 'local-demo',
  contactName: '',
  contactPhone: '',
  email: '',
  businessOpen: true,
  weekendOpen: true,
  openAt: '09:30',
  closeAt: '21:30',
})

const selectedModule = computed(() => findSettingsModule(selectedId.value))
const roleMatrix = computed(() => actorContextAdapter.buildRoleMatrix())
const credentialRows = computed(() => buildCredentialStatusRows(overview.value || {}))
const healthChecks = computed(() => Array.isArray(health.value?.checks) ? health.value.checks : [])
const healthChecklist = computed(() => Array.isArray(health.value?.checklist) ? health.value.checklist : [])
const configSourceLabel = computed(() => {
  if (overview.value?.source === 'mysql') return '本地 MySQL'
  if (overview.value?.source === 'localStorage') return '浏览器本地预览'
  return '读取中'
})
const depositRuleLabel = computed(() => {
  const count = overview.value?.relatedData?.depositExemptionRules?.count
  return Number.isFinite(Number(count)) ? `${count} 条规则` : '暂无记录'
})
const storeOptions = computed(() => {
  const stores = overview.value?.stores?.items || []
  return stores.length
    ? stores.map((store) => ({ label: store.name || store.code || store.id, value: String(store.id || store.code) }))
    : [{ label: storeForm.value.storeName || '本地演示门店', value: storeForm.value.defaultStoreId || 'local-demo-store' }]
})

function selectModule(id) {
  selectedId.value = id
  message.value = ''
  errorMessage.value = ''
}

function moduleStatus(module) {
  if (module.kind === 'credentials') {
    const total = credentialRows.value.reduce((sum, item) => sum + Number(item.totalCount || 0), 0)
    const configured = credentialRows.value.reduce((sum, item) => sum + Number(item.configuredCount || 0), 0)
    return total ? `${configured}/${total} 已配置` : '未配置'
  }
  if (module.kind === 'health') return health.value?.status ? healthStatusLabel(health.value.status) : module.status
  return module.status
}

function rolePermissionLabel(role) {
  if (role.canExecuteInternal && role.canPreviewExternal) return '内部安全写 + 外部预览'
  if (role.canExecuteInternal) return '内部安全写'
  return '只读查看'
}

function healthStatusLabel(status) {
  const labels = {
    ready: '就绪',
    'ready-for-local-demo': '本地演示就绪',
    'preview-only': '预览降级',
    blocked: '已阻断',
    warning: '需关注',
  }
  return labels[status] || status || '未知'
}

function applyStoreSettings(result = {}) {
  const settings = result.settings || {}
  const store = result.store || result.stores?.[0] || {}
  storeForm.value = {
    ...storeForm.value,
    ...settings,
    defaultStoreId: String(settings.defaultStoreId || store.id || storeForm.value.defaultStoreId || 'local-demo-store'),
    storeName: settings.storeName || store.name || storeForm.value.storeName || '小狗相机租赁',
    storeCode: settings.storeCode || store.code || storeForm.value.storeCode || 'LOCAL-DEMO',
    businessOpen: settings.businessOpen !== false && store.status !== 'inactive',
  }
}

async function loadSettings() {
  loading.value = true
  errorMessage.value = ''
  message.value = ''
  try {
    const [nextOverview, storeSettings, nextHealth] = await Promise.all([
      configCenterAdapter.getOverview(),
      configCenterAdapter.getStoreSettings(),
      healthCheckAdapter.getLocalDemoHealthCheck(),
    ])
    overview.value = nextOverview
    health.value = nextHealth
    applyStoreSettings(storeSettings)
    actorContext.value = actorContextAdapter.getLocalActorContext()
    selectedRole.value = actorContext.value.role
    message.value = '配置中心已刷新；敏感凭证仅展示配置状态。'
  } catch (error) {
    errorMessage.value = error?.message || '设置读取失败'
  } finally {
    loading.value = false
  }
}

async function saveStore() {
  if (selectedModule.value.kind !== 'store') return
  saving.value = true
  errorMessage.value = ''
  message.value = ''
  try {
    const result = await configCenterAdapter.saveStoreSettings(storeForm.value)
    if (!result?.ok) throw new Error(result?.message || '保存失败')
    applyStoreSettings(result)
    message.value = '门店与非敏感配置已保存；没有调用外部服务。'
  } catch (error) {
    errorMessage.value = error?.message || '保存失败，未执行危险写入。'
  } finally {
    saving.value = false
  }
}

function changeRole() {
  actorContext.value = actorContextAdapter.setDemoRole(selectedRole.value)
  message.value = `已切换为 ${actorContext.value.roleLabel}，权限变化会影响 safeOps execute。`
}

onMounted(loadSettings)
</script>

<style scoped>
.settings-shell {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.settings-nav {
  display: grid;
  gap: 10px;
}

.settings-content {
  display: grid;
  gap: 14px;
}

.settings-section {
  display: grid;
  gap: 14px;
}

.settings-form-grid,
.settings-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.settings-form-grid.is-narrow {
  grid-template-columns: minmax(260px, 0.45fr);
}

.settings-info-grid > div,
.credential-list__item {
  min-height: 92px;
  padding: 14px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-surface);
  display: grid;
  gap: 5px;
  align-content: start;
}

.settings-info-grid span,
.credential-list__item span,
.settings-note,
.settings-message,
.settings-info-grid small,
.credential-list__item small {
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.settings-info-grid strong,
.credential-list__item strong {
  color: var(--ui-text);
  font-size: 15px;
}

.credential-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.settings-toggle-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.settings-toggle-row button {
  min-height: 72px;
  padding: 12px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-surface);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--ui-text-muted);
  font-weight: 720;
}

.settings-toggle-row button.is-on {
  border-color: rgba(0, 127, 109, 0.35);
  background: var(--ui-brand-soft);
  color: var(--ui-brand);
}

.advanced-health {
  padding: 12px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-surface);
}

.advanced-health summary {
  cursor: pointer;
  color: var(--ui-text);
  font-weight: 820;
}

.settings-checklist {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.settings-checklist span {
  padding: 5px 8px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.settings-message {
  min-height: 34px;
  padding: 9px 12px;
  border: 1px solid rgba(0, 127, 109, 0.24);
  border-radius: 10px;
  background: rgba(232, 247, 243, 0.82);
  color: var(--ui-brand);
  font-weight: 760;
}

.settings-message.is-error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.9);
  color: #b42318;
}

@media (max-width: 1100px) {
  .settings-shell {
    grid-template-columns: 1fr;
  }

  .settings-nav,
  .credential-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
