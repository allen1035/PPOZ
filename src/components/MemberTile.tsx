import type { MemberView } from '../hooks/useRoom';

type Props = {
  member: MemberView;
  isHost: boolean;
  connState?: string;
  onKick: (id: string) => void;
};

const CONN_LABEL: Record<string, string> = {
  connected: '已连接',
  connecting: '连接中',
  new: '连接中',
  disconnected: '已断开',
  failed: '连接失败',
  closed: '已关闭',
};

export default function MemberTile({ member, isHost, connState, onKick }: Props) {
  const initial = (member.name.slice(0, 1) || '?').toUpperCase();
  const dotClass = connState ? `conn-dot conn-${connState}` : '';
  return (
    <div className={`member-tile ${member.speaking ? 'speaking' : ''}`}>
      {isHost && !member.isSelf && (
        <button className="kick-btn" title="踢出" onClick={() => onKick(member.id)}>
          ✕
        </button>
      )}
      <div className="avatar">{initial}</div>
      <div className="member-name">{member.name}</div>
      <div>
        {connState && <span className={`tag conn ${dotClass}`}>{CONN_LABEL[connState] ?? connState}</span>}
        {member.host && <span className="tag host">房主</span>}
        {member.isSelf && <span className="tag self">你</span>}
        {member.mute && <span className="tag muted">已静音</span>}
      </div>
    </div>
  );
}
