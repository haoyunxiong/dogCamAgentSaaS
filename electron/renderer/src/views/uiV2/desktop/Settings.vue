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
              <ExternalConfigPanel
                group-id="sf"
                :group="externalGroup('sf')"
                :form="externalForms.sf"
                :saving="externalSaving"
                :testing="externalTesting"
                @save="saveExternalGroup('sf')"
                @validate="validateExternalGroup('sf')"
              />
              <div class="settings-form-grid">
                <BaseInput v-model="sfTransitForm.province" label="测试收件省份" />
                <BaseInput v-model="sfTransitForm.city" label="测试收件城市" />
                <BaseInput v-model="sfTransitForm.district" label="测试收件区县" />
                <BaseInput v-model="sfTransitForm.rentStartDate" label="租期开始" type="date" />
              </div>
              <div class="settings-action-row">
                <BaseButton :loading="externalTesting" @click="previewSfTransit">预览顺丰时效</BaseButton>
                <RouterLink to="/ui-v2/logistics">进入物流页</RouterLink>
              </div>
            </section>

            <section v-else-if="selectedModule.kind === 'deposit'" class="settings-section">
              <ExternalConfigPanel
                group-id="deposit"
                :group="externalGroup('deposit')"
                :form="externalForms.deposit"
                :saving="externalSaving"
                :testing="externalTesting"
                @save="saveExternalGroup('deposit')"
                @validate="testDepositConnection"
              />
              <div class="settings-info-grid">
                <div><span>免押规则</span><strong>{{ depositRuleLabel }}</strong><small>来自本地 deposit_exemption_rules。</small></div>
                <div><span>真实创建/完结</span><strong>默认关闭</strong><small>开启后仍需要 safeOps confirmToken、idempotency、audit。</small></div>
              </div>
              <div class="settings-action-row">
                <BaseButton variant="secondary" :loading="externalTesting" @click="validateExternalGroup('deposit')">创建免押预览</BaseButton>
                <BaseButton variant="secondary" :loading="externalTesting" @click="validateExternalGroup('deposit')">完结免押预览</BaseButton>
                <RouterLink to="/ui-v2/deposit">进入免押页</RouterLink>
              </div>
            </section>

            <section v-else-if="selectedModule.kind === 'xianyu'" class="settings-section">
              <ExternalConfigPanel
                group-id="xianyu"
                :group="externalGroup('xianyu')"
                :form="externalForms.xianyu"
                :saving="externalSaving"
                :testing="externalTesting"
                @save="saveExternalGroup('xianyu')"
                @validate="getXianyuStatus"
              />
              <div class="settings-info-grid">
                <div><span>Cookie / Session</span><strong>{{ xianyuStatus.cookieSessionStatus || '未配置' }}</strong><small>不回显明文。</small></div>
                <div><span>同步状态</span><strong>{{ xianyuStatus.status || '未配置' }}</strong><small>真实写同步默认 disabled。</small></div>
              </div>
              <div class="settings-action-row">
                <BaseButton variant="secondary" :loading="externalTesting" @click="getXianyuStatus">刷新配置状态</BaseButton>
                <RouterLink to="/ui-v2/orders">进入订单页</RouterLink>
              </div>
            </section>

            <section v-else-if="selectedModule.kind === 'notify'" class="settings-section">
              <div class="settings-info-grid">
                <div><span>发货提醒</span><strong>本地草案</strong><small>不会自动发送。</small></div>
                <div><span>归还提醒</span><strong>本地草案</strong><small>后续接通知服务前需审核。</small></div>
                <div><span>异常提醒</span><strong>本地草案</strong><small>不接短信或 OAuth。</small></div>
              </div>
              <p class="settings-note">通知模板当前只作为产品入口占位，不执行真实推送。</p>
            </section>

            <section v-else-if="selectedModule.kind === 'externalStatus'" class="settings-section">
              <div class="settings-info-grid">
                <div v-for="group in externalGroups" :key="group.id">
                  <span>{{ group.title }}</span>
                  <strong>{{ group.completeness.configured }}/{{ group.completeness.required }} 必填已配置</strong>
                  <small>{{ group.mode }} · 最近测试 {{ group.lastTestAt || '无' }} · {{ group.lastError || '无错误' }}</small>
                </div>
              </div>
              <p class="settings-note">本页只显示配置状态，不显示 token、cookie、secret、API key、手机号、地址、证件号或月结卡号明文。</p>
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

const booleanOptions = [
  { label: '关闭', value: 'False' },
  { label: '开启', value: 'True' },
]

