import { describe, expect, it, vi } from 'vitest';
import { createBackendClient } from './backend';
import { toReviewEventRow, toReviewEventWrite } from './supabase';

describe('BackendClient', () => {
  it('forwards sign-in through the backend boundary', async () => {
    const signIn = vi.fn(async () => undefined);
    const client = createBackendClient({
      signIn,
      appendReviewEvent: async (event) => ({ eventId: event.eventId }),
    });

    await client.signIn('student@example.com', 'password');
    expect(signIn).toHaveBeenCalledWith('student@example.com', 'password');
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
