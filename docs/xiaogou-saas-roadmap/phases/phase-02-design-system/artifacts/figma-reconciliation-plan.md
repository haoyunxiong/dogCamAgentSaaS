# Figma Reconciliation Plan / Figma 衔接与校准计划

## 1. 结论

当前已经在 Figma 中创建过部分组件，因此 **不建议全部推翻重做**。

正确做法是：

```text
审计已有组件
→ 对照最终 UI 图片与 final-ui-style-lock.md
→ 保留可用组件
→ 调整不一致的组件
→ 缺失组件补齐
→ 必要时创建 v2 变体
```

## 2. 禁止事项

- 不要删除已有 Figma 组件；
- 不要直接重建全部页面；
- 不要让 Figma 会话跳过审计直接画页面；
- 不要用 PNG 代替原生可编辑组件；
- 不要把旧“小狗相机”视觉继续作为核心品牌。

## 3. Figma 后续任务

### Phase 02B-Reconcile

1. 读取本包设计参考图；
2. 检查 Figma 当前页面与组件；
3. 输出组件审计表：可保留 / 需调整 / 需新增；
4. 按 final-ui-style-lock.md 更新颜色、字体、间距、圆角、阴影；
5. 补齐 P0 基础组件；
6. 再进入页面高保真。

## 4. 建议 Figma 文件结构

Starter 限制下继续采用：

```text
Page 1: 00 System / 设计系统
Page 2: 01 Mobile / 手机端核心页面
Page 3: 02 Desktop / PC 端核心页面
```

如果后续升级 Figma 计划，再拆成更多 Page。
