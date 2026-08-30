// PPOZ 信令服务（最小实现，零成本）
// 仅做房间路由与消息转发，不触碰音频。生产环境可整体平移为 NestJS WebSocket 网关。
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Msg, Member } from '../src/lib/protocol';
import { ROOM_MAX } from '../src/lib/protocol';

const PORT = Number(process.env.PORT) || 8787;

type Client = { ws: WebSocket; id: string; name: string; host: boolean; mute: boolean };
type Room = { members: Map<string, Client>; locked: boolean };

const rooms = new Map<string, Room>();

function getRoom(room: string): Room {
  let r = rooms.get(room);
  if (!r) {
    r = { members: new Map(), locked: false };
    rooms.set(room, r);
  }
  return r;
}

function send(ws: WebSocket, m: Msg): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
}

function broadcast(room: string, m: Msg, exceptId?: string): void {
  const r = rooms.get(room);
  if (!r) return;
  for (const c of r.members.values()) if (c.id !== exceptId) send(c.ws, m);
}

// 用显式 http server 承载：普通请求做健康检查（部署平台用它判断存活），
// WebSocket 升级由下方的 WebSocketServer 处理。绑定 0.0.0.0 以便容器/平台外部可达。
const server = http.createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (path === '/') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('PPOZ signaling ok');
  } else {
    res.writeHead(404);
    res.end();
  }
});

export const wss = new WebSocketServer({ server });

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[ppoz] 端口 ${PORT} 已被占用（可能已有另一个 PPOZ 信令服务在运行）。\n` +
        `        请先关闭占用该端口的进程，或换个端口：PORT=9000 npm run server`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[ppoz] signaling server listening on ws://0.0.0.0:${PORT}`);
});

wss.on('connection', (ws: WebSocket) => {
  let room = '';
  let myId = '';

  ws.on('message', (raw) => {
    let m: Msg;
    try {
      m = JSON.parse(raw.toString()) as Msg;
    } catch {
      return;
    }

    switch (m.t) {
      case 'join': {
        room = m.room;
        myId = m.id;
        const r = rooms.get(room);
        if (!r) {
          // 房间不存在：只有房主可以「创建」，成员输入错误口令应得到明确提示
          if (!m.host) {
            send(ws, { t: 'room-not-found' });
            ws.close();
            return;
          }
          getRoom(room); // 房主建房：创建并登记房间
        }
        const roomRef = rooms.get(room)!;
        if (roomRef.locked) {
          send(ws, { t: 'locked' });
          ws.close();
          return;
        }
        if (roomRef.members.size >= ROOM_MAX) {
          send(ws, { t: 'room-full' });
          ws.close();
          return;
        }
        const client: Client = { ws, id: m.id, name: m.name, host: m.host, mute: false };
        roomRef.members.set(m.id, client);
        // 把当前成员列表回给新成员
        const roster: Member[] = [...roomRef.members.values()]
          .filter((c) => c.id !== m.id)
          .map((c) => ({ id: c.id, name: c.name, host: c.host }));
        send(ws, { t: 'roster', members: roster });
        // 通知房内其他人
        broadcast(room, { t: 'peer-join', id: m.id, name: m.name, host: m.host }, m.id);
        break;
      }
      case 'offer':
      case 'answer':
      case 'ice': {
        const target = rooms.get(room)?.members.get(m.to);
        if (target) send(target.ws, m);
        break;
      }
      case 'state': {
        const c = rooms.get(room)?.members.get(m.id);
        if (c) c.mute = m.mute;
        broadcast(room, m, m.id);
        break;
      }
      case 'lock': {
        const c = rooms.get(room)?.members.get(myId);
        if (!c?.host) return; // 仅房主
        rooms.get(room)!.locked = m.locked;
        broadcast(room, m, myId);
        break;
      }
      case 'kick': {
        const c = rooms.get(room)?.members.get(myId);
        if (!c?.host) return; // 仅房主
        const victim = rooms.get(room)?.members.get(m.target);
        if (!victim) return;
        rooms.get(room)!.members.delete(m.target);
        // 先告知被踢者（在其连接关闭前），让客户端显示明确提示并返回大厅
        send(victim.ws, { t: 'kicked' });
        // 再广播给房间内其他人，移除其磁贴
        broadcast(room, { t: 'peer-leave', id: m.target });
        victim.ws.close();
        break;
      }
      case 'ping': {
        send(ws, { t: 'pong', ts: m.ts });
        break;
      }
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (!room || !myId) return;
    const r = rooms.get(room);
    if (!r) return;
    r.members.delete(myId);
    broadcast(room, { t: 'peer-leave', id: myId });
    if (r.members.size === 0) rooms.delete(room);
  });
});
