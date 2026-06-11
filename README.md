# 小狗相机助手

相机租赁运营与闲鱼 AI 客服工作台。项目当前服务于“小狗相机”这类闲鱼租赁业务，核心目标是把询单、排期、订单履约、押金、顺丰寄件、知识库、人工接管和手机端处理流程放到一个可日常使用的本地工作台里。

当前形态：

- 桌面端：Electron + Vue 3，用于完整运营后台。
- 手机端：`mobile-gateway` 提供 `/mobile` H5 工作台和 `/api/mobile/*` API，可配合内网穿透在手机上使用。
- 数据层：MySQL 为当前主存储，启动时会自动初始化业务表；同时保留部分 SQLite/本地文件依赖用于历史兼容和 Electron 原生模块。
- AI 运行时：Python bridge 负责闲鱼消息连接、自动回复、知识检索、人工接管和浏览器自动化相关能力。

## 当前能做什么

| 模块 | 说明 |
| --- | --- |
| 询单处理 | 解析客户租赁需求，提取型号、租期、城市、物流方式，生成可用性判断和回复参考。 |
| AI 客服 | 闲鱼消息自动回复，支持意图分类、知识库检索、人工接管、冷却和手动模式。 |
| 订单履约 | 管理租赁订单、租期、发货、归还、续租、完成和删除确认。 |
| 设备排期 | 按型号和设备编号维护库存，生成租期、发货、归还物流等档期块。 |
| 顺丰寄件 | 顺丰预下单、下单、轨迹、运费、同城/标快相关寄件流程。 |
| 押金管理 | 押金单、押金状态、费用和订单来源绑定。 |
| 知识库与学习 | 按全局、型号、商品作用域维护问答，支持学习候选审核。 |
| 飞书协作 | 待确认回复、提醒、回调和移动端任务处理。 |
| 手机工作台 | 通过 `/mobile` 在手机上查看排期、订单、询单和履约任务。 |

## 运行方式

### 方式一：桌面双击启动

macOS 当前使用桌面的启动器：

```bash
/Users/lishuangshuang/Desktop/闲鱼助手Pro.app
```

这个启动器会做几件事：

1. 检查并启动本机 MySQL。
2. 启动 Vite 开发服务：`http://localhost:5177`。
3. 启动 Electron 桌面窗口。
4. 启动手机网关：`http://127.0.0.1:8787`。

### 方式二：命令行开发启动

```bash
cd electron
npm install
npm run dev
```

`npm run dev` 会同时启动：

- Vite：`http://localhost:5177`
- Electron：加载 Vite 页面并注入 `window.electronAPI`

桌面完整功能必须在 Electron 窗口里使用。普通浏览器没有 Electron preload，不能直接使用订单、设置、知识库、顺丰寄件等桌面模块。

## 手机访问

手机端入口是移动工作台，不是 Electron 桌面页面：

```text
http://localhost:5177/mobile
```

或手机访问内网穿透域名：

```text
https://<你的穿透域名>/mobile
```

当前 Vite 已把这些路径代理到 `mobile-gateway`：

- `/mobile`
- `/api/mobile/*`
- `/api/feishu/*`

因此内网穿透工具可以指向本机 `5177`，手机访问 `/mobile` 即可使用移动端后台。也可以直接把穿透工具指向 `8787`，访问同样的 `/mobile`。

参考文档：[手机公网访问方案](docs/rental-ops/mobile-public-access.md)

## 环境要求

| 工具 | 说明 |
| --- | --- |
| Node.js | 建议 18+ |
| npm | 随 Node 安装 |
| Python | 建议 3.10+，用于 `python/bridge.py` |
| MySQL | 当前主数据库，默认库名 `xianyu_agent` |
| Playwright Chromium | 扫码登录和浏览器自动化需要 |

安装 Python 依赖：

```bash
pip install -r python/requirements.txt
playwright install chromium
```

安装 Electron 依赖：

```bash
cd electron
npm install
```

## 数据与配置

详细环境切换、启动、停止和字段维护说明见：[环境切换与启动运维手册](docs/deployment/environment-runbook.md)。

桌面启动按环境加载配置。默认本机开发环境使用：

```bash
./scripts/start_xianyu_desktop_local.sh
```

线上环境使用：

