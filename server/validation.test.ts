import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDateKey,
  isMonthKey,
  passwordError,
  taskNameError,
  usernameError,
} from '../shared/validation.js';

test('密码必须至少 8 位并同时包含字母和数字', () => {
  assert.equal(passwordError('abc12345'), null);
  assert.equal(passwordError('Abc12345!'), null);
  assert.ok(passwordError('abcdefgh'));
  assert.ok(passwordError('12345678'));
  assert.ok(passwordError('ab12'));
});

test('用户名支持中文、字母、数字和下划线', () => {
  assert.equal(usernameError('小残'), null);
  assert.equal(usernameError('user_2026'), null);
  assert.ok(usernameError('a'));
  assert.ok(usernameError('含空格 用户'));
});

test('任务名称和日期格式校验', () => {
  assert.equal(taskNameError('阅读 20 分钟'), null);
  assert.ok(taskNameError('   '));
  assert.equal(isDateKey('2026-10-29'), true);
  assert.equal(isDateKey('2026-02-30'), false);
  assert.equal(isMonthKey('2026-10'), true);
  assert.equal(isMonthKey('2026-13'), false);
});
