import React, { useMemo, useState } from 'react';
import type { Card, LearningState, ReviewGrade } from '@zhongkao-recall/domain';
import { buildDailyQueue, computeNextLearningState, type QueueKind } from '@zhongkao-recall/domain';
import { ReviewCard } from '../components/ReviewCard';
import type { BackendClient } from '../lib/backend';
import { queueReviewEvent } from '../lib/sync-queue';

interface ReviewSessionPageProps {
  queueKind: QueueKind;
  cards: Card[];
  activePieceIds?: string[];
  initialStates: Record<string, LearningState>;
  dailyNewTarget: number;
  reviewLimit: number;
  timeZone: string;
  backend: BackendClient;
  onStateChange?: (states: Record<string, LearningState>) => void;
  onDone: () => void;
}

export function selectSessionCards(cards: Card[], queueKind: QueueKind, activePieceIds: string[] = []): Card[] {
  if (queueKind === 'vocabulary') return cards.filter((card) => card.kind === 'sense-recall');
  const active = new Set(activePieceIds);
  return cards.filter((card) => card.kind !== 'sense-recall' && card.pieceId !== undefined && active.has(card.pieceId));
}

function newEventId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function ReviewSessionPage({ queueKind, cards, activePieceIds = [], initialStates, dailyNewTarget, reviewLimit, timeZone, backend, onStateChange, onDone }: ReviewSessionPageProps) {
  const [states, setStates] = useState(initialStates);
  const sessionCards = useMemo(
    () => selectSessionCards(cards, queueKind, activePieceIds),
    [activePieceIds, cards, queueKind],
  );
  const [queue, setQueue] = useState(() => buildDailyQueue({
    now: new Date(),
    queueKind,
    cards: sessionCards,
    states: initialStates,
    dailyNewTarget,
    reviewLimit,
  }));
  const [completedCount, setCompletedCount] = useState(0);
  const index = 0;
  const item = queue[index];

  async function handleGrade(grade: ReviewGrade) {
    if (!item) return;
    const next = computeNextLearningState({ cardId: item.card.id, now: new Date(), grade, timeZone, current: states[item.card.id] });
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
    setQueue((current) => current.filter((queueItem) => queueItem.card.id !== item.card.id));
    setCompletedCount((current) => current + 1);
  }

  async function handleMastered() {
    if (!item) return;
    const now = new Date().toISOString();
    const next: LearningState = {
      cardId: item.card.id,
      status: 'mastered',
      dueAt: now,
      intervalDays: states[item.card.id]?.intervalDays ?? 0,
      lapseCount: states[item.card.id]?.lapseCount ?? 0,
      updatedAt: now,
    };
    setStates((current) => {
      const updated = { ...current, [item.card.id]: next };
      onStateChange?.(updated);
      return updated;
    });
    await backend.setCardMastery(item.card.id, true);
    setQueue((current) => current.filter((queueItem) => queueItem.card.id !== item.card.id));
    setCompletedCount((current) => current + 1);
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
        <span>{completedCount + 1} / {completedCount + queue.length}</span>
        <span>{item.reason === 'new' ? '新学' : '复习'}</span>
      </div>
      <ReviewCard card={item.card} onGrade={(grade) => void handleGrade(grade)} onMastered={() => void handleMastered()} />
    </main>
  );
}
