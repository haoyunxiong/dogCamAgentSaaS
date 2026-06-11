<template>
  <div class="page mapping-page">
    <PageHeader
      title="商品业务绑定"
      subtitle="把闲鱼商品 item_id 显式绑定到业务商品编码 / 机型，便于跨帖子共享价格、FAQ 与知识检索。"
      icon="🔗"
      :breadcrumb="['经营管理', '商品业务绑定']"
    >
      <template #actions>
        <button class="btn btn-secondary" @click="load">↻ 刷新</button>
        <button class="btn btn-secondary" :disabled="syncingListings" @click="syncListings">{{ syncingListings ? '同步中…' : '同步本地帖子' }}</button>
        <button class="btn btn-primary" @click="openCreate">＋ 新增绑定</button>
      </template>
    </PageHeader>

    <section class="panel listing-panel">
      <div class="panel-header">
        <div>
          <h3>当前账号帖子审核</h3>
          <div class="panel-tip">从本地已缓存的商品详情整理，不主动全量扫闲鱼；换账号后按账号隔离展示。</div>
        </div>
        <div class="listing-tools">
          <select v-model="listingFilters.reviewStatus" @change="loadListings">
            <option value="">全部状态</option>
            <option value="pending">待审核</option>
            <option value="reviewed">已审核</option>
            <option value="ignored">已忽略</option>
          </select>
          <input v-model="listingFilters.keyword" placeholder="搜索标题 / 编码 / item_id" @keyup.enter="loadListings" />
          <button class="btn btn-sm btn-secondary" @click="loadListings">查询</button>
        </div>
      </div>

      <div v-if="listingSyncResult" class="banner success-banner">
        账号 {{ listingSyncResult.accountId }}：同步本人/归属标记命中帖子 {{ listingSyncResult.synced }} 个，其中描述标记命中候选 {{ listingSyncResult.syncedByOwnerMarker || listingSyncResult.syncedByCodeFallback || 0 }} 个；解析 {{ listingSyncResult.inferred }} 个，生成/更新绑定 {{ listingSyncResult.mapped }} 个；已跳过非本人 {{ listingSyncResult.skippedOtherOwner || 0 }} 个、归属未知且无标记 {{ listingSyncResult.skippedUnknownOwner || 0 }} 个。
      </div>

      <div class="listing-grid">
        <article v-for="item in listings" :key="`${item.account_id}-${item.item_id}`" class="listing-card">
          <div class="cover-box">
            <img v-if="item.cover_url" :src="item.cover_url" alt="商品首图" />
            <span v-else>无图</span>
          </div>
          <div class="listing-main">
            <div class="listing-title">{{ item.title || '未命名商品' }}</div>
            <div class="listing-meta">
              <code>{{ item.item_id }}</code>
              <span class="pill" :class="statusClass(item.review_status)">{{ statusLabel(item.review_status) }}</span>
              <span>{{ formatDt(item.last_seen_at) }}</span>
            </div>
            <div class="listing-edit-row">
              <input v-model="item.biz_item_code" placeholder="商品编码" />
              <input v-model="item.model_code" placeholder="机型" />
              <button class="btn btn-sm btn-primary" :disabled="item._saving" @click="reviewListing(item, 'reviewed')">确认绑定</button>
              <button class="btn btn-sm btn-secondary" :disabled="item._saving" @click="reviewListing(item, 'ignored')">忽略</button>
            </div>
            <p class="listing-desc">{{ item.description || '暂无详情描述缓存' }}</p>
          </div>
        </article>
        <div v-if="!listings.length" class="empty-listing">
          暂无帖子缓存。可先启动机器人/同步历史，让系统接触到帖子详情后再点“同步本地帖子”。
        </div>
      </div>
    </section>

    <section class="panel filter-panel">
      <div class="filter-row">
        <div class="filter-field">
          <span class="ff-icon">🔍</span>
          <input v-model="filters.keyword" placeholder="搜索 item_id / 商品编码 / 机型 / 备注" @keyup.enter="load" />
        </div>
        <div class="filter-field short">
          <span class="ff-icon">🧩</span>
          <input v-model="filters.bizItemCode" placeholder="商品编码精确匹配" @keyup.enter="load" />
        </div>
        <div class="filter-field short">
          <span class="ff-icon">🏷</span>
          <input v-model="filters.modelCode" placeholder="机型精确匹配" @keyup.enter="load" />
        </div>
        <select v-model="filters.source" class="ff-select" @change="load">
          <option value="">全部来源</option>
          <option value="manual">手动</option>
          <option value="inferred">推断</option>
        </select>
        <button v-if="hasFilter" class="btn btn-secondary btn-sm" @click="resetFilters">重置</button>
      </div>
    </section>

    <div v-if="message" class="banner">{{ message }}</div>

    <section class="panel">
      <table class="map-table">
        <thead>
          <tr>
            <th>item_id</th>
            <th>商品编码</th>
            <th>机型</th>
            <th>来源</th>
            <th>备注</th>
            <th>更新时间</th>
            <th class="op">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.item_id">
            <td><code>{{ row.item_id }}</code></td>
            <td><code class="biz">{{ row.biz_item_code || '—' }}</code></td>
            <td><code class="model">{{ row.model_code || '—' }}</code></td>
            <td>
              <span class="pill" :class="row.source === 'manual' ? 'pill-manual' : 'pill-infer'">{{ row.source }}</span>
            </td>
            <td class="remark">{{ row.note || '—' }}</td>
            <td class="dt">{{ formatDt(row.updated_at) }}</td>
            <td class="op">
              <button class="btn btn-sm btn-secondary" @click="markDetailDirty(row)">详情已更新</button>
              <button class="btn btn-sm btn-secondary" @click="openEdit(row)">编辑</button>
              <button class="btn btn-sm btn-danger" @click="remove(row)">删除</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="7" class="empty">暂无绑定记录</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="modal.show" class="modal-mask" @click.self="closeModal">
      <div class="modal-card">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeModal">✕</button>
        </div>
        <header class="modal-head">
          <h3>{{ modal.editing ? '编辑绑定' : '新增绑定' }}</h3>
        </header>
        <div class="modal-body">
          <div class="form-row">
            <label>item_id <span class="req">*</span></label>
            <input v-model="modal.form.itemId" :disabled="modal.editing" placeholder="闲鱼商品 ID" />
          </div>
          <div class="form-row">
            <label>商品编码</label>
            <input v-model="modal.form.bizItemCode" placeholder="如 G7X_RENT_STD" />
          </div>
          <div class="form-row">
            <label>机型</label>
            <input v-model="modal.form.modelCode" placeholder="如 CANON_R5" />
          </div>
          <div class="form-row">
            <label>来源</label>
            <select v-model="modal.form.source">
              <option value="manual">manual（手动绑定，最高优先级）</option>
              <option value="inferred">inferred（推断结果）</option>
            </select>
          </div>
          <div class="form-row">
            <label>备注</label>
            <input v-model="modal.form.note" placeholder="例如: 自营店铺 / 第三方代发" />
          </div>
        </div>
        <footer class="modal-foot">
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '../../components/PageHeader.vue'
import { runViewInitialization } from '../../utils/viewInitialization.mjs'

