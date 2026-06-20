<template>
  <div class="page settings-page">
    <PageHeader
      title="系统设置"
      subtitle="统一维护模型、智能体、通知与顺丰履约配置。保存后机器人自动重载配置。"
      icon="⚙️"
      :breadcrumb="['配置中心', '系统设置']"
    >
      <template #actions>
        <span v-if="saved" class="save-ok">✓ 已保存</span>
        <button type="submit" form="settings-form" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中…' : '💾 保存配置' }}</button>
      </template>
    </PageHeader>

    <div v-if="loaded && !loadError" class="settings-body">
      <section class="panel overview-panel overview-panel-wide">
        <div class="overview-head">
          <div>
            <h2 class="section-title">配置总览</h2>
            <div class="panel-tip">把最常看的状态放在上面，先判断，再进入对应模块编辑。</div>
          </div>
          <div class="overview-tags">
            <span class="hero-chip">回复模式：{{ replyModeLabel }}</span>
            <span class="hero-chip">浏览器只读：{{ browserCollectOnlyMode ? '开启' : '关闭' }}</span>
            <span class="hero-chip">知识库 Top K：{{ form.KNOWLEDGE_TOP_K || 3 }}</span>
          </div>
        </div>
        <div class="overview-grid overview-grid-wide">
          <div class="overview-card">
            <span class="overview-label">接入模式</span>
            <strong class="overview-value">{{ channelModeLabel }}</strong>
          </div>
          <div class="overview-card">
            <span class="overview-label">当前模型</span>
            <strong class="overview-value">{{ form.MODEL_NAME || '未设置' }}</strong>
          </div>
          <div class="overview-card">
            <span class="overview-label">模型平台</span>
            <strong class="overview-value">{{ selectedPlatform?.name || '自定义' }}</strong>
          </div>
          <div class="overview-card accent-card">
            <span class="overview-label">已启用能力</span>
            <strong class="overview-value">{{ enabledFeatureCount }}</strong>
          </div>
        </div>
      </section>

      <section class="panel nav-panel nav-panel-wide">
        <div class="nav-panel-head">
          <div>
            <h2 class="section-title">模块导航</h2>
            <div class="panel-tip">按主题切换模块，右侧区域只展示当前配置，阅读更聚焦。</div>
          </div>
          <div class="inline-tips">
            <span>常改：基础配置 / 模型配置</span>
            <span>外部依赖：物流 / 闲管家建议保存后立即测试</span>
          </div>
        </div>
        <nav class="settings-nav-grid">
          <button
            v-for="section in sectionNav"
            :key="section.id"
            type="button"
            class="settings-nav-item"
            :class="{ active: activeModule === section.id }"
            @click="switchModule(section.id)"
          >
            <span class="nav-icon">{{ section.icon }}</span>
            <span class="nav-copy">
              <strong>{{ section.title }}</strong>
              <small>{{ section.desc }}</small>
            </span>
          </button>
        </nav>
      </section>

      <form id="settings-form" ref="moduleContentRef" @submit.prevent="save" class="settings-form settings-main">
        <section class="panel module-banner module-banner-wide">
          <div class="module-banner-copy">
            <div class="section-kicker">{{ activeSection?.icon }} 当前模块</div>
            <h2 class="section-title module-title">{{ activeSection?.title }}</h2>
            <div class="panel-tip">{{ activeSection?.desc }}</div>
          </div>
          <div class="module-quick-switch">
            <span>快速切换</span>
            <div class="module-tabs">
              <button
                v-for="section in sectionNav"
                :key="section.id"
                type="button"
                class="module-tab"
                :class="{ active: activeModule === section.id }"
                @click="switchModule(section.id, false)"
              >
                {{ section.icon }} {{ section.title }}
              </button>
            </div>
          </div>
          <div class="module-banner-meta">
            <div class="module-meta-item">
              <span>当前模式</span>
              <strong>{{ channelModeLabel }}</strong>
            </div>
            <div class="module-meta-item">
              <span>已启用能力</span>
              <strong>{{ enabledFeatureCount }}</strong>
            </div>
          </div>
        </section>

        <section v-show="activeModule === 'basic-config'" id="basic-config" class="settings-section settings-card">
          <div class="panel-header section-head">
            <div>
              <div class="section-kicker">🔑 系统入口</div>
              <h2 class="section-title">基础配置</h2>
              <div class="panel-tip">系统启动所需的基础认证信息与接入模式</div>
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-group">
              <label>接入模式</label>
              <select v-model="form.CHANNEL_MODE">
                <option value="api">接口模式（Cookie + 接口）</option>
                <option value="browser">浏览器模式（Playwright 接管）</option>
              </select>
              <p class="hint">接口模式保留现有链路；浏览器模式用真实浏览器接管。</p>
            </div>
            <div class="form-group span-two-mobile">
              <label>模型密钥</label>
              <div class="input-group">
                <input :type="showApiKey ? 'text' : 'password'" v-model="form.API_KEY" placeholder="填入模型密钥" />
                <button type="button" class="toggle-btn" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button>
              </div>
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-group span-two-mobile">
              <label>闲鱼 Cookies</label>
              <textarea v-model="form.COOKIES_STR" rows="4" :placeholder="form.CHANNEL_MODE === 'browser' ? '浏览器模式下可留空；接口模式建议填写或通过 CDP 刷新' : '粘贴闲鱼登录后的 Cookies' "></textarea>
            </div>
          </div>
          <div v-if="form.CHANNEL_MODE === 'browser'" class="form-row three-cols">
            <div class="form-group"><label>浏览器调试端口</label><input type="number" min="1" v-model.number="form.BROWSER_REMOTE_DEBUGGING_PORT" /></div>
            <div class="form-group"><label>扫描间隔（毫秒）</label><input type="number" min="500" v-model.number="form.BROWSER_POLL_INTERVAL_MS" /></div>
            <div class="form-group"><label>发送校验超时（毫秒）</label><input type="number" min="1000" v-model.number="form.BROWSER_SEND_VERIFY_TIMEOUT_MS" /></div>
          </div>
          <div v-if="form.CHANNEL_MODE === 'browser'" class="form-row three-cols">
            <div class="form-group">
              <label>最多读取最近会话（分钟）</label>
              <input type="number" min="0" max="1440" v-model.number="form.BROWSER_SESSION_MAX_AGE_MINUTES" />
              <p class="hint">默认 5。启动基线不点击；该窗口只约束未读候选和手动慢速历史同步，遇到更旧会话即停止。</p>
            </div>
            <div class="form-group">
              <label>单会话同步消息上限</label>
              <input type="number" min="0" max="200" v-model.number="form.BROWSER_HISTORY_SYNC_MAX_MESSAGES" />
              <p class="hint">默认 0，效仿接口模式：启动只建基线，不补历史；需要 AI 上下文时再填 5-20。</p>
            </div>
          </div>
          <div v-if="form.CHANNEL_MODE === 'browser'" class="form-row three-cols">
            <div class="form-group toggle-group cardish">
              <div><label>复用现有浏览器</label><p class="hint">开启后优先接管已开启调试端口的浏览器</p></div>
              <label class="switch"><input type="checkbox" v-model="browserUseExistingChrome" /><span class="slider"></span></label>
            </div>
            <div class="form-group toggle-group cardish">
              <div><label>自动打开浏览器</label><p class="hint">关闭后不会弹新 Chrome；请提前打开带调试端口的 Chrome 并登录</p></div>
              <label class="switch"><input type="checkbox" v-model="browserAutoLaunch" /><span class="slider"></span></label>
            </div>
            <div class="form-group toggle-group cardish">
              <div><label>只回复我发布的帖子</label><p class="hint">默认开启，更安全；别人帖子的会话直接忽略</p></div>
              <label class="switch"><input type="checkbox" v-model="browserOnlyReplyMyListings" /><span class="slider"></span></label>
            </div>
          </div>
          <div v-if="form.CHANNEL_MODE === 'browser'" class="form-row three-cols">
            <div class="form-group toggle-group cardish">
              <div><label>浏览器只读采集模式</label><p class="hint">启动后只记录 / 同步历史消息，绝不自动发送回复；适合登录大号做知识库沉淀</p></div>
              <label class="switch"><input type="checkbox" v-model="browserCollectOnlyMode" /><span class="slider"></span></label>
            </div>
          </div>
          <div v-if="form.CHANNEL_MODE === 'browser'" class="form-row two-cols">
            <div class="form-group span-two-mobile">
              <label>帖子归属关键词</label>
              <textarea v-model="form.LISTING_OWNER_KEYWORDS" rows="3" placeholder="可用逗号或换行分隔；帖子详情命中任一关键词时视为本人帖子&#10;例如：本店自营&#10;商品编码："></textarea>
              <p class="hint">owner 缺失时使用：详情同时含“商品编码 + 机型”会自动视为本人；这里填写的关键词也会作为本人标记。明确识别为别人 owner 的帖子仍跳过。</p>
            </div>
          </div>
        </section>

        <section v-show="activeModule === 'model-config'" id="model-config" class="settings-section settings-card">
          <div class="panel-header section-head">
            <div>
              <div class="section-kicker">🧠 模型接入</div>
              <h2 class="section-title">模型配置</h2>
              <div class="panel-tip">选择模型平台并维护基础模型参数</div>
            </div>
          </div>
          <div class="form-group">
            <label>快速选择平台</label>
            <div class="platform-grid">
              <button v-for="p in platforms" :key="p.name" type="button" class="platform-btn" :class="{ active: form.MODEL_BASE_URL === p.baseUrl }" @click="selectPlatform(p)">{{ p.name }}</button>
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-group">
              <label>模型接口地址</label>
              <input v-model="form.MODEL_BASE_URL" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
            </div>
            <div class="form-group">
              <label>模型名称</label>
              <input v-model="form.MODEL_NAME" list="model-suggestions" placeholder="qwen-max" />
              <datalist id="model-suggestions"><option v-for="m in modelSuggestions" :key="m" :value="m" /></datalist>
              <p v-if="selectedPlatform" class="hint">{{ selectedPlatform.hint }}</p>
            </div>
          </div>
        </section>

        <section v-show="activeModule === 'agent-config'" id="agent-config" class="settings-section settings-card">
          <div class="panel-header section-head">
            <div>
              <div class="section-kicker">🤖 回复策略</div>
              <h2 class="section-title">租赁智能体配置</h2>
              <div class="panel-tip">回复模式、人工接管与增强能力控制</div>
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-group">
              <label>回复模式</label>
              <select v-model="form.REPLY_MODE_DEFAULT">
                <option value="faq_strict">严格知识库模式</option>
                <option value="boundary_augmented">增强回答模式</option>
              </select>
              <p class="hint">严格知识库模式仅使用知识库；增强回答模式允许在边界内补充回答。</p>
            </div>
            <div class="form-group">
              <label>默认物流方式</label>
              <select v-model="form.DEFAULT_SHIPPING_MODE">
                <option value="land">陆运</option>
                <option value="express">普通快递</option>
                <option value="next_morning">次晨达</option>
              </select>
            </div>
          </div>

          <div class="form-row three-cols">
            <div class="form-group toggle-group cardish">
              <div><label>电话升级通知</label><p class="hint">人工接管超时后是否触发电话升级</p></div>
              <label class="switch"><input type="checkbox" v-model="phoneAlertEnabled" /><span class="slider"></span></label>
            </div>
            <div class="form-group toggle-group cardish">
              <div><label>小红书增强</label><p class="hint">增强回答模式下允许推荐小红书参考</p></div>
              <label class="switch"><input type="checkbox" v-model="xiaohongshuEnabled" /><span class="slider"></span></label>
            </div>
            <div class="form-group toggle-group cardish">
              <div><label>模拟人工输入延迟</label><p class="hint">发送前增加拟人延迟</p></div>
              <label class="switch"><input type="checkbox" v-model="simulateHumanTyping" /><span class="slider"></span></label>
            </div>
          </div>

          <div class="form-row three-cols">
            <div class="form-group"><label>人工接管超时（秒）</label><input type="number" min="60" v-model.number="form.MANUAL_TAKEOVER_TIMEOUT_SEC" /></div>
            <div class="form-group"><label>电话勿扰开始</label><input type="time" v-model="form.PHONE_DND_START" /></div>
            <div class="form-group"><label>电话勿扰结束</label><input type="time" v-model="form.PHONE_DND_END" /></div>
          </div>

          <div class="form-row three-cols">
            <div class="form-group"><label>提前送达天数</label><input type="number" min="0" v-model.number="form.SHIP_ARRIVE_AHEAD_DAYS" /></div>
            <div class="form-group"><label>知识库 Top K</label><input type="number" min="1" v-model.number="form.KNOWLEDGE_TOP_K" /></div>
            <div class="form-group"><label>人工接管关键词</label><input v-model="form.TOGGLE_KEYWORDS" placeholder="。" /></div>
          </div>

          <div class="subsection-title">高级能力开关（Sprint 3/5/6）</div>
          <p class="hint" style="margin: 4px 0 10px">以下开关默认关闭，用于灰度启用新决策层。请先在测试会话验证后再全量打开。</p>
          <div class="form-row three-cols">
            <div class="form-group toggle-group cardish">
              <div><label>意图路由 (INTENT_ROUTER)</label><p class="hint">启用 价格/档期/物流 等显式意图分类，供上层做拦截或结构化回答</p></div>
              <label class="switch"><input type="checkbox" v-model="intentRouterEnabled" /><span class="slider"></span></label>
            </div>
            <div class="form-group toggle-group cardish">
              <div><label>结构化报价 (QUOTE_SERVICE)</label><p class="hint">命中价格意图时改用 pricing_repository 出稳定报价，未配置 SKU 时走人工</p></div>
              <label class="switch"><input type="checkbox" v-model="quoteServiceEnabled" /><span class="slider"></span></label>
            </div>
            <div class="form-group toggle-group cardish">
              <div><label>建单状态机 (BOOKING_FSM)</label><p class="hint">识别下单信号后按 收件信息→租期→确认 状态机推进，最终生成订单草稿</p></div>
              <label class="switch"><input type="checkbox" v-model="bookingFsmEnabled" /><span class="slider"></span></label>
            </div>
          </div>
          <div class="form-row three-cols">
            <div class="form-group toggle-group cardish">
              <div><label>意图路由仅记录</label><p class="hint">只打日志、不实际拦截，用于观察分类准确度（仅 INTENT_ROUTER 启用时生效）</p></div>
              <label class="switch"><input type="checkbox" v-model="intentRouterLogOnly" :disabled="!intentRouterEnabled" /><span class="slider"></span></label>
            </div>
          </div>

          <div class="subsection-title">会话回复状态机</div>
          <p class="hint" style="margin: 4px 0 10px">控制默认回复的重复发送、人工介入感知、冷却期催促兜底等行为，避免连续打扰买家。</p>
          <div class="form-row three-cols">
            <div class="form-group toggle-group cardish">
              <div><label>启用会话状态机</label><p class="hint">关闭后退回老逻辑（自动进入 manual）</p></div>
              <label class="switch"><input type="checkbox" v-model="sessionStateEnabled" /><span class="slider"></span></label>
            </div>
            <div class="form-group toggle-group cardish">
              <div><label>启用催促兜底消息</label><p class="hint">冷却超过阈值且买家再次催问时发送</p></div>
              <label class="switch"><input type="checkbox" v-model="takeoverFollowupEnabled" /><span class="slider"></span></label>
            </div>
            <div class="form-group"><label>冷却时间（分钟）</label><input type="number" min="1" v-model.number="form.COOLDOWN_MIN" /></div>
          </div>
          <div class="form-row three-cols">
            <div class="form-group"><label>通知节流（分钟）</label><input type="number" min="1" v-model.number="form.NOTIFY_THROTTLE_MIN" /></div>
            <div class="form-group"><label>人工空闲判定（分钟）</label><input type="number" min="1" v-model.number="form.HUMAN_IDLE_MIN" /></div>
            <div class="form-group"><label>兜底触发阈值（分钟）</label><input type="number" min="1" v-model.number="form.TAKEOVER_FOLLOWUP_MIN" /></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex: 1">
              <label>兜底催促语</label>
              <textarea v-model="form.TAKEOVER_FOLLOWUP_TEXT" rows="2" placeholder="不好意思让您久等了，我这边处理完马上回复您哈"></textarea>
              <p class="hint">冷却期内买家催问一次时发送（每个冷却周期最多一次）</p>
            </div>
          </div>
        </section>

        <section v-show="activeModule === 'notify-config'" id="notify-config" class="settings-section settings-card">
          <div class="panel-header section-head">
            <div>
              <div class="section-kicker">🔔 履约协同</div>
              <h2 class="section-title">通知与物流配置</h2>
              <div class="panel-tip">通知渠道、物流轨迹与顺丰时效都在这一组维护</div>
            </div>
          </div>
          <div class="subsection-title">飞书自建应用</div>
          <div class="form-row three-cols">
            <div class="form-group"><label>飞书应用 App ID</label><input v-model="form.FEISHU_APP_ID" placeholder="应用凭证中的 App ID" /></div>
            <div class="form-group"><label>飞书应用 App Secret</label><input v-model="form.FEISHU_APP_SECRET" placeholder="应用凭证中的 App Secret" /></div>
            <div class="form-group"><label>事件校验 Token</label><input v-model="form.FEISHU_VERIFICATION_TOKEN" placeholder="事件与回调中的 Verification Token" /></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex: 1">
              <label>消息加密 Key</label>
              <input v-model="form.FEISHU_ENCRYPT_KEY" placeholder="如果飞书事件开启消息加密，这里填写 Encrypt Key；未开启可留空" />
              <p class="hint">这组配置用于“飞书里直接发消息查档期 / 记档期”。保留下面两个 Webhook，可继续往群里发通知。</p>
            </div>
          </div>
          <div class="subsection-title">飞书查档期回复模板</div>
          <div class="form-row two-cols">
            <div class="form-group">
              <label>有档期回复模板</label>
              <textarea
                v-model="form.MOBILE_AVAILABLE_REPLY_TEMPLATE"
                rows="5"
                placeholder="宝，这边看了下，{型号} {开始日期}到{结束日期}是有档期的哈～&#10;这几天租金一共是{租金}。&#10;免押的话需要{免押条件}。"
              ></textarea>
              <p class="hint">可用变量：{型号}、{开始日期}、{结束日期}、{租金}、{免押条件}、{档期状态}</p>
            </div>
            <div class="form-group">
              <label>无档期回复模板</label>
              <textarea
                v-model="form.MOBILE_UNAVAILABLE_REPLY_TEMPLATE"
                rows="5"
                placeholder="宝，不好意思，这边看了下，{型号} {开始日期}到{结束日期}暂时没有档期咯。"
              ></textarea>
              <p class="hint">飞书查档期卡片会生成单独的可复制话术，不再混在档期详情里。</p>
            </div>
          </div>

          <div class="subsection-title">飞书群机器人 Webhook</div>
          <div class="form-row two-cols">
            <div class="form-group"><label>飞书销售接管 Webhook</label><textarea v-model="form.FEISHU_WEBHOOK_SALES" rows="3" placeholder="用于接管 / 议价 / 常见问答未命中通知"></textarea></div>
            <div class="form-group"><label>飞书履约通知 Webhook</label><textarea v-model="form.FEISHU_WEBHOOK_ORDER" rows="3" placeholder="用于出单 / 物流更新通知"></textarea></div>
          </div>

          <div class="subsection-title">真实物流查询</div>
          <div class="form-row three-cols">
            <div class="form-group toggle-group cardish">
              <div><label>真实物流查询</label><p class="hint">开启后使用第三方物流查询接口</p></div>
              <label class="switch"><input type="checkbox" v-model="logisticsEnabled" /><span class="slider"></span></label>
            </div>
            <div class="form-group"><label>物流查询接口地址</label><input v-model="form.LOGISTICS_QUERY_API" placeholder="https://example.com/logistics/query" /></div>
            <div class="form-group"><label>物流查询令牌</label><input v-model="form.LOGISTICS_QUERY_TOKEN" placeholder="可选" /></div>
          </div>

          <div class="subsection-title">顺丰开放平台与寄件</div>
          <div class="form-row three-cols">
            <div class="form-group toggle-group cardish">
              <div><label>顺丰时效查询</label><p class="hint">开启后先取 accessToken，再调用时效标准查询接口</p></div>
              <label class="switch"><input type="checkbox" v-model="sfOpenEnabled" /><span class="slider"></span></label>
            </div>
            <div class="form-group"><label>顾客编码</label><input v-model="form.SF_APP_ID" placeholder="请输入顺丰 App ID" /></div>
            <div class="form-group"><label>密钥 Secret</label><input type="password" v-model="form.SF_APP_KEY" placeholder="OAuth2 secret" /></div>
          </div>
          <div class="form-row three-cols">
            <div class="form-group"><label>顺丰鉴权接口地址</label><input v-model="form.SF_TOKEN_API" placeholder="https://bspgw.sf-express.com/oauth2/accessToken" /></div>
            <div class="form-group"><label>顺丰时效查询接口地址</label><input v-model="form.SF_PREORDER_API" placeholder="https://bspgw.sf-express.com/std/service" /></div>
            <div class="form-group"><label>川内特殊地区</label><input v-model="form.SF_SICHUAN_SPECIAL_REGIONS" placeholder="甘孜,阿坝" /></div>
          </div>
          <div class="form-row three-cols">
            <div class="form-group"><label>寄件省</label><input v-model="form.SF_SENDER_PROVINCE" placeholder="四川省" /></div>
            <div class="form-group"><label>寄件市</label><input v-model="form.SF_SENDER_CITY" placeholder="成都市" /></div>
            <div class="form-group"><label>寄件区县</label><input v-model="form.SF_SENDER_DISTRICT" placeholder="区 / 县" /></div>
          </div>
          <div class="form-row three-cols">
            <div class="form-group"><label>寄件详细地址</label><input v-model="form.SF_SENDER_ADDRESS" placeholder="详细地址" /></div>
            <div class="form-group"><label>寄件联系人</label><input v-model="form.SF_SENDER_CONTACT" placeholder="寄件人姓名" /></div>
            <div class="form-group"><label>寄件手机号</label><input v-model="form.SF_SENDER_MOBILE" placeholder="顺丰寄件手机号" /></div>
          </div>
          <div class="form-row three-cols">
            <div class="form-group"><label>月结卡号</label><input type="password" v-model="form.SF_MONTHLY_CARD" placeholder="可选；未配置则按寄付下单" /></div>
            <div class="form-group"><label>货物名称</label><input v-model="form.SF_CARGO_NAME" placeholder="租赁设备" /></div>
            <div class="form-group"><label>顺丰标快产品编码</label><input v-model="form.SF_STANDARD_EXPRESS_TYPE_ID" placeholder="2" /></div>
          </div>
          <div class="form-row three-cols">
            <div class="form-group"><label>顺丰半日达产品编码</label><input v-model="form.SF_HALF_DAY_EXPRESS_TYPE_ID" placeholder="263" /></div>
            <div class="form-group"><label>川内默认寄件小时</label><input type="number" min="0" max="23" v-model.number="form.SF_DEFAULT_SEND_HOUR" /></div>
            <div class="form-group"><label>特殊地区寄件小时</label><input type="number" min="0" max="23" v-model.number="form.SF_SPECIAL_SEND_HOUR" /></div>
          </div>
          <div class="subsection-title">顺丰同城询价</div>
          <p class="hint">同城当前仅支持费用与时效查询，不执行正式下单。</p>
          <div class="form-row three-cols">
            <div class="form-group"><label>接口地址</label><input v-model="form.SF_INTRACITY_API" placeholder="同城 FEE_TIME_SERVICE 地址" /></div>
            <div class="form-group"><label>CompanyCode</label><input v-model="form.SF_INTRACITY_COMPANY_CODE" placeholder="CompanyCode" /></div>
            <div class="form-group"><label>AccessCode</label><input type="password" v-model="form.SF_INTRACITY_ACCESS_CODE" placeholder="AccessCode" /></div>
          </div>
          <div class="form-row three-cols">
            <div class="form-group"><label>Checkword</label><input type="password" v-model="form.SF_INTRACITY_CHECKWORD" placeholder="Checkword" /></div>
            <div class="form-group"><label>ProjectCode</label><input v-model="form.SF_INTRACITY_PROJECT_CODE" placeholder="ProjectCode" /></div>
            <div class="form-group"><label>ShopId</label><input v-model="form.SF_INTRACITY_SHOP_ID" placeholder="ShopId" /></div>
          </div>
          <div class="form-row three-cols">
            <div class="form-group"><label>ShopType</label><input v-model="form.SF_INTRACITY_SHOP_TYPE" placeholder="2" /></div>
          </div>
        </section>

        <section v-show="activeModule === 'xgj-config'" id="xgj-config" class="settings-section settings-card">
          <div class="panel-header section-head">
            <div>
              <div class="section-kicker">🛒 平台联动</div>
              <h2 class="section-title">闲管家开放平台 (open.goofish.pro)</h2>
              <div class="panel-tip">接入官方开放平台后，可直接拉取订单/商品、调用物流发货等接口</div>
            </div>
            <div class="page-actions">
              <button type="button" class="btn btn-secondary btn-sm" @click="testXgj" :disabled="xgjTesting">
                {{ xgjTesting ? '测试中...' : '测试连接' }}
              </button>
            </div>
          </div>
          <div class="form-row three-cols">
            <div class="form-group"><label>AppKey (appid)</label><input v-model="form.xgj_appid" placeholder="开放平台自研应用的 AppKey" /></div>
            <div class="form-group">
              <label>AppSecret</label>
              <div class="input-group">
                <input :type="showXgjSecret ? 'text' : 'password'" v-model="form.xgj_app_secret" placeholder="AppSecret，不会上传到任何第三方" />
                <button type="button" class="toggle-btn" @click="showXgjSecret = !showXgjSecret">{{ showXgjSecret ? '隐藏' : '显示' }}</button>
              </div>
            </div>
            <div class="form-group"><label>SellerId（可选）</label><input v-model="form.xgj_seller_id" placeholder="商务对接才需要，自研/ERP 留空" /></div>
          </div>
          <div class="form-row two-cols">
            <div class="form-group">
              <label>Base URL</label>
              <input v-model="form.xgj_base_url" placeholder="https://open.goofish.pro" />
              <p class="hint">默认使用正式环境，一般不用改。</p>
            </div>
            <div class="form-group">
              <label>签名模式</label>
              <select v-model="form.xgj_sign_mode">
                <option value="default">default · md5(secret+appid+ts+body)</option>
                <option value="sorted_query">sorted_query · md5(secret+排序query+body+secret)</option>
              </select>
              <p class="hint">若调用失败返回"签名失败"，切换到另一个模式再试。</p>
            </div>
          </div>
          <div v-if="xgjTestResult" class="form-row">
            <div class="form-group cardish" :class="{ 'xgj-ok': xgjTestResult.ok, 'xgj-fail': !xgjTestResult.ok }">
              <label>测试结果</label>
              <pre class="xgj-result-pre">{{ xgjTestResult.text }}</pre>
            </div>
          </div>
        </section>

        <section v-show="activeModule === 'market-config'" id="market-config" class="settings-section settings-card">
          <div class="panel-header section-head">
            <div>
              <div class="section-kicker">📈 外部观察</div>
              <h2 class="section-title">市场监控配置</h2>
              <div class="panel-tip">定时抓取竞品价格与数量，检测异常波动</div>
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-group">
              <label>监控关键词</label>
              <textarea v-model="form.MARKET_MONITOR_KEYWORDS" rows="5" placeholder="每行格式：型号代码:搜索关键词&#10;例如：&#10;A7M4:索尼A7M4 出租&#10;R5:佳能R5 出租"></textarea>
              <p class="hint">每行一条，冒号分隔型号代码和搜索词。留空则不启动市场监控。</p>
            </div>
            <div class="form-group">
              <label>扫描间隔（分钟）</label>
              <input type="number" min="10" v-model.number="form.MARKET_SCAN_INTERVAL_MIN" />
              <p class="hint">默认 60 分钟扫描一次</p>
            </div>
          </div>
        </section>

        <section v-show="activeModule === 'inquiry-optimization'" id="inquiry-optimization" class="settings-section settings-card">
          <div class="panel-header section-head">
            <div>
              <div class="section-kicker">🎯 询单优化</div>
              <h2 class="section-title">询单优化与成本配置</h2>
              <div class="panel-tip">维护询单分析窗口、ROI 阈值和履约成本参数，供询单分析页输出补货、调价和观察建议。</div>
            </div>
            <div class="page-actions">
              <span v-if="optimizationSaved" class="save-ok">✓ 已保存</span>
              <button type="button" class="btn btn-primary btn-sm" :disabled="optimizationSaving" @click="saveOptimizationConfig">
                {{ optimizationSaving ? '保存中…' : '保存询单优化配置' }}
              </button>
            </div>
          </div>

          <div class="form-row three-cols">
            <div class="form-group">
              <label>分析窗口（天）</label>
              <input v-model.number="optimizationConfig.analysisWindowDays" type="number" min="1" />
              <p class="hint">询单与订单汇总默认回看天数。</p>
            </div>
            <div class="form-group">
              <label>ROI 下限</label>
              <input v-model.number="optimizationConfig.targetMonthlyRoiMin" type="number" min="0" step="0.01" />
              <p class="hint">达到该月化 ROI 时，可支持补货建议。</p>
            </div>
            <div class="form-group">
              <label>ROI 上限</label>
              <input v-model.number="optimizationConfig.targetMonthlyRoiMax" type="number" min="0" step="0.01" />
              <p class="hint">低于该上限且询单紧张时，可尝试提价。</p>
            </div>
          </div>

          <div class="form-row three-cols">
            <div class="form-group">
              <label>调价步长</label>
              <input v-model.number="optimizationConfig.priceStep" type="number" min="1" step="1" />
            </div>
            <div class="form-group">
              <label>最大调价幅度</label>
              <input v-model.number="optimizationConfig.maxPriceAdjustment" type="number" min="0" step="1" />
            </div>
            <div class="form-group">
              <label>最少询单样本</label>
              <input v-model.number="optimizationConfig.minInquirySamples" type="number" min="0" step="1" />
            </div>
          </div>

          <div class="form-row three-cols">
            <div class="form-group">
              <label>最少成单样本</label>
              <input v-model.number="optimizationConfig.minOrderSamples" type="number" min="0" step="1" />
            </div>
            <div class="form-group">
              <label>平台费率</label>
              <input v-model.number="optimizationConfig.platformFeeRate" type="number" min="0" step="0.001" />
              <p class="hint">按订单金额比例计算平台成本，例如 0.016 表示 1.6%。</p>
            </div>
            <div class="form-group">
              <label>免押每 100 元费用</label>
              <input v-model.number="optimizationConfig.depositFreePer100Fee" type="number" min="0" step="0.1" />
            </div>
          </div>

          <div class="form-row three-cols">
            <div class="form-group">
              <label>免押每单固定成本</label>
              <input v-model.number="optimizationConfig.depositFreeOrderCost" type="number" min="0" step="0.1" />
            </div>
            <div class="form-group">
              <label>运费分摊方式</label>
              <select v-model="optimizationConfig.shippingAllocationMode">
                <option value="order_count">按订单数均摊</option>
              </select>
            </div>
            <div class="form-group">
              <label>月账单提醒日</label>
              <input v-model.number="optimizationConfig.shippingBillReminderDay" type="number" min="1" max="31" step="1" />
            </div>
          </div>

          <div class="subsection-title">补充成本录入</div>
          <div class="form-row utility-grid">
            <div class="form-group utility-card">
              <label>录入单条费用</label>
              <div class="inline-form-grid">
                <input v-model="expenseForm.model_code" placeholder="型号代码，如 A7M4" />
                <select v-model="expenseForm.expense_type">
                  <option value="repair">维修</option>
                  <option value="shipping_sf">顺丰运费</option>
                  <option value="other">其他成本</option>
                </select>
                <input v-model.number="expenseForm.amount" type="number" min="0" step="0.01" placeholder="金额" />
                <input v-model="expenseForm.expense_date" type="date" />
                <input v-model="expenseForm.order_id" type="number" min="0" step="1" placeholder="订单 ID（可选）" />
                <input v-model="expenseForm.unit_id" type="number" min="0" step="1" placeholder="设备 ID（可选）" />
              </div>
              <textarea v-model="expenseForm.description" rows="2" placeholder="费用说明，例如：屏幕维修 / 临时补运费"></textarea>
              <div class="utility-actions">
                <span class="hint">保存到 `expense_records`，供询单优化和报表汇总使用。</span>
                <button type="button" class="btn btn-secondary btn-sm" :disabled="expenseSaving" @click="saveExpense">
                  {{ expenseSaving ? '保存中…' : '保存费用记录' }}
                </button>
              </div>
            </div>

            <div class="form-group utility-card">
              <label>上传月度顺丰账单</label>
              <div class="inline-form-grid inline-form-grid-bill">
                <input v-model="shippingBillForm.month" type="month" />
                <input v-model.number="shippingBillForm.amount" type="number" min="0" step="0.01" placeholder="账单金额" />
              </div>
              <textarea v-model="shippingBillForm.note" rows="2" placeholder="备注，例如：2026 年 6 月顺丰月结账单"></textarea>
              <div class="utility-actions">
                <span class="hint">将按当前运费分摊方式写入共享运费成本。</span>
                <button type="button" class="btn btn-secondary btn-sm" :disabled="shippingBillSaving" @click="uploadShippingBill">
                  {{ shippingBillSaving ? '上传中…' : '上传月度账单' }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section v-show="activeModule === 'deposit-config'" id="deposit-config" class="settings-section settings-card">
          <div class="panel-header section-head">
            <div>
              <div class="section-kicker">💳 支付宝免押</div>
              <h2 class="section-title">免押接口配置</h2>
              <div class="panel-tip">
                支付宝免押开放平台接口（POST /openapi/order/createMerchantDepositOrder）。<br />
                ⚠️ 真实请求通过 Electron 主进程代理，不在前端直接 fetch。<br />
                ⚠️ appId / appSecret 为敏感凭据，建议本地测试使用；正式环境不应保存在前端。
              </div>
            </div>
            <div class="page-actions">
              <span v-if="depositSaved" class="save-ok">✓ 已保存</span>
              <button type="button" class="btn btn-secondary btn-sm" @click="resetDepositConfig">恢复默认</button>
              <button type="button" class="btn btn-primary btn-sm" :disabled="depositSaving" @click="saveDepositConfig">
                {{ depositSaving ? '保存中…' : '💾 保存免押配置' }}
              </button>
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label>接口模式</label>
              <select v-model="depositSettings.api.mode">
                <option value="mock">Mock（本地模拟）</option>
                <option value="real">Real（真实接口，通过主进程代理）</option>
              </select>
              <p class="hint">默认 Mock。切换 Real 前请确保 appId/appSecret/userEid/baseUrl 已配置。</p>
            </div>
            <div class="form-group">
              <label>Base URL</label>
              <input v-model="depositSettings.api.baseUrl" placeholder="https://api.example.com" />
              <p class="hint">免押开放平台接口地址，例如 https://your-domain.com</p>
            </div>
          </div>

          <div class="subsection-title">敏感凭据（保存在主进程 SQLite 配置中，不会暴露在前端页面）</div>
          <div class="form-row two-cols">
            <div class="form-group">
              <label>appId</label>
              <div class="input-group">
                <input :type="showDepositToken ? 'text' : 'password'" v-model="form.DEPOSIT_APP_ID" placeholder="开放平台分配的 appId" />
                <button type="button" class="toggle-btn" @click="showDepositToken = !showDepositToken">{{ showDepositToken ? '隐藏' : '显示' }}</button>
              </div>
              <p class="hint">必填。点击顶部 💾 保存配置 按钮保存到主进程。</p>
            </div>
            <div class="form-group">
              <label>appSecret</label>
              <div class="input-group">
                <input :type="showDepositApiKey ? 'text' : 'password'" v-model="form.DEPOSIT_APP_SECRET" placeholder="开放平台分配的 appSecret" />
                <button type="button" class="toggle-btn" @click="showDepositApiKey = !showDepositApiKey">{{ showDepositApiKey ? '隐藏' : '显示' }}</button>
              </div>
              <p class="hint">必填。敏感信息，不会回传给前端页面。</p>
            </div>
          </div>

          <div class="subsection-title">接口参数</div>
          <div class="form-row three-cols">
            <div class="form-group">
              <label>userEid（服务商 EID）</label>
              <input v-model="depositSettings.api.userEid" placeholder="必填" />
              <p class="hint">创建免押单时 Header 必传。</p>
            </div>
            <div class="form-group">
              <label>请求超时 (ms)</label>
              <input type="number" min="1000" v-model.number="depositSettings.api.timeoutMs" />
            </div>
            <div class="form-group">
              <label>回调地址 notify_url</label>
              <input v-model="depositSettings.api.notifyUrl" placeholder="选填，异步通知地址" />
              <p class="hint">真实平台需要可公网访问的回调地址；本地测试可转发到 {{ depositLocalNotifyUrl }}。</p>
              <p class="hint">
                本地回调接收器：
                <strong>{{ depositNotifyServerStatus?.running ? '运行中' : '未启动' }}</strong>
                <button type="button" class="btn btn-secondary btn-sm inline-action" @click="copyDepositLocalNotifyUrl">复制本地地址</button>
                <button type="button" class="btn btn-secondary btn-sm inline-action" @click="refreshDepositNotifyServerStatus">刷新状态</button>
              </p>
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label>合同补充内容模板</label>
              <textarea v-model="depositSettings.api.contractSupplementaryContent" rows="2" placeholder="选填。留空则自动拼接：来源订单 / 型号 / 设备编号"></textarea>
            </div>
            <div class="form-group">
              <label>收货信息兜底文案</label>
              <input v-model="depositSettings.api.receivingInfoFallback" placeholder="待补充" />
              <p class="hint">当订单无完整收货信息时的默认填充文案。</p>
            </div>
          </div>
        </section>

        <section v-show="activeModule === 'deposit-config'" id="deposit-display-config" class="settings-section settings-card">
          <div class="panel-header section-head">
            <div>
              <div class="section-kicker">🖼️ 海报展示</div>
              <h2 class="section-title">海报与展示文案配置</h2>
              <div class="panel-tip">免押审核海报中的固定文案、联系方式与流程步骤。创建免押单和保存海报时生效。</div>
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label>商户名称</label>
              <input v-model="depositSettings.display.merchantName" placeholder="小狗相机租赁" />
            </div>
            <div class="form-group">
              <label>海报标题</label>
              <input v-model="depositSettings.display.posterTitle" placeholder="小狗相机租赁 · 支付宝免押确认" />
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label>海报副标题</label>
              <input v-model="depositSettings.display.posterSubtitle" placeholder="请使用支付宝扫码完成免押授权" />
            </div>
            <div class="form-group">
              <label>二维码提示文字</label>
              <input v-model="depositSettings.display.posterQRHint" placeholder="打开支付宝扫一扫" />
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label>二维码失败提示</label>
              <input v-model="depositSettings.display.posterQRFallback" placeholder="二维码加载失败 请复制邀约文本" />
            </div>
            <div class="form-group">
              <label>有效期文案</label>
              <input v-model="depositSettings.display.expiresInText" placeholder="24小时" />
            </div>
          </div>

          <div class="form-row three-cols">
            <div class="form-group">
              <label>有效期标签</label>
              <input v-model="depositSettings.display.expiresInLabel" placeholder="二维码有效期：24小时" />
            </div>
            <div class="form-group">
              <label>联系电话</label>
              <input v-model="depositSettings.display.contactPhones" placeholder="19822964925，13060186655" />
            </div>
            <div class="form-group">
              <label>工作时间</label>
              <input v-model="depositSettings.display.workTime" placeholder="09:30-00:30" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex: 1">
              <label>温馨提示标题</label>
              <input v-model="depositSettings.display.tipsTitle" placeholder="温馨提示" />
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label>温馨提示（每行一条）</label>
              <textarea v-model="depositSettings.display.tips" rows="5" placeholder="1. 请确认支付宝账号为本人实名账号&#10;2. 如扫码后无反应，请使用最新版支付宝重试&#10;3. 本二维码有效期为 24 小时，过期请联系商家重新生成&#10;4. 免押结果将同步给商家"></textarea>
            </div>
            <div class="form-group">
              <label>流程步骤（每行一条）</label>
              <textarea v-model="depositSettings.display.processSteps" rows="5" placeholder="支付宝扫码&#10;核对信息&#10;信用评估&#10;开启免押"></textarea>
            </div>
          </div>
        </section>

        <section v-show="activeModule === 'advanced-config'" id="advanced-config" class="settings-section settings-card">
          <div class="panel-header section-head">
            <div>
              <div class="section-kicker">🛠 运行细节</div>
              <h2 class="section-title expandable" @click="showAdvanced = !showAdvanced">高级配置<span class="chevron">{{ showAdvanced ? '收起' : '展开' }}</span></h2>
              <div class="panel-tip">这些参数影响心跳、重试、日志上限等底层行为，建议按需调整。</div>
            </div>
          </div>
          <div v-if="showAdvanced" class="advanced-grid">
            <div class="form-group" v-for="field in advancedFields" :key="field.key">
              <label>{{ field.label }}</label>
              <input type="number" v-model.number="form[field.key]" :min="field.min" />
              <p class="hint">{{ field.hint }}</p>
            </div>
          </div>
        </section>
      </form>
    </div>
    <section v-else-if="loadError" class="panel settings-load-error">
      <EmptyState
        title="系统设置加载失败"
        :hint="loadError"
        icon="!"
        tone="warning"
      >
        <button class="btn btn-primary" @click="loadPage">重新加载</button>
      </EmptyState>
    </section>
    <div v-else class="loading">加载中...</div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBotStore } from '../stores/botStore'
