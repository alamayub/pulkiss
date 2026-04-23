import { useCallback, useEffect, useRef, useState } from "react";
import { loadIceServers } from "../lib/api";

/**
 * @param {import("socket.io-client").Socket | null} socket
 * @param {React.RefObject<HTMLVideoElement | null>} localRef
 * @param {React.RefObject<HTMLVideoElement | null>} remoteRef
 * @param {{ onMatchEnd?: (evt: { reason?: string }) => void }} [options]
 */
export function useStrangerCall(socket, localRef, remoteRef, options = {}) {
  const { onMatchEnd } = options;
  const [searchStatus, setSearchStatus] = useState("Click Start to look for a stranger.");
  const [inQueue, setInQueue] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [canChat, setCanChat] = useState(false);
  const [chatLines, setChatLines] = useState(() => /** @type {{ self: boolean, text: string }[]} */ ([]));

  const iceServersRef = useRef([{ urls: "stun:stun.l.google.com:19302" }]);
  const localStreamRef = useRef(null);
  const pcRef = useRef(null);
  const currentMatchIdRef = useRef(null);
  const pendingRemoteOfferRef = useRef(null);
  const iceFromPeerRef = useRef(/** @type {RTCIceCandidate[]} */ ([]));
  const socketIdRef = useRef(null);

  const clearChat = useCallback(() => {
    setChatLines([]);
  }, []);

  const closePeer = useCallback(() => {
    iceFromPeerRef.current = [];
    pendingRemoteOfferRef.current = null;
    if (pcRef.current) {
      try {
        pcRef.current.getSenders().forEach((s) => {
          try {
            if (s.track) s.track.stop();
          } catch {
            /* empty */
          }
        });
        pcRef.current.close();
      } catch {
        /* empty */
      }
      pcRef.current = null;
    }
    if (remoteRef.current) {
      remoteRef.current.srcObject = null;
    }
  }, [remoteRef]);

  const endLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localRef.current) {
      localRef.current.srcObject = null;
    }
  }, [localRef]);

  const endMatchUi = useCallback(() => {
    closePeer();
    currentMatchIdRef.current = null;
    setInCall(false);
    setCanChat(false);
    setInQueue(false);
  }, [closePeer]);

  const flushRemoteIce = useCallback(() => {
    const pc = pcRef.current;
    if (!pc) return;
    while (iceFromPeerRef.current.length) {
      const c = iceFromPeerRef.current.shift();
      if (c) void pc.addIceCandidate(c).catch(() => {});
    }
  }, []);

  const onRtcAnswer = useCallback(
    (data) => {
      if (!data?.sdp || !data.matchId) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (String(data.matchId) !== String(currentMatchIdRef.current)) return;
      if (data.from && data.from === socketIdRef.current) return;
      if (data.sdp.type === "answer") {
        void (async () => {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            flushRemoteIce();
          } catch {
            /* empty */
          }
        })();
      }
    },
    [flushRemoteIce]
  );

  const onRtcOffer = useCallback(
    (data) => {
      if (!data?.sdp || !data.matchId) return;
      if (String(data.matchId) !== String(currentMatchIdRef.current)) return;
      if (data.from && data.from === socketIdRef.current) return;

      if (!pcRef.current) {
        pendingRemoteOfferRef.current = data;
        return;
      }
      const pc = pcRef.current;
      void (async () => {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          flushRemoteIce();
          if (data.sdp.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket?.emit("rtc:answer", { matchId: currentMatchIdRef.current, sdp: answer });
          }
        } catch {
          /* empty */
        }
      })();
    },
    [socket, flushRemoteIce]
  );

  const onRtcIce = useCallback((data) => {
    if (!data?.candidate || !data.matchId) return;
    const pc = pcRef.current;
    if (!pc) return;
    if (String(data.matchId) !== String(currentMatchIdRef.current)) return;
    if (data.from && data.from === socketIdRef.current) return;
    const cand = new RTCIceCandidate(data.candidate);
    if (pc.remoteDescription && pc.remoteDescription.type) {
      void pc.addIceCandidate(cand).catch(() => {});
    } else {
      iceFromPeerRef.current.push(cand);
    }
  }, []);

  const onMatchEnded = useCallback(
    (evt) => {
      const reason = evt?.reason;
      setInQueue(false);
      if (reason === "next") {
        setSearchStatus("Partner clicked Next. Click Start to search again.");
      } else if (reason === "peer-disconnected") {
        setSearchStatus("Stranger disconnected.");
      } else {
        setSearchStatus("Call ended.");
      }
      onMatchEnd?.(evt);
      endMatchUi();
    },
    [endMatchUi, onMatchEnd]
  );

  const onMatchFound = useCallback(
    async (data) => {
      if (!data?.matchId || !socket) return;
      setInQueue(false);
      setSearchStatus("Setting up call…");
      setInCall(true);
      setCanChat(true);
      currentMatchIdRef.current = data.matchId;

      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStreamRef.current = stream;
          if (localRef.current) localRef.current.srcObject = stream;
        }
      } catch {
        setSearchStatus("Camera or microphone denied. Allow access and try Start again.");
        setInCall(false);
        setCanChat(false);
        endMatchUi();
        setSearchStatus("Click Start to look for a stranger.");
        return;
      }

      const initiator = !!data.isInitiator;
      const preOffer = pendingRemoteOfferRef.current;
      closePeer();
      clearChat();
      if (!localStreamRef.current) return;

      const iceServers = iceServersRef.current;
      const configuration = { iceServers };
      const pc = new RTCPeerConnection(configuration);
      pcRef.current = pc;

      localStreamRef.current.getTracks().forEach((t) => {
        try {
          pc.addTrack(t, localStreamRef.current);
        } catch {
          /* empty */
        }
      });

      pc.ontrack = (e) => {
        if (e.streams[0] && remoteRef.current) {
          remoteRef.current.srcObject = e.streams[0];
        }
      };
      pc.onicecandidate = (e) => {
        if (e.candidate && currentMatchIdRef.current) {
          socket.emit("rtc:ice", { matchId: currentMatchIdRef.current, candidate: e.candidate.toJSON() });
        }
      };

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("rtc:offer", { matchId: data.matchId, sdp: offer });
      } else if (preOffer) {
        onRtcOffer(preOffer);
      }
      setSearchStatus("In a call. Say hi.");
    },
    [socket, localRef, remoteRef, closePeer, clearChat, onRtcOffer, endMatchUi]
  );

  useEffect(() => {
    if (!socket) {
      return undefined;
    }
    void loadIceServers().then((s) => {
      iceServersRef.current = s;
    });
    const onId = () => {
      socketIdRef.current = socket.id;
    };
    socket.on("connect", onId);
    onId();
    const onFound = (d) => void onMatchFound(d);
    const onEnd = (e) => onMatchEnded(e);
    const onO = (d) => onRtcOffer(d);
    const onA = (d) => onRtcAnswer(d);
    const onI = (d) => onRtcIce(d);
    const onMsg = (msg) => {
      if (msg?.text) {
        setChatLines((c) => [...c, { self: false, text: msg.text }]);
      }
    };
    socket.on("match:found", onFound);
    socket.on("match:ended", onEnd);
    socket.on("rtc:offer", onO);
    socket.on("rtc:answer", onA);
    socket.on("rtc:ice", onI);
    socket.on("chat:message", onMsg);
    return () => {
      socket.off("connect", onId);
      socket.off("match:found", onFound);
      socket.off("match:ended", onEnd);
      socket.off("rtc:offer", onO);
      socket.off("rtc:answer", onA);
      socket.off("rtc:ice", onI);
      socket.off("chat:message", onMsg);
    };
  }, [socket, onMatchFound, onMatchEnded, onRtcOffer, onRtcAnswer, onRtcIce]);

  const startSearch = useCallback(async () => {
    if (!socket?.connected) return;
    if (inQueue) return;
    if (inCall) return;
    setInQueue(true);
    setSearchStatus("Looking for a stranger…");
    try {
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localRef.current) {
          localRef.current.srcObject = stream;
        }
      }
    } catch {
      setInQueue(false);
      setSearchStatus("Allow camera and microphone, then try again.");
      return;
    }
    socket.emit("queue:join");
  }, [socket, inQueue, inCall, localRef]);

  const stopSearch = useCallback(() => {
    if (socket) {
      socket.emit("queue:leave");
    }
    setInQueue(false);
    if (!inCall) {
      setSearchStatus("Stopped. Click Start to try again.");
    }
  }, [socket, inCall]);

  const next = useCallback(() => {
    if (socket) {
      socket.emit("match:next");
    }
    closePeer();
    clearChat();
    currentMatchIdRef.current = null;
    setInCall(false);
    setCanChat(false);
    setInQueue(false);
    setSearchStatus("You skipped. Click Start for another match.");
  }, [socket, closePeer, clearChat]);

  const sendMessage = useCallback(
    (text) => {
      if (!text?.trim() || !currentMatchIdRef.current || !socket) return;
      const t = text.slice(0, 2000);
      socket.emit("chat:message", { text: t });
      setChatLines((c) => [...c, { self: true, text: t }]);
    },
    [socket]
  );

  return {
    searchStatus,
    inQueue,
    inCall,
    canChat,
    chatLines,
    startSearch,
    stopSearch,
    next,
    sendMessage,
    endLocalMedia,
  };
}
