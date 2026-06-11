# 环境切换与启动运维手册

本文档说明小狗相机助手在本机开发环境和 Mac mini 线上环境之间如何切换、如何启动、如何停止，以及后续新增配置字段时应该改哪些文件。

## 1. 环境模型

当前项目是 Electron 桌面应用，不是完整 Web SaaS。推荐运行模型是：

```text
本机 Mac
  local 环境
  用于开发、调试、试验数据和功能验证

Mac mini
  production 环境
  用于长期运行、手机工作台、飞书回调和真实业务数据
```

环境切换通过启动命令完成，不靠手动反复修改 `mysql-connection.json`。

## 2. 配置文件结构

启动期配置放在：

```text
config/environments/
  local.example.env
  production.example.env
  local.env
  production.env
```

文件职责：

| 文件 | 是否提交 Git | 作用 |
| --- | --- | --- |
| `local.example.env` | 是 | 本机开发环境模板，不含真实密码 |
| `production.example.env` | 是 | Mac mini 线上环境模板，不含真实密码 |
| `local.env` | 否 | 本机真实配置，含数据库密码 |
| `production.env` | 否 | Mac mini 真实配置，含数据库密码和穿透地址 |

`.env` 文件已被 `.gitignore` 忽略，避免把密码、账号、内网穿透地址提交到远端仓库。

首次创建：

```bash
cp config/environments/local.example.env config/environments/local.env
cp config/environments/production.example.env config/environments/production.env
```

## 3. local 环境配置

本机开发环境默认连接本机 MySQL：

```bash
XIANYU_ENV_LABEL="local"
XIANYU_DATA_DIR="$ROOT_DIR/data/local"

XIANYU_MYSQL_HOST="127.0.0.1"
XIANYU_MYSQL_PORT="3306"
XIANYU_MYSQL_USER="root"
XIANYU_MYSQL_PASSWORD="你的本机 MySQL 密码"
XIANYU_MYSQL_DATABASE="xianyu_agent"

VITE_PORT="5177"
XIANYU_MOBILE_GATEWAY_HOST="127.0.0.1"
XIANYU_MOBILE_GATEWAY_PORT="8787"
XIANYU_LOG_DIR="/tmp/xianyu-launcher/local"
```

本机环境主要用于：

- 改代码。
- 跑 UI。
- 验证数据库迁移和新功能。
- 用测试账号、测试 Cookies、测试飞书或测试顺丰配置。

## 4. production 环境配置

Mac mini 线上环境建议通过安全内网通道连接，不建议直接把 MySQL `3306` 暴露到公网。

`production.env` 示例：

```bash
XIANYU_ENV_LABEL="production"
XIANYU_DATA_DIR="$ROOT_DIR/data/production"

XIANYU_MYSQL_HOST="你的 Mac mini 内网穿透主机或隧道地址"
XIANYU_MYSQL_PORT="3306"
XIANYU_MYSQL_USER="xianyu_app"
XIANYU_MYSQL_PASSWORD="线上数据库密码"
XIANYU_MYSQL_DATABASE="xianyu_agent"

VITE_PORT="5277"
XIANYU_MOBILE_GATEWAY_HOST="127.0.0.1"
XIANYU_MOBILE_GATEWAY_PORT="8887"
XIANYU_LOG_DIR="/tmp/xianyu-launcher/production"
```

建议线上数据库用户不要用 `root`。推荐建一个专用用户：

```sql
CREATE USER 'xianyu_app'@'%' IDENTIFIED BY '强密码';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
ON xianyu_agent.* TO 'xianyu_app'@'%';
FLUSH PRIVILEGES;
```

如果通过 SSH tunnel 连接 Mac mini，可以让桌面端连本机端口：

```bash
ssh -L 3307:127.0.0.1:3306 mac-mini-user@mac-mini-host
```

然后 `production.env` 写：

```bash
XIANYU_MYSQL_HOST="127.0.0.1"
XIANYU_MYSQL_PORT="3307"
```

## 5. 启动命令

本机开发环境：

```bash
./scripts/start_xianyu_desktop_local.sh
```

线上环境：

```bash
./scripts/start_xianyu_desktop_production.sh
```

通用启动器：

```bash
XIANYU_ENV=local ./scripts/start_xianyu_desktop.sh
XIANYU_ENV=production ./scripts/start_xianyu_desktop.sh
```

启动脚本会做这些事：

1. 读取 `config/environments/<env>.env`。
2. 检查 MySQL 是否可连接。
3. 启动 mobile gateway。
4. 启动 Vite。
5. 启动 Electron。
6. 按环境写入独立日志目录。