import PageHeader from '../components/PageHeader.vue'
import EmptyState from '../components/EmptyState.vue'
import { runViewInitialization } from '../utils/viewInitialization.mjs'
import { getDepositSettings, saveDepositSettings, resetDepositSettings } from '../services/depositSettingsService.js'
const form = ref({})
const botStore = useBotStore()
const route = useRoute()
const router = useRouter()
const loaded = ref(false)
const loadError = ref('')
const saving = ref(false)
const saved = ref(false)
const showApiKey = ref(false)
const showAdvanced = ref(false)
const activeModule = ref('basic-config')
const moduleContentRef = ref(null)
const showXgjSecret = ref(false)
const xgjTesting = ref(false)
const xgjTestResult = ref(null)

// ── 免押配置独立状态（localStorage，不走主进程 IPC） ──
const depositSaving = ref(false)
const depositSaved = ref(false)
const showDepositToken = ref(false)
const showDepositApiKey = ref(false)
const depositNotifyServerStatus = ref(null)
const optimizationSaving = ref(false)
const optimizationSaved = ref(false)
const expenseSaving = ref(false)
const shippingBillSaving = ref(false)
const optimizationConfig = reactive({
  analysisWindowDays: 14,
  targetMonthlyRoiMin: 0.1,
  targetMonthlyRoiMax: 0.15,
  priceStep: 5,
  maxPriceAdjustment: 10,
  minInquirySamples: 5,
  minOrderSamples: 2,
  platformFeeRate: 0.016,
  depositFreePer100Fee: 1.5,
  depositFreeOrderCost: 3.5,
  shippingAllocationMode: 'order_count',
  shippingBillReminderDay: 1,
})
const expenseForm = reactive({
  model_code: '',
  unit_id: '',
  expense_type: 'repair',
  amount: '',
  description: '',
  expense_date: '',
  order_id: '',
})
const shippingBillForm = reactive({
  month: '',
  amount: '',
  note: '',
})
const depositSettings = reactive({
  api: {
    mode: 'mock',
    baseUrl: '',
    timeoutMs: 10000,
    userEid: '',
    notifyUrl: '',
    contractSupplementaryContent: '',
    receivingInfoFallback: '待补充',
  },
  display: {
    merchantName: '',
    posterTitle: '',
    posterSubtitle: '',
    posterQRHint: '',
    posterQRFallback: '',
    expiresInText: '',
    expiresInLabel: '',
    contactPhones: '',
    workTime: '',
    tipsTitle: '',
    tips: '',
    processSteps: '',
  },
})
const depositLocalNotifyUrl = computed(() => depositNotifyServerStatus.value?.url || 'http://127.0.0.1:1032/api/AliNotify/deposit')

