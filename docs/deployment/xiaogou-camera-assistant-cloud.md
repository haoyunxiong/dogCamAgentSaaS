# 小狗相机助手云部署与固定域名方案

## 当前结论

当前项目是 Electron 桌面应用，不是可直接部署到公网域名访问的 Web SaaS。现阶段建议采用：

```text
桌面端小狗相机助手
  -> 连接云上数据库 / 后端服务
  -> 固定域名用于下载页、状态页、API 网关或移动工作台
```

如果要让用户直接打开 `https://你的域名` 使用完整后台，需要后续做 Web SaaS 架构改造：认证、服务端 API、租户隔离、权限、前端 Web 构建和云端运行环境。

## 推荐云架构

### 阶段 1：当前桌面版上云配套

- 云服务器：阿里云 ECS、腾讯云 CVM、华为云 ECS 或 AWS Lightsail。
- 系统：Ubuntu 22.04 LTS。
- 数据库：优先使用云数据库 MySQL；预算有限可先在同一台服务器安装 MySQL。
- 域名：例如 `xiaogoucamera.com`。
- 固定域名用途：
  - `www.xiaogoucamera.com`：下载页、说明页或运营入口。
  - `api.xiaogoucamera.com`：未来 API 网关。
  - `status.xiaogoucamera.com`：状态页或健康检查。

不要把 MySQL 3306 直接暴露到公网。临时调试可以使用 SSH 隧道，长期使用应改为 API 服务或 VPN/内网访问。

### 阶段 2：未来 Web SaaS

后续如果要做真正的云端访问，应拆成：

- Vue Web 前端：使用 Vite 构建静态文件。
- 后端 API：Node、Python FastAPI 或现有 Electron main 逻辑拆出的服务端。
- 认证：账号密码、短信、飞书/企微登录或单点登录。
- 多租户：按店铺、账号或团队隔离数据。
- 密钥管理：Cookie、API Key、顺丰和飞书凭证放到服务端密钥库，不进入前端。
- 部署：Nginx 反向代理 + HTTPS + CI/CD。

## 固定域名绑定步骤

以下以 Ubuntu 22.04 + Nginx 为例。

### 1. 购买云服务器

建议配置：

```text
2 核 CPU
4 GB 内存
80 GB SSD
Ubuntu 22.04 LTS
```

安全组只开放：

```text
22/tcp    SSH
80/tcp    HTTP
443/tcp   HTTPS
```

如必须远程访问 MySQL，只允许固定办公 IP，并优先使用 SSH 隧道。

### 2. 解析域名

在域名 DNS 控制台添加：

```text
A     www       服务器公网 IP
A     api       服务器公网 IP
A     status    服务器公网 IP
```

如果使用云厂商负载均衡或 Vercel/Netlify，可用 CNAME 指向平台提供的域名。

### 3. 安装 Nginx

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

创建站点配置：

```nginx
server {
  listen 80;
  server_name www.xiaogoucamera.com;

  root /var/www/xiaogou-camera-assistant;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/xiaogou-camera-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. 配置 HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d www.xiaogoucamera.com -d api.xiaogoucamera.com -d status.xiaogoucamera.com
```

检查自动续期：

```bash
sudo certbot renew --dry-run
```

### 5. 上传下载页或静态入口

```bash
sudo mkdir -p /var/www/xiaogou-camera-assistant
sudo chown -R $USER:$USER /var/www/xiaogou-camera-assistant
```

把下载页、版本说明或后续 Web 构建产物放到：

```text
/var/www/xiaogou-camera-assistant
```

### 6. 云数据库建议

优先选云数据库 MySQL：

- 开启自动备份。
- 设置强密码。
- 只允许服务器内网或固定 IP 访问。
- 不把数据库密码写入 Git。

如果当前桌面端需要连接云数据库，建议先通过 SSH 隧道验证：

```bash
ssh -L 3307:数据库内网地址:3306 ubuntu@服务器公网IP
```

然后桌面端连接：

```text
127.0.0.1:3307
```

长期方案应改为 `api.xiaogoucamera.com` 后端 API，桌面端不直接连 MySQL。

## 上线检查清单

- 域名已备案或符合所在云厂商要求。
- DNS A/CNAME 记录生效。
- Nginx `nginx -t` 通过。
- HTTPS 证书签发成功。
- 80/443 安全组已开放。
- MySQL 未直接暴露公网，或只允许固定 IP。
- 服务器有自动备份。
- 敏感配置不进入 Git。

## 后续改造成 Web SaaS 的最小任务

1. 把 Electron renderer 作为独立 Web 前端构建。
2. 把 Electron main 中的数据访问能力拆成服务端 API。
3. 增加登录认证和权限模型。
4. 增加店铺/团队级租户隔离。
5. 把自动回复、顺丰、飞书等密钥全部放服务端。
6. 用 Nginx 将 `https://www.xiaogoucamera.com` 指向前端，将 `https://api.xiaogoucamera.com` 指向后端。
