import { afterAll, beforeAll, expect, test } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';
import type { Msg } from '../src/lib/protocol';

const PORT = 8799;
process.env.PORT = String(PORT);
const URL = `ws://localhost:${PORT}`;

let wss: WebSocketServer;

beforeAll(async () => {
  const mod = await import('../server/signaling');
  wss = mod.wss;
  // 等待服务完成监听
  await new Promise((r) => setTimeout(r, 400));
});

afterAll(() => {
  wss?.close();
});

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function send(ws: WebSocket, m: Msg): void {
  ws.send(JSON.stringify(m));
}

function waitFor(ws: WebSocket, type: Msg['t']): Promise<Msg> {
  return new Promise((resolve) => {
    const handler = (raw: Buffer | string) => {
      const m = JSON.parse(raw.toString()) as Msg;
      if (m.t === type) {
        ws.off('message', handler);
        resolve(m);
      }
    };
    ws.on('message', handler);
  });
}

test('房主踢人：被踢者收到 kicked，房间其他人收到 peer-leave', async () => {
  const host = await connect();
  send(host, { t: 'join', room: 'KICKTEST', id: 'host', name: 'H', host: true });

  const member = await connect();
  send(member, { t: 'join', room: 'KICKTEST', id: 'mem', name: 'M', host: false });

  // 先挂好监听，再触发踢人
  const joinP = waitFor(host, 'peer-join');
  const kickedP = waitFor(member, 'kicked');
  const leaveP = waitFor(host, 'peer-leave');

  send(host, { t: 'kick', target: 'mem' });

  const kicked = await kickedP;
  expect(kicked.t).toBe('kicked');

  const join = await joinP;
  expect(join.t === 'peer-join' && join.id).toBe('mem');

  const leave = await leaveP;
  expect(leave.t === 'peer-leave' && leave.id).toBe('mem');

  host.close();
  member.close();
}, 10000);

test('成员加入已上锁房间：收到 locked', async () => {
  const host = await connect();
  send(host, { t: 'join', room: 'LOCKTEST', id: 'h', name: 'H', host: true });
  await waitFor(host, 'roster');
  send(host, { t: 'lock', locked: true });

  const member = await connect();
  const p = waitFor(member, 'locked');
  send(member, { t: 'join', room: 'LOCKTEST', id: 'm', name: 'M', host: false });
  const locked = await p;
  expect(locked.t).toBe('locked');
  host.close();
  member.close();
}, 10000);

test('成员加入不存在的房间：收到 room-not-found', async () => {
  const member = await connect();
  const p = waitFor(member, 'room-not-found');
  send(member, { t: 'join', room: 'NOROOM', id: 'm1', name: 'M1', host: false });
  const notFound = await p;
  expect(notFound.t).toBe('room-not-found');
  member.close();
}, 10000);

test('房主可创建并加入不存在的房间（不返回 room-not-found）', async () => {
  const host = await connect();
  const rosterP = waitFor(host, 'roster');
  send(host, { t: 'join', room: 'NEWROOM', id: 'h1', name: 'H1', host: true });
  const roster = await rosterP;
  expect(roster.t).toBe('roster');
  host.close();
}, 10000);

test('房主退出：最早加入的剩余成员收到 host-changed 并获得房主特权', async () => {
  const host = await connect();
  send(host, { t: 'join', room: 'HOSTXFER', id: 'h', name: 'H', host: true });
  await waitFor(host, 'roster');

  const mem1 = await connect(); // 先于 mem2 加入，应成为新房主
  send(mem1, { t: 'join', room: 'HOSTXFER', id: 'm1', name: 'M1', host: false });
  await waitFor(mem1, 'roster');

  const mem2 = await connect();
  send(mem2, { t: 'join', room: 'HOSTXFER', id: 'm2', name: 'M2', host: false });
  await waitFor(mem2, 'roster');

  const hostChangedP = waitFor(mem1, 'host-changed');
  const lockP = waitFor(mem2, 'lock'); // 新房主锁房会广播给其他人(mem2)

  host.close(); // 房主退出

  const hc = await hostChangedP;
  expect(hc.t).toBe('host-changed');
  if (hc.t === 'host-changed') expect(hc.hostId).toBe('m1'); // 按加入顺序，最早成员 m1 继承房主

  // m1 现在应拥有房主特权：发锁房，mem2 能收到 lock，说明服务端已认可 m1 为房主
  send(mem1, { t: 'lock', locked: true });
  const lock = await lockP;
  expect(lock.t).toBe('lock');

  mem1.close();
  mem2.close();
}, 10000);

