import { describe, expect, it } from 'vitest';
import { formatAuthError } from './AuthPage';

describe('formatAuthError', () => {
  it('explains invalid production credentials in Chinese', () => {
    expect(formatAuthError(new Error('Invalid login credentials'))).toBe('用户名或密码不正确。首次使用请切换到“注册”。');
  });
});
