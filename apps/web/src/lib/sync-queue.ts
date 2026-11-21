import type { ReviewEvent } from '@zhongkao-recall/domain';
import type { BackendClient } from './backend';
import { getOfflineDatabase } from './offline-db';

export interface SyncResult {
  synced: number;
  failed: number;
}

export async function queueReviewEvent(event: ReviewEvent): Promise<void> {
  const database = await getOfflineDatabase();
  await database.put('pending-events', event, event.eventId);
}

export async function getPendingEventCount(): Promise<number> {
  const database = await getOfflineDatabase();
  return database.count('pending-events');
}

export async function flushPendingEvents(backend: BackendClient): Promise<SyncResult> {
  const database = await getOfflineDatabase();
  const events = await database.getAll('pending-events');
  let synced = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await backend.appendReviewEvent(event);
      await database.delete('pending-events', event.eventId);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { synced, failed };
}
