# Final UI Reference Only / 最终 UI 参考源锁定

## 唯一允许参考目录

后续 Electron UI-V2 实现、视觉还原、差距审计和验收，只允许使用以下目录中的 UI 图片作为最终设计图参考：

```text
docs/xiaogou-saas-roadmap/design-references/final-ui-reference-locked/
```

## 禁止使用的旧参考源

以下目录、文件或历史散图不得继续作为最终 UI 实现依据：

- `docs/xiaogou-saas-roadmap/design-references/archive-mixed-ui-reference-DO-NOT-USE/`
- 旧 `docs/xiaogou-saas-roadmap/design-references/final-ui-direction/`
- `imagegen*`
- `contact_sheet*`
- `小狗相机助手*`
- `租赁商家运营系统*` 历史散图
- 任何不在 `final-ui-reference-locked/` 下的 UI 图片

如果历史文档、Prompt 或页面审计提到上述旧图，只能作为反例或归档记录，不得作为实现基准。

## Desktop 最终参考图清单

目录：

```text
docs/xiaogou-saas-roadmap/design-references/final-ui-reference-locked/desktop/
```

文件：

- `01_desktop_order_center.png`
- `02_desktop_workbench.png`
- `03_desktop_schedule_center.png`
- `04_desktop_device_management.png`
- `05_desktop_customer_management.png`
- `06_desktop_logistics_shipping.png`
- `07_desktop_report_center.png`
- `08_desktop_system_settings.png`

## Mobile 最终参考图清单

目录：

```text
docs/xiaogou-saas-roadmap/design-references/final-ui-reference-locked/mobile/
```

文件：

- `01_mobile_workbench.jpeg`
- `02_mobile_order_center.jpeg`
- `03_mobile_schedule_center.jpeg`
- `04_mobile_order_detail.jpeg`
- `05_mobile_device_center.jpeg`
- `06_mobile_my_center.jpeg`

## 当前缺口说明

- 当前没有单独的桌面端免押管理最终图。
- 当前没有单独的手机端免押管理最终图。
- 如需免押页面，应以桌面端订单、设备、客户、物流、设置的同风格进行结构重构，而不是继续参考旧候选图。

## 后续实现要求

- Electron UI-V2 必须按 `final-ui-reference-locked/` 对齐。
- 不允许混用历史候选图、过程图或旧 `final-ui-direction/` 图片。
- 若某页面缺少最终图，必须先明确：
  - 结构参考来源；
  - 视觉风格来源；
  - 哪些部分是基于当前业务语义推导，而不是图片直接还原。
- 任何 Design Fidelity Gap Audit 或 Gap Closure 任务，都必须先读取本文件。