function loadDepositSettings() {
  try {
    const current = getDepositSettings()
    // 展平 API 配置（优先级：MySQL 主配置 > localStorage 用户配置 > 默认值）
    // 与其他配置（顺丰、飞书等）保持一致：MySQL 有表的读 MySQL。
    depositSettings.api.mode = form.value.DEPOSIT_API_MODE || current.api.mode || 'mock'
    depositSettings.api.baseUrl = form.value.DEPOSIT_BASE_URL || current.api.baseUrl || ''
    depositSettings.api.timeoutMs = form.value.DEPOSIT_TIMEOUT_MS || current.api.timeoutMs || 10000
    depositSettings.api.userEid = form.value.DEPOSIT_USER_EID || current.api.userEid || ''
    depositSettings.api.notifyUrl = form.value.DEPOSIT_NOTIFY_URL || current.api.notifyUrl || ''
    depositSettings.api.contractSupplementaryContent = form.value.DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT || current.api.contractSupplementaryContent || ''
    depositSettings.api.receivingInfoFallback = form.value.DEPOSIT_RECEIVING_INFO_FALLBACK || current.api.receivingInfoFallback || '待补充'
  } catch (e) {
    console.error('免押配置读取失败:', e)
  }
  // 展平展示配置（不受 try/catch 影响，确保 display 字段始终被赋值）
  try {
    const current = getDepositSettings()
    depositSettings.display.merchantName = current.display.merchantName || ''
    depositSettings.display.posterTitle = current.display.posterTitle || ''
    depositSettings.display.posterSubtitle = current.display.posterSubtitle || ''
    depositSettings.display.posterQRHint = current.display.posterQRHint || ''
    depositSettings.display.posterQRFallback = current.display.posterQRFallback || ''
    depositSettings.display.expiresInText = current.display.expiresInText || ''
    depositSettings.display.expiresInLabel = current.display.expiresInLabel || ''
    depositSettings.display.contactPhones = current.display.contactPhones || ''
    depositSettings.display.workTime = current.display.workTime || ''
    depositSettings.display.tipsTitle = current.display.tipsTitle || ''
    depositSettings.display.tips = Array.isArray(current.display.tips)
      ? current.display.tips.join('\n')
      : (current.display.tips || '')
    depositSettings.display.processSteps = Array.isArray(current.display.processSteps)
      ? current.display.processSteps.join('\n')
      : (current.display.processSteps || '')
  } catch (e) {
    console.error('免押海报配置读取失败:', e)
  }
}

