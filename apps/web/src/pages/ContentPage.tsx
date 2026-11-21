import React from 'react';
import type { Piece } from '@zhongkao-recall/domain';

interface ContentPageProps {
  pieces: Piece[];
  progress: Record<string, string>;
  onUnlock: (pieceId: string) => void;
}

export function ContentPage({ pieces, progress, onUnlock }: ContentPageProps) {
  return (
    <main className="content-page">
      <header className="page-heading">
        <p className="page-heading__eyebrow">内容</p>
        <h1>从现在学到哪里。</h1>
        <p>先解锁想学的篇目，句段才会进入诗文复习。</p>
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
                <button type="button" className="outline-button" onClick={() => onUnlock(piece.id)}>解锁</button>
              ) : (
                <span className={`status-pill status-pill--${status}`}>{status === 'mastered' ? '熟练' : status === 'learned' ? '已学' : '学习中'}</span>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
