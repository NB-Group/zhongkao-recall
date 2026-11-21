import { describe, expect, it, vi } from 'vitest';
import { createBackendClient } from './backend';
import { toAuthEmail, toReviewEventRow, toReviewEventWrite } from './supabase';

describe('BackendClient', () => {
  it('accepts a valid student invite link in the local backend', async () => {
    const client = createBackendClient({
      appendReviewEvent: async (event) => ({ eventId: event.eventId }),
    });

    await client.signUp('https://mp.weixin.qq.com/s/exampleInvite', 'xiaoming', 'password123');
    await expect(client.getSession()).resolves.toEqual({ demo: true });
  });

  it('rejects invalid local registration input', async () => {
    const client = createBackendClient({
      appendReviewEvent: async (event) => ({ eventId: event.eventId }),
    });

    await expect(client.signUp('https://example.com', 'x', 'short')).rejects.toThrow('注册信息');
  });

  it('forwards sign-in through the backend boundary', async () => {
    const signIn = vi.fn(async () => undefined);
    const client = createBackendClient({
      signIn,
      appendReviewEvent: async (event) => ({ eventId: event.eventId }),
    });

    await client.signIn('xiaoming', 'password');
    expect(signIn).toHaveBeenCalledWith('xiaoming', 'password');
  });

  it('forwards manual card mastery through the backend boundary', async () => {
    const setCardMastery = vi.fn(async () => undefined);
    const client = createBackendClient({
      setCardMastery,
      appendReviewEvent: async (event) => ({ eventId: event.eventId }),
    });

    await client.setCardMastery('card-1', true);
    expect(setCardMastery).toHaveBeenCalledWith('card-1', true);
  });

  it('forwards review events through the backend boundary', async () => {
    const client = createBackendClient({
      appendReviewEvent: async (event) => ({ eventId: event.eventId }),
    });

    await expect(
      client.appendReviewEvent({
        eventId: 'event-1',
        cardId: 'card-1',
        grade: 'good',
        reviewedAtClient: '2026-11-21T08:00:00.000Z',
        timeZone: 'Asia/Shanghai',
        contentVersion: '2026.11.21',
      }),
    ).resolves.toEqual({ eventId: 'event-1' });
  });
});

describe('Supabase row mapping', () => {
  it('derives an internal auth email from a normalized username', () => {
    expect(toAuthEmail('  Xiao_Ming ')).toBe('xiao_ming@students.invalid');
  });
  it('maps review events to the database naming convention', () => {
    expect(
      toReviewEventRow({
        eventId: 'event-1',
        cardId: 'card-1',
        grade: 'good',
        reviewedAtClient: '2026-11-21T08:00:00.000Z',
        timeZone: 'Asia/Shanghai',
        contentVersion: '2026.11.21',
      }),
    ).toEqual({
      event_id: 'event-1',
      card_id: 'card-1',
      grade: 'good',
      reviewed_at_client: '2026-11-21T08:00:00.000Z',
      time_zone: 'Asia/Shanghai',
      content_version: '2026.11.21',
    });
  });

  it('uses an idempotent event write', () => {
    expect(toReviewEventWrite('user-1', {
      eventId: 'event-1',
      cardId: 'card-1',
      grade: 'good',
      reviewedAtClient: '2026-11-21T08:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      contentVersion: '2026.11.21',
    })).toEqual({
      row: {
        user_id: 'user-1',
        event_id: 'event-1',
        card_id: 'card-1',
        grade: 'good',
        reviewed_at_client: '2026-11-21T08:00:00.000Z',
        time_zone: 'Asia/Shanghai',
        content_version: '2026.11.21',
      },
      options: { onConflict: 'event_id', ignoreDuplicates: true },
    });
  });
});
