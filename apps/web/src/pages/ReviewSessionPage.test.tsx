import { describe, expect, it } from 'vitest';
import type { Card } from '@zhongkao-recall/domain';
import { selectSessionCards } from './ReviewSessionPage';

const cards: Card[] = [
  { id: 'vocab', kind: 'sense-recall', senseId: 'sense-1', prompt: '词义', answer: '释义', estimatedSeconds: 20 },
  { id: 'open-piece', kind: 'segment-continuation', pieceId: 'piece-open', prompt: '句子', answer: '答案', estimatedSeconds: 20 },
  { id: 'locked-piece', kind: 'segment-continuation', pieceId: 'piece-locked', prompt: '句子', answer: '答案', estimatedSeconds: 20 },
];

describe('selectSessionCards', () => {
  it('only includes unlocked prose pieces in the prose session', () => {
    expect(selectSessionCards(cards, 'prose', ['piece-open']).map((card) => card.id)).toEqual(['open-piece']);
  });
});
