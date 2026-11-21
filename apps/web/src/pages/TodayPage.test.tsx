import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TodayPage } from './TodayPage';

describe('TodayPage', () => {
  it('keeps vocabulary and prose tasks as separate entries', () => {
    const onStartVocabulary = vi.fn();
    const onStartProse = vi.fn();
    render(
      <TodayPage
        summary={{ newWords: 5, reviews: 12, proseReviews: 4, estimatedMinutes: 18 }}
        onStartVocabulary={onStartVocabulary}
        onStartProse={onStartProse}
      />,
    );

    expect(screen.getByRole('button', { name: '开始新学实词' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '开始诗文复习' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '开始新学实词' }));
    fireEvent.click(screen.getByRole('button', { name: '开始诗文复习' }));
    expect(onStartVocabulary).toHaveBeenCalledOnce();
    expect(onStartProse).toHaveBeenCalledOnce();
  });
});
