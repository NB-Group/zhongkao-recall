import type { Card, LearningState } from './types';

export type QueueKind = 'vocabulary' | 'prose';
export type QueueReason = 'overdue' | 'due' | 'new';

export interface QueueItem {
  card: Card;
  reason: QueueReason;
}

export interface QueueInput {
  now: Date;
  queueKind: QueueKind;
  cards: Card[];
  states: Record<string, LearningState | undefined>;
  dailyNewTarget: number;
  reviewLimit: number;
  timeBudgetMinutes?: number;
}

function belongsToQueue(card: Card, queueKind: QueueKind): boolean {
  if (queueKind === 'vocabulary') return card.kind === 'sense-recall';
  return card.kind !== 'sense-recall';
}

export function buildDailyQueue(input: QueueInput): QueueItem[] {
  const eligible = input.cards.filter((card) => belongsToQueue(card, input.queueKind));
  const due: QueueItem[] = [];
  const fresh: QueueItem[] = [];

  for (const card of eligible) {
    const state = input.states[card.id];
    if (!state || state.status === 'new') {
      fresh.push({ card, reason: 'new' });
      continue;
    }
    if (state.status === 'suspended' || state.status === 'mastered') continue;
    if (new Date(state.dueAt) <= input.now) {
      due.push({
        card,
        reason: new Date(state.dueAt) < input.now ? 'overdue' : 'due',
      });
    }
  }

  due.sort((left, right) => {
    const leftState = input.states[left.card.id];
    const rightState = input.states[right.card.id];
    return new Date(leftState?.dueAt ?? 0).getTime() - new Date(rightState?.dueAt ?? 0).getTime();
  });

  const selected = [
    ...due.slice(0, input.reviewLimit),
    ...fresh.slice(0, input.dailyNewTarget),
  ];
  if (input.timeBudgetMinutes === undefined) return selected;

  const budgetSeconds = input.timeBudgetMinutes * 60;
  let usedSeconds = 0;
  return selected.filter((item) => {
    if (usedSeconds + item.card.estimatedSeconds > budgetSeconds) return false;
    usedSeconds += item.card.estimatedSeconds;
    return true;
  });
}
