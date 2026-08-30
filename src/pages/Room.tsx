import { useRoom } from '../hooks/useRoom';
import MemberTile from '../components/MemberTile';
import ControlBar from '../components/ControlBar';
import PingBadge from '../components/PingBadge';

type Props = {
  nickname: string;
  roomCode: string;
  isHost: boolean;
  onExit: () => void;
};

export default function Room({ nickname, roomCode, isHost, onExit }: Props) {
  const { members, micOn, soundOn, locked, ping, error, toggleMic, toggleSound, kick, toggleLock, leave, isHost: amHost } =
    useRoom({ nickname, roomCode, isHost });

  const copyCode = () => navigator.clipboard?.writeText(roomCode).catch(() => {});
  const copyLink = () =>
    navigator.clipboard?.writeText(`${location.origin}/?r=${roomCode}`).catch(() => {});

  if (error) {
    return (
      <div className="app">
        <div className="error-banner">
          <span>{error}</span>
          <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={onExit}>
            返回大厅
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="room-header">
        <div>
          <div className="room-title">房间</div>
          <div className="room-code-box">
            <span className="room-code">{roomCode}</span>
            <button className="btn btn-ghost" style={{ width: 'auto', padding: '6px 10px' }} onClick={copyCode}>
              复制口令
            </button>
          </div>
        </div>
        <PingBadge ping={ping} />
        <div className="spacer" />
        <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={copyLink}>
          复制邀请链接
        </button>
      </div>

      <div className="members-grid">
        {members.map((m) => (
          <MemberTile key={m.id} member={m} isHost={amHost} onKick={kick} />
        ))}
      </div>

      <ControlBar
        micOn={micOn}
        soundOn={soundOn}
        locked={locked}
        isHost={amHost}
        onToggleMic={toggleMic}
        onToggleSound={toggleSound}
        onToggleLock={toggleLock}
        onLeave={() => {
          leave();
          onExit();
        }}
      />
    </div>
  );
}
