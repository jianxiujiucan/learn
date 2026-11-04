# 成长打卡

基于 Vue 3、TypeScript、Sass、Express 和 MySQL 的打卡项目，并提供 Taro + Vue 3 的微信小程序版本。网页端界面沿用春日配色设计稿，颜色统一使用 CSS 自定义属性，定义在 `src/styles/variables.css`。

> 需要 Node.js 18 及以上版本（Taro 4 的要求）。

## 目录

```
.
├─ src/                     # 网页端 Vue 3
├─ server/                  # Express API、会话、MySQL
├─ shared/                  # 前后端共用校验
├─ miniprogram/             # 微信小程序（Taro + Vue 3）
│  ├─ config/               # Taro 构建配置
│  ├─ src/
│  │  ├─ pages/login/       # 登录页（微信一键登录 / 账号密码）
│  │  ├─ pages/index/       # 打卡主页
│  │  ├─ components/        # 概览卡、日历、任务列表、底部弹层
│  │  └─ api/               # 带 Bearer Token 的请求封装
│  └─ project.config.json   # 微信开发者工具项目配置
└─ .env.example
```

## 功能

- 用户名注册、登录和退出，bcrypt 密码哈希，httpOnly 会话 Cookie
- 微信小程序微信一键登录，也支持用已有账号密码登录
- 密码至少 8 位且同时包含字母和数字，登录与注册均支持图标切换显隐
- 新用户自动获得 7 项默认任务，并安排到注册/首次登录当天
- 月份切换、任意日期选择、历史完成标记
- 从个人任务库安排每日任务，在安排弹窗中修改、删除任务，也可通过主页面新增任务
- 勾选打卡，实时更新数量、进度环、进度条和连续打卡天数
- MySQL 持久化，刷新或重新登录后恢复当前用户的数据
- 移动端底部弹窗、桌面端居中弹窗、键盘焦点管理

## 网页版启动

```bash
npm install
cp .env.example .env
# 修改 .env 中的 MySQL 连接信息
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3001
- 首次启动自动创建 `growth_checkin` 数据库和数据表

生产构建：

```bash
npm run build
npm start
```

`npm start` 会在存在 `dist` 时同时托管前端静态文件。

## 微信小程序

### 1. 安装依赖与构建

```bash
npm run mini:install
npm run mini:dev
```

首次构建后会生成 `miniprogram/dist/`（已在 `.gitignore` 中忽略）。

### 2. 用微信开发者工具导入

导入目录选择 **`miniprogram`**（不是 `dist`）。`project.config.json` 里的 `miniprogramRoot` 已指向 `./dist`。

- 没有 AppID 时，`appid` 保持 `touristappid`，用测试号打开。
- 有正式 AppID 时，把 `miniprogram/project.config.json` 的 `appid` 换成自己的。
- 本地调试需要勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。

### 3. 配置 API 地址

小程序默认请求 `http://127.0.0.1:3001`，在开发者工具里可直接连本机后端。

需要改地址时，在构建命令前设置环境变量，例如 PowerShell：

```powershell
$env:TARO_APP_API_BASE="http://192.168.1.10:3001"
npm run mini:dev
```

也可以用 `miniprogram/config/index.ts` 里的默认值。真机调试时 `127.0.0.1` 指向手机自己，必须换成电脑的局域网 IP，或使用已备案的 HTTPS 域名。

### 4. 微信登录

本地开发默认可以“零配置”跑通：

- `.env` 的 `NODE_ENV=development` 且未配置 `WX_APPID` 时，**只有来自 `127.0.0.1` 的请求**会使用模拟微信账号。
- 模拟账号固定为 `WX_MOCK_OPENID`（默认 `mock-openid-growth-checkin`），重复登录仍是同一个用户。
- 在开发者工具里点「微信一键登录」即可。测试号拿不到 `code` 也没关系，本地模拟允许空 `code`。

正式微信登录需要：

1. 在 `.env` 填写：

   ```dotenv
   WX_APPID=wx1234567890abcdef
   WX_SECRET=你的小程序 AppSecret
   ```

2. 重启后端。
3. 在微信公众平台 →「开发管理」→「开发设置」→「服务器域名」中，把 API 域名加入 **request 合法域名**。
4. 域名必须已备案并支持 HTTPS；微信不允许正式环境使用 HTTP 或 IP 地址。

`WX_LOGIN_MOCK=true` 可让局域网真机也使用模拟账号，但生产环境（`NODE_ENV=production`）会强制禁用模拟登录。

### 账号说明

- 微信一键登录会创建一个独立的微信用户（用户名形如 `wx_xxxxxxxxxx`），与网页端已有账号的数据不互通。
- 登录页底部提供「使用已有账号登录」，可以继续使用网页端注册的账号和打卡数据。
- 目前没有做「微信账号绑定已有账号」，需要的话可以后续增加。

## 后端登录与会话

### Cookie + Bearer Token

网页端仍使用 HttpOnly Cookie；小程序使用 `Authorization: Bearer <token>`。

- `POST /api/auth/login`、`POST /api/auth/register` 现在额外返回 `token`。
- `POST /api/auth/logout` 支持 Bearer Token 注销。
- 其余接口鉴权逻辑不变，两种方式都可用。

### 微信登录接口

```http
POST /api/auth/wechat
Content-Type: application/json

{ "code": "wx.login 返回的 code", "today": "2026-11-04" }
```

返回：

```json
{
  "user": { "id": 1, "username": "wx_xxxxxxxxxx", "isWechat": true },
  "token": "...."
}
```

服务端会用 `code` 调用微信 `jscode2session` 换取 `openid`：

- 首次登录：创建用户，并写入默认任务和当天任务。
- 再次登录：复用同一个用户。
- 数据库会自动补 `users.wechat_openid` 列和唯一索引，无需手动迁移。

## 验证

```bash
npm test
npx tsc -p server/tsconfig.json
npm run build
npm run mini:build
# 开发服务器运行时：
npm run test:e2e
```

端到端测试使用本机 Edge，覆盖注册、密码显隐、默认任务、打卡、新增任务、日历切换、任务安排、刷新持久化、重新登录和移动端布局。截图保存在 `artifacts/`。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同时启动网页端和后端 |
| `npm test` | 后端校验单元测试 |
| `npm run build` | 网页端类型检查 + 构建 |
| `npm run mini:install` | 安装小程序依赖 |
| `npm run mini:dev` | 小程序 watch 构建 |
| `npm run mini:build` | 小程序生产构建 |

## 上线前检查

- [ ] `miniprogram/project.config.json` 换成正式 AppID
- [ ] 服务端配置 `WX_APPID`、`WX_SECRET`、`NODE_ENV=production`
- [ ] API 使用 HTTPS 域名，并加入小程序 request 合法域名
- [ ] `TARO_APP_API_BASE` 改为正式 HTTPS 地址
- [ ] 网页端 HTTPS 环境设置 `COOKIE_SECURE=true`
- [ ] 确认 `WX_LOGIN_MOCK` 未开启
- [ ] 微信登录用户与网页账号的数据策略已确认

## 数据安全

- `.env` 已加入 `.gitignore`，不要提交真实数据库密码或小程序 AppSecret。
- 密码不以明文保存；数据库会话表只保存会话令牌哈希。
- 每个任务和打卡记录都通过当前会话的用户 ID 隔离。
- 微信登录只在服务端使用 `AppSecret`，不会下发到小程序。
