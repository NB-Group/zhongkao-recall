import React from 'react';
import type { Piece } from '@zhongkao-recall/domain';

interface ContentPageProps {
  pieces: Piece[];
  progress: Record<string, string>;
  onUnlock: (pieceId: string) => void;
  onSetStatus?: (pieceId: string, status: string) => void;
}

export function piecesThroughSelection(pieces: Piece[], selectedId: string): string[] {
  const selectedIndex = pieces.findIndex((piece) => piece.id === selectedId);
  if (selectedIndex < 0) return [];
  const selected = pieces[selectedIndex];
  return pieces
    .slice(0, selectedIndex + 1)
    .filter((piece) => piece.kind === selected.kind)
    .map((piece) => piece.id);
}

export function ContentPage({ pieces, progress, onUnlock, onSetStatus }: ContentPageProps) {
  return (
    <main className="content-page">
      <header className="page-heading">
        <p className="page-heading__eyebrow">内容</p>
        <h1>从现在学到哪里。</h1>
        <p>选择“学到这里”，同类篇目中之前的内容会一起进入诗文复习。</p>
      </header>
      <div className="piece-list">
        {pieces.map((piece) => {
          const status = progress[piece.id] ?? 'locked';
          return (
            <article className="piece-row" key={piece.id}>
              <div>
                <p className="piece-row__type">{piece.kind === 'poem' ? '古诗词' : '文言文'} · {piece.textbookLocation}</p>
                <h2>{piece.title}</h2>
                {piece.author && <p>{piece.author}</p>}
              </div>
              {status === 'locked' ? (
                <button type="button" className="outline-button" onClick={() => onUnlock(piece.id)}>学到这里</button>
              ) : (
                <div className="piece-row__actions">
                  <span className={`status-pill status-pill--${status}`}>{status === 'mastered' ? '熟练' : status === 'learned' ? '已学' : '学习中'}</span>
                  {onSetStatus && <button type="button" className="text-button" onClick={() => onSetStatus(piece.id, status === 'mastered' ? 'learning' : 'mastered')}>
                    {status === 'mastered' ? '恢复学习' : '标记熟练'}
                  </button>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
