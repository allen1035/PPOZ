import type { MemberView } from '../hooks/useRoom';

type Props = {
  member: MemberView;
  isHost: boolean;
  onKick: (id: string) => void;
};

export default function MemberTile({ member, isHost, onKick }: Props) {
  const initial = (member.name.slice(0, 1) || '?').toUpperCase();
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
        {member.host && <span className="tag host">房主</span>}
        {member.isSelf && <span className="tag self">你</span>}
        {member.mute && <span className="tag muted">已静音</span>}
      </div>
    </div>
  );
}
