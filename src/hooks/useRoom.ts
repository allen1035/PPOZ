import { useCallback, useEffect, useRef, useState } from 'react';
import type { Msg, Member } from '../lib/protocol';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export type MemberView = {
  id: string;
  name: string;
  host: boolean;
  isSelf: boolean;
  mute: boolean;
  speaking: boolean;
};

type Options = { nickname: string; roomCode: string; isHost: boolean; wsUrl?: string };

function genId(): string {
  return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8);
}

function makeAudioContext(): AudioContext {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctx();
}

type RemoteEntry = {
  audio: HTMLAudioElement;
  analyser: AnalyserNode;
  raf: number;
  lastSpeaking: boolean;
};

export function useRoom({ nickname, roomCode, isHost, wsUrl }: Options) {
  const myId = useRef(genId()).current;
  const [members, setMembers] = useState<MemberView[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [locked, setLocked] = useState(false);
  const [ping, setPing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remote = useRef<Map<string, RemoteEntry>>(new Map());
  const localStream = useRef<MediaStream | null>(null);
  const localAnalyser = useRef<AnalyserNode | null>(null);
  const localRaf = useRef<number>(0);
  const memberState = useRef<Map<string, MemberView>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pingTimer = useRef<number>(0);
  const selfClosed = useRef(false); // 主动离开时置位，避免 onclose 误报断线
  const kickedRef = useRef(false); // 已被房主踢出时置位，避免 onclose 覆盖提示文案
  const rejectedRef = useRef(false); // 服务端拒绝进房(locked/room-not-found)时置位，避免 onclose 覆盖专属提示

  const micOnRef = useRef(true);
  const soundOnRef = useRef(true);

  const syncMembers = () => setMembers([...memberState.current.values()]);
  const addMember = (m: MemberView) => { memberState.current.set(m.id, m); syncMembers(); };
  const removeMember = (id: string) => { memberState.current.delete(id); syncMembers(); };
  const patchMember = (id: string, patch: Partial<MemberView>) => {
    const cur = memberState.current.get(id);
    if (!cur) return;
    memberState.current.set(id, { ...cur, ...patch });
    syncMembers();
  };

  const send = (m: Msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  };

  const ensureLocalTracks = (pc: RTCPeerConnection): boolean => {
    if (pc.getSenders().length > 0 || !localStream.current) return false;
    localStream.current.getAudioTracks().forEach((t) => pc.addTrack(t, localStream.current!));
    return true;
  };

  const makePc = (peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    ensureLocalTracks(pc);
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ t: 'ice', to: peerId, from: myId, cand: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => attachRemote(peerId, e.streams[0]);
    pcs.current.set(peerId, pc);
    return pc;
  };

  const closePc = (id: string) => {
    const pc = pcs.current.get(id);
    if (pc) { pc.close(); pcs.current.delete(id); }
    const e = remote.current.get(id);
    if (e) { cancelAnimationFrame(e.raf); e.audio.srcObject = null; remote.current.delete(id); }
  };

  const attachRemote = (peerId: string, stream: MediaStream) => {
    let entry = remote.current.get(peerId);
    if (!entry) {
      const audio = new Audio();
      audio.autoplay = true;
      const ctx = audioCtxRef.current ?? makeAudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      entry = { audio, analyser, raf: 0, lastSpeaking: false };
      remote.current.set(peerId, entry);
    }
    entry.audio.srcObject = stream;
    entry.audio.muted = !soundOnRef.current;
    entry.audio.play().catch(() => {});
    const data = new Uint8Array(entry.analyser.fftSize);
    const loop = () => {
      entry!.analyser.getByteTimeDomainData(data);
      let vol = 0;
      for (let i = 0; i < data.length; i++) vol = Math.max(vol, Math.abs(data[i] - 128));
      const speaking = vol > 12;
      if (speaking !== entry!.lastSpeaking) {
        entry!.lastSpeaking = speaking;
        patchMember(peerId, { speaking });
      }
      entry!.raf = requestAnimationFrame(loop);
    };
    loop();
  };

  const startLocalSpeaking = () => {
    const analyser = localAnalyser.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    let last = false;
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let vol = 0;
      for (let i = 0; i < data.length; i++) vol = Math.max(vol, Math.abs(data[i] - 128));
      const speaking = micOnRef.current && vol > 12;
      if (speaking !== last) { last = speaking; patchMember(myId, { speaking }); }
      localRaf.current = requestAnimationFrame(loop);
    };
    loop();
  };

  useEffect(() => {
    let cancelled = false;
    let active = true; // 本 effect 实例是否仍处于挂载态（区分 cleanup 关闭与真实断网）
    const envUrl = import.meta.env.VITE_SIGNALING_URL as string | undefined;
    let url: string;
    if (wsUrl) url = wsUrl;                       // 测试注入优先
    else if (envUrl) url = envUrl;               // 生产：公网 wss 信令
    else if (location.protocol === 'https:') url = `wss://${location.host}/ws`; // 本地 https 经 vite 同源代理
    else url = `ws://${location.hostname}:8787`; // 本地 http 开发默认
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onclose = () => {
      // cleanup（含 React StrictMode 双调用 / 主动离开 / 被踢 / 服务端拒绝进房）关闭的连接不算断网
      if (!active || selfClosed.current || kickedRef.current || rejectedRef.current) return;
      setError('已与房间断开连接，请返回大厅');
    };

    ws.onopen = () => {
      send({ t: 'join', room: roomCode, id: myId, name: nickname, host: isHost });
      const tick = () => {
        if (ws.readyState === WebSocket.OPEN) {
          send({ t: 'ping', ts: Date.now() });
          pingTimer.current = window.setTimeout(tick, 3000);
        }
      };
      tick();
    };

    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data) as Msg;
      switch (m.t) {
        case 'roster':
          for (const mem of m.members as Member[]) addMember({ ...mem, isSelf: false, mute: false, speaking: false });
          // 进房成功后再申请麦克风，避免加入被拒(锁房/房间不存在)时仍打开麦克风
          startLocalMedia();
          break;
        case 'peer-join':
          addMember({ id: m.id, name: m.name, host: m.host, isSelf: false, mute: false, speaking: false });
          if (!cancelled) {
            const pc = makePc(m.id);
            pc.createOffer()
              .then((offer) => pc.setLocalDescription(offer).then(() => send({ t: 'offer', to: m.id, from: myId, sdp: offer })));
          }
          break;
        case 'peer-leave':
          closePc(m.id);
          removeMember(m.id);
          break;
        case 'offer': {
          const pc = pcs.current.get(m.from) ?? makePc(m.from);
          pc.setRemoteDescription(m.sdp)
            .then(() => pc.createAnswer())
            .then((answer) => pc.setLocalDescription(answer).then(() => send({ t: 'answer', to: m.from, from: myId, sdp: answer })));
          break;
        }
        case 'answer': {
          const pc = pcs.current.get(m.from);
          if (pc) pc.setRemoteDescription(m.sdp);
          break;
        }
        case 'ice': {
          const pc = pcs.current.get(m.from);
          if (pc) pc.addIceCandidate(m.cand).catch(() => {});
          break;
        }
        case 'state':
          patchMember(m.id, { mute: m.mute });
          break;
        case 'lock':
          setLocked(m.locked);
          break;
        case 'room-full':
          setError('房间已满（最多 6 人）');
          break;
        case 'room-not-found':
          rejectedRef.current = true;
          setError('该房间不存在，请重新输入');
          break;
        case 'locked':
          rejectedRef.current = true;
          setError('该房间已上锁');
          break;
        case 'kicked':
          kickedRef.current = true;
          setError('你已被房主移出房间');
          break;
        case 'pong':
          setPing(Date.now() - m.ts);
          break;
        default:
          break;
      }
    };

    // 仅在进房成功(收到 roster)后调用：申请麦克风并把自己加入成员列表
    const startLocalMedia = () => {
      if (cancelled) return;
      navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        .then((stream) => {
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          localStream.current = stream;
          addMember({ id: myId, name: nickname, host: isHost, isSelf: true, mute: false, speaking: false });
          const ctx = makeAudioContext();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          src.connect(analyser);
          localAnalyser.current = analyser;
          // 若已有连接但当时没有本地轨道，补发并重新协商
          pcs.current.forEach((pc, peerId) => {
            if (ensureLocalTracks(pc)) {
              pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer).then(() => send({ t: 'offer', to: peerId, from: myId, sdp: offer })));
            }
          });
          startLocalSpeaking();
        })
        .catch(() => {
          if (!cancelled) addMember({ id: myId, name: nickname, host: isHost, isSelf: true, mute: true, speaking: false });
        });
    };

    return () => {
      active = false;
      cancelled = true;
      window.clearTimeout(pingTimer.current);
      if (localRaf.current) cancelAnimationFrame(localRaf.current);
      remote.current.forEach((e) => cancelAnimationFrame(e.raf));
      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
      remote.current.forEach((e) => { e.audio.srcObject = null; });
      remote.current.clear();
      localStream.current?.getTracks().forEach((t) => t.stop());
      ws.close();
    };
  }, []);

  const toggleMic = useCallback(() => {
    const next = !micOnRef.current;
    setMicOn(next);
    micOnRef.current = next;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    patchMember(myId, { mute: !next });
    send({ t: 'state', id: myId, mute: !next });
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundOnRef.current;
    setSoundOn(next);
    soundOnRef.current = next;
    remote.current.forEach((e) => (e.audio.muted = !next));
  }, []);

  const kick = useCallback((id: string) => send({ t: 'kick', target: id }), []);
  const toggleLock = useCallback(() => {
    const next = !locked;
    setLocked(next);
    send({ t: 'lock', locked: next });
  }, [locked]);

  const leave = useCallback(() => { selfClosed.current = true; wsRef.current?.close(); }, []);

  return { members, micOn, soundOn, locked, ping, error, toggleMic, toggleSound, kick, toggleLock, leave, isHost };
}
