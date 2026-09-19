import { SocketEvent } from '@vcs/shared';

/**
 * A full-mesh WebRTC manager: one RTCPeerConnection per remote participant.
 *
 * Two rules keep the negotiation simple enough to reason about:
 *
 *  1. Only the *joining* peer creates an offer. The server tells a joiner
 *     exactly who is already in the room (`meeting:joined` -> peers), and tells
 *     everyone else about the newcomer. So for any pair, exactly one side
 *     offers and there is no glare to resolve.
 *  2. The audio and video senders are created once, from the local stream, and
 *     never added or removed afterwards. Muting flips `track.enabled` and screen
 *     sharing calls `replaceTrack`, so nothing needs renegotiating mid-call.
 */
export class PeerMesh {
  constructor({ socket, iceServers, onRemoteStream, onPeerLeft, onConnectionState }) {
    this.socket = socket;
    this.iceServers = iceServers ?? [];
    this.onRemoteStream = onRemoteStream ?? (() => {});
    this.onPeerLeft = onPeerLeft ?? (() => {});
    this.onConnectionState = onConnectionState ?? (() => {});

    /** socketId -> { pc, pendingCandidates } */
    this.peers = new Map();
    this.localStream = null;
    this.bound = [];
  }

  setLocalStream(stream) {
    this.localStream = stream;
  }

  /** Subscribes to the signaling events. Call once, after the socket is joined. */
  listen() {
    const on = (event, handler) => {
      this.socket.on(event, handler);
      this.bound.push([event, handler]);
    };

    on(SocketEvent.RtcOffer, (payload) => {
      this.handleOffer(payload).catch((error) => this.warn('offer', error));
    });
    on(SocketEvent.RtcAnswer, (payload) => {
      this.handleAnswer(payload).catch((error) => this.warn('answer', error));
    });
    on(SocketEvent.RtcCandidate, (payload) => {
      this.handleCandidate(payload).catch((error) => this.warn('candidate', error));
    });
  }

  warn(what, error) {
    // A single failed peer must not take the whole call down.
    console.warn(`[webrtc] failed to handle ${what}:`, error);
  }

  createPeer(socketId) {
    const existing = this.peers.get(socketId);
    if (existing) return existing.pc;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const entry = { pc, pendingCandidates: [] };
    this.peers.set(socketId, entry);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) this.onRemoteStream(socketId, stream);
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      this.socket.emit(SocketEvent.RtcCandidate, {
        targetSocketId: socketId,
        candidate: event.candidate.toJSON(),
      });
    };

    pc.onconnectionstatechange = () => {
      this.onConnectionState(socketId, pc.connectionState);
      if (pc.connectionState === 'failed') {
        // ICE can recover; a restart is cheaper than rebuilding the tile.
        pc.restartIce?.();
      }
    };

    return pc;
  }

  /** Called for each peer already in the room when we join. */
  async callPeer(socketId) {
    const pc = this.createPeer(socketId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.socket.emit(SocketEvent.RtcOffer, {
      targetSocketId: socketId,
      description: { type: 'offer', sdp: pc.localDescription.sdp },
    });
  }

  async handleOffer({ fromSocketId, description }) {
    const pc = this.createPeer(fromSocketId);
    await pc.setRemoteDescription(description);
    await this.drainCandidates(fromSocketId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.socket.emit(SocketEvent.RtcAnswer, {
      targetSocketId: fromSocketId,
      description: { type: 'answer', sdp: pc.localDescription.sdp },
    });
  }

  async handleAnswer({ fromSocketId, description }) {
    const entry = this.peers.get(fromSocketId);
    if (!entry) return;
    await entry.pc.setRemoteDescription(description);
    await this.drainCandidates(fromSocketId);
  }

  async handleCandidate({ fromSocketId, candidate }) {
    const entry = this.peers.get(fromSocketId);
    if (!entry) return;

    // Candidates can arrive before the description they belong to.
    if (!entry.pc.remoteDescription) {
      entry.pendingCandidates.push(candidate);
      return;
    }
    await entry.pc.addIceCandidate(candidate);
  }

  async drainCandidates(socketId) {
    const entry = this.peers.get(socketId);
    if (!entry) return;

    const queued = entry.pendingCandidates;
    entry.pendingCandidates = [];
    for (const candidate of queued) {
      await entry.pc.addIceCandidate(candidate).catch((error) => this.warn('candidate', error));
    }
  }

  /** Swaps what the camera sender publishes, for screen share on and off. */
  async replaceVideoTrack(track) {
    await Promise.all(
      [...this.peers.values()].map(async ({ pc }) => {
        const sender = pc.getSenders().find((candidate) => candidate.track?.kind === 'video');
        if (sender) await sender.replaceTrack(track);
      }),
    );
  }

  closePeer(socketId) {
    const entry = this.peers.get(socketId);
    if (!entry) return;

    entry.pc.ontrack = null;
    entry.pc.onicecandidate = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.close();

    this.peers.delete(socketId);
    this.onPeerLeft(socketId);
  }

  destroy() {
    for (const [event, handler] of this.bound) this.socket.off(event, handler);
    this.bound = [];

    for (const socketId of [...this.peers.keys()]) this.closePeer(socketId);
  }
}

/** Asks for camera and microphone, falling back to audio only. */
export async function requestUserMedia({ audio = true, video = true } = {}) {
  const constraints = {
    audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
    video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    if (video) {
      // A missing or busy camera should not stop someone joining by audio.
      console.warn('[webrtc] camera unavailable, falling back to audio only', error);
      return navigator.mediaDevices.getUserMedia({ ...constraints, video: false });
    }
    throw error;
  }
}

export function requestDisplayMedia() {
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 15, max: 30 } },
    audio: false,
  });
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
