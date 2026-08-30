import { describe, it, expect } from 'vitest';
import { ROOM_MAX } from '../src/lib/protocol';

describe('protocol', () => {
  it('ROOM_MAX is 6', () => {
    expect(ROOM_MAX).toBe(6);
  });

  it('message shapes survive JSON round-trip', () => {
    const msgs = [
      { t: 'join', room: 'ABC123', id: 'a1', name: 'x', host: true },
      { t: 'offer', to: 'b', from: 'a', sdp: { type: 'offer', sdp: 'x' } },
      { t: 'ice', to: 'b', from: 'a', cand: { candidate: 'c' } },
      { t: 'state', id: 'a', mute: true },
      { t: 'lock', locked: true },
      { t: 'kick', target: 'a' },
      { t: 'room-full' },
      { t: 'ping', ts: 123 },
    ] as const;
    for (const m of msgs) {
      const back = JSON.parse(JSON.stringify(m));
      expect(back.t).toBe(m.t);
    }
  });
});
