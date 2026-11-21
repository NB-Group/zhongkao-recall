import { describe, expect, it } from 'vitest';
import { buildDailyQueue } from './queue';

const now = new Date('2026-11-21T08:00:00.000Z');

describe('buildDailyQueue', () => {
  it('prioritizes overdue cards and adds the configured number of new cards', () => {
    const queue = buildDailyQueue({
      now,
      queueKind: 'vocabulary',
      cards: [
        { id: 'old', kind: 'sense-recall', prompt: 'old', answer: 'old', estimatedSeconds: 20 },
        { id: 'new-1', kind: 'sense-recall', prompt: 'new', answer: 'new', estimatedSeconds: 20 },
        { id: 'new-2', kind: 'sense-recall', prompt: 'new', answer: 'new', estimatedSeconds: 20 },
      ],
      states: {
        old: {
          cardId: 'old',
          status: 'review',
          dueAt: '2026-11-20T08:00:00.000Z',
          intervalDays: 3,
          lapseCount: 0,
          updatedAt: now.toISOString(),
        },
      },
      dailyNewTarget: 1,
      reviewLimit: 30,
    });

    expect(queue.map((item) => item.card.id)).toEqual(['old', 'new-1']);
    expect(queue[0].reason).toBe('overdue');
    expect(queue[1].reason).toBe('new');
  });

  it('caps due reviews and supports a ten-minute slice', () => {
    const cards = Array.from({ length: 4 }, (_, index) => ({
      id: `card-${index}`,
      kind: 'sense-recall' as const,
      prompt: 'prompt',
      answer: 'answer',
      estimatedSeconds: 40,
    }));
    const states = Object.fromEntries(
      cards.map((card) => [
        card.id,
        {
          cardId: card.id,
          status: 'review' as const,
          dueAt: '2026-11-21T07:00:00.000Z',
          intervalDays: 1,
          lapseCount: 0,
          updatedAt: now.toISOString(),
        },
      ]),
    );

    const queue = buildDailyQueue({
      now,
      queueKind: 'vocabulary',
      cards,
      states,
      dailyNewTarget: 0,
      reviewLimit: 2,
      timeBudgetMinutes: 1,
    });

    expect(queue).toHaveLength(1);
    expect(queue[0].card.id).toBe('card-0');
  });
});
