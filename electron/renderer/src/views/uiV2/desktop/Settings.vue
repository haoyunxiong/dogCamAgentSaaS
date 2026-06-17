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
          <div class="final-panel__head"><div><h2>系统信息</h2><p>Demo 环境状态</p></div></div>
          <div class="system-info">
            <div><span>系统版本</span><strong>v2.4.6</strong></div>
            <div><span>更新时间</span><strong>2025-06-10 18:23:45</strong></div>
            <div><span>服务状态</span><strong class="ok">正常运行</strong></div>
            <div><span>数据备份</span><strong>已开启（每日 02:00）</strong></div>
            <div><span>当前环境</span><strong>生产环境</strong></div>
          </div>
        </div>
      </div>

      <aside class="final-panel settings-form">
        <div class="final-panel__head">
          <div>
            <h2>门店设置</h2>
            <p>基础信息、联系信息与营业设置</p>
          </div>
          <BaseButton size="sm">保存设置</BaseButton>
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
import { ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import { SettingsCard } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import '../shared/uiV2View.css'

const settings = uiV2MockAdapter.getSettings()
const selectedId = ref(settings[0]?.id || '')
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
}
</style>
