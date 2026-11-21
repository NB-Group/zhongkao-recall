import React, { useState } from 'react';
import type { Card, ReviewGrade } from '@zhongkao-recall/domain';

interface ReviewCardProps {
  card: Card;
  onGrade: (grade: ReviewGrade) => void;
}

const grades: Array<{ grade: ReviewGrade; label: string }> = [
  { grade: 'again', label: '不会' },
  { grade: 'hard', label: '模糊' },
  { grade: 'good', label: '想起了' },
  { grade: 'easy', label: '很熟' },
];

export function ReviewCard({ card, onGrade }: ReviewCardProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <article className="review-card" aria-label="复习卡片">
      <p className="review-card__kind">{card.kind === 'sense-recall' ? '实词义项' : '诗文句段'}</p>
      <p className="review-card__prompt">{card.prompt}</p>
      {revealed ? (
        <div className="review-card__answer" aria-live="polite">
          <p>{card.answer}</p>
          <p className="review-card__note">系统记录背诵自评，字形尚未检验。</p>
          <div className="review-card__ratings" aria-label="复习结果">
            {grades.map(({ grade, label }) => (
              <button key={grade} type="button" onClick={() => onGrade(grade)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" className="review-card__reveal" onClick={() => setRevealed(true)}>
          显示答案
        </button>
      )}
    </article>
  );
}
