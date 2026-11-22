import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@zhongkao-recall/domain';
import { ReviewCard } from './ReviewCard';

const card: Card = {
  id: 'card-1',
  kind: 'sense-recall',
  context: '其两膝相比者，各隐卷底衣褶中。',
  prompt: '“比”在上面这句中的意思是？',
  answer: '靠近',
  options: ['靠近', '比较', '等到', '超过'],
  estimatedSeconds: 20,
};

describe('ReviewCard', () => {
  afterEach(() => cleanup());

  it('records a correct multiple-choice answer as remembered', () => {
    const onGrade = vi.fn();
    render(<ReviewCard card={card} onGrade={onGrade} />);

    expect(screen.getByText(/例句：其两膝相比者/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '靠近' }));
    expect(onGrade).toHaveBeenCalledWith('good');
  });

  it('shows the answer and self-rating after a wrong choice', () => {
    const onGrade = vi.fn();
    render(<ReviewCard card={card} onGrade={onGrade} />);

    fireEvent.click(screen.getByRole('button', { name: '比较' }));
    expect(screen.getByText('靠近')).toBeTruthy();
    expect(screen.getByRole('button', { name: '不会' })).toBeTruthy();
    expect(onGrade).not.toHaveBeenCalled();
  });

  it('starts the next card with its choices visible', () => {
    const onGrade = vi.fn();
    const nextCard: Card = {
      ...card,
      id: 'card-2',
      prompt: '“之”在上面这句中的意思是？',
      answer: '到达',
      options: ['到达', '靠近', '比较', '超过'],
    };
    const { rerender } = render(<ReviewCard card={card} onGrade={onGrade} />);

    fireEvent.click(screen.getByRole('button', { name: '比较' }));
    expect(screen.getByRole('button', { name: '不会' })).toBeTruthy();

    rerender(<ReviewCard card={nextCard} onGrade={onGrade} />);

    expect(screen.getByRole('button', { name: '到达' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '不会' })).toBeNull();
  });

  it('keeps the reveal flow for poem and prose cards', () => {
    const onGrade = vi.fn();
    const onMastered = vi.fn();
    const proseCard: Card = {
      id: 'piece-card-1',
      kind: 'segment-continuation',
      prompt: '移舟泊烟渚，',
      answer: '移舟泊烟渚，日暮客愁新。',
      estimatedSeconds: 25,
    };
    render(<ReviewCard card={proseCard} onGrade={onGrade} onMastered={onMastered} />);

    expect(screen.getByRole('button', { name: '显示答案' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '显示答案' }));
    expect(screen.getByText('移舟泊烟渚，日暮客愁新。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '标记熟练' }));
    expect(onMastered).toHaveBeenCalledOnce();
  });

  it('asks for a rating after a wrong choice instead of marking mastery', () => {
    const onMastered = vi.fn();
    render(<ReviewCard card={card} onGrade={vi.fn()} onMastered={onMastered} />);

    fireEvent.click(screen.getByRole('button', { name: '比较' }));

    expect(screen.getByRole('button', { name: '不会' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '标记熟练' })).toBeNull();
  });
});
