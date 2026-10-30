# 成长打卡

基于 Vue 3、TypeScript、Sass、Express 和 MySQL 的完整打卡项目。界面沿用春日配色设计稿，所有样式颜色统一使用 CSS 原生自定义属性，并定义在 `src/styles/variables.css`。

## 功能

- 用户名注册、登录和退出，bcrypt 密码哈希，httpOnly 会话 Cookie
- 密码至少 8 位且同时包含字母和数字，登录与注册均支持图标切换显隐
- 新用户自动获得 7 项默认任务，并安排到注册当天
- 月份切换、任意日期选择、历史完成标记
- 从个人任务库安排每日任务，在安排弹窗中修改、删除任务，也可通过主页面新增任务
- 勾选打卡，实时更新数量、进度环、进度条和连续打卡天数
- MySQL 持久化，刷新或重新登录后恢复当前用户的数据
- 移动端底部弹窗、桌面端居中弹窗、键盘焦点管理

## 启动

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

## 验证

```bash
npm test
npx tsc -p server/tsconfig.json
npm run build
# 开发服务器运行时：
npm run test:e2e
```

端到端测试使用本机 Edge，覆盖注册、密码显隐、默认任务、打卡、新增任务、日历切换、任务安排、刷新持久化、重新登录和移动端布局。截图保存在 `artifacts/`。

## 数据安全

- `.env` 已加入 `.gitignore`，不要提交真实数据库密码。
- 密码不以明文保存；数据库会话表只保存会话令牌哈希。
- 每个任务和打卡记录都通过当前会话的用户 ID 隔离。
