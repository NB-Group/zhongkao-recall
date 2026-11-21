import type { LearningState, ReviewGrade } from './types';
import { addDays, addMinutes } from './time';

export interface ReviewInput {
  cardId: string;
  now: Date;
  grade: ReviewGrade;
  current?: LearningState;
}

function dueAtFor(now: Date, intervalDays: number): string {
  return (intervalDays === 0 ? addMinutes(now, 10) : addDays(now, intervalDays)).toISOString();
}

function roundInterval(days: number, minimum: number): number {
  return Math.max(minimum, Math.round(days));
}

function nextLearningInterval(currentInterval: number, grade: ReviewGrade): number {
  if (grade === 'again') return 0;
  if (grade === 'easy') return Math.max(3, Math.round(Math.max(1, currentInterval) * 3.5));
  if (grade === 'hard') return currentInterval === 0 ? 0 : currentInterval;
  if (currentInterval === 0) return 1;
  if (currentInterval === 1) return 3;
  return 7;
}

export function computeNextLearningState(input: ReviewInput): LearningState {
  const current = input.current;
  const currentInterval = current?.intervalDays ?? 0;
  const isReview = current?.status === 'review' || current?.status === 'mastered';
  let intervalDays: number;
  let status: LearningState['status'];

  if (isReview) {
    if (input.grade === 'again') {
      intervalDays = 0;
      status = 'learning';
    } else if (input.grade === 'hard') {
      intervalDays = roundInterval(currentInterval * 1.5, 1);
      status = 'review';
    } else if (input.grade === 'good') {
      intervalDays = roundInterval(currentInterval * 2.3, 1);
      status = 'review';
    } else {
      intervalDays = roundInterval(currentInterval * 3.5, 3);
      status = 'review';
    }
  } else {
    intervalDays = nextLearningInterval(currentInterval, input.grade);
    status = intervalDays >= 7 ? 'review' : 'learning';
  }

  return {
    cardId: input.cardId,
    status,
    intervalDays,
    dueAt: dueAtFor(input.now, intervalDays),
    lapseCount: (current?.lapseCount ?? 0) + (input.grade === 'again' && current ? 1 : 0),
    lastGrade: input.grade,
    updatedAt: input.now.toISOString(),
  };
}
