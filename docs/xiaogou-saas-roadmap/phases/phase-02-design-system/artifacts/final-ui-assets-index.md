# Final UI Assets Index / 最终 UI 图片索引

## Canonical Reference Source / 唯一参考源

当前唯一允许作为最终 UI 实现依据的图片目录：

```text
docs/xiaogou-saas-roadmap/design-references/final-ui-reference-locked/
```

禁止继续使用旧 `final-ui-direction/`、`archive-mixed-ui-reference-DO-NOT-USE/` 或任何历史候选图作为最终实现参考。详细规则见：

```text
docs/xiaogou-saas-roadmap/design-references/FINAL_UI_REFERENCE_ONLY.md
```

## Desktop / Web

| 文件 | 页面 | 用途 |
|---|---|---|
| `desktop/01_desktop_order_center.png` | 订单中心 | PC 端订单中心、表格、右侧 Drawer、筛选、状态体系参考 |
| `desktop/02_desktop_workbench.png` | 工作台 | PC 端工作台、待办、快捷入口、运营提醒参考 |
| `desktop/03_desktop_schedule_center.png` | 档期中心 | PC 端档期热力图、型号视图、右侧详情参考 |
| `desktop/04_desktop_device_management.png` | 设备管理 | PC 端设备列表、设备详情 Drawer、状态体系参考 |
| `desktop/05_desktop_customer_management.png` | 客户管理 | PC 端客户列表、客户详情、CRM 参考 |
| `desktop/06_desktop_logistics_shipping.png` | 物流发货 | PC 端物流列表、运单详情、发货流程参考 |
| `desktop/07_desktop_report_center.png` | 报表中心 | PC 端数据报表、图表卡片、洞察建议参考 |
| `desktop/08_desktop_system_settings.png` | 系统设置 | PC 端设置中心、表单、开关、配置模块参考 |

## Mobile

| 文件 | 页面 | 用途 |
|---|---|---|
| `mobile/01_mobile_workbench.jpeg` | 工作台 | 手机端首页，移动运营工作台参考 |
| `mobile/02_mobile_order_center.jpeg` | 订单中心 | 手机端订单列表卡片参考 |
| `mobile/03_mobile_schedule_center.jpeg` | 档期中心 | 手机端档期卡片/热力条参考 |
| `mobile/04_mobile_order_detail.jpeg` | 订单详情 | 手机端详情页与底部操作参考 |
| `mobile/05_mobile_device_center.jpeg` | 设备中心 | 手机端设备列表参考 |
| `mobile/06_mobile_my_center.jpeg` | 我的 | 手机端低频功能入口与更多工具参考 |

## Known Gaps / 当前缺口

- 当前没有单独的桌面端免押管理最终图。
- 当前没有单独的手机端免押管理最终图。
- 免押管理后续应参考订单、客户、物流和系统设置的同风格结构重构，不再使用旧候选免押图。

## 说明

这些图片是当前最终设计输入，不等于前端最终代码。Codex 实现时必须拆解为 Design Tokens、Base Components、页面结构和状态规范。
