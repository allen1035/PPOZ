# PPOZ 技术方案（MVP 版）

> 版本：v0.1 · 日期：2026-08-30 · 配套：PRODUCT_DESIGN.md v0.3（零成本 P2P 方案定稿）
> 范围：朋友间游戏语音开黑，房间上限 **6 人**，全程零成本（不购买任何服务器）

---

## 1. 目标与约束

- 让 3~6 个朋友以最短路径开黑语音：群里发链接 → 点链接进房 → 开麦 → 开打。
- **硬约束：零成本**。音频不经过服务器；信令与状态用免费云服务（或本机 + 免费组网）。
- **房间上限 6 人**：P2P mesh 下每人向其余每人各发一份音频，6 人是上行带宽与连接数的舒适上限。
- 不做账号体系、不做陌生人社交、不做移动端（MVP 仅 Web）。

---

## 2. 整体架构

两套流彻底分离：

- **媒体流（音频）**：浏览器 ↔ 浏览器，WebRTC P2P mesh 直连，**不经过任何服务器**。
- **控制流（信令/状态）**：走一条极轻的 WebSocket 信令通道，只转发连接信息（SDP/ICE）与房间事件，**不碰音频**。

```
┌─────────┐   audio P2P    ┌─────────┐
│  Browser │ ←───────────→ │  Browser │   (WebRTC mesh, 全互联)
│  (你)    │ ←─┐   ┌──────→ │  (阿伟)  │
└─────────┘   │   │        └─────────┘
     │        │   │             │
     │  signaling (WebSocket, 仅 SDP/事件) │
     └────────┴───┴─────────────┘
                │
        ┌───────┴────────┐
        │  信令服务(免费)  │  Cloudflare Workers / 本机 NestJS + ZeroTier
        │  + 房间状态(KV) │
        └─────────────────┘
                │
        STUN: stun.l.google.com (公共免费, 仅 NAT 穿透用)
```

---

## 3. 技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 前端 | React 18 + TypeScript + Vite | 组件化、热更新快，与 WebRTC API 契合 |
| 音频 | 原生 WebRTC（`RTCPeerConnection` / `getUserMedia`） | 不自研，无第三方 SDK 费用 |
| 说话检测 | Web Audio API `AnalyserNode` | 本地计算音量驱动高亮，不发网络 |
| 信令服务 | Cloudflare Workers（免费档）或 本机 NestJS + WebSocket | 仅转发 SDP/ICE 与房间事件 |
| 房间状态 | Workers KV（免费）或 信令进程内存 | 易失，人散即灭 |
| NAT 穿透 | 公共 STUN（Google） | 免费；TURN 仅在对称 NAT 时才需（用 ZeroTier 规避） |
| 部署 | Cloudflare Workers 免费 / Vercel 免费 / 本机 + ZeroTier | 零成本 |

---

## 4. 房间与口令

- **房间号**：6 位大写字母 + 数字，字符集去掉易混淆的 `I L O 0 1`，例：`K7M2XQ`。
- 不区分大小写（前端自动转大写）；输入框限 6 位，长度/字符非法时提示「口令输入有误：请输入 6 位字母或数字」。
- 建房即随机生成房间号，并写入房间状态；满 6 人后新成员进房被拒（返回 `room-full`）。
- 邀请链接：`https://<域名>/?r=<房间号>`，点开自动带入房间号。

---

## 5. 信令协议（WebSocket 消息）

信令服务只做「房间路由 + 消息转发」，不解析音频。消息体统一：