function buildDepositSettingsPayload() {
  return {
    api: {
      mode: depositSettings.api.mode,
      baseUrl: depositSettings.api.baseUrl,
      timeoutMs: depositSettings.api.timeoutMs,
      userEid: depositSettings.api.userEid,
      notifyUrl: depositSettings.api.notifyUrl,
      contractSupplementaryContent: depositSettings.api.contractSupplementaryContent,
      receivingInfoFallback: depositSettings.api.receivingInfoFallback,
    },
    display: {
      merchantName: depositSettings.display.merchantName,
      posterTitle: depositSettings.display.posterTitle,
      posterSubtitle: depositSettings.display.posterSubtitle,
      posterQRHint: depositSettings.display.posterQRHint,
      posterQRFallback: depositSettings.display.posterQRFallback,
      expiresInText: depositSettings.display.expiresInText,
      expiresInLabel: depositSettings.display.expiresInLabel,
      contactPhones: depositSettings.display.contactPhones,
      workTime: depositSettings.display.workTime,
      tipsTitle: depositSettings.display.tipsTitle,
      tips: depositSettings.display.tips
        ? depositSettings.display.tips.split('\n').map((s) => s.trim()).filter(Boolean)
        : [],
      processSteps: depositSettings.display.processSteps
        ? depositSettings.display.processSteps.split('\n').map((s) => s.trim()).filter(Boolean)
        : [],
    },
  }
}

