# Phase 01 Legacy Channel 边界说明

确认日期：2026-06-12

## 总原则

闲鱼不再是产品核心，只作为 legacy channel / 订单来源渠道之一。

Phase 01 对 legacy 的处理原则：

1. 不删除。
2. 不重构。
3. 不进入新产品主导航。
4. 不作为新架构核心。
5. 只在文档中标记为 legacy / 渠道化候选 / 待确认。
6. 未来如果仍有业务价值，再抽象为渠道能力或客户沟通辅助。

## 统一降级的能力

以下能力统一降级为 legacy / channel / 待确认，不作为新产品主架构：

| 能力 | Phase 01 分类 | 后续可能方向 |
|---|---|---|
| 闲鱼自动回复作为产品核心 | legacy | 客户沟通辅助候选 |
| 闲鱼账号连接作为主入口 | legacy channel | 渠道配置 |
| 闲鱼 WebSocket / cookies / token | legacy 技术链路 | 闲鱼渠道兼容层 |
| 浏览器 IM 扫描 | legacy 技术实现 | 渠道兼容层 |
| 闲管家开放平台 | legacy channel integration | 视接口稳定性和业务价值决定 |
| 商品 item_id / chat_id / session_id 强绑定 | 渠道化候选 | channel_item_id / channel_conversation_id 等抽象 |
| 自动回复 Agent | legacy | 客户沟通辅助 / 话术模板候选 |
| 人工接管 | legacy 包装后保留 | 员工待办 / SOP 候选 |
| 消息审批 | legacy 客服流程 | 客户沟通辅助 / 员工话术审批候选 |
| 学习审核 | legacy 客服训练能力 | 话术库 / SOP 知识库 / 新员工培训候选 |
| 闲鱼市场监控 | legacy / 暂缓 | 行业数据 / 竞品观察 / 渠道监控候选 |
| 闲鱼帖子审核 | legacy | 闲鱼渠道工具 |
| XianyuAgentPro / xianyu-auto-agent / xianyu_agent 等旧命名 | legacy 命名 | 后续命名统一和迁移计划 |
| xianyu.deposit* localStorage key | legacy 命名 | 后续兼容迁移 |

## 重点能力处理级别

### 市场监控

- Phase 01 标记为 legacy / 暂缓。
- 不进入当前产品主线。
- 后续如果有价值，可转为“行业数据 / 竞品观察 / 渠道监控”方向重新设计。

### 闲管家

- Phase 01 标记为 legacy channel integration。
- 不作为当前核心架构。
- 后续视接口稳定性和业务价值决定是否保留。

### 消息审批

- Phase 01 标记为 legacy 客服流程。
- 不作为当前主线。
- 后续可抽象为“客户沟通辅助 / 员工话术审批”。

### 学习审核

- Phase 01 标记为 legacy 客服训练能力。
- 不作为当前主线。
- 后续可抽象为“话术库 / SOP 知识库 / 新员工培训”。

### 浏览器采集 / 浏览器 IM

- Phase 01 标记为 legacy 技术实现。
- 不作为未来主架构。
- 不删除。
- 后续仅在渠道兼容层讨论。

## 不应删除的 legacy

以下 legacy 能力短期不可删除：

- 闲鱼 WebSocket / cookies / token / 浏览器模式。
- 自动回复 Agent。
- item_id / chat_id / session_id 字段。
- 启动脚本和打包名称。
- xianyu_agent 数据库名。
- 现有有效数据和历史备份。

## 新产品主架构要求

新产品主架构应围绕：

```text
询单、订单、档期、设备、免押/押金、物流、归还验机、员工协作、经营数据
```

而不是围绕：

```text
闲鱼自动回复、闲鱼账号连接、闲鱼 IM、闲鱼商品帖子
```
