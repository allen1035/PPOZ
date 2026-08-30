import { useState } from 'react';
import Lobby from './pages/Lobby';
import Room from './pages/Room';

type Session = { nickname: string; roomCode: string; isHost: boolean };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return <Lobby onEnter={setSession} />;
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
