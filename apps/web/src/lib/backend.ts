import type { LearningState, ReviewEvent } from '@zhongkao-recall/domain';

export interface UserSettings {
  dailyNewWords: number;
  dailyReviewLimit: number;
  timeZone: string;
}

export interface BackendClient {
  signIn(username: string, password: string): Promise<void>;
  signUp(inviteLink: string, username: string, password: string, nickname?: string): Promise<void>;
  signOut(): Promise<void>;
  setCardMastery(cardId: string, mastered: boolean): Promise<void>;
  getSession(): Promise<unknown>;
  getSettings(): Promise<UserSettings>;
  getLearningStates(): Promise<Record<string, LearningState>>;
  getPieceProgress(): Promise<Record<string, string>>;
  appendReviewEvent(event: ReviewEvent): Promise<{ eventId: string }>;
  setPieceProgress(pieceId: string, status: string): Promise<void>;
  setPieceProgressBatch?(progress: Array<{ pieceId: string; status: string }>): Promise<void>;
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
  let localSession = false;
  return {
    signIn: async (username, password) => {
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username) || password.length < 8) {
        throw new Error('用户名或密码格式不正确');
      }
      localSession = true;
    },
    signUp: async (inviteLink, username, password) => {
      if (!/^https:\/\/mp\.weixin\.qq\.com\/s\/[A-Za-z0-9_-]+$/.test(inviteLink.trim()) || !/^[A-Za-z0-9_]{3,24}$/.test(username) || password.length < 8) {
        throw new Error('注册信息不正确，请检查邀请码、用户名和密码');
      }
      localSession = true;
    },
    signOut: async () => undefined,
    setCardMastery: async () => undefined,
    getSession: async () => (localSession ? { demo: true } : null),
    getSettings: async () => defaultSettings,
    getLearningStates: async () => ({}),
    getPieceProgress: async () => ({}),
    setPieceProgress: async () => undefined,
    updateSettings: async () => undefined,
    ...overrides,
  };
}