日志路径：

```text
/tmp/xianyu-launcher/local/
/tmp/xianyu-launcher/production/
```

## 6. 手机工作台与公网访问

手机工作台地址：

```text
http://127.0.0.1:<VITE_PORT>/mobile
```

本机 local 默认是：

```text
http://127.0.0.1:5177/mobile
```

production 模板默认是：

```text
http://127.0.0.1:5277/mobile
```

启动公网访问：

```bash
./scripts/start_mobile_public_access.sh
```

默认使用 local。线上环境使用：

```bash
XIANYU_ENV=production ./scripts/start_mobile_public_access.sh
```

脚本会读取对应环境的 `XIANYU_MOBILE_GATEWAY_PORT`，不会固定打到 local 的 `8787`。

## 7. 停止服务

当前启动器使用 `screen` 后台会话。查看会话：

```bash
screen -ls
```

常见会话名：

```text
xiaogou_local_vite
xiaogou_local_electron
xiaogou_local_gateway
xiaogou_production_vite
xiaogou_production_electron
xiaogou_production_gateway
xiaogou_production_ngrok
```

停止单个会话：

```bash
screen -S xiaogou_local_vite -X quit
screen -S xiaogou_local_electron -X quit
screen -S xiaogou_local_gateway -X quit
```

停止 production：

```bash
screen -S xiaogou_production_vite -X quit
screen -S xiaogou_production_electron -X quit
screen -S xiaogou_production_gateway -X quit
screen -S xiaogou_production_ngrok -X quit
```

如果只是 Electron 窗口还开着，也可以直接关闭窗口。

## 8. 验证当前连接的是哪个环境

查看日志：

```bash
tail -n 80 /tmp/xianyu-launcher/local/gateway.log
tail -n 80 /tmp/xianyu-launcher/production/gateway.log
```

应看到类似：

```text
[MySQL] Pool initialized, connected to root@127.0.0.1:3306/xianyu_agent
[mobile-gateway] listening at http://127.0.0.1:8787
```

检查本机配置加载：

```bash
cd electron
ROOT_DIR="$(cd .. && pwd)" zsh -c 'set -a; source ../config/environments/local.env; set +a; node -e "const { loadMysqlConfig, describeMysqlConfig } = require(\"./main/mysqlConfig\"); console.log(describeMysqlConfig(loadMysqlConfig()))"'
```

检查 production 配置加载：

```bash
cd electron
ROOT_DIR="$(cd .. && pwd)" zsh -c 'set -a; source ../config/environments/production.env; set +a; node -e "const { loadMysqlConfig, describeMysqlConfig } = require(\"./main/mysqlConfig\"); console.log(describeMysqlConfig(loadMysqlConfig()))"'
```

## 9. 配置分层原则

不同类型的配置放在不同地方：

| 配置类型 | 放哪里 | 示例 |
| --- | --- | --- |
| 启动期环境配置 | `config/environments/*.env` | MySQL host、port、password、Vite 端口、gateway 端口、数据目录 |
| 默认兜底配置 | `python/config_manager.py` 的 `DEFAULT_CONFIG` | 默认模型名、默认顺丰接口、默认开关 |
| 用户可在 UI 修改的业务配置 | MySQL `config` 表，通过设置页保存 | API Key、Cookies、飞书、顺丰、押金、Agent 参数 |
| 桌面设置页字段 | `electron/renderer/src/views/Settings.vue` | 输入框、开关、保存逻辑 |
| Electron 业务读取 | `electron/main/dbManager.js` / 相关 service | 顺丰下单、订单、排期、移动端 API |
| Python 自动回复读取 | `python/config_manager.py` / `python/bridge.py` / `python/services/*` | API Key、Cookies、渠道模式、知识库参数 |
| 启动脚本行为 | `scripts/*.sh` | local / production 启动、ngrok、公网访问 |

判断规则：

- 和“这台机器怎么连服务”有关，放 `config/environments/*.env`。
- 和“业务系统运行参数”有关，优先放设置页，最终进 MySQL `config` 表。
- 和“新配置的默认值”有关，补 `python/config_manager.py`。
- 和“用户要在界面里改”有关，补 `Settings.vue` 和 `saveConfig` 流程。
- 和“某个业务动作怎么调用接口”有关，改对应 service，不放 env。

## 10. 常见字段应该在哪里改

### MySQL 主机、端口、账号、密码

修改：

```text
config/environments/local.env
config/environments/production.env
```

不要改：

