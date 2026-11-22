export type PieceKind = 'poem' | 'prose';

export type PieceStatus = 'locked' | 'learning' | 'learned' | 'mastered';

export type CardKind =
  | 'sense-recall'
  | 'context-cloze'
  | 'segment-continuation'
  | 'segment-cloze'
  | 'piece-check';

export type CardStatus = 'new' | 'learning' | 'review' | 'suspended' | 'mastered';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface ContentPack {
  packId: string;
  version: string;
  title: string;
  pieces: Piece[];
  segments: Segment[];
  senses: Sense[];
  cards: Card[];
}

export interface Piece {
  id: string;
  kind: PieceKind;
  title: string;
  author?: string;
  textbookLocation?: string;
  sourceTags: string[];
}

export interface Segment {
  id: string;
  pieceId: string;
  order: number;
  text: string;
}

export interface Sense {
  id: string;
  term: string;
  meaning: string;
  example: string;
  source?: string;
  tags: string[];
}

export interface Card {
  id: string;
  kind: CardKind;
  pieceId?: string;
  segmentId?: string;
  senseId?: string;
  prompt: string;
  context?: string;
  options?: string[];
  answer: string;
  estimatedSeconds: number;
}

export interface LearningState {
  cardId: string;
  status: CardStatus;
  dueAt: string;
  intervalDays: number;
  lapseCount: number;
  lastGrade?: ReviewGrade;
  updatedAt: string;
}

export interface ReviewEvent {
  eventId: string;
  cardId: string;
  grade: ReviewGrade;
  reviewedAtClient: string;
  timeZone: string;
  contentVersion: string;
}
