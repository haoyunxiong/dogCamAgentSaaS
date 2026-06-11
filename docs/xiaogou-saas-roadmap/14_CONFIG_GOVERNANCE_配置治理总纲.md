# 14 配置治理总纲

## 1. 为什么要做配置治理

当前项目从内部工具升级为“租赁商户运营标准化系统 / 商户 SaaS”后，配置不能继续散落在 JS / Python 文件、历史文档、本地 JSON、local.env、SQLite、MySQL、前端页面或临时代码中。

配置治理的目标不是立刻重构所有代码，而是先明确：

1. 配置现在在哪里；
2. 哪些配置可以保留在代码默认配置中；
3. 哪些配置只能存在本地运行配置中，且必须被 Git 忽略；
4. 哪些配置未来要进入 MySQL / DB，并按 merchant_id / store_id 隔离；
5. 哪些配置属于敏感凭证，不能写死，不能提交，需要加密存储；
6. 哪些敏感扫描命中只是变量名 / 字段名误报；
7. 哪些是真实风险，必须修复后才能提交或上线。

## 2. 配置分类

### 2.1 系统默认配置

可以进入 Git，可以保存在代码默认配置文件中。

示例：

- 默认分页条数；
- 默认主题；
- 默认订单状态枚举；
- 默认设备状态枚举；
- 默认超时时间；
- 默认 UI 展示规则；
- 默认任务优先级。

建议位置：

```text
electron/renderer/src/config/defaults.ts
electron/main/config/defaults.js
python/config/defaults.py
```

### 2.2 本地运行配置

不应该提交 Git。适合本地开发、单机部署、私有运行环境。

示例：

- 本地 MySQL 地址；
- 本地 MySQL 用户名 / 密码；
- 本地端口；
- 本地调试配置；
- 本地缓存路径；
- 本地运行环境。

建议位置：

```text
.env.local
config/environments/local.env
mysql-connection.json
```

必须被 `.gitignore` 排除。

### 2.3 商户业务配置

未来应该存储在 MySQL / DB，并按商户、门店隔离。

示例：

- 商户名称；
- 门店配置；
- 发货地址；
- 物流配置；
- 押金 / 免押规则；
- 租期规则；
- 逾期费用规则；
- 设备定价规则；
- 打印模板；
- 通知模板；
- 话术模板；
- 订单来源配置；
- 员工权限。

建议未来表：

```text
merchant_settings
store_settings
shipping_settings
deposit_settings
pricing_rules
notification_templates
print_templates
integration_settings
role_permissions
user_preferences
```

核心字段建议：

```text
merchant_id
store_id
created_by
updated_by
created_at
updated_at
```

### 2.4 敏感凭证

不能写死在 JS / Python 中，不能提交 Git。

示例：

- API Key；
- Cookie；
- Token；
- 数据库密码；
- 顺丰接口密钥；
- 免押接口密钥；
- AI 模型 Key；
- 第三方平台授权信息。

建议治理方式：

- 开发阶段：本地 `.env.local` / `local.env` / `mysql-connection.json`，且 Git 忽略；
- 单机桌面阶段：本地 DB 加密存储；
- 多商户 SaaS 阶段：服务端 DB 加密存储或密钥管理服务；
- 前端页面：绝不直接暴露真实凭证。

## 3. 统一服务方向

后续应逐步收敛成：

```text
ConfigService
SettingsService
MerchantConfigService
CredentialService
```

目标调用方式：

```js
const dbConfig = await configService.getDatabaseConfig()
const shippingConfig = await configService.getShippingConfig(merchantId, storeId)
const depositConfig = await configService.getDepositConfig(merchantId)
const apiKey = await credentialService.getSecret('llm_api_key', merchantId)
```

Python 侧同理：

```python
runtime_config = config_service.get_runtime_config()
merchant_config = config_service.get_merchant_config(merchant_id)
secret = credential_service.get_secret('llm_api_key', merchant_id)
```

## 4. 当前阶段处理原则

### 首次 Git baseline 阶段

只做：

- 确认无真实敏感值提交；
- 本地敏感文件进入 `.gitignore`；
- 敏感扫描命中逐项复核；
- 配置散落问题记录为后续需求。

不做：

- 不重构配置中心；
- 不迁移数据库；
- 不新增商户配置表；
- 不修改现有业务逻辑。

### Phase 03 SaaS 底座阶段

应执行：

- 配置来源审计；
- 敏感凭证治理；
- 商户配置模型设计；
- 本地配置和商户配置边界划分；
- ConfigService / CredentialService 方案设计；
- 必要时分批改造代码。

## 5. 配置审计输出

审计结果写入：

```text
docs/xiaogou-saas-roadmap/reference-docs/current-codebase/CONFIG_SOURCE_AUDIT.md
docs/xiaogou-saas-roadmap/phases/phase-03-saas-base/artifacts/config-source-audit.md
```

审计字段：

| 字段 | 说明 |
|---|---|
| 配置名称 | 配置项名称 |
| 当前来源 | JS / Python / env / JSON / SQLite / MySQL / localStorage 等 |
| 当前文件 / 表 / 模块 | 当前所在位置 |
| 配置分类 | 系统默认配置 / 本地运行配置 / 商户业务配置 / 敏感凭证 |
| 是否敏感 | 是 / 否 |
| 是否会进入 Git | 是 / 否 |
| 当前风险等级 | 低 / 中 / 高 |
| 未来推荐存储位置 | 代码默认配置 / local.env / MySQL / 加密凭证库 |
| 是否需要迁移 | 是 / 否 / 待确认 |
| 所属阶段 | Phase 03 / Phase 04 等 |
| 备注 | 说明 |

## 6. 验收标准

配置治理完成后，至少满足：

- 真实密钥不写死在代码中；
- 本地敏感文件被 `.gitignore` 排除；
- 商户配置有明确 DB / MySQL 归属；
- 敏感凭证有加密存储方案；
- 前端不接触真实密钥；
- 旧功能不受影响；
- 有迁移和回滚方案；
- 有配置来源审计表。
