import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { MeetingLayout, MeetingRole, formatDuration, formatMeetingId } from '@vcs/shared';
import { useAuth } from '@/context/AuthContext';
import { useMeetingRoom } from '@/hooks/useMeetingRoom';
import { Button, Spinner } from '@/components/ui';
import { CopyIcon } from '@/components/icons';
import Stage from '@/components/meeting/Stage';
import ControlBar from '@/components/meeting/ControlBar';
import { ChatPanel, ParticipantsPanel } from '@/components/meeting/SidePanel';

function Notice({ title, description, children }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-navy-950 px-6 text-center text-white">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="mt-2 max-w-md text-white/70">{description}</p>}
      <div className="mt-8 flex gap-3">{children}</div>
    </div>
  );
}

/** Screens 6, 7, 8 and 13: the meeting itself. */
export default function MeetingRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const options = location.state ?? {};
  const room = useMeetingRoom(code, options);

  const [layout, setLayout] = useState(MeetingLayout.Gallery);
  const [panel, setPanel] = useState(null);
  const [readCount, setReadCount] = useState(0);
  const [elapsed, setElapsed] = useState('00:00:00');

  const startedAt = room.meeting?.startedAt;
  useEffect(() => {
    if (!startedAt) return undefined;
    const tick = () => setElapsed(formatDuration(startedAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  // Messages read while the panel is open should not count as unread.
  useEffect(() => {
    if (panel === 'chat') setReadCount(room.messages.length);
  }, [panel, room.messages.length]);

  const isHost = room.self?.role === MeetingRole.Host || room.self?.role === MeetingRole.CoHost;

  const tiles = useMemo(() => {
    const list = [];

    if (room.self) {
      list.push({
        key: 'self',
        participant: {
          ...room.self,
          media: {
            ...room.self.media,
            audioEnabled: room.audioEnabled,
            videoEnabled: room.videoEnabled || room.screenSharing,
            screenSharing: room.screenSharing,
            handRaised: room.handRaised,
          },
        },
        stream: room.localStream,
        isSelf: true,
        mirrored: !room.screenSharing,
      });
    }

    for (const participant of room.others) {
      list.push({
        key: participant.id,
        participant,
        stream: participant.socketId ? room.remoteStreams.get(participant.socketId) : undefined,
      });
    }

    return list;
  }, [room]);

  // Whoever is sharing takes the stage, otherwise the chosen layout wins.
  const sharingTile = tiles.find((tile) => tile.participant?.media?.screenSharing);
  const effectiveLayout = sharingTile ? 'screen' : layout;
  const spotlight =
    sharingTile ?? (layout === MeetingLayout.Speaker ? (tiles[1] ?? tiles[0]) : null);

  if (room.status === 'joining') {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-navy-950 text-white">
        <Spinner className="h-8 w-8" />
        <p className="mt-4 text-sm text-white/70">Connecting to the meeting…</p>
      </div>
    );
  }

  if (room.status === 'error') {
    return (
      <Notice title="Could not join" description={room.error}>
        <Button onClick={() => navigate('/join')}>Try another ID</Button>
        <Button variant="outline" onClick={() => navigate(user ? '/app' : '/')}>
          Go back
        </Button>
      </Notice>
    );
  }

  if (room.status === 'ended' || room.status === 'left') {
    return (
      <Notice
        title={room.status === 'left' ? 'You left the meeting' : 'The meeting has ended'}
        description={
          room.endedReason === 'host_ended' ? 'The host ended this meeting for everyone.' : undefined
        }
      >
        <Button onClick={() => navigate(user ? '/app' : '/')}>
          {user ? 'Back to home' : 'Back to start'}
        </Button>
        {user && (
          <Button variant="outline" onClick={() => navigate('/app/meetings')}>
            My meetings
          </Button>
        )}
      </Notice>
    );
  }

  return (
    <div className="flex h-full flex-col bg-navy-950">
      <header className="flex items-center gap-3 px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold sm:text-base">
            {room.meeting?.title ?? 'Meeting'}
          </h1>
          <p className="flex items-center gap-2 text-xs text-white/60">
            ID {formatMeetingId(room.meeting?.meetingId ?? code)}
            <button
              type="button"
              aria-label="Copy invite link"
              onClick={() => navigator.clipboard?.writeText(room.meeting?.joinUrl ?? '')}
              className="rounded p-0.5 hover:bg-white/10"
            >
              <CopyIcon className="h-3.5 w-3.5" />
            </button>
            <span>· {elapsed}</span>
          </p>
        </div>

        {room.screenSharing && (
          <span className="ml-auto rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold">
            You are sharing your screen
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <Stage layout={effectiveLayout} tiles={tiles} spotlight={spotlight} />
        </div>

        {panel === 'chat' && (
          <div className="fixed inset-0 z-30 lg:static lg:z-auto">
            <ChatPanel
              messages={room.messages}
              currentUserId={user?.id}
              disabled={!user}
              onSend={room.sendChatMessage}
              onClose={() => setPanel(null)}
            />
          </div>
        )}

        {panel === 'participants' && (
          <div className="fixed inset-0 z-30 lg:static lg:z-auto">
            <ParticipantsPanel
              participants={room.participants}
              selfId={room.self?.id}
              canManage={isHost}
              onMute={room.muteParticipant}
              onRemove={room.removeParticipant}
              onClose={() => setPanel(null)}
            />
          </div>
        )}
      </div>

      <ControlBar
        audioEnabled={room.audioEnabled}
        videoEnabled={room.videoEnabled}
        screenSharing={room.screenSharing}
        handRaised={room.handRaised}
        layout={layout}
        unreadChat={Math.max(0, room.messages.length - readCount)}
        participantCount={room.participants.filter((participant) => participant.isOnline).length}
        canEndForAll={isHost}
        onToggleAudio={room.toggleAudio}
        onToggleVideo={room.toggleVideo}
        onToggleScreenShare={room.toggleScreenShare}
        onToggleHand={room.toggleHand}
        onToggleChat={() => setPanel((current) => (current === 'chat' ? null : 'chat'))}
        onToggleParticipants={() =>
          setPanel((current) => (current === 'participants' ? null : 'participants'))
        }
        onChangeLayout={setLayout}
        onLeave={room.leave}
        onEndForAll={room.endForAll}
      />

      {!user && (
        <p className="bg-navy-900 px-4 py-2 text-center text-xs text-white/60">
          You joined as a guest.{' '}
          <Link to="/signin" className="font-semibold text-brand-300">
            Sign in
          </Link>{' '}
          to use chat and keep your meeting history.
        </p>
      )}
    </div>
  );
}
