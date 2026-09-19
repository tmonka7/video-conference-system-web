import { useCallback, useEffect, useRef, useState } from 'react';
import { SocketEvent, normalizeMeetingId } from '@vcs/shared';
import { meetingsApi } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { PeerMesh, requestDisplayMedia, requestUserMedia, stopStream } from '@/lib/webrtc';

/**
 * Owns everything about being in a call: the local stream, the mesh of peer
 * connections, and the participant list the UI renders.
 *
 * The join is deliberately two steps. `POST /meetings/join` does the checks that
 * need the database (passcode, capacity, membership) and hands back a join
 * token; the socket then presents that token. So the socket layer never has to
 * re-implement any of those rules.
 */
export function useMeetingRoom(code, options = {}) {
  const { guestName, passcode, media: initialMedia, shareOnJoin } = options;

  const [status, setStatus] = useState('joining');
  const [error, setError] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [selfId, setSelfId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [localStream, setLocalStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [endedReason, setEndedReason] = useState(null);

  const [audioEnabled, setAudioEnabled] = useState(initialMedia?.audioEnabled ?? true);
  const [videoEnabled, setVideoEnabled] = useState(initialMedia?.videoEnabled ?? true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  const meshRef = useRef(null);
  const socketRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const leftRef = useRef(false);

  /**
   * Closes every peer connection and releases the camera and microphone. This
   * runs on unmount, but also as soon as the call is over, so the camera light
   * goes out while the "you left" screen is still on show.
   */
  const teardown = useCallback(() => {
    meshRef.current?.destroy();
    meshRef.current = null;

    stopStream(cameraStreamRef.current);
    stopStream(screenStreamRef.current);
    cameraStreamRef.current = null;
    screenStreamRef.current = null;

    setLocalStream(null);
    setRemoteStreams(new Map());
  }, []);

  const upsertParticipant = useCallback((participant) => {
    setParticipants((current) => {
      const index = current.findIndex((entry) => entry.id === participant.id);
      if (index === -1) return [...current, participant];
      const next = [...current];
      next[index] = participant;
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const digits = normalizeMeetingId(code);

    async function join() {
      try {
        const stream = await requestUserMedia({
          audio: true,
          video: initialMedia?.videoEnabled ?? true,
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }

        // Muting is a track flag, never a removed sender: that keeps the
        // negotiated m-lines stable for the whole call.
        stream.getAudioTracks().forEach((track) => {
          track.enabled = initialMedia?.audioEnabled ?? true;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = initialMedia?.videoEnabled ?? true;
        });

        cameraStreamRef.current = stream;
        setLocalStream(stream);

        const session = await meetingsApi.join({
          meetingId: digits,
          passcode,
          guestName,
          media: {
            audioEnabled: initialMedia?.audioEnabled ?? true,
            videoEnabled: initialMedia?.videoEnabled ?? true,
          },
        });
        if (cancelled) return;

        setMeeting(session.meeting);
        setSelfId(session.participant.id);

        const socket = connectSocket();
        socketRef.current = socket;

        const mesh = new PeerMesh({
          socket,
          iceServers: session.iceServers,
          onRemoteStream: (socketId, remoteStream) => {
            setRemoteStreams((current) => new Map(current).set(socketId, remoteStream));
          },
          onPeerLeft: (socketId) => {
            setRemoteStreams((current) => {
              const next = new Map(current);
              next.delete(socketId);
              return next;
            });
          },
        });
        mesh.setLocalStream(stream);
        mesh.listen();
        meshRef.current = mesh;

        socket.on(SocketEvent.MeetingJoined, (payload) => {
          setMeeting(payload.meeting);
          setSelfId(payload.self.id);
          setParticipants([payload.self, ...payload.peers]);
          setStatus('connected');

          // We joined last, so we are the one who offers to everybody here.
          for (const peer of payload.peers) {
            if (peer.socketId) mesh.callPeer(peer.socketId);
          }
        });

        socket.on(SocketEvent.ParticipantJoined, ({ participant }) => {
          // They will send us the offer; we only need the tile.
          upsertParticipant(participant);
        });

        socket.on(SocketEvent.ParticipantUpdated, ({ participant }) => {
          upsertParticipant(participant);
        });

        socket.on(SocketEvent.ParticipantLeft, ({ participant }) => {
          setParticipants((current) => current.filter((entry) => entry.id !== participant.id));
          if (participant.socketId) mesh.closePeer(participant.socketId);
        });

        socket.on(SocketEvent.MeetingEnded, ({ reason }) => {
          setEndedReason(reason);
          setStatus('ended');
          teardown();
        });

        socket.on(SocketEvent.ChatMessage, ({ message }) => {
          setMessages((current) =>
            current.some((entry) => entry.id === message.id) ? current : [...current, message],
          );
        });

        socket.on(SocketEvent.Error, (payload) => {
          if (payload.event === SocketEvent.MeetingJoin) {
            setError(payload.message);
            setStatus('error');
          }
        });

        socket.emit(SocketEvent.MeetingJoin, {
          joinToken: session.joinToken,
          media: {
            audioEnabled: initialMedia?.audioEnabled ?? true,
            videoEnabled: initialMedia?.videoEnabled ?? true,
          },
        });
      } catch (joinError) {
        if (cancelled) return;
        setError(joinError.message ?? 'Could not join this meeting');
        setStatus('error');
      }
    }

    join();

    return () => {
      cancelled = true;
      const socket = socketRef.current;

      if (socket) {
        socket.emit(SocketEvent.MeetingLeave, {});
        socket.off(SocketEvent.MeetingJoined);
        socket.off(SocketEvent.ParticipantJoined);
        socket.off(SocketEvent.ParticipantUpdated);
        socket.off(SocketEvent.ParticipantLeft);
        socket.off(SocketEvent.MeetingEnded);
        socket.off(SocketEvent.ChatMessage);
        socket.off(SocketEvent.Error);
      }

      teardown();
    };
    // The room is rebuilt from scratch if the meeting code changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const publishMedia = useCallback((patch) => {
    socketRef.current?.emit(SocketEvent.MediaUpdate, { media: patch });
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((current) => {
      const next = !current;
      cameraStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
      publishMedia({ audioEnabled: next });
      return next;
    });
  }, [publishMedia]);

  const toggleVideo = useCallback(() => {
    setVideoEnabled((current) => {
      const next = !current;
      cameraStreamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
      publishMedia({ videoEnabled: next });
      return next;
    });
  }, [publishMedia]);

  const toggleHand = useCallback(() => {
    setHandRaised((current) => {
      publishMedia({ handRaised: !current });
      return !current;
    });
  }, [publishMedia]);

  const stopScreenShare = useCallback(async () => {
    const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0] ?? null;
    await meshRef.current?.replaceVideoTrack(cameraTrack);

    stopStream(screenStreamRef.current);
    screenStreamRef.current = null;

    setScreenSharing(false);
    publishMedia({ screenSharing: false });
  }, [publishMedia]);

  const startScreenShare = useCallback(async () => {
    const stream = await requestDisplayMedia();
    const [track] = stream.getVideoTracks();

    screenStreamRef.current = stream;
    // Swapping the sender's track avoids a renegotiation round trip.
    await meshRef.current?.replaceVideoTrack(track);

    // The browser's own "Stop sharing" bar bypasses our button.
    track.addEventListener('ended', () => {
      stopScreenShare();
    });

    setScreenSharing(true);
    publishMedia({ screenSharing: true });
  }, [publishMedia, stopScreenShare]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (screenSharing) await stopScreenShare();
      else await startScreenShare();
    } catch {
      // The picker being dismissed is a normal outcome, not an error.
      setScreenSharing(false);
    }
  }, [screenSharing, startScreenShare, stopScreenShare]);

  // "Share Screen" from the home screen opens the picker once connected.
  const sharePrompted = useRef(false);
  useEffect(() => {
    if (!shareOnJoin || status !== 'connected' || sharePrompted.current) return;
    sharePrompted.current = true;
    startScreenShare().catch(() => setScreenSharing(false));
  }, [shareOnJoin, status, startScreenShare]);

  const sendChatMessage = useCallback((body) => {
    if (!body.trim()) return;
    socketRef.current?.emit(SocketEvent.ChatSend, { body: body.trim() });
  }, []);

  const muteParticipant = useCallback((participantId) => {
    socketRef.current?.emit(SocketEvent.HostMuteParticipant, { participantId });
  }, []);

  const removeParticipant = useCallback((participantId) => {
    socketRef.current?.emit(SocketEvent.HostRemoveParticipant, { participantId });
  }, []);

  const endForAll = useCallback(() => {
    socketRef.current?.emit(SocketEvent.HostEndMeeting, { meetingId: meeting?.id });
  }, [meeting]);

  const leave = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    socketRef.current?.emit(SocketEvent.MeetingLeave, { meetingId: meeting?.id });
    teardown();
    setStatus('left');
  }, [meeting, teardown]);

  const self = participants.find((participant) => participant.id === selfId) ?? null;
  const others = participants.filter(
    (participant) => participant.id !== selfId && participant.isOnline,
  );

  return {
    status,
    error,
    endedReason,
    meeting,
    self,
    participants,
    others,
    remoteStreams,
    localStream,
    messages,
    audioEnabled,
    videoEnabled,
    screenSharing,
    handRaised,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    toggleHand,
    sendChatMessage,
    muteParticipant,
    removeParticipant,
    endForAll,
    leave,
  };
}
