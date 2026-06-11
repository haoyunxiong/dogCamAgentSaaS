# 手机公网访问方案 A

## 目标

让当前本机运行的闲鱼助手手机工作台，通过临时公网地址在 iPhone 上访问使用。

## 当前做法

- 本机 `mobile gateway` 监听 `127.0.0.1:8787`
- 使用本机 `ngrok` 把 `8787` 映射为一个 HTTPS 公网地址
- 手机访问 `https://<ngrok-domain>/mobile`

## 启动命令

运行下面这个脚本：

```bash
zsh /Users/lishuangshuang/Downloads/闲鱼Agent/XianyuAgentPro/scripts/start_mobile_public_access.sh
```

脚本会自动：

- 检查 `8787` 网关是否已启动
- 如未启动则拉起独立 mobile gateway
- 检查 `ngrok` 隧道是否可用
- 输出当前可访问的公网地址

## 当前入口

脚本输出的 `公网访问地址` 即手机入口，完整路径为：

```text
https://<ngrok-domain>/mobile
```

`可用于飞书回调的基础地址` 为：

```text
https://<ngrok-domain>
```

## iPhone 使用方式

1. 在 iPhone Safari 打开 `https://<ngrok-domain>/mobile`
2. 点击 Safari 分享按钮
3. 选择“添加到主屏幕”
4. 名称可设为“闲鱼助手”

后续从主屏幕打开时，会以接近 App 的方式使用。

## natapp 注意事项

如果使用 natapp 域名，例如：

```text
kitlend.natapp1.cc
```

需要区分 HTTP 和 HTTPS：

- `http://kitlend.natapp1.cc/mobile` 能打开，只代表 HTTP 隧道正常。
- `https://kitlend.natapp1.cc/mobile` 如果显示 `Tunnel kitlend.natapp1.cc not found`，说明 HTTPS 隧道没有对应到当前服务。
- iPhone 添加到主屏幕后可能优先按 HTTPS 启动；这种情况下需要开通/配置 natapp HTTPS，或改用 ngrok、Cloudflare Tunnel 等稳定 HTTPS 入口。
- 如果暂时只用 HTTP，请在 Safari 地址栏明确输入完整的 `http://kitlend.natapp1.cc/mobile` 后再添加到主屏幕。

## 方案限制

- `ngrok` 免费域名可能变化，所以每次重启隧道后都应重新确认入口地址
- 本机电脑必须保持开机、联网、且不能休眠
- 如果 `mobile gateway`、`ngrok`、网络任一中断，手机端就会不可访问
- 该方案适合几个人临时使用和流程验证，不适合长期正式运行

## 适用场景

- 先让手机端尽快用起来
- 先验证操作流程和使用频率
- 为后续云服务器长期部署做过渡
