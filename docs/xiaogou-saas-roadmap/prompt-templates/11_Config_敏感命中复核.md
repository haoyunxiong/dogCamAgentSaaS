# Prompt Template：敏感命中复核

```text
现在执行“敏感命中复核”。

请不要输出真实 token、cookie、密码、数据库连接串、私钥原文。

请对以下命中逐项判断：
【粘贴命中列表，例如：electron/main/dbManager.js:2357:TOKEN_LITERAL】

对每一项输出：
- 文件路径
- 行号
- 命中类型
- 分类：SAFE_FALSE_POSITIVE / IGNORED_LOCAL_FILE / REAL_SECRET / NEED_USER_CONFIRMATION
- 脱敏原因说明

分类规则：

SAFE_FALSE_POSITIVE：
- 只是变量名、字段名、对象属性、函数参数、配置读取；
- 例如 token、authToken、cookie、cookiesStr、password、config.password、process.env.xxx、dbManager.getConfig()、headers.Authorization；
- 没有真实长串密钥、真实 cookie、真实密码、真实连接串。

IGNORED_LOCAL_FILE：
- 文件已被 .gitignore 排除，不会进入提交。

REAL_SECRET：
- 真实硬编码 token；
- 真实 cookie 长串；
- 真实数据库密码；
- 真实数据库连接串；
- 真实 API Key；
- 私钥内容。

NEED_USER_CONFIRMATION：
- 无法判断是不是示例值或真实值；
- 看起来像真实值但不能确认。

如果出现任何 REAL_SECRET 或 NEED_USER_CONFIRMATION，立即停止，不要 commit。
如果全部是 SAFE_FALSE_POSITIVE 或 IGNORED_LOCAL_FILE，可以继续后续提交流程。
```
