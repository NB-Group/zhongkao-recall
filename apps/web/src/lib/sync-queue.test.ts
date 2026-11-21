import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ReviewEvent } from '@zhongkao-recall/domain';
import { createBackendClient } from './backend';
import { clearOfflineDatabase } from './offline-db';
import { flushPendingEvents, getPendingEventCount, queueReviewEvent } from './sync-queue';

const event: ReviewEvent = {
  eventId: 'event-1',
  cardId: 'card-1',
  grade: 'good',
  reviewedAtClient: '2026-11-21T08:00:00.000Z',
  timeZone: 'Asia/Shanghai',
  contentVersion: '2026.11.21',
};

beforeEach(async () => {
  await clearOfflineDatabase();
});

describe('offline review queue', () => {
  it('stores a review event and removes it after successful sync', async () => {
    await queueReviewEvent(event);
    expect(await getPendingEventCount()).toBe(1);

    const received: string[] = [];
    const backend = createBackendClient({
      appendReviewEvent: async (nextEvent) => {
        received.push(nextEvent.eventId);
        return { eventId: nextEvent.eventId };
      },
    });

    await expect(flushPendingEvents(backend)).resolves.toEqual({ synced: 1, failed: 0 });
    expect(received).toEqual(['event-1']);
    expect(await getPendingEventCount()).toBe(0);
  });

  it('deduplicates an event queued twice', async () => {
    await queueReviewEvent(event);
    await queueReviewEvent(event);

    expect(await getPendingEventCount()).toBe(1);
  });
});