function syncDepositSettingsToForm() {
  form.value.DEPOSIT_API_MODE = depositSettings.api.mode || 'mock'
  form.value.DEPOSIT_BASE_URL = depositSettings.api.baseUrl || ''
  form.value.DEPOSIT_USER_EID = depositSettings.api.userEid || ''
  form.value.DEPOSIT_NOTIFY_URL = depositSettings.api.notifyUrl || ''
  form.value.DEPOSIT_TIMEOUT_MS = String(depositSettings.api.timeoutMs || '')
  form.value.DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT = depositSettings.api.contractSupplementaryContent || ''
  form.value.DEPOSIT_RECEIVING_INFO_FALLBACK = depositSettings.api.receivingInfoFallback || ''
}

async function saveDepositConfig() {
  depositSaving.value = true
  depositSaved.value = false
  try {
    const settings = buildDepositSettingsPayload()

    const ok = saveDepositSettings(settings)
    if (ok) {
      syncDepositSettingsToForm()
      await window.electronAPI.saveConfig({
        DEPOSIT_API_MODE: depositSettings.api.mode || 'mock',
        DEPOSIT_APP_ID: form.value.DEPOSIT_APP_ID || '',
        DEPOSIT_APP_SECRET: form.value.DEPOSIT_APP_SECRET || '',
        DEPOSIT_BASE_URL: depositSettings.api.baseUrl || '',
        DEPOSIT_USER_EID: depositSettings.api.userEid || '',
        DEPOSIT_NOTIFY_URL: depositSettings.api.notifyUrl || '',
        DEPOSIT_TIMEOUT_MS: String(depositSettings.api.timeoutMs || ''),
        DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT: depositSettings.api.contractSupplementaryContent || '',
        DEPOSIT_RECEIVING_INFO_FALLBACK: depositSettings.api.receivingInfoFallback || '',
      })
      depositSaved.value = true
      window.$toast?.('免押配置已保存', 'success')
      setTimeout(() => { depositSaved.value = false }, 3000)
    } else {
      window.$toast?.('保存失败，请重试', 'error')
    }
  } catch (e) {
    console.error('免押配置保存失败:', e)
    window.$toast?.('保存失败：' + (e.message || '未知错误'), 'error')
  } finally {
    depositSaving.value = false
  }
}

async function refreshDepositNotifyServerStatus() {
  try {
    if (!window.electronAPI?.depositNotifyServerStatus) return
    depositNotifyServerStatus.value = await window.electronAPI.depositNotifyServerStatus()
  } catch (e) {
    depositNotifyServerStatus.value = {
      running: false,
      url: depositLocalNotifyUrl.value,
      lastError: e.message || '读取本地回调接收器状态失败',
    }
  }
}

async function copyDepositLocalNotifyUrl() {
  try {
    await navigator.clipboard.writeText(depositLocalNotifyUrl.value)
    window.$toast?.('本地回调地址已复制', 'success')
  } catch {
    window.$toast?.('复制失败，请手动复制本地回调地址', 'error')
  }
}

