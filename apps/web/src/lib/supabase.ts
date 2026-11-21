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
    signIn: async (email, password) => {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signUp: async (email, password, nickname) => {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        const { error: profileError } = await client.from('profiles').upsert({
          id: data.user.id,
          nickname: nickname || null,
        });
        if (profileError) throw profileError;
        const { error: settingsError } = await client.from('user_settings').upsert({
          user_id: data.user.id,
        });
        if (settingsError) throw settingsError;
      }
    },
    signOut: async () => {
      const { error } = await client.auth.signOut();
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
      const { data, error } = await client
        .from('review_events')
        .insert({ user_id: userId, ...toReviewEventRow(event) })
        .select('event_id')
        .single();
      if (error) throw error;
      return { eventId: data.event_id };
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
