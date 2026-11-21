import { describe, expect, it } from 'vitest';
import { computeNextLearningState } from './scheduler';

const now = new Date('2026-11-21T08:00:00.000Z');

describe('computeNextLearningState', () => {
  it('starts a new card with a ten-minute learning step', () => {
    const state = computeNextLearningState({ cardId: 'card-1', now, grade: 'again' });

    expect(state.status).toBe('learning');
    expect(state.intervalDays).toBe(0);
    expect(state.dueAt).toBe('2026-11-21T08:10:00.000Z');
  });

  it('uses the learner timezone for calendar-day intervals', () => {
    const state = computeNextLearningState({
      cardId: 'card-1',
      now: new Date('2026-03-07T17:00:00.000Z'),
      grade: 'good',
      timeZone: 'America/New_York',
    });

    expect(state.dueAt).toBe('2026-03-08T16:00:00.000Z');
  });

  it('moves a new card through one day and three day steps', () => {
    const oneDay = computeNextLearningState({
      cardId: 'card-1',
      now,
      grade: 'good',
      current: {
        cardId: 'card-1',
        status: 'learning',
        dueAt: now.toISOString(),
        intervalDays: 0,
        lapseCount: 0,
        updatedAt: now.toISOString(),
      },
    });
    const threeDays = computeNextLearningState({
      cardId: 'card-1',
      now,
      grade: 'good',
      current: oneDay,
    });

    expect(oneDay.intervalDays).toBe(1);
    expect(threeDays.intervalDays).toBe(3);
    expect(threeDays.dueAt).toBe('2026-11-24T08:00:00.000Z');
  });

  it('applies review multipliers and resets a lapse', () => {
    const current = {
      cardId: 'card-1',
      status: 'review' as const,
      dueAt: now.toISOString(),
      intervalDays: 10,
      lapseCount: 0,
      updatedAt: now.toISOString(),
    };

    expect(computeNextLearningState({ cardId: 'card-1', now, grade: 'hard', current }).intervalDays).toBe(15);
    expect(computeNextLearningState({ cardId: 'card-1', now, grade: 'good', current }).intervalDays).toBe(23);
    expect(computeNextLearningState({ cardId: 'card-1', now, grade: 'easy', current }).intervalDays).toBe(35);
    expect(computeNextLearningState({ cardId: 'card-1', now, grade: 'again', current }).lapseCount).toBe(1);
  });
});