async function resetDepositConfig() {
  const ok = resetDepositSettings()
  if (ok) {
    await window.electronAPI.saveConfig({
      DEPOSIT_APP_ID: '',
      DEPOSIT_APP_SECRET: '',
      DEPOSIT_BASE_URL: '',
      DEPOSIT_USER_EID: '',
      DEPOSIT_NOTIFY_URL: '',
      DEPOSIT_TIMEOUT_MS: '',
      DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT: '',
      DEPOSIT_RECEIVING_INFO_FALLBACK: '',
    })
    form.value.DEPOSIT_APP_ID = ''
    form.value.DEPOSIT_APP_SECRET = ''
    form.value.DEPOSIT_BASE_URL = ''
    form.value.DEPOSIT_USER_EID = ''
    form.value.DEPOSIT_NOTIFY_URL = ''
    form.value.DEPOSIT_TIMEOUT_MS = ''
    form.value.DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT = ''
    form.value.DEPOSIT_RECEIVING_INFO_FALLBACK = ''
    loadDepositSettings()
    window.$toast?.('免押配置已恢复默认', 'success')
  } else {
    window.$toast?.('恢复默认失败', 'error')
  }
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function currentMonth() {
  return todayDate().slice(0, 7)
}

function finiteNumber(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeOptimizationConfig(payload = {}) {
  optimizationConfig.analysisWindowDays = Math.max(1, finiteNumber(payload.analysisWindowDays ?? payload.ANALYSIS_WINDOW_DAYS, optimizationConfig.analysisWindowDays))
  optimizationConfig.targetMonthlyRoiMin = Math.max(0, finiteNumber(payload.targetMonthlyRoiMin ?? payload.TARGET_MONTHLY_ROI_MIN, optimizationConfig.targetMonthlyRoiMin))
  optimizationConfig.targetMonthlyRoiMax = Math.max(0, finiteNumber(payload.targetMonthlyRoiMax ?? payload.TARGET_MONTHLY_ROI_MAX, optimizationConfig.targetMonthlyRoiMax))
  optimizationConfig.priceStep = Math.max(1, finiteNumber(payload.priceStep ?? payload.PRICE_STEP, optimizationConfig.priceStep))
  optimizationConfig.maxPriceAdjustment = Math.max(0, finiteNumber(payload.maxPriceAdjustment ?? payload.MAX_PRICE_ADJUSTMENT, optimizationConfig.maxPriceAdjustment))
  optimizationConfig.minInquirySamples = Math.max(0, finiteNumber(payload.minInquirySamples ?? payload.MIN_INQUIRY_SAMPLES, optimizationConfig.minInquirySamples))
  optimizationConfig.minOrderSamples = Math.max(0, finiteNumber(payload.minOrderSamples ?? payload.MIN_ORDER_SAMPLES, optimizationConfig.minOrderSamples))
  optimizationConfig.platformFeeRate = Math.max(0, finiteNumber(payload.platformFeeRate ?? payload.PLATFORM_FEE_RATE, optimizationConfig.platformFeeRate))
  optimizationConfig.depositFreePer100Fee = Math.max(0, finiteNumber(payload.depositFreePer100Fee ?? payload.DEPOSIT_FREE_PER_100_FEE, optimizationConfig.depositFreePer100Fee))
  optimizationConfig.depositFreeOrderCost = Math.max(0, finiteNumber(payload.depositFreeOrderCost ?? payload.DEPOSIT_FREE_ORDER_COST, optimizationConfig.depositFreeOrderCost))
  optimizationConfig.shippingAllocationMode = String((payload.shippingAllocationMode ?? payload.SHIPPING_ALLOCATION_MODE ?? optimizationConfig.shippingAllocationMode) || 'order_count')
  optimizationConfig.shippingBillReminderDay = Math.max(1, Math.min(31, finiteNumber(payload.shippingBillReminderDay ?? payload.SHIPPING_BILL_REMINDER_DAY, optimizationConfig.shippingBillReminderDay)))
  if (optimizationConfig.targetMonthlyRoiMin > optimizationConfig.targetMonthlyRoiMax) {
    optimizationConfig.targetMonthlyRoiMax = optimizationConfig.targetMonthlyRoiMin
  }
}

async function loadOptimizationConfig() {
  try {
    const payload = await window.electronAPI.getRentalOptimizationConfig()
    normalizeOptimizationConfig(payload || {})
  } catch (error) {
    console.error('询单优化配置读取失败:', error)
    window.$toast?.('询单优化配置读取失败', 'error')
  }
}

async function saveOptimizationConfig() {
  optimizationSaving.value = true
  optimizationSaved.value = false
  try {
    const payload = {
      analysisWindowDays: optimizationConfig.analysisWindowDays,
      targetMonthlyRoiMin: optimizationConfig.targetMonthlyRoiMin,
      targetMonthlyRoiMax: optimizationConfig.targetMonthlyRoiMax,
      priceStep: optimizationConfig.priceStep,
      maxPriceAdjustment: optimizationConfig.maxPriceAdjustment,
      minInquirySamples: optimizationConfig.minInquirySamples,
      minOrderSamples: optimizationConfig.minOrderSamples,
      platformFeeRate: optimizationConfig.platformFeeRate,
      depositFreePer100Fee: optimizationConfig.depositFreePer100Fee,
      depositFreeOrderCost: optimizationConfig.depositFreeOrderCost,
      shippingAllocationMode: optimizationConfig.shippingAllocationMode,
      shippingBillReminderDay: optimizationConfig.shippingBillReminderDay,
    }
    const result = await window.electronAPI.saveRentalOptimizationConfig(payload)
    normalizeOptimizationConfig(result || payload)
    optimizationSaved.value = true
    window.$toast?.('询单优化配置已保存', 'success')
    setTimeout(() => { optimizationSaved.value = false }, 3000)
  } catch (error) {
    console.error('询单优化配置保存失败:', error)
    window.$toast?.(`询单优化配置保存失败：${error?.message || '未知错误'}`, 'error')
  } finally {
    optimizationSaving.value = false
  }
}

async function saveExpense() {
  if (!String(expenseForm.model_code || '').trim()) {
    window.$toast?.('请填写型号代码', 'error')
    return
  }
  if (!Number(expenseForm.amount || 0)) {
    window.$toast?.('请填写有效金额', 'error')
    return
  }
  if (!expenseForm.expense_date) {
    window.$toast?.('请选择费用日期', 'error')
    return
  }
  expenseSaving.value = true
  try {
    await window.electronAPI.saveExpenseRecord({
      model_code: String(expenseForm.model_code || '').trim(),
      unit_id: expenseForm.unit_id === '' ? null : Number(expenseForm.unit_id),
      expense_type: expenseForm.expense_type,
      amount: Number(Number(expenseForm.amount).toFixed(2)),
      description: String(expenseForm.description || '').trim(),
      expense_date: expenseForm.expense_date,
      order_id: expenseForm.order_id === '' ? null : Number(expenseForm.order_id),
    })
    expenseForm.unit_id = ''
    expenseForm.amount = ''
    expenseForm.description = ''
    expenseForm.order_id = ''
    expenseForm.expense_date = todayDate()
    window.$toast?.('费用记录已保存', 'success')
  } catch (error) {
    console.error('费用记录保存失败:', error)
    window.$toast?.(`费用记录保存失败：${error?.message || '未知错误'}`, 'error')
  } finally {
    expenseSaving.value = false
  }
}

async function uploadShippingBill() {
  if (!shippingBillForm.month) {
    window.$toast?.('请选择账单月份', 'error')
    return
  }
  if (!Number(shippingBillForm.amount || 0)) {
    window.$toast?.('请填写有效账单金额', 'error')
    return
  }
  shippingBillSaving.value = true
  try {
    await window.electronAPI.uploadMonthlyShippingBill({
      month: shippingBillForm.month,
      amount: Number(Number(shippingBillForm.amount).toFixed(2)),
      note: String(shippingBillForm.note || '').trim(),
      allocationMode: optimizationConfig.shippingAllocationMode,
      reminderDay: optimizationConfig.shippingBillReminderDay,
      config: { ...optimizationConfig },
    })
    shippingBillForm.amount = ''
    shippingBillForm.note = ''
    window.$toast?.('月度运费账单已上传', 'success')
  } catch (error) {
    console.error('月度运费账单上传失败:', error)
    window.$toast?.(`月度运费账单上传失败：${error?.message || '未知错误'}`, 'error')
  } finally {
    shippingBillSaving.value = false
  }
}

const sectionNav = [
  { id: 'basic-config', icon: '🔑', title: '基础配置', desc: '接入模式、密钥、Cookie 与浏览器参数' },
  { id: 'model-config', icon: '🧠', title: '模型配置', desc: '模型平台、Base URL 与模型名' },
  { id: 'agent-config', icon: '🤖', title: '智能体配置', desc: '回复模式、接管、会话状态机与能力开关' },
  { id: 'notify-config', icon: '🔔', title: '通知与物流', desc: '飞书、真实物流查询与顺丰时效' },
  { id: 'xgj-config', icon: '🛒', title: '闲管家开放平台', desc: '开放平台凭证、签名与连接测试' },
  { id: 'market-config', icon: '📈', title: '市场监控', desc: '关键词与扫描周期' },
  { id: 'inquiry-optimization', icon: '🎯', title: '询单优化', desc: '分析窗口、ROI 目标、成本参数与运费账单' },
  { id: 'deposit-config', icon: '💳', title: '免押配置', desc: '支付宝免押接口、审核海报、商户联系方式' },
  { id: 'advanced-config', icon: '🛠', title: '高级配置', desc: '心跳、超时、日志等底层参数' },
]
const platforms = [
  { name: '阿里云百炼', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-max', models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'], hint: '推荐模型：qwen-max / qwen-plus' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', models: ['deepseek-chat', 'deepseek-reasoner'], hint: '价格低，适合高频回复' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', models: ['gpt-4o-mini', 'gpt-4o'], hint: '需海外网络' },
]
const advancedFields = [
  { key: 'HEARTBEAT_INTERVAL', label: '心跳间隔 (秒)', hint: '默认 15', min: 5 },
  { key: 'HEARTBEAT_TIMEOUT', label: '心跳超时 (秒)', hint: '默认 5', min: 1 },
  { key: 'TOKEN_REFRESH_INTERVAL', label: 'Token 刷新间隔 (秒)', hint: '默认 3600', min: 60 },
  { key: 'TOKEN_RETRY_INTERVAL', label: 'Token 重试间隔 (秒)', hint: '默认 300', min: 30 },
  { key: 'MANUAL_MODE_TIMEOUT', label: '人工模式超时 (秒)', hint: '默认 3600', min: 60 },
  { key: 'MESSAGE_EXPIRE_TIME', label: '消息过期时间 (毫秒)', hint: '默认 300000', min: 1000 },
  { key: 'UI_MAX_LOG_LINES', label: '控制台日志条数', hint: '默认 500', min: 50 },
]
const selectedPlatform = computed(() => platforms.find((p) => p.baseUrl === form.value.MODEL_BASE_URL) || null)
const activeSection = computed(() => sectionNav.find((section) => section.id === activeModule.value) || sectionNav[0])
const modelSuggestions = computed(() => selectedPlatform.value ? selectedPlatform.value.models : ['qwen-max'])
const channelModeLabel = computed(() => form.value.CHANNEL_MODE === 'browser' ? '浏览器模式' : '接口模式')
const replyModeLabel = computed(() => form.value.REPLY_MODE_DEFAULT === 'boundary_augmented' ? '增强回答' : '严格知识库')
const simulateHumanTyping = computed({ get: () => form.value.SIMULATE_HUMAN_TYPING === 'True', set: (v) => { form.value.SIMULATE_HUMAN_TYPING = v ? 'True' : 'False' } })
const phoneAlertEnabled = computed({ get: () => form.value.PHONE_ALERT_ENABLED === 'True', set: (v) => { form.value.PHONE_ALERT_ENABLED = v ? 'True' : 'False' } })
const xiaohongshuEnabled = computed({ get: () => form.value.XIAOHONGSHU_ENABLED === 'True', set: (v) => { form.value.XIAOHONGSHU_ENABLED = v ? 'True' : 'False' } })
const logisticsEnabled = computed({ get: () => form.value.LOGISTICS_QUERY_ENABLED === 'True', set: (v) => { form.value.LOGISTICS_QUERY_ENABLED = v ? 'True' : 'False' } })
const sfOpenEnabled = computed({ get: () => form.value.SF_OPEN_ENABLED === 'True', set: (v) => { form.value.SF_OPEN_ENABLED = v ? 'True' : 'False' } })
const browserUseExistingChrome = computed({ get: () => form.value.BROWSER_USE_EXISTING_CHROME === 'True', set: (v) => { form.value.BROWSER_USE_EXISTING_CHROME = v ? 'True' : 'False' } })
const browserAutoLaunch = computed({ get: () => form.value.BROWSER_AUTO_LAUNCH === 'True', set: (v) => { form.value.BROWSER_AUTO_LAUNCH = v ? 'True' : 'False' } })
const browserOnlyReplyMyListings = computed({ get: () => form.value.BROWSER_ONLY_REPLY_MY_LISTINGS === 'True', set: (v) => { form.value.BROWSER_ONLY_REPLY_MY_LISTINGS = v ? 'True' : 'False' } })
const browserCollectOnlyMode = computed({ get: () => form.value.BROWSER_COLLECT_ONLY_MODE === 'True', set: (v) => { form.value.BROWSER_COLLECT_ONLY_MODE = v ? 'True' : 'False' } })
const sessionStateEnabled = computed({ get: () => form.value.SESSION_STATE_ENABLED === 'True', set: (v) => { form.value.SESSION_STATE_ENABLED = v ? 'True' : 'False' } })
const takeoverFollowupEnabled = computed({ get: () => form.value.TAKEOVER_FOLLOWUP_ENABLED === 'True', set: (v) => { form.value.TAKEOVER_FOLLOWUP_ENABLED = v ? 'True' : 'False' } })
const intentRouterEnabled = computed({ get: () => form.value.INTENT_ROUTER_ENABLED === 'True', set: (v) => { form.value.INTENT_ROUTER_ENABLED = v ? 'True' : 'False' } })
const intentRouterLogOnly = computed({ get: () => form.value.INTENT_ROUTER_LOG_ONLY === 'True', set: (v) => { form.value.INTENT_ROUTER_LOG_ONLY = v ? 'True' : 'False' } })
const quoteServiceEnabled = computed({ get: () => form.value.QUOTE_SERVICE_ENABLED === 'True', set: (v) => { form.value.QUOTE_SERVICE_ENABLED = v ? 'True' : 'False' } })
const bookingFsmEnabled = computed({ get: () => form.value.BOOKING_FSM_ENABLED === 'True', set: (v) => { form.value.BOOKING_FSM_ENABLED = v ? 'True' : 'False' } })
const enabledFeatureCount = computed(() => {
  const flags = [
    simulateHumanTyping.value,
    phoneAlertEnabled.value,
    xiaohongshuEnabled.value,
    logisticsEnabled.value,
    sfOpenEnabled.value,
    browserUseExistingChrome.value,
    browserAutoLaunch.value,
    browserOnlyReplyMyListings.value,
    browserCollectOnlyMode.value,
    sessionStateEnabled.value,
    takeoverFollowupEnabled.value,
    intentRouterEnabled.value,
    quoteServiceEnabled.value,
    bookingFsmEnabled.value,
  ]
  return flags.filter(Boolean).length
})
function selectPlatform(platform) { form.value.MODEL_BASE_URL = platform.baseUrl; form.value.MODEL_NAME = platform.defaultModel }
function resolveModuleFromRoute(query = route.query) {
  const requestedModule = String(query?.module || '').trim()
  return sectionNav.some((section) => section.id === requestedModule) ? requestedModule : ''
}
async function switchModule(moduleId, shouldScroll = true) {
  activeModule.value = moduleId
  if (route.query.module !== moduleId) {
    router.replace({ path: route.path, query: { ...route.query, module: moduleId } }).catch(() => {})
  }
  if (!shouldScroll) return
  await nextTick()
  moduleContentRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
async function loadPage() {
  loaded.value = false
  loadError.value = ''
  await runViewInitialization('系统设置', async () => {
    form.value = await window.electronAPI.getConfig()
    form.value.CHANNEL_MODE ||= 'api'
    form.value.BROWSER_REMOTE_DEBUGGING_PORT ||= '9222'
    form.value.BROWSER_POLL_INTERVAL_MS ||= '2000'
    form.value.BROWSER_USE_EXISTING_CHROME ||= 'True'
    form.value.BROWSER_AUTO_LAUNCH ||= 'False'
    form.value.BROWSER_SEND_VERIFY_TIMEOUT_MS ||= '5000'
    form.value.BROWSER_ONLY_REPLY_MY_LISTINGS ||= 'True'
    form.value.LISTING_OWNER_KEYWORDS ||= ''
    form.value.BROWSER_HISTORY_SYNC_MAX_MESSAGES ||= '0'
    form.value.BROWSER_SESSION_MAX_AGE_MINUTES ||= '5'
    form.value.BROWSER_COLLECT_ONLY_MODE ||= 'False'
    form.value.REPLY_MODE_DEFAULT ||= 'faq_strict'
    form.value.DEFAULT_SHIPPING_MODE ||= 'land'
    form.value.INTENT_ROUTER_ENABLED ||= 'False'
    form.value.INTENT_ROUTER_LOG_ONLY ||= 'False'
    form.value.QUOTE_SERVICE_ENABLED ||= 'False'
    form.value.BOOKING_FSM_ENABLED ||= 'False'
    form.value.PHONE_DND_START ||= '01:00'
    form.value.PHONE_DND_END ||= '09:00'
    form.value.SHIP_ARRIVE_AHEAD_DAYS ||= '1'
    form.value.XIAOHONGSHU_ENABLED ||= 'False'
    form.value.SESSION_STATE_ENABLED ||= 'True'
    form.value.COOLDOWN_MIN ||= '10'
    form.value.NOTIFY_THROTTLE_MIN ||= '3'
    form.value.HUMAN_IDLE_MIN ||= '15'
    form.value.TAKEOVER_FOLLOWUP_ENABLED ||= 'True'
    form.value.TAKEOVER_FOLLOWUP_MIN ||= '5'
    form.value.TAKEOVER_FOLLOWUP_TEXT ||= '不好意思让您久等了，我这边处理完马上回复您哈'
    form.value.LOGISTICS_QUERY_ENABLED ||= 'False'
    form.value.LOGISTICS_QUERY_API ||= ''
    form.value.LOGISTICS_QUERY_TOKEN ||= ''
    form.value.SF_OPEN_ENABLED ||= 'False'
    form.value.SF_APP_ID ||= ''
    form.value.SF_APP_KEY ||= ''
    form.value.SF_TOKEN_API ||= 'https://bspgw.sf-express.com/oauth2/accessToken'
    form.value.SF_PREORDER_API ||= 'https://bspgw.sf-express.com/std/service'
    form.value.SF_SENDER_PROVINCE ||= '四川省'
    form.value.SF_SENDER_CITY ||= '成都市'
    form.value.SF_SENDER_DISTRICT ||= ''
    form.value.SF_SENDER_ADDRESS ||= ''
    form.value.SF_SENDER_CONTACT ||= ''
    form.value.SF_SENDER_MOBILE ||= ''
    form.value.SF_MONTHLY_CARD ||= ''
    form.value.SF_CARGO_NAME ||= '租赁设备'
    form.value.SF_STANDARD_EXPRESS_TYPE_ID ||= '2'
    form.value.SF_HALF_DAY_EXPRESS_TYPE_ID ||= '263'
    form.value.SF_INTRACITY_API ||= ''
    form.value.SF_INTRACITY_COMPANY_CODE ||= ''
    form.value.SF_INTRACITY_ACCESS_CODE ||= ''
    form.value.SF_INTRACITY_CHECKWORD ||= ''
    form.value.SF_INTRACITY_PROJECT_CODE ||= ''
    form.value.SF_INTRACITY_SHOP_ID ||= ''
    form.value.SF_INTRACITY_SHOP_TYPE ||= '2'
    form.value.SF_SICHUAN_SPECIAL_REGIONS ||= '甘孜,阿坝'
    form.value.SF_DEFAULT_SEND_HOUR = String(form.value.SF_DEFAULT_SEND_HOUR || '').trim() === '23' ? '18' : (form.value.SF_DEFAULT_SEND_HOUR || '18')
    form.value.SF_SPECIAL_SEND_HOUR = String(form.value.SF_SPECIAL_SEND_HOUR || '').trim() === '23' ? '18' : (form.value.SF_SPECIAL_SEND_HOUR || '18')
    form.value.UI_MAX_LOG_LINES ||= '500'
    form.value.MARKET_MONITOR_KEYWORDS ||= ''
    form.value.MARKET_SCAN_INTERVAL_MIN ||= '60'
    form.value.xgj_appid ||= ''
    form.value.xgj_app_secret ||= ''
    form.value.xgj_base_url ||= 'https://open.goofish.pro'
    form.value.xgj_seller_id ||= ''
    form.value.xgj_sign_mode ||= 'default'
    form.value.DEPOSIT_APP_ID ||= ''
    form.value.DEPOSIT_APP_SECRET ||= ''
    form.value.DEPOSIT_API_MODE ||= 'mock'
    form.value.DEPOSIT_BASE_URL ||= ''
    form.value.DEPOSIT_USER_EID ||= ''
    form.value.DEPOSIT_NOTIFY_URL ||= ''
    form.value.DEPOSIT_TIMEOUT_MS ||= ''
    form.value.DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT ||= ''
    form.value.DEPOSIT_RECEIVING_INFO_FALLBACK ||= ''
    expenseForm.expense_date = todayDate()
    shippingBillForm.month = currentMonth()
    botStore.setMaxLogs(form.value.UI_MAX_LOG_LINES)
    loadDepositSettings()
    await loadOptimizationConfig()
    await refreshDepositNotifyServerStatus()
    const requestedModule = resolveModuleFromRoute()
    if (requestedModule) activeModule.value = requestedModule
    loaded.value = true
  }, {
    fallbackMessage: '系统设置初始化失败，请稍后重试',
    onError: (message) => {
      loadError.value = message
      loaded.value = true
    },
  })
}

onMounted(() => {
  loadPage()
})
watch(() => route.query.module, (nextModule) => {
  const resolvedModule = resolveModuleFromRoute({ module: nextModule })
  if (resolvedModule && resolvedModule !== activeModule.value) {
    activeModule.value = resolvedModule
  }
})
async function save() {
  saving.value = true
  saved.value = false
  try {
    const depositSettingsSaved = saveDepositSettings(buildDepositSettingsPayload())
    if (!depositSettingsSaved) {
      throw new Error('免押配置写入本地失败')
    }
    syncDepositSettingsToForm()
    await window.electronAPI.saveConfig({ ...form.value })
    botStore.setMaxLogs(form.value.UI_MAX_LOG_LINES)
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } finally { saving.value = false }
}

async function testXgj() {
  xgjTesting.value = true
  xgjTestResult.value = null
  try {
    // 先保存一次当前配置，确保主进程凭据最新
    await window.electronAPI.saveConfig({
      xgj_appid: form.value.xgj_appid,
      xgj_app_secret: form.value.xgj_app_secret,
      xgj_base_url: form.value.xgj_base_url,
      xgj_seller_id: form.value.xgj_seller_id,
      xgj_sign_mode: form.value.xgj_sign_mode,
    })
    const res = await window.electronAPI.xgjListShops()
    if (res?.ok) {
      const shops = (res.data?.list || []).map((s) => `· ${s.shop_name || s.user_name} (user=${s.user_name})`).join('\n')
      xgjTestResult.value = { ok: true, text: `✓ 连接成功，共 ${res.data?.list?.length || 0} 个店铺\n${shops}` }
    } else {
      xgjTestResult.value = { ok: false, text: `✗ ${res?.msg || '未知错误'} (code=${res?.code})` }
    }
  } catch (err) {
    xgjTestResult.value = { ok: false, text: `✗ ${err?.message || String(err)}` }
  } finally {
    xgjTesting.value = false
  }
}
</script>

<style scoped>
.settings-page {
  min-height: 100%;
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-main {
  min-width: 0;
  gap: 24px;
}

.module-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 24px;
  border: 1px solid rgba(59, 130, 246, 0.14);
  background: var(--bg-surface, #fff);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}

.module-banner-wide {
  position: sticky;
  top: 0;
  z-index: 5;
}

.module-banner-copy {
  min-width: 0;
  flex: 1 1 240px;
}

.module-title {
  margin-bottom: 4px;
}

.module-quick-switch {
  flex: 1.4 1 460px;
  min-width: 320px;
  padding: 12px;
  border-radius: 16px;
  background: var(--bg-subtle, #f3f4f6);
  border: 1px solid var(--border-subtle, #e5e7eb);
}

.module-quick-switch > span {
  display: block;
  margin: 0 0 9px 2px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.module-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.module-tabs::-webkit-scrollbar {
  height: 4px;
}

.module-tabs::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.28);
  border-radius: 999px;
}

.module-tab {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: #f8fafc;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.module-tab:hover {
  color: var(--color-primary, #2563eb);
  border-color: rgba(59, 130, 246, 0.24);
  background: #eff6ff;
}

.module-tab.active {
  color: #fff;
  border-color: transparent;
  background: var(--brand-primary, #0f766e);
  box-shadow: 0 2px 6px rgba(15, 118, 110, 0.18);
}

.module-banner-meta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.module-meta-item {
  min-width: 108px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.module-meta-item span {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.module-meta-item strong {
  font-size: 14px;
  color: var(--text-primary);
}

.overview-panel,
.nav-panel,
.settings-card {
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
}

.overview-panel-wide,
.nav-panel-wide {
  padding: 20px 22px;
}

.overview-head,
.nav-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
}

.compact-head {
  margin-bottom: 16px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.overview-grid-wide {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.overview-card {
  padding: 14px 15px;
  border-radius: 14px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
}

.accent-card {
  background: var(--color-info-soft, #eff6ff);
  border-color: var(--color-info-border, #bfdbfe);
}

.overview-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.overview-value {
  display: block;
  font-size: 15px;
  line-height: 1.5;
  color: var(--text-primary);
}

.overview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.hero-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 13px;
  border-radius: 999px;
  background: var(--bg-primary-soft);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;
}

.inline-tips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.inline-tips span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: var(--text-secondary);
  font-size: 12px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-card {
  scroll-margin-top: 18px;
  padding: 24px;
  background: var(--bg-surface, #fff);
}

.section-head {
  margin-bottom: 18px;
}

.section-kicker {
  display: inline-flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--color-primary, #2563eb);
}

.settings-card .panel-tip {
  line-height: 1.7;
}

.settings-card .form-row,
.settings-card .advanced-grid {
  gap: 18px;
}

.settings-card .form-row + .form-row,
.settings-card .form-row + .subsection-title,
.settings-card .subsection-title + .form-row,
.settings-card .subsection-title + .hint {
  margin-top: 2px;
}

.settings-card .form-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  background: var(--bg-surface, #fff);
}

.settings-card .form-group > label:first-child,
.settings-card .form-group .toggle-group label:first-child,
.settings-card .form-group label {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
  color: var(--text-strong);
}

.settings-card .form-group input,
.settings-card .form-group select,
.settings-card .form-group textarea {
  width: 100%;
  min-height: 46px;
  padding: 11px 13px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: #fff;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}

.settings-card .form-group textarea {
  min-height: 112px;
  resize: vertical;
}

.settings-card .form-group input:focus,
.settings-card .form-group select:focus,
.settings-card .form-group textarea:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.55);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.10);
}

.settings-card .hint {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.68;
  color: var(--text-muted);
}

.settings-card .input-group {
  align-items: stretch;
  gap: 10px;
}

.settings-card .toggle-btn {
  min-width: 68px;
  padding: 0 14px;
  border-radius: 12px;
  background: #f3f6fb;
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: var(--text-secondary);
}

.settings-card .toggle-group.cardish {
  gap: 18px;
  padding: 18px;
  border-radius: 16px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
}

.settings-card .toggle-group.cardish > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.settings-card .toggle-group.cardish .hint {
  max-width: 34ch;
}

.utility-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.utility-card {
  gap: 12px;
}

.inline-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.inline-form-grid-bill {
  grid-template-columns: minmax(0, 180px) minmax(0, 1fr);
}

.utility-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.subsection-title {
  margin: 18px 0 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  padding-top: 14px;
  border-top: 1px dashed rgba(148, 163, 184, 0.22);
}

.save-ok {
  color: var(--text-success);
  font-size: 13px;
  font-weight: 600;
}

.expandable {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chevron {
  font-size: 12px;
  color: var(--text-muted);
}

.platform-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settings-nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.settings-nav-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
  min-height: 86px;
  padding: 14px 14px;
  border-radius: 14px;
  text-align: left;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: inherit;
  transition: all 0.15s ease;
  cursor: pointer;
}

.settings-nav-item:hover {
  transform: translateY(-1px);
  border-color: rgba(59, 130, 246, 0.22);
  background: #eff6ff;
}

.settings-nav-item.active {
  background: var(--bg-primary-soft, #dbf6f1);
  border-color: var(--brand-primary-border, rgba(20, 184, 166, 0.24));
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}

.settings-nav-item.active .nav-copy strong {
  color: var(--color-primary, #2563eb);
}

.nav-icon {
  width: 24px;
  flex: 0 0 24px;
  text-align: center;
  font-size: 15px;
  margin-top: 1px;
}

.nav-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-copy strong {
  font-size: 13px;
  line-height: 1.45;
}

.nav-copy small {
  color: var(--text-muted);
  line-height: 1.55;
}

.platform-btn.active {
  background: var(--bg-primary);
  color: #fff;
  border-color: transparent;
}

.settings-card :deep(datalist) {
  display: none;
}

@media (max-width: 1180px) {
  .overview-head,
  .nav-panel-head,
  .module-banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .module-quick-switch {
    width: 100%;
    min-width: 0;
  }

  .overview-tags,
  .inline-tips {
    justify-content: flex-start;
  }

  .overview-grid-wide {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .utility-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .page-actions {
    width: 100%;
  }

  .overview-grid,
  .overview-grid-wide {
    grid-template-columns: 1fr 1fr;
  }

  .settings-card {
    padding: 20px;
  }

  .settings-nav-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settings-card .form-row,
  .settings-card .advanced-grid {
    gap: 14px;
  }

  .inline-form-grid,
  .inline-form-grid-bill {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .overview-grid,
  .overview-grid-wide,
  .settings-nav-grid {
    grid-template-columns: 1fr;
  }

  .module-banner {
    padding: 18px;
  }

  .module-banner-meta {
    width: 100%;
  }

  .module-quick-switch {
    padding: 10px;
  }

  .module-meta-item {
    flex: 1 1 140px;
  }

  .settings-card .form-group {
    padding: 14px 14px;
  }

  .overview-panel-wide,
  .nav-panel-wide,
  .settings-card {
    padding-left: 16px;
    padding-right: 16px;
  }
}

.xgj-result-pre {
  margin: 0;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow: auto;
}
.xgj-ok { border: 1px solid rgba(22, 163, 74, 0.3); background: #f0fdf4; }
.xgj-fail { border: 1px solid rgba(220, 38, 38, 0.3); background: #fef2f2; }
.settings-load-error { min-height: 360px; }
</style>
