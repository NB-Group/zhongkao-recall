import type { LearningState, ReviewEvent } from '@zhongkao-recall/domain';

export interface UserSettings {
  dailyNewWords: number;
  dailyReviewLimit: number;
  timeZone: string;
}

export interface BackendClient {
  getSession(): Promise<unknown>;
  getSettings(): Promise<UserSettings>;
  getLearningStates(): Promise<Record<string, LearningState>>;
  getPieceProgress(): Promise<Record<string, string>>;
  appendReviewEvent(event: ReviewEvent): Promise<{ eventId: string }>;
  setPieceProgress(pieceId: string, status: string): Promise<void>;
  updateSettings(settings: UserSettings): Promise<void>;
}

export type BackendClientOverrides = Partial<BackendClient> &
  Pick<BackendClient, 'appendReviewEvent'>;

const defaultSettings: UserSettings = {
  dailyNewWords: 5,
  dailyReviewLimit: 30,
  timeZone: 'Asia/Shanghai',
};

export function createBackendClient(overrides: BackendClientOverrides): BackendClient {
  return {
    getSession: async () => null,
    getSettings: async () => defaultSettings,
    getLearningStates: async () => ({}),
    getPieceProgress: async () => ({}),
    setPieceProgress: async () => undefined,
    updateSettings: async () => undefined,
    ...overrides,
  };
}
