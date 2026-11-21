import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ReviewEvent } from '@zhongkao-recall/domain';

interface OfflineSchema extends DBSchema {
  'pending-events': {
    key: string;
    value: ReviewEvent;
  };
}

const DATABASE_NAME = 'zhongkao-recall-offline';
const DATABASE_VERSION = 1;

let databasePromise: ReturnType<typeof openDB<OfflineSchema>> | undefined;
let activeDatabase: IDBPDatabase<OfflineSchema> | undefined;

export function getOfflineDatabase() {
  databasePromise ??= openDB<OfflineSchema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('pending-events')) {
        database.createObjectStore('pending-events');
      }
    },
  }).then((database) => {
    activeDatabase = database;
    return database;
  });
  return databasePromise;
}

export async function clearOfflineDatabase(): Promise<void> {
  activeDatabase?.close();
  activeDatabase = undefined;
  databasePromise = undefined;
  await deleteDB(DATABASE_NAME);
}
