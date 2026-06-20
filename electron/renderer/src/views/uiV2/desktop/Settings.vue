<template>
  <UiV2Page title="系统设置" description="全局配置租赁业务相关规则与功能；Demo 只做 UI，不写入真实配置。">
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
          <div class="final-panel__head"><div><h2>本地 Demo 上下文</h2><p>最小权限、角色、商户隔离模型</p></div></div>
          <div class="system-info">
            <div><span>当前角色</span><strong>{{ actorContext.role }}</strong></div>
            <div><span>操作人</span><strong>{{ actorContext.id }}</strong></div>
            <div><span>商户</span><strong>{{ actorContext.merchantId }}</strong></div>
            <div><span>门店</span><strong>{{ actorContext.storeId }}</strong></div>
            <div><span>外部 real</span><strong class="warn">disabled</strong></div>
          </div>
          <div class="settings-inline-form">
            <BaseSelect v-model="selectedRole" label="切换 Demo 角色" :options="roleOptions" @change="changeRole" />
            <p class="settings-note">viewer 只读；operator 可执行阶段 1/2 内部安全操作；owner 可执行内部安全操作并查看外部 preview。外部 real 始终 disabled。</p>
          </div>
        </div>

        <div class="final-panel">
          <div class="final-panel__head"><div><h2>系统健康 / 上线准备</h2><p>本地 readiness，不触发外部请求</p></div><BaseButton size="sm" variant="secondary" @click="loadHealth">刷新</BaseButton></div>
          <div class="readiness-grid">
            <div v-for="check in healthChecks" :key="check.key" class="readiness-card" :class="`is-${check.status}`">
              <span>{{ check.label }}</span>
              <strong>{{ check.status }}</strong>
              <small>{{ check.detail }}</small>
            </div>
          </div>
          <div class="settings-checklist">
            <span v-for="item in healthChecklist" :key="item">{{ item }}</span>
          </div>
          <p v-if="healthError" class="settings-note is-error">{{ healthError }}</p>
        </div>

        <div class="final-panel">
          <div class="final-panel__head"><div><h2>系统信息</h2><p>Demo 环境状态</p></div></div>
          <div class="system-info">
            <div><span>Demo 版本</span><strong>Phase 04 → 06</strong></div>
            <div><span>safeOps</span><strong>{{ healthSafeMode }}</strong></div>
            <div><span>服务状态</span><strong class="ok">{{ healthStatus }}</strong></div>
            <div><span>rollback</span><strong class="warn">unavailable</strong></div>
            <div><span>当前环境</span><strong>本地 Demo</strong></div>
          </div>
        </div>
      </div>

      <aside class="final-panel settings-form">
        <div class="final-panel__head">
          <div>
            <h2>门店设置</h2>
            <p>基础信息、联系信息与营业设置</p>
          </div>
          <BaseButton size="sm" disabled>保存设置</BaseButton>
        </div>
        <div class="final-panel__body form-stack">
          <h3>基础信息</h3>
          <BaseInput model-value="深圳南山店" label="门店名称" />
          <BaseInput model-value="SZ-NS-001" label="门店编码" />
          <BaseSelect model-value="直营门店" label="门店类型" :options="['直营门店', '合作仓', '临时仓']" />
          <BaseSelect model-value="广东省 / 深圳市 / 南山区" label="所属区域" :options="['广东省 / 深圳市 / 南山区']" />
          <BaseInput model-value="深圳市南山区科技园南区科苑路8号讯美科技广场B座8楼" label="详细地址" />
          <h3>联系信息</h3>
          <div class="form-grid">
            <BaseInput model-value="林小姐" label="联系人" />
            <BaseInput model-value="138 **** 8899" label="联系电话" />
            <BaseInput model-value="0755-**** 1234" label="备用电话" />
            <BaseInput model-value="linxiaoxu@zuling.com" label="联系邮箱" />
          </div>
          <h3>营业设置</h3>
          <div class="toggle-row"><span>营业状态</span><strong>开启</strong><i></i></div>
          <div class="form-grid">
            <BaseInput model-value="10:00" label="开始时间" />
            <BaseInput model-value="18:00" label="结束时间" />
          </div>
          <div class="toggle-row"><span>周末营业</span><strong>开启</strong><i></i></div>
          <p class="settings-note">配置项只做 UI 展示，不读取或写入真实商家配置。</p>
        </div>
      </aside>
    </section>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
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
const roleOptions = [
  { label: 'owner', value: 'owner' },
  { label: 'operator', value: 'operator' },
  { label: 'viewer', value: 'viewer' },
]

const healthChecks = computed(() => Array.isArray(health.value?.checks) ? health.value.checks : [])
const healthChecklist = computed(() => Array.isArray(health.value?.checklist) ? health.value.checklist : [])
const healthStatus = computed(() => health.value?.status || 'checking')
const healthSafeMode = computed(() => health.value?.safeOps?.safeMode || 'gated-internal-write')

async function loadActorContext() {
  const result = await getCurrentActorContext({ role: selectedRole.value, source: 'settings-page' })
  actorContext.value = result?.current || actorContextAdapter.getLocalActorContext({ role: selectedRole.value })
}

async function loadHealth() {
  healthError.value = ''
  const result = await healthCheckAdapter.getLocalDemoHealthCheck()
  health.value = result
  if (!result?.ok) healthError.value = result?.message || 'health check returned blocked status'
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
  color: var(--ui-text-muted);
  font-size: 13px;
}

.toggle-row strong {
  margin-left: auto;
  color: var(--ui-text);
}

.toggle-row i {
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: var(--ui-brand);
  position: relative;
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
