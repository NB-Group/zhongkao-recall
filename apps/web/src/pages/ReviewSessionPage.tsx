import React, { useMemo, useState } from 'react';
import type { Card, LearningState, ReviewGrade } from '@zhongkao-recall/domain';
import { buildDailyQueue, computeNextLearningState, type QueueKind } from '@zhongkao-recall/domain';
import { ReviewCard } from '../components/ReviewCard';
import type { BackendClient } from '../lib/backend';
import { queueReviewEvent } from '../lib/sync-queue';

interface ReviewSessionPageProps {
  queueKind: QueueKind;
  cards: Card[];
  initialStates: Record<string, LearningState>;
  backend: BackendClient;
  onStateChange?: (states: Record<string, LearningState>) => void;
  onDone: () => void;
}

function newEventId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function ReviewSessionPage({ queueKind, cards, initialStates, backend, onStateChange, onDone }: ReviewSessionPageProps) {
  const [states, setStates] = useState(initialStates);
  const [index, setIndex] = useState(0);
  const now = new Date();
  const queue = useMemo(
    () =>
      buildDailyQueue({
        now,
        queueKind,
        cards,
        states,
        dailyNewTarget: 5,
        reviewLimit: 30,
      }),
    [cards, queueKind, states],
  );
  const item = queue[index];

  async function handleGrade(grade: ReviewGrade) {
    if (!item) return;
    const next = computeNextLearningState({ cardId: item.card.id, now: new Date(), grade, current: states[item.card.id] });
    setStates((current) => {
      const updated = { ...current, [item.card.id]: next };
      onStateChange?.(updated);
      return updated;
    });
    await queueReviewEvent({
      eventId: newEventId(),
      cardId: item.card.id,
      grade,
      reviewedAtClient: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      contentVersion: '2026.11.21',
    });
    setIndex((current) => current + 1);
  }

  if (!item) {
    return (
      <main className="session-done">
        <p className="page-heading__eyebrow">完成</p>
        <h1>这一组做完了。</h1>
        <p>新结果已经留在本地，网络恢复后会自动同步。</p>
        <button type="button" className="primary-button" onClick={onDone}>回到今天</button>
      </main>
    );
  }

  return (
    <main className="review-session">
      <div className="session-progress">
        <span>{index + 1} / {queue.length}</span>
        <span>{item.reason === 'new' ? '新学' : '复习'}</span>
      </div>
      <ReviewCard card={item.card} onGrade={(grade) => void handleGrade(grade)} />
    </main>
  );
}
