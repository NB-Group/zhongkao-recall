import React from 'react';

export interface TodaySummary {
  newWords: number;
  reviews: number;
  proseReviews: number;
  estimatedMinutes: number;
}

interface TodayPageProps {
  summary: TodaySummary;
  onStartVocabulary: () => void;
  onStartProse: () => void;
}

export function TodayPage({ summary, onStartVocabulary, onStartProse }: TodayPageProps) {
  return (
    <main className="today-page">
      <header className="page-heading">
        <p className="page-heading__eyebrow">今天</p>
        <h1>把今天这一小段做完。</h1>
        <p>预计用时 {summary.estimatedMinutes} 分钟</p>
      </header>

      <section className="today-summary" aria-label="今日任务摘要">
        <div>
          <strong>{summary.newWords}</strong>
          <span>新学实词</span>
        </div>
        <div>
          <strong>{summary.reviews}</strong>
          <span>到期复习</span>
        </div>
        <div>
          <strong>{summary.proseReviews}</strong>
          <span>诗文巩固</span>
        </div>
      </section>

      <section className="today-actions" aria-label="开始任务">
        <button
          type="button"
          aria-label="开始新学实词"
          className="task-button task-button--primary"
          onClick={onStartVocabulary}
        >
          <span>新学实词</span>
          <small>{summary.newWords} 个新义项，加上到期复习</small>
        </button>
        <button type="button" aria-label="开始诗文复习" className="task-button" onClick={onStartProse}>
          <span>诗文复习</span>
          <small>{summary.proseReviews} 个已解锁句段</small>
        </button>
      </section>
    </main>
  );
}