const ExternalConfigPanel = defineComponent({
  name: 'ExternalConfigPanel',
  props: {
    groupId: { type: String, required: true },
    group: { type: Object, default: () => null },
    form: { type: Object, default: () => ({}) },
    saving: { type: Boolean, default: false },
    testing: { type: Boolean, default: false },
  },
  emits: ['save', 'validate'],
  setup(props, { emit }) {
    function isSwitchField(field) {
      return String(field?.key || '').includes('ENABLED')
    }
    return () => {
      const group = props.group || { title: '外部接口', mode: '未配置', completeness: { configured: 0, required: 0 }, fields: [] }
      return h('div', { class: 'external-config-panel' }, [
        h('div', { class: 'settings-info-grid' }, [
          h('div', [
            h('span', '配置完整度'),
            h('strong', `${group.completeness?.configured || 0}/${group.completeness?.required || 0} 必填已配置`),
            h('small', group.warning || '本地测试配置，生产需迁移到加密凭证存储。'),
          ]),
          h('div', [
            h('span', '当前模式'),
            h('strong', group.mode || '未配置'),
            h('small', `最近测试 ${group.lastTestAt || '无'}；最近错误 ${group.lastError || '无'}`),
          ]),
        ]),
        h('div', { class: 'settings-form-grid' }, (group.fields || []).map((field) => {
          const common = {
            key: field.key,
            modelValue: props.form[field.key] || '',
            'onUpdate:modelValue': (value) => { props.form[field.key] = value },
            label: field.label,
            placeholder: field.sensitive
              ? (field.configured ? '已配置，留空不覆盖旧值' : '未配置，输入后保存')
              : '',
            hint: field.sensitive ? '敏感字段不回显明文。' : '',
          }
          return isSwitchField(field)
            ? h(BaseSelect, { ...common, options: booleanOptions })
            : h(BaseInput, common)
        })),
        h('div', { class: 'settings-action-row' }, [
          h(BaseButton, { loading: props.saving, onClick: () => emit('save') }, () => '保存配置'),
          h(BaseButton, { variant: 'secondary', loading: props.testing, onClick: () => emit('validate') }, () => '测试连接'),
        ]),
      ])
    }
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
const externalStatus = ref({ groups: [] })
const xianyuStatus = ref({})
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
const externalForms = ref({
  sf: {},
  deposit: {},
  xianyu: {},
})
const externalSaving = ref(false)
const externalTesting = ref(false)
const sfTransitForm = ref({
  province: '四川省',
  city: '成都市',
  district: '',
  rentStartDate: new Date().toISOString().slice(0, 10),
})

const selectedModule = computed(() => findSettingsModule(selectedId.value))
const roleMatrix = computed(() => actorContextAdapter.buildRoleMatrix())
const credentialRows = computed(() => buildCredentialStatusRows(overview.value || {}))
const healthChecks = computed(() => Array.isArray(health.value?.checks) ? health.value.checks : [])
const healthChecklist = computed(() => Array.isArray(health.value?.checklist) ? health.value.checklist : [])
const externalGroups = computed(() => Array.isArray(externalStatus.value?.groups) ? externalStatus.value.groups : [])
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
  if (module.kind === 'logistics') return externalGroup('sf')?.mode || module.status
  if (module.kind === 'deposit') return externalGroup('deposit')?.mode || module.status
  if (module.kind === 'xianyu') return externalGroup('xianyu')?.mode || module.status
  if (module.kind === 'externalStatus') {
    const total = externalGroups.value.reduce((sum, group) => sum + Number(group.completeness?.required || 0), 0)
    const configured = externalGroups.value.reduce((sum, group) => sum + Number(group.completeness?.configured || 0), 0)
    return total ? `${configured}/${total} 必填已配置` : module.status
  }
  if (module.kind === 'credentials') {
    const total = credentialRows.value.reduce((sum, item) => sum + Number(item.totalCount || 0), 0)
    const configured = credentialRows.value.reduce((sum, item) => sum + Number(item.configuredCount || 0), 0)
    return total ? `${configured}/${total} 已配置` : '未配置'
  }
  if (module.kind === 'health') return health.value?.status ? healthStatusLabel(health.value.status) : module.status
  return module.status
}

function externalGroup(groupId) {
  return externalGroups.value.find((group) => group.id === groupId) || null
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

function applyExternalStatus(result = {}) {
  externalStatus.value = result && typeof result === 'object' ? result : { groups: [] }
  const nextForms = { ...externalForms.value }
  for (const group of externalGroups.value) {
    const current = { ...(nextForms[group.id] || {}) }
    for (const field of group.fields || []) {
      if (field.sensitive) {
        if (current[field.key] === undefined) current[field.key] = ''
      } else {
        current[field.key] = current[field.key] !== undefined && current[field.key] !== ''
          ? current[field.key]
          : (field.value || '')
      }
      if (String(field.key).includes('ENABLED') && !current[field.key]) current[field.key] = field.configured ? 'True' : 'False'
    }
    nextForms[group.id] = current
  }
  externalForms.value = nextForms
}

async function loadSettings() {
  loading.value = true
  errorMessage.value = ''
  message.value = ''
  try {
    const [nextOverview, storeSettings, nextHealth, nextExternalStatus] = await Promise.all([
      configCenterAdapter.getOverview(),
      configCenterAdapter.getStoreSettings(),
      healthCheckAdapter.getLocalDemoHealthCheck(),
      configCenterAdapter.getExternalConfigStatus(),
    ])
    overview.value = nextOverview
    health.value = nextHealth
    applyStoreSettings(storeSettings)
    applyExternalStatus(nextExternalStatus)
    actorContext.value = actorContextAdapter.getLocalActorContext()
    selectedRole.value = actorContext.value.role
    message.value = '配置中心已刷新；敏感凭证仅展示配置状态。'
  } catch (error) {
    errorMessage.value = error?.message || '设置读取失败'
  } finally {
    loading.value = false
  }
}

function confirmRealSwitchEnable(groupId, values = {}) {
  const realSwitchKeys = ['SF_REAL_ORDER_ENABLED', 'DEPOSIT_REAL_CREATE_ENABLED', 'DEPOSIT_REAL_FINISH_ENABLED', 'XGJ_REAL_SYNC_ENABLED']
  const enabling = realSwitchKeys.filter((key) => String(values[key] || '').toLowerCase() === 'true')
  if (!enabling.length) return true
  const group = externalGroup(groupId)
  return window.confirm(`${group?.title || '外部接口'}即将保存真实写开关为开启。即使开启，真实写操作仍需要 safeOps confirmToken、idempotency、audit。确认保存？`)
}

async function refreshExternalStatusOnly() {
  const result = await configCenterAdapter.getExternalConfigStatus()
  applyExternalStatus(result)
}

async function saveExternalGroup(groupId) {
  const values = externalForms.value[groupId] || {}
  if (!confirmRealSwitchEnable(groupId, values)) return
  externalSaving.value = true
  errorMessage.value = ''
  message.value = ''
  try {
    const result = await configCenterAdapter.saveExternalConfig({ groupId, values, actor: actorContext.value })
    if (!result?.ok) throw new Error(result?.message || '保存失败')
    message.value = `${result.group?.title || '外部配置'}已保存；敏感字段未回显，未调用外部接口。`
    await refreshExternalStatusOnly()
  } catch (error) {
    errorMessage.value = error?.message || '保存失败'
  } finally {
    externalSaving.value = false
  }
}

async function validateExternalGroup(groupId) {
  externalTesting.value = true
  errorMessage.value = ''
  message.value = ''
  try {
    const result = await configCenterAdapter.validateExternalConfig({ groupId, actor: actorContext.value })
    if (!result?.ok) throw new Error(result?.message || '配置校验未通过')
    message.value = result.message || '配置校验通过；未调用外部接口。'
  } catch (error) {
    errorMessage.value = error?.message || '配置校验失败'
  } finally {
    externalTesting.value = false
  }
}

async function previewSfTransit() {
  externalTesting.value = true
  errorMessage.value = ''
  message.value = ''
  try {
    const result = await configCenterAdapter.previewSfTransit({ ...sfTransitForm.value, actor: actorContext.value })
    if (!result?.ok) throw new Error(result?.message || result?.error || '顺丰时效测试失败')
    message.value = `顺丰时效测试完成：预计 ${result.plan?.expectedArriveAt || '-'} 到达。`
    await refreshExternalStatusOnly()
  } catch (error) {
    errorMessage.value = error?.message || '顺丰时效测试失败'
    await refreshExternalStatusOnly()
  } finally {
    externalTesting.value = false
  }
}

async function testDepositConnection() {
  externalTesting.value = true
  errorMessage.value = ''
  message.value = ''
  try {
    const result = await configCenterAdapter.testDepositConnection({ actor: actorContext.value })
    if (!result?.ok) throw new Error(result?.message || '免押配置校验失败')
    message.value = result.message || '免押配置校验通过。'
  } catch (error) {
    errorMessage.value = error?.message || '免押配置校验失败'
  } finally {
    externalTesting.value = false
  }
}

async function getXianyuStatus() {
  externalTesting.value = true
  errorMessage.value = ''
  message.value = ''
  try {
    const result = await configCenterAdapter.getXianyuConfigStatus({ actor: actorContext.value })
    xianyuStatus.value = result || {}
    message.value = result?.message || '闲鱼/闲管家配置状态已刷新。'
  } catch (error) {
    errorMessage.value = error?.message || '闲鱼/闲管家状态读取失败'
  } finally {
    externalTesting.value = false
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

.external-config-panel {
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

.settings-action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.settings-action-row a {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  color: var(--ui-brand);
  font-size: 13px;
  font-weight: 760;
  text-decoration: none;
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
