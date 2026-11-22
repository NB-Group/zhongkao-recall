import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Piece } from '@zhongkao-recall/domain';
import { ContentPage, piecesThroughSelection } from './ContentPage';

const pieces: Piece[] = [
  { id: 'poem-1', kind: 'poem', title: '第一首', textbookLocation: '六上', sourceTags: [] },
  { id: 'poem-2', kind: 'poem', title: '第二首', textbookLocation: '六上', sourceTags: [] },
  { id: 'prose-1', kind: 'prose', title: '第一篇', textbookLocation: '六上', sourceTags: [] },
  { id: 'poem-3', kind: 'poem', title: '第三首', textbookLocation: '六下', sourceTags: [] },
];

afterEach(cleanup);

describe('piecesThroughSelection', () => {
  it('returns the selected piece and earlier pieces of the same kind', () => {
    expect(piecesThroughSelection(pieces, 'poem-3')).toEqual(['poem-1', 'poem-2', 'poem-3']);
  });
});

describe('ContentPage', () => {
  it('labels locked items as progress checkpoints', () => {
    render(<ContentPage pieces={pieces} progress={{}} onUnlock={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: '学到这里' })).toHaveLength(4);
  });

  it('passes the selected checkpoint to the parent', () => {
    const onUnlock = vi.fn();
    render(<ContentPage pieces={pieces} progress={{}} onUnlock={onUnlock} />);

    fireEvent.click(screen.getAllByRole('button', { name: '学到这里' })[0]);
    expect(onUnlock).toHaveBeenCalled();
  });
});