const rows = ref([])
const listings = ref([])
const message = ref('')
const saving = ref(false)
const syncingListings = ref(false)
const listingSyncResult = ref(null)
const filters = reactive({ keyword: '', bizItemCode: '', modelCode: '', source: '' })
const listingFilters = reactive({ keyword: '', reviewStatus: 'pending' })

const hasFilter = computed(() => filters.keyword || filters.bizItemCode || filters.modelCode || filters.source)

const modal = reactive({
  show: false,
  editing: false,
  form: emptyForm(),
})

function emptyForm() {
  return { itemId: '', bizItemCode: '', modelCode: '', source: 'manual', note: '' }
}

function formatDt(v) {
  if (!v) return '—'
  try {
    const s = typeof v === 'string' ? v : new Date(v).toISOString()
    return s.replace('T', ' ').slice(0, 19)
  } catch {
    return String(v)
  }
}

async function load() {
  try {
    const payload = {}
    if (filters.keyword) payload.keyword = filters.keyword
    if (filters.bizItemCode) payload.bizItemCode = filters.bizItemCode
    if (filters.modelCode) payload.modelCode = filters.modelCode
    if (filters.source) payload.source = filters.source
    rows.value = await window.electronAPI.listItemMapping(payload)
    message.value = ''
  } catch (e) {
    message.value = `加载失败：${e.message || e}`
  }
}

