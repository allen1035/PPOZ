import { useEffect, useState } from 'react';
import { generateRoomCode, isValidRoomCode } from '../lib/roomCode';

type Session = { nickname: string; roomCode: string; isHost: boolean };

type Props = {
  nickname: string;
  code: string;
  onNicknameChange: (v: string) => void;
  onCodeChange: (v: string) => void;
  onEnter: (s: Session) => void;
};

export default function Lobby({ nickname, code, onNicknameChange, onCodeChange, onEnter }: Props) {
  const [err, setErr] = useState<string | null>(null);

  // 通过邀请链接 ?r=CODE 进入时，自动回填房间口令（首次挂载）
  useEffect(() => {
    const r = new URLSearchParams(location.search).get('r');
    if (r) onCodeChange(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = () => {
    if (!nickname.trim()) {
      setErr('请先输入昵称');
      return;
    }
    onEnter({ nickname: nickname.trim(), roomCode: generateRoomCode(), isHost: true });
  };

  const join = () => {
    if (!nickname.trim()) {
      setErr('请先输入昵称');
      return;
    }
    if (!isValidRoomCode(code)) {
      setErr('口令输入有误：请输入 6 位字母或数字');
      return;
    }
    onEnter({ nickname: nickname.trim(), roomCode: code.trim().toUpperCase(), isHost: false });
  };

  return (
    <div className="app">
      <div className="lobby-card">
        <div className="logo">PPOZ</div>
        <div className="field" style={{ marginTop: 24 }}>
          <label>昵称</label>
          <input
            className="input"
            value={nickname}
            maxLength={16}
            placeholder="你的昵称"
            onChange={(e) => onNicknameChange(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={create}>
          创建房间（你是房主）
        </button>
        <div className="divider">或</div>
        <div className="field">
          <label>房间口令</label>
          <input
            className="input code"
            value={code}
            maxLength={6}
            placeholder="6 位口令"
            onChange={(e) => onCodeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') join();
            }}
          />
          <div className="hint">口令为 6 位字母或数字，不区分大小写</div>
        </div>
        <button className="btn btn-ghost" onClick={join}>
          加入房间
        </button>
        {err && (
          <div className="error-banner" style={{ marginTop: 16 }}>
            <span>{err}</span>
          </div>
        )}
      </div>
    </div>
  );
}
