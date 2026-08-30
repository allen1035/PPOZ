// 房间号：6 位大写字母 + 数字，去除易混淆字符 I L O 0 1
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let s = '';
  const rnd = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint32Array(6))
    : Array.from({ length: 6 }, () => Math.floor(Math.random() * CHARS.length));
  for (let i = 0; i < 6; i++) s += CHARS[rnd[i] % CHARS.length];
  return s;
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidRoomCode(input: string): boolean {
  const n = normalizeRoomCode(input);
  return /^[A-Z0-9]{6}$/.test(n) && [...n].every((c) => CHARS.includes(c));
}

export function roomCodeChars(): string {
  return CHARS;
}
