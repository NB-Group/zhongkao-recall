import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Card } from '@zhongkao-recall/domain';
import { ReviewCard } from './ReviewCard';

const card: Card = {
  id: 'card-1',
  kind: 'sense-recall',
  context: '其两膝相比者，各隐卷底衣褶中。',
  prompt: '“当”在这句话中是什么意思？',
  answer: '应当，应该',
  estimatedSeconds: 20,
};

describe('ReviewCard', () => {
  it('hides the answer until reveal and exposes four ratings', () => {
    const onGrade = vi.fn();
    render(<ReviewCard card={card} onGrade={onGrade} />);

    expect(screen.queryByText('应当，应该')).toBeNull();
    expect(screen.getByText(/例句：其两膝相比者/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '显示答案' }));
    expect(screen.getByText('应当，应该')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '想起了' }));
    expect(onGrade).toHaveBeenCalledWith('good');
  });

  it('offers a manual mastery action after revealing the answer', () => {
    const onMastered = vi.fn();
    render(<ReviewCard card={card} onGrade={vi.fn()} onMastered={onMastered} />);
    fireEvent.click(screen.getByRole('button', { name: '显示答案' }));
    fireEvent.click(screen.getByRole('button', { name: '标记熟练' }));
    expect(onMastered).toHaveBeenCalledOnce();
  });
});