async function loadListings() {
  try {
    const payload = {}
    if (listingFilters.keyword) payload.keyword = listingFilters.keyword
    if (listingFilters.reviewStatus) payload.reviewStatus = listingFilters.reviewStatus
    listings.value = await window.electronAPI.listItemListings(payload)
  } catch (e) {
    window.$toast?.(`加载帖子失败：${e.message || e}`, 'error')
  }
}

async function syncListings() {
  syncingListings.value = true
  listingSyncResult.value = null
  try {
    const res = await window.electronAPI.syncItemListingsFromLocalCache({ limit: 80 })
    if (res?.ok) {
      listingSyncResult.value = res
      window.$toast?.('本地帖子缓存已同步', 'success')
      await Promise.all([loadListings(), load()])
    } else {
      window.$toast?.(res?.message || '同步失败', 'error')
    }
  } catch (e) {
    window.$toast?.(`同步失败：${e.message || e}`, 'error')
  } finally {
    syncingListings.value = false
  }
}

async function reviewListing(item, reviewStatus) {
  item._saving = true
  try {
    const res = await window.electronAPI.reviewItemListing({
      accountId: item.account_id,
      itemId: item.item_id,
      bizItemCode: item.biz_item_code || '',
      modelCode: item.model_code || '',
      reviewStatus,
    })
    if (res?.ok) {
      window.$toast?.(reviewStatus === 'reviewed' ? '已确认绑定' : '已忽略', 'success')
      await Promise.all([loadListings(), load()])
    } else {
      window.$toast?.(res?.message || '保存失败', 'error')
    }
  } catch (e) {
    window.$toast?.(`保存失败：${e.message || e}`, 'error')
  } finally {
    item._saving = false
  }
}

function statusLabel(status) {
  return { pending: '待审核', reviewed: '已审核', ignored: '已忽略' }[status] || status || '待审核'
}

function statusClass(status) {
  return status === 'reviewed' ? 'pill-manual' : status === 'ignored' ? 'pill-infer' : 'pill-pending'
}

function resetFilters() {
  filters.keyword = ''
  filters.bizItemCode = ''
  filters.modelCode = ''
  filters.source = ''
  load()
}

function openCreate() {
  Object.assign(modal.form, emptyForm())
  modal.editing = false
  modal.show = true
}

function openEdit(row) {
  modal.form.itemId = row.item_id
  modal.form.bizItemCode = row.biz_item_code || ''
  modal.form.modelCode = row.model_code || ''
  modal.form.source = row.source || 'manual'
  modal.form.note = row.note || ''
  modal.editing = true
  modal.show = true
}

function closeModal() {
  modal.show = false
}

