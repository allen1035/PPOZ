type Props = {
  micOn: boolean;
  soundOn: boolean;
  locked: boolean;
  isHost: boolean;
  onToggleMic: () => void;
  onToggleSound: () => void;
  onToggleLock: () => void;
  onLeave: () => void;
};

export default function ControlBar({
  micOn,
  soundOn,
  locked,
  isHost,
  onToggleMic,
  onToggleSound,
  onToggleLock,
  onLeave,
}: Props) {
  return (
    <div className="ctrl-bar">
      <button className={`ctrl-btn ${micOn ? 'active' : 'off'}`} onClick={onToggleMic}>
        {micOn ? '麦克风开' : '麦克风关'}
      </button>
      <button className={`ctrl-btn ${soundOn ? 'active' : 'off'}`} onClick={onToggleSound}>
        {soundOn ? '声音开' : '声音关'}
      </button>
      {isHost && (
        <button className={`ctrl-btn ${locked ? 'off' : 'active'}`} onClick={onToggleLock}>
          {locked ? '已锁房' : '锁房'}
        </button>
      )}
      <button className="ctrl-btn leave" onClick={onLeave}>
        离开
      </button>
    </div>
  );
}
