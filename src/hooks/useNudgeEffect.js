import { useEffect, useRef, useState } from 'react';

export default function useNudgeEffect(roomData, role) {
  const [receiveNudge, setReceiveNudge] = useState(false);
  const prevNudgeRef = useRef(0);

  useEffect(() => {
    if (!role) return;
    const myNudge = role === 'left' ? roomData.leftNudge : roomData.rightNudge;
    if (myNudge && myNudge !== prevNudgeRef.current) {
      if (Date.now() - myNudge < 10000) {
        setReceiveNudge(true);
        setTimeout(() => setReceiveNudge(false), 3500);
      }
      prevNudgeRef.current = myNudge;
    }
  }, [roomData.leftNudge, roomData.rightNudge, role]);

  return receiveNudge;
}
