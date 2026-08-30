import { describe, it, expect } from 'vitest';
import { generateRoomCode, normalizeRoomCode, isValidRoomCode, roomCodeChars } from '../src/lib/roomCode';

describe('roomCode', () => {
  it('generates 6 uppercase chars from the allowed set', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateRoomCode();
      expect(c).toHaveLength(6);
      expect([...c].every((ch) => roomCodeChars().includes(ch))).toBe(true);
    }
  });

  it('normalizeRoomCode uppercases and trims', () => {
    expect(normalizeRoomCode('  k7m2xq ')).toBe('K7M2XQ');
  });

  it('isValidRoomCode accepts valid codes case-insensitively', () => {
    expect(isValidRoomCode('K7M2XQ')).toBe(true);
    expect(isValidRoomCode('k7m2xq')).toBe(true);
  });

  it('isValidRoomCode rejects wrong length', () => {
    expect(isValidRoomCode('K7M2X')).toBe(false);
    expect(isValidRoomCode('K7M2XQ1')).toBe(false);
  });

  it('isValidRoomCode rejects ambiguous/excluded chars', () => {
    expect(isValidRoomCode('K7M2X0')).toBe(false); // 0 excluded
    expect(isValidRoomCode('K7M2XI')).toBe(false); // I excluded
    expect(isValidRoomCode('K7M2XO')).toBe(false); // O excluded
    expect(isValidRoomCode('K7M2XL')).toBe(false); // L excluded
    expect(isValidRoomCode('K7M2X1')).toBe(false); // 1 excluded
  });

  it('isValidRoomCode rejects non-alphanumerics', () => {
    expect(isValidRoomCode('K7M2X!')).toBe(false);
    expect(isValidRoomCode('!!!!!!')).toBe(false);
  });
});
