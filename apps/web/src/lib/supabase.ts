import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LearningState, ReviewEvent } from '@zhongkao-recall/domain';
import {
  createBackendClient,
  type BackendClient,
  type UserSettings,
} from './backend';

export interface ReviewEventRow {
  event_id: string;
  card_id: string;
  grade: ReviewEvent['grade'];
  reviewed_at_client: string;
  time_zone: string;
  content_version: string;
}

export function toAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@students.invalid`;
}

export function toReviewEventRow(event: ReviewEvent): ReviewEventRow {
  return {
    event_id: event.eventId,
    card_id: event.cardId,
    grade: event.grade,
    reviewed_at_client: event.reviewedAtClient,
    time_zone: event.timeZone,
    content_version: event.contentVersion,
  };
}

export function toReviewEventWrite(userId: string, event: ReviewEvent) {
  return {
    row: { user_id: userId, ...toReviewEventRow(event) },
    options: { onConflict: 'event_id', ignoreDuplicates: true as const },
  };
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('登录状态已失效，请重新登录');
  return data.user.id;
}

function toUserSettings(row: Record<string, unknown> | null): UserSettings {
  return {
    dailyNewWords: Number(row?.daily_new_words ?? 5),
    dailyReviewLimit: Number(row?.daily_review_limit ?? 30),
    timeZone: String(row?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
  };
}

function toLearningState(row: Record<string, unknown>): LearningState {
  return {
    cardId: String(row.card_id),
    status: row.status as LearningState['status'],
    dueAt: String(row.due_at),
    intervalDays: Number(row.interval_days),
    lapseCount: Number(row.lapse_count),
    lastGrade: row.last_grade as LearningState['lastGrade'],
    updatedAt: String(row.updated_at),
  };
}

export function createSupabaseBackend(url: string, anonKey: string): BackendClient {
  const client = createClient(url, anonKey);

  return createBackendClient({
    signIn: async (username, password) => {
      const { error } = await client.auth.signInWithPassword({ email: toAuthEmail(username), password });
      if (error) throw error;
    },
    signUp: async (inviteLink, username, password, nickname) => {
      const { error } = await client.functions.invoke('register-student', {
        body: { inviteLink, username, password, nickname: nickname || undefined },
      });
      if (error) throw error;
      const { error: signInError } = await client.auth.signInWithPassword({
        email: toAuthEmail(username),
        password,
      });
      if (signInError) throw signInError;
    },
    signOut: async () => {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    setCardMastery: async (cardId, mastered) => {
      const userId = await requireUserId(client);
      const { error } = await client.from('learning_states').upsert({
        user_id: userId,
        card_id: cardId,
        status: mastered ? 'mastered' : 'review',
        due_at: new Date().toISOString(),
        interval_days: mastered ? 0 : 1,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    getSession: async () => {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    getSettings: async () => {
      const userId = await requireUserId(client);
      const { data, error } = await client
        .from('user_settings')
        .select('daily_new_words, daily_review_limit, time_zone')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return toUserSettings(data);
    },
    getLearningStates: async () => {
      const userId = await requireUserId(client);
      const { data, error } = await client.from('learning_states').select('*').eq('user_id', userId);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.card_id, toLearningState(row)]));
    },
    getPieceProgress: async () => {
      const userId = await requireUserId(client);
      const { data, error } = await client
        .from('piece_progress')
        .select('piece_id, status')
        .eq('user_id', userId);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.piece_id, row.status]));
    },
    appendReviewEvent: async (event) => {
      const userId = await requireUserId(client);
      const { error } = await client
        .from('review_events')
        .upsert(toReviewEventWrite(userId, event).row, toReviewEventWrite(userId, event).options);
      if (error) throw error;
      return { eventId: event.eventId };
    },
    setPieceProgress: async (pieceId, status) => {
      const userId = await requireUserId(client);
      const { error } = await client.from('piece_progress').upsert({
        user_id: userId,
        piece_id: pieceId,
        status,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    setPieceProgressBatch: async (progress) => {
      const userId = await requireUserId(client);
      const { error } = await client.from('piece_progress').upsert(
        progress.map(({ pieceId, status }) => ({
          user_id: userId,
          piece_id: pieceId,
          status,
          updated_at: new Date().toISOString(),
        })),
      );
      if (error) throw error;
    },
    updateSettings: async (settings) => {
      const userId = await requireUserId(client);
      const { error } = await client.from('user_settings').upsert({
        user_id: userId,
        daily_new_words: settings.dailyNewWords,
        daily_review_limit: settings.dailyReviewLimit,
        time_zone: settings.timeZone,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
  });
}
