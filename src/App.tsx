import { useState } from 'react';
import Lobby from './pages/Lobby';
import Room from './pages/Room';

type Session = { nickname: string; roomCode: string; isHost: boolean };

export default function App() {
  // 昵称与房间号持久保存：返回大厅后保留，便于掉线后直接重新加入
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState<Session | null>(null);

  const enter = (s: Session) => {
    setNickname(s.nickname);
    setCode(s.roomCode);
    setSession(s);
  };

  if (!session) {
    return (
      <Lobby
        nickname={nickname}
        code={code}
        onNicknameChange={setNickname}
        onCodeChange={setCode}
        onEnter={enter}
      />
    );
  }
  return (
    <Room
      nickname={session.nickname}
      roomCode={session.roomCode}
      isHost={session.isHost}
      onExit={() => setSession(null)}
    />
  );
}
