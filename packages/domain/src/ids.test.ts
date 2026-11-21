import { describe, expect, it } from 'vitest';
import { makeCardId, makePieceId } from './ids';

describe('content identifiers', () => {
  it('keeps identical piece inputs stable', () => {
    expect(makePieceId('zhongkao-2024', '八下桃花源记')).toBe(
      makePieceId('zhongkao-2024', '八下桃花源记'),
    );
  });

  it('keeps different card keys distinct', () => {
    expect(makeCardId('zhongkao-2024', '桃花源记:segment:1')).not.toBe(
      makeCardId('zhongkao-2024', '桃花源记:segment:2'),
    );
  });
});
