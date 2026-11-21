import { describe, expect, it } from 'vitest';
import { addCalendarDays, getLocalDayKey } from './time';

describe('getLocalDayKey', () => {
  it('uses the requested timezone instead of the runtime timezone', () => {
    expect(getLocalDayKey(new Date('2026-11-21T23:30:00.000Z'), 'Asia/Shanghai')).toBe(
      '2026-11-22',
    );
  });

  it('adds a local calendar day across daylight-saving changes', () => {
    expect(addCalendarDays(new Date('2026-03-07T17:00:00.000Z'), 1, 'America/New_York').toISOString()).toBe(
      '2026-03-08T16:00:00.000Z',
    );
  });
});