```text
mysql-connection.json
```

`mysql-connection.json` 只作为无敏感 fallback，不作为日常切换入口。

### Vite 端口和手机网关端口

修改：

```text
config/environments/local.env
config/environments/production.env
```

字段：

```bash
VITE_PORT="5177"
XIANYU_MOBILE_GATEWAY_PORT="8787"
```

相关代码：

```text
scripts/start_xianyu_desktop.sh
electron/vite.config.js
electron/main/mobileGateway.js
```

### API Key、模型、Cookies、渠道模式

优先在应用内设置页改。

对应字段：

```text
API_KEY
MODEL_BASE_URL
MODEL_NAME
COOKIES_STR
CHANNEL_MODE
BROWSER_REMOTE_DEBUGGING_PORT
BROWSER_USE_EXISTING_CHROME
BROWSER_AUTO_LAUNCH
```

相关文件：

```text
electron/renderer/src/views/Settings.vue
python/config_manager.py
python/bridge.py
python/login_browser.py
python/channels/browser_runner.py
```

说明：

- `CHANNEL_MODE=api` 依赖 `COOKIES_STR`。
- `CHANNEL_MODE=browser` 依赖浏览器调试端口和浏览器登录态。
- 浏览器持久化 profile 由 `python/login_browser.py` 处理。

### 飞书配置

优先在设置页改。

常见字段：

```text
FEISHU_WEBHOOK_SALES
FEISHU_WEBHOOK_ORDER
FEISHU_APP_ID
FEISHU_APP_SECRET
FEISHU_VERIFICATION_TOKEN
FEISHU_ENCRYPT_KEY
MOBILE_FEISHU_NOTIFY_CHAT_ID
MOBILE_AVAILABLE_REPLY_TEMPLATE
MOBILE_UNAVAILABLE_REPLY_TEMPLATE
```

相关文件：

```text
electron/renderer/src/views/Settings.vue
electron/main/mobileGateway.js
python/services/notification_service.py
```

### 顺丰配置

优先在设置页改。

常见字段：

```text
SF_OPEN_ENABLED
SF_APP_ID
SF_APP_KEY
SF_TOKEN_API
SF_PREORDER_API
SF_SENDER_PROVINCE
SF_SENDER_CITY
SF_SENDER_DISTRICT
SF_SENDER_ADDRESS
SF_SENDER_CONTACT
SF_SENDER_MOBILE
SF_MONTHLY_CARD
SF_CARGO_NAME
SF_STANDARD_EXPRESS_TYPE_ID
SF_HALF_DAY_EXPRESS_TYPE_ID
SF_INTRACITY_API
SF_INTRACITY_COMPANY_CODE
SF_INTRACITY_ACCESS_CODE
SF_INTRACITY_CHECKWORD
SF_INTRACITY_PROJECT_CODE
SF_INTRACITY_SHOP_ID
SF_INTRACITY_SHOP_TYPE
```

相关文件：

```text
electron/renderer/src/views/Settings.vue
electron/main/dbManager.js
electron/main/sfShippingService.js
```

如果要新增一个顺丰产品类型，通常改：

```text
electron/main/sfShippingService.js
electron/tests/sfShippingService.test.mjs
electron/renderer/src/views/rental/SfShipping.vue
```

如果只是改顺丰产品编码，优先改设置页里的字段，不要改代码。

### 押金配置

优先在设置页改。

常见字段：

```text
DEPOSIT_API_MODE
DEPOSIT_APP_ID
DEPOSIT_APP_SECRET
DEPOSIT_BASE_URL
DEPOSIT_USER_EID
DEPOSIT_NOTIFY_URL
DEPOSIT_TIMEOUT_MS
DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT
DEPOSIT_RECEIVING_INFO_FALLBACK
```

相关文件：

```text
electron/renderer/src/views/Settings.vue
electron/main/depositClient.js
electron/main/depositNotifyServer.js
electron/main/ipcHandlers.js
electron/main/mobileGateway.js
```

### 商品、型号、上新、商品映射

如果是运营上新，优先在界面里处理：

```text
商品/型号映射页面
设备管理页面
排期页面
知识库页面
```

相关文件：

```text
electron/renderer/src/views/rental/ItemModelMapping.vue
electron/renderer/src/views/rental/Devices.vue
electron/renderer/src/views/rental/ScheduleCalendar.vue
electron/renderer/src/views/KnowledgeBase.vue
electron/main/dbManager.js
```

常见数据库表：

```text
item_model_mapping
schedule_units
rental_pricing
knowledge
xianyu_item_listings
```

