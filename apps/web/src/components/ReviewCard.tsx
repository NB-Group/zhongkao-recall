import React, { useEffect, useState } from 'react';
import type { Card, ReviewGrade } from '@zhongkao-recall/domain';

interface ReviewCardProps {
  card: Card;
  onGrade: (grade: ReviewGrade) => void;
  onMastered?: () => void;
}

const grades: Array<{ grade: ReviewGrade; label: string }> = [
  { grade: 'again', label: '没学' },
  { grade: 'again', label: '忘了' },
  { grade: 'again', label: '不会' },
  { grade: 'hard', label: '模糊' },
  { grade: 'good', label: '想起了' },
  { grade: 'easy', label: '很熟' },
];

export function ReviewCard({ card, onGrade, onMastered }: ReviewCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [wrongChoice, setWrongChoice] = useState<string>();

  useEffect(() => {
    setRevealed(false);
    setWrongChoice(undefined);
  }, [card.id]);

  function chooseOption(option: string) {
    if (option === card.answer) {
      onGrade('good');
      return;
    }
    setWrongChoice(option);
    setRevealed(true);
  }

  return (
    <article className="review-card" aria-label="复习卡片">
      <p className="review-card__kind">{card.kind === 'sense-recall' ? '实词义项' : '诗文句段'}</p>
      {card.context && <p className="review-card__context">例句：{card.context}</p>}
      <p className="review-card__prompt">{card.prompt}</p>
      {card.options && !revealed ? (
        <div className="review-card__options" aria-label="选择释义">
          {card.options.map((option) => (
            <button key={option} type="button" onClick={() => chooseOption(option)}>
              {option}
            </button>
          ))}
        </div>
      ) : revealed ? (
        <div className="review-card__answer" aria-live="polite">
          {wrongChoice && <p className="review-card__wrong">你选了：{wrongChoice}</p>}
          <p>{card.answer}</p>
          <p className="review-card__note">系统记录背诵自评，字形尚未检验。</p>
          {onMastered && !wrongChoice && <button type="button" className="text-button" onClick={onMastered}>标记熟练</button>}
          <div className="review-card__ratings" aria-label="复习结果">
            {grades.map(({ grade, label }) => (
              <button key={`${grade}-${label}`} type="button" onClick={() => onGrade(grade)}>
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