async function save() {
  saving.value = true
  try {
    if (!modal.form.bizItemCode.trim() && !modal.form.modelCode.trim()) {
      window.$toast?.('商品编码和机型至少填写一个', 'error')
      return
    }
    const res = await window.electronAPI.upsertItemMapping({
      itemId: modal.form.itemId.trim(),
      bizItemCode: modal.form.bizItemCode.trim(),
      modelCode: modal.form.modelCode.trim(),
      source: modal.form.source,
      note: modal.form.note,
    })
    if (res.ok === false) {
      window.$toast?.(res.message || '保存失败', 'error')
    } else {
      window.$toast?.('已保存', 'success')
      modal.show = false
      await load()
    }
  } catch (e) {
    window.$toast?.(`保存失败：${e.message || e}`, 'error')
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  if (!confirm(`确定删除商品 ${row.item_id} 的绑定？`)) return
  try {
    const res = await window.electronAPI.deleteItemMapping({ itemId: row.item_id })
    if (res.ok) {
      window.$toast?.('已删除', 'success')
      await load()
    } else {
      window.$toast?.(res.message || '删除失败', 'error')
    }
  } catch (e) {
    window.$toast?.(`删除失败：${e.message || e}`, 'error')
  }
}

async function markDetailDirty(row) {
  try {
    const res = await window.electronAPI.markItemDetailDirty({
      itemId: row.item_id,
      reason: 'manual_ui',
    })
    if (res?.ok) {
      window.$toast?.('已标记，下一次该商品来消息会刷新详情', 'success')
    } else {
      window.$toast?.(res?.message || '标记失败', 'error')
    }
  } catch (e) {
    window.$toast?.(`标记失败：${e.message || e}`, 'error')
  }
}

onMounted(() => {
  runViewInitialization('商品业务绑定', async () => {
    await Promise.all([load(), loadListings()])
  })
})
</script>

<style scoped>
.page { padding: 16px 24px 40px; }
.panel { background: var(--panel-bg, #fff); border-radius: 10px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); margin-bottom: 16px; }
.filter-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.filter-field { display: flex; align-items: center; background: #f5f6f8; border-radius: 6px; padding: 4px 10px; flex: 1; min-width: 220px; }
.filter-field.short { flex: 0 0 220px; }
.filter-field input { background: transparent; border: none; outline: none; flex: 1; padding: 4px 6px; }
.ff-icon { opacity: 0.6; margin-right: 4px; }
.ff-select { background: #f5f6f8; border: none; border-radius: 6px; padding: 8px 10px; }
.banner { padding: 10px 14px; background: #fef3c7; border-radius: 6px; margin-bottom: 12px; }
.success-banner { background: #ecfdf5; color: #047857; }

.listing-panel { display: flex; flex-direction: column; gap: 14px; }
.listing-tools { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.listing-tools select { width: 130px; }
.listing-tools input { width: 260px; }
.listing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 14px; }
.listing-card { display: flex; gap: 14px; padding: 14px; border: 1px solid rgba(226,232,240,0.9); border-radius: 16px; background: #fff; }
.cover-box { width: 84px; height: 84px; flex: 0 0 84px; border-radius: 14px; background: #f1f5f9; overflow: hidden; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px; }
.cover-box img { width: 100%; height: 100%; object-fit: cover; }
.listing-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8px; }
.listing-title { font-weight: 800; color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.listing-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; color: var(--text-muted); font-size: 12px; }
.listing-edit-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto; gap: 8px; align-items: center; }
.listing-desc { color: var(--text-muted); font-size: 12px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.empty-listing { grid-column: 1 / -1; padding: 28px; border: 1px dashed #cbd5e1; border-radius: 14px; text-align: center; color: #94a3b8; }

.map-table { width: 100%; border-collapse: collapse; }
.map-table th, .map-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eef0f3; font-size: 13px; }
.map-table th { background: #fafbfc; font-weight: 600; color: #555; }
.map-table td.op, .map-table th.op { text-align: right; white-space: nowrap; }
.map-table td.op .btn + .btn { margin-left: 6px; }
.map-table td.remark { color: #666; max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.map-table td.dt { color: #888; font-size: 12px; font-variant-numeric: tabular-nums; }
.map-table td.empty { text-align: center; color: #999; padding: 28px 0; }
.map-table code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.map-table code.biz { background: #ede9fe; color: #6d28d9; }
.map-table code.model { background: #dbeafe; color: #1e40af; }

.pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.pill-manual { background: #dbeafe; color: #1e40af; }
.pill-infer { background: #f3f4f6; color: #6b7280; }
.pill-pending { background: #fef3c7; color: #92400e; }

.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-card { background: #fff; border-radius: 10px; width: 460px; max-width: 94vw; box-shadow: 0 10px 30px rgba(0,0,0,0.15); overflow: hidden; }
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #eef0f3; }
.modal-head h3 { margin: 0; font-size: 16px; }
.btn-close { background: transparent; border: none; cursor: pointer; font-size: 18px; color: #999; }
.modal-body { padding: 16px 18px; max-height: 70vh; overflow: auto; }
.modal-foot { padding: 12px 18px; border-top: 1px solid #eef0f3; display: flex; justify-content: flex-end; gap: 8px; }
.form-row { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.form-row label { font-size: 13px; color: #555; }
.form-row input, .form-row select { padding: 8px 10px; border: 1px solid #dcdfe3; border-radius: 6px; }
.form-row input:disabled { background: #f3f4f6; color: #666; }
.req { color: #dc2626; }

.btn { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; }
.btn-primary { background: #2563eb; color: #fff; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: #f1f3f5; color: #333; }
.btn-danger { background: #fee2e2; color: #b91c1c; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
</style>
