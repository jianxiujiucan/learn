import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const artifacts = path.resolve('artifacts');
await fs.mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 430, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const username = `测试用户${Date.now().toString().slice(-7)}`;
const password = 'Abc12345';

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: '注册' }).click();
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill('abcdefgh');
  await page.locator('#auth-confirm').fill('abcdefgh');
  await page.getByRole('button', { name: '显示密码', exact: true }).click();
  assert.equal(await page.locator('#auth-password').getAttribute('type'), 'text');
  await page.getByRole('button', { name: '隐藏密码', exact: true }).click();
  assert.equal(await page.locator('#auth-password').getAttribute('type'), 'password');
  await page.getByRole('button', { name: '注册并开始打卡' }).click();
  await page.getByText('密码需为 8–64 位，且同时包含字母和数字').waitFor();
  await page.screenshot({ path: path.join(artifacts, 'register.png'), fullPage: true });

  await page.locator('#auth-password').fill(password);
  await page.locator('#auth-confirm').fill(password);
  await page.getByRole('button', { name: '注册并开始打卡' }).click();
  await page.locator('.task-row').first().waitFor();
  assert.equal(await page.locator('.task-row').count(), 7, '新用户应有 7 项默认任务');

  const heroColors = await page.locator('.hero-card').evaluate((element) =>
    getComputedStyle(element).backgroundImage,
  );
  assert.ok(heroColors.includes('71, 160, 105'), '主卡应使用参考主绿');

  await page.locator('.task-row').first().locator('.custom-check').click();
  await page.waitForFunction(() =>
    document.querySelector('.task-count')?.textContent?.includes('1 / 7'),
  );
  await page.getByRole('button', { name: '新增任务', exact: true }).click();
  await page.screenshot({ path: path.join(artifacts, 'add-task-modal.png'), fullPage: true });
  await page.locator('#new-task-name').fill('阅读 20 分钟');
  await page.getByRole('button', { name: '添加并安排到当天' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.task-row').length === 8);

  const currentMonth = await page.locator('#calendar-title').textContent();
  await page.getByRole('button', { name: '下个月' }).click();
  assert.notEqual(await page.locator('#calendar-title').textContent(), currentMonth);
  await page.getByRole('button', { name: '上个月' }).click();
  assert.equal(await page.locator('#calendar-title').textContent(), currentMonth);

  await page.getByRole('button', { name: '安排任务', exact: true }).click();
  assert.equal(await page.locator('.selection-row').count(), 8, '任务库应包含新增任务');
  assert.equal(
    await page.locator('#arrange-add-submit').evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgb(166, 228, 136)',
    '新增按钮应应用主题浅绿色',
  );
  assert.equal(
    await page.locator('.icon-action').first().evaluate((element) => getComputedStyle(element).display),
    'grid',
    '编辑按钮应应用组件样式',
  );
  await page.locator('#arrange-new-task').fill('整理房间');
  await page.locator('#arrange-add-submit').click();
  await page.waitForFunction(() => document.querySelectorAll('.selection-row').length === 9);
  await page.getByRole('button', { name: '修改任务 整理房间', exact: true }).click();
  await page.locator('.edit-input').fill('整理书桌');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.getByText('整理书桌', { exact: true }).waitFor();
  await page.getByRole('button', { name: '删除任务 整理书桌', exact: true }).click();
  await page.getByText('删除“整理书桌”？', { exact: true }).waitFor();
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.selection-row').length === 8);
  await page.screenshot({ path: path.join(artifacts, 'arrange-modal.png'), fullPage: true });
  await page.getByRole('button', { name: '全选' }).click();
  await page.getByRole('button', { name: /保存安排/ }).click();
  await page.locator('.modal-overlay').waitFor({ state: 'detached' });

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.task-row').first().waitFor();
  assert.equal(await page.locator('.task-row').count(), 8, '刷新后任务安排应保留');
  assert.ok(
    await page.locator('.task-row').first().evaluate((element) => element.classList.contains('completed')),
    '刷新后完成状态应保留',
  );

  await page.getByRole('button', { name: '退出登录' }).click();
  await page.locator('#auth-username').waitFor();
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: '登录并开始打卡' }).click();
  await page.locator('.task-row').first().waitFor();
  assert.equal(await page.locator('.task-row').count(), 8, '重新登录后记录应恢复');

  await page.locator('.day-number', { hasText: /^15$/ }).first().click();
  await page.waitForFunction(() => document.querySelector('.hero-date')?.textContent?.includes('10月15日'));
  await page.getByRole('button', { name: '安排任务', exact: true }).click();
  await page.locator('.task-select').nth(0).click();
  await page.locator('.task-select').nth(1).click();
  await page.getByRole('button', { name: /保存安排/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('.task-row').length === 2);
  await page.locator('.task-row').first().locator('.custom-check').click();
  await page.waitForFunction(() => document.querySelector('.task-count')?.textContent?.includes('1 / 2'));
  await page.getByRole('button', { name: '今天', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.task-row').length === 8);
  await page.locator('.day-number', { hasText: /^15$/ }).first().click();
  await page.waitForFunction(() => document.querySelectorAll('.task-row').length === 2);
  assert.ok(
    await page.locator('.task-row').first().evaluate((element) => element.classList.contains('completed')),
    '返回历史日期后应恢复当日完成状态',
  );
  await page.getByRole('button', { name: '今天', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.task-row').length === 8);
  await page.screenshot({ path: path.join(artifacts, 'checkin.png'), fullPage: true });

  await page.setViewportSize({ width: 360, height: 780 });
  await page.screenshot({ path: path.join(artifacts, 'checkin-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

  console.log(JSON.stringify({
    ok: true,
    checks: [
      '注册密码规则',
      '密码显隐图标',
      '默认任务',
      '任务打卡',
      '新增任务',
      '日历切换',
      '任务库安排',
      '任务库增删改',
      '刷新持久化',
      '重新登录恢复',
      '历史日期回看',
      '移动端布局',
    ],
    screenshots: [
      'artifacts/register.png',
      'artifacts/add-task-modal.png',
      'artifacts/arrange-modal.png',
      'artifacts/checkin.png',
      'artifacts/checkin-mobile.png',
    ],
  }, null, 2));
} finally {
  await browser.close();
}