```ts
type Msg =
  | { t: "join";     room: string; id: string; name: string; host: boolean }
  | { t: "peer-join"; room: string; id: string; name: string; host: boolean }
  | { t: "peer-leave"; room: string; id: string }
  | { t: "offer";   to: string; from: string; sdp: RTCSessionDescriptionInit }
  | { t: "answer";  to: string; from: string; sdp: RTCSessionDescriptionInit }
  | { t: "ice";     to: string; from: string; cand: RTCIceCandidateInit }
  | { t: "state";   room: string; mute: boolean; host: boolean }   // 麦克风/房主状态变更
  | { t: "kick";    room: string; target: string }                 // 仅房主可发
  | { t: "room-full" }
  | { t: "locked" }                                                // 锁房后拒绝新成员
```

转发规则：信令服务按 `room` 维护成员表；`offer/answer/ice` 按 `to` 定向转发；其余事件广播给同房所有人。

---

## 6. WebRTC P2P mesh 实现

### 6.1 连接拓扑

房间内每个人（含房主）与其他**每一个**已在线成员各建立一条 `RTCPeerConnection`。N 人即有 `N*(N-1)/2` 条连接；N=6 → 15 条，完全可控。

新人进房流程（以新成员 B 加入已有 A 为例）：

1. B 发 `join` → 信令服务把 B 的 `peer-join` 广播给 A。
2. **由已在房者（A）作为发起方**向 B 建连：`A.createOffer()` → 经信令把 `offer` 发给 B。
3. B `setRemoteDescription(offer)` → `createAnswer()` → 回 `answer` 给 A。
4. 双方互换 `ice` 候选，连接建立；A 把本地 `audio` track `addTrack` 给这条 PC，B 收到 `ontrack` 后播放。
5. B 再与房内其余成员重复 2~4（谁先到谁发起，避免双 offer 冲突：约定「已在房者发起」）。

### 6.2 音频采集与开关

```ts
const stream = await navigator.mediaDevices.getUserMedia({ audio: {
  echoCancellation: true, noiseSuppression: true, autoGainControl: true
}});
let audioOn = true;
function setMic(on: boolean) {
  audioOn = on;
  stream.getAudioTracks().forEach(t => (t.enabled = on)); // 关麦 = 静音 track，他人听不到
}
```

### 6.3 说话人高亮（本地计算，零网络）

```ts
const ctx = new AudioContext();
const src = ctx.createMediaStreamSource(stream);
const analyser = ctx.createAnalyser();
src.connect(analyser);
const data = new Uint8Array(analyser.fftSize);
function tick() {
  analyser.getByteTimeDomainData(data);
  const vol = data.reduce((m, v) => Math.max(m, Math.abs(v - 128)), 0);
  setSpeaking(audioOn && vol > 12);   // 驱动磁贴绿框高亮
  requestAnimationFrame(tick);
}
```

### 6.4 静音他人 / 踢人

- **静音他人**：本地把对应远端 `<audio>` 元素的 `muted = true`，只影响自己收听，不发网络。
- **踢人（房主特权）**：房主发 `kick {target}` → 信令广播 `peer-leave` → 各方 `pc.close()` 并移除磁贴；被踢者本地也收到 `peer-leave` 后退出房间。踢人按钮仅当 `selfHost === true` 时渲染，且发送前再校验权限。

---

## 7. NAT 穿透与弱网

- 每个 `RTCPeerConnection` 配置 `iceServers: [{ urls: "stun:stun.l.google.com:19302" }]`。
- 家用宽带多为锥形 NAT，STUN 即可打通直连，免费。
- **对称型 NAT**（公司网/部分移动网）可能需 TURN 中继（唯一潜在花费）。规避方案：所有成员安装 ZeroTier/Tailscale 免费组网，组网后如同局域网，无需 NAT 穿透，纯 P2P 直连。
- 弱网降质：WebRTC 自带自适应码率，丢包时降质不中断；不引入额外组件。

---

## 8. 前端结构（React）

