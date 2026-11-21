import { describe, expect, it } from 'vitest';
import { getLocalDayKey } from './time';

describe('getLocalDayKey', () => {
  it('uses the requested timezone instead of the runtime timezone', () => {
    expect(getLocalDayKey(new Date('2026-11-21T23:30:00.000Z'), 'Asia/Shanghai')).toBe(
      '2026-11-22',
    );
  });
});