建议流程：

1. 先把新商品同步到商品映射。
2. 绑定业务商品编码 `biz_item_code`。
3. 绑定型号 `model_code`。
4. 给型号补设备库存。
5. 给型号补租金和押金规则。
6. 给型号补知识库问答。
7. 用 local 环境验证询单、排期和回复。
8. 再在 production 环境录入正式数据。

### 订单来源渠道

订单履约里的来源渠道字段在：

```text
electron/renderer/src/views/rental/OrderFulfillment.vue
```

数据库字段：

```text
rental_orders.source_channel
rental_orders.source_name
```

如果只是运营填写渠道，在界面里填。只有新增渠道选项或显示文案时才改 `OrderFulfillment.vue`。

### 移动端页面字段

移动端 H5 和 API 在：

```text
electron/main/mobileGateway.js
```

如果手机端要显示新字段，一般同时检查：

```text
electron/main/mobileGateway.js
electron/main/dbManager.js
```

如果字段来自订单、排期、知识库，需要确认 `dbManager.js` 查询是否已经返回该字段。

## 11. 新增配置字段的标准流程

新增一个业务配置字段时按这个顺序做：

1. 在 `python/config_manager.py` 的 `DEFAULT_CONFIG` 加默认值。
2. 在 `electron/renderer/src/views/Settings.vue` 加输入控件或开关。
3. 确认保存时进入 `window.electronAPI.saveConfig`。
4. 在使用该配置的业务代码里读取 `getConfig()` 或 Python config。
5. 如果字段影响 Electron 主进程，检查 `electron/main/dbManager.js` 或相关 service。
6. 如果字段影响 Python 自动回复，检查 `python/bridge.py`、`python/main.py` 或 `python/services/*`。
7. 在 local 环境验证。
8. 再在 production 环境单独配置同名字段。

不要把业务配置写死在 `.env` 里，除非它只影响启动期。

## 12. 上线前检查清单

production 启动前检查：

- `config/environments/production.env` 已存在。
- `XIANYU_MYSQL_HOST` 和 `XIANYU_MYSQL_PORT` 可连接。
- 线上 MySQL 用户不是 root，权限只限 `xianyu_agent`。
- `XIANYU_DATA_DIR` 指向 `data/production` 或 Mac mini 上的持久目录。
- `VITE_PORT` 和 `XIANYU_MOBILE_GATEWAY_PORT` 没有和 local 冲突。
- 设置页里 production 数据库已配置 API Key、Cookies、飞书、顺丰、押金等真实参数。
- 手机公网访问使用 `XIANYU_ENV=production ./scripts/start_mobile_public_access.sh`。
- `screen -ls` 能看到 production 会话。
- 日志里 MySQL endpoint 是 production，不是 local。

## 13. 常见问题

### 报数据库连接失败

先检查当前启动的是哪个环境：

```bash
screen -ls
```

再看日志：

```bash
tail -n 80 /tmp/xianyu-launcher/local/electron.log
tail -n 80 /tmp/xianyu-launcher/production/electron.log
```

然后检查对应 env 文件：

```text
config/environments/local.env
config/environments/production.env
```

### 端口被占用

local 默认端口：

```text
Vite: 5177
mobile gateway: 8787
```

production 默认端口：

```text
Vite: 5277
mobile gateway: 8887
```

查看占用：

```bash
lsof -nP -iTCP:8787 -sTCP:LISTEN
lsof -nP -iTCP:8887 -sTCP:LISTEN
```

### 切到 production 后设置页配置不一样

这是预期行为。设置页配置存储在当前连接的 MySQL `config` 表里。local 和 production 连接不同数据库，所以 API Key、Cookies、飞书、顺丰等配置天然分离。

### 手机端还是连到旧环境

确认公网访问脚本使用了正确环境：

```bash
XIANYU_ENV=production ./scripts/start_mobile_public_access.sh
```

确认 Vite 代理和 mobile gateway 端口一致：

```text
production.env:
  VITE_PORT
  XIANYU_MOBILE_GATEWAY_PORT
```

### 不知道某个字段在哪改

先判断字段类型：

- 机器连接和端口：`config/environments/*.env`
- 设置页可见的业务参数：`electron/renderer/src/views/Settings.vue`
- 默认配置：`python/config_manager.py`
- 订单、排期、设备、知识库：`electron/main/dbManager.js` 和对应 Vue 页面
- 手机端：`electron/main/mobileGateway.js`
- 自动回复：`python/bridge.py`、`python/main.py`、`python/services/*`