```
src/
  App.tsx                 // 路由：大厅 / 房间
  pages/
    Lobby.tsx             // 昵称、建房、口令进房
    Room.tsx              // 房间页容器，持有信令 + mesh 状态
  components/
    MemberTile.tsx        // 成员磁贴：头像、名字、房主/你标签、说话高亮、踢人按钮(房主)
    ControlBar.tsx        // 麦克风开关、声音开关、离开
    PingBadge.tsx         // 模拟/真实延迟显示
  hooks/
    useSignaling.ts       // WebSocket 连接与消息分发
    useMesh.ts            // RTCPeerConnection 管理（建连/重连/关闭）
    useMic.ts             // 麦克风采集、开关、说话检测
  lib/
    roomCode.ts           // 6 位房间号生成与校验
    protocol.ts           // 信令消息类型定义
```

状态管理：房间内用 `useMesh` 维护 `peers: Map<id, { pc, audioEl, name, host, speaking, muted }>`，`Room.tsx` 聚合后下发到 `MemberTile`。

---

## 9. 信令服务（最小实现，Cloudflare Workers 示例）

```ts
// worker.ts — 仅做房间路由与消息转发，不碰音频
const rooms = new Map<string, Set<WebSocket>>();   // 真实部署用 KV/Durable Objects
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const room = url.searchParams.get("r")!;
    const [client, server] = Object.values(new WebSocketPair());
    rooms.get(room)?.add(server) ?? rooms.set(room, new Set([server]));
    server.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      // offer/answer/ice 按 to 定向转发；其余广播同房
      for (const ws of rooms.get(room)!) {
        if (ws !== server && (!("to" in msg) || msg.to === getId(ws))) ws.send(e.data);
      }
    });
    server.addEventListener("close", () => rooms.get(room)?.delete(server));
    return new Response(null, { status: 101, webSocket: client });
  }
};
```

> 注：Workers 原生 WebSocket 需用 Durable Objects 持久化房间；本机 NestJS + `socket.io`/`ws` 起步更简单，零依赖免费，适合先跑通。

---

## 10. 零成本部署选项

| 方案 | 适用 | 成本 | 备注 |
|------|------|------|------|
| Cloudflare Workers 免费档 + KV | 朋友随时进 | ¥0 | 10 万请求/天免费，信令量极小，用不完 |
| 本机 NestJS + ZeroTier 组网 | 你开机时可用 | ¥0 | 无需公网 IP，朋友通过组网 IP 访问 |
| Vercel / Render 免费档 | 备选 | ¥0 | 有休眠限制，开黑前先唤醒 |

---

## 11. 验收标准（沿用产品设计文档）

1. 5 个朋友从点链接到全部开麦 ≤ 30 秒。
2. 2 小时+ 通话无掉线、无明显音质劣化。
3. 游戏全屏时麦克风采集正常（麦克风开关即常开说话）。
4. 弱网（丢包 20%）可通话（降质不中断）。
5. **房间满 6 人后拒绝新成员进房**（本次新增约束）。

---

## 12. 里程碑与任务

| 阶段 | 任务 |
|------|------|
| M1 骨架 | Vite + React + TS 初始化；`roomCode.ts` 6 位生成/校验；大厅页（建房/口令进房） |
| M2 语音跑通 | `useSignaling` + 最小信令服务（本机 ws）；`useMesh` 两标签页本地音频直连；说话检测高亮 |
| M3 控制与管理 | 麦克风开关、静音他人、房主踢人/锁房、满员拒绝进房、口令校验提示 |
| M4 内测 | 本机 + ZeroTier 车队真实开黑 2 周；修复 NAT/弱网问题后交付 |

---

## 13. 风险与回退

- **mesh 上限**：严格 ≤6 人，超出在信令层直接拒绝（`room-full`）。
- **对称 NAT**：先用 ZeroTier/Tailscale 免费组网规避；若未来必须支持陌生人广域，再评估付费 TURN 或切 TRTC（客户端接入层可平滑替换，架构已隔离）。
- **本机方案可用性**：内测阶段用本机 + 组网足够；正式给朋友用建议上 Cloudflare Workers 免费档，免维护。