```bash
./scripts/start_xianyu_desktop_production.sh
```

手机公网访问脚本也读取同一套环境配置。默认使用 local；如需暴露线上环境：

```bash
XIANYU_ENV=production ./scripts/start_mobile_public_access.sh
```

两套启动命令分别读取：

- `config/environments/local.env`
- `config/environments/production.env`

这两个文件包含数据库密码、数据目录和端口等机器私有配置，默认不会提交到 Git。首次配置时从模板复制：

```bash
cp config/environments/local.example.env config/environments/local.env
cp config/environments/production.example.env config/environments/production.env
```

MySQL 连接统一使用主机和端口，不使用 socket。可配置项包括：

- `XIANYU_MYSQL_HOST`
- `XIANYU_MYSQL_PORT`
- `XIANYU_MYSQL_USER`
- `XIANYU_MYSQL_PASSWORD`
- `XIANYU_MYSQL_DATABASE`

底层仍兼容以下来源，优先级从高到低：

1. 环境变量里的单项 MySQL 配置。
2. `XIANYU_MYSQL_CONFIG` 指向的 JSON 文件。
3. 工作区附近的 `mysql-connection.json`。
4. 默认值：`127.0.0.1:3306`、用户 `root`、数据库 `xianyu_agent`。

运行数据目录由 `XIANYU_DATA_DIR` 控制。建议本机和线上环境使用不同目录：

```text
data/local
data/production
```

业务配置（例如 API Key、Cookies、顺丰、飞书、Agent 参数）存储在对应环境的 MySQL 数据库中。切换启动命令后，应用会连接不同数据库，因此这些业务配置也会自然分成 local / production 两套。

启动时会在数据目录下生成：

- Electron 用户数据和缓存目录。
- `db-backups/` 运行时快照。
- 导入文件、日志和其它本地运行数据。

## 项目结构

```text
electron/
  main/
    index.js              Electron 主进程入口
    dbManager.js          MySQL 数据访问和业务数据服务
    mobileGateway.js      手机 H5 工作台和移动端 API
    ipcHandlers.js        Electron IPC 接口
    pythonManager.js      Python bridge 进程管理
    sfShippingService.js  顺丰接口请求与结果归一化
  preload/
    preload.js            暴露 window.electronAPI
  renderer/
    src/                  Vue 3 桌面端界面

python/
  bridge.py               Electron 与 Python 的 JSON Lines 桥
  main.py                 闲鱼 WebSocket 连接与消息处理
  services/               会话、知识、接管、租赁等服务
  knowledge_base/         知识库检索
  channels/               浏览器通道和自动化能力

scripts/
  mysql_schema.sql        MySQL 表结构
  start_mobile_public_access.sh
  migrate_to_mysql.py

docs/
  design/                 当前 UI 重设计规范
  rental-ops/             租赁运营和手机端方案
  superpowers/            功能设计与实施计划
```

## 常用命令

```bash
# 启动桌面开发环境
cd electron
npm run dev

# 构建 Vue 渲染层
cd electron
npm run build:renderer

# 打包 Electron
cd electron
npm run build:electron

# 完整构建
cd electron
npm run build
```

## 验证方式

桌面端：

1. 启动 `npm run dev` 或双击桌面启动器。
2. 确认 Electron 窗口打开。
3. 检查控制台中出现 `[MySQL] initDbManager done`。
4. 检查 `mobile-gateway` 输出 `listening at http://127.0.0.1:8787`。

手机端：

```bash
curl http://127.0.0.1:5177/mobile
curl http://127.0.0.1:5177/api/mobile/model-codes
```

第一个命令应返回 HTML，第二个命令应返回 JSON。

## 重要边界

- `localhost:5177` 根页面是桌面 Vue 壳；普通浏览器访问时会自动进入 `/mobile`。
- Electron 桌面模块依赖 `window.electronAPI`，不能直接在手机浏览器里完整运行。
- 手机端应使用 `/mobile` 工作台和 `/api/mobile/*` API。
- 本机穿透方案适合临时使用；长期多人使用应部署独立云端服务。
- 启动、数据库、Python bridge、闲鱼连接和顺丰接口涉及真实业务状态，改动前需要确认影响范围。

## 说明

本 README 以当前“小狗相机助手”本地项目的真实结构、启动方式和业务模块为准。
