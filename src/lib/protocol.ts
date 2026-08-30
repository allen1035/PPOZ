// WebSocket 信令消息协议（客户端与信令服务共用）
// 信令只转发连接信息(SDP/ICE)与房间事件，绝不触碰音频。

export type Member = { id: string; name: string; host: boolean };

export type Msg =
  | { t: 'join'; room: string; id: string; name: string; host: boolean }
  | { t: 'roster'; members: Member[] } // 新成员进房时，服务器把当前成员列表回给它
  | { t: 'peer-join'; id: string; name: string; host: boolean } // 广播给房内其他人
  | { t: 'peer-leave'; id: string }
  | { t: 'offer'; to: string; from: string; sdp: RTCSessionDescriptionInit }
  | { t: 'answer'; to: string; from: string; sdp: RTCSessionDescriptionInit }
  | { t: 'ice'; to: string; from: string; cand: RTCIceCandidateInit }
  | { t: 'state'; id: string; mute: boolean } // 麦克风开关状态变更（用于 UI 显示）
  | { t: 'kick'; target: string } // 仅房主可发
  | { t: 'lock'; locked: boolean } // 房主锁房/解锁
  | { t: 'room-full' }
  | { t: 'locked' }
  | { t: 'kicked' } // 仅发给被踢者，客户端据此提示并返回大厅
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number };

export const ROOM_MAX = 6;
