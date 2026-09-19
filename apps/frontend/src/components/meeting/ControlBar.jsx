import { useState } from 'react';
import { MeetingLayout } from '@vcs/shared';
import {
  ChatIcon,
  HandIcon,
  MicIcon,
  MicOffIcon,
  MoreIcon,
  ScreenIcon,
  UsersIcon,
  VideoIcon,
  VideoOffIcon,
} from '@/components/icons';

function ControlButton({ icon: Icon, label, active, danger, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition hover:bg-white/10"
    >
      <span className="relative">
        <Icon
          className={`h-6 w-6 ${
            danger ? 'text-red-400' : active ? 'text-emerald-400' : 'text-white'
          }`}
        />
        {badge > 0 && (
          <span className="absolute -right-2 -top-1 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="text-[11px] font-medium text-white/80">{label}</span>
    </button>
  );
}

/** The bar along the bottom of screens 6, 7 and 8. */
export default function ControlBar({
  audioEnabled,
  videoEnabled,
  screenSharing,
  handRaised,
  layout,
  unreadChat,
  participantCount,
  canEndForAll,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHand,
  onToggleChat,
  onToggleParticipants,
  onChangeLayout,
  onLeave,
  onEndForAll,
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-1 bg-navy-950 px-3 py-2 sm:px-6 sm:py-3">
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        <ControlButton
          icon={audioEnabled ? MicIcon : MicOffIcon}
          label={audioEnabled ? 'Mute' : 'Unmute'}
          danger={!audioEnabled}
          onClick={onToggleAudio}
        />
        <ControlButton
          icon={videoEnabled ? VideoIcon : VideoOffIcon}
          label={videoEnabled ? 'Stop Video' : 'Start Video'}
          danger={!videoEnabled}
          onClick={onToggleVideo}
        />
        <ControlButton
          icon={ScreenIcon}
          label={screenSharing ? 'Stop Share' : 'Share'}
          active={screenSharing}
          onClick={onToggleScreenShare}
        />
        <ControlButton
          icon={UsersIcon}
          label="Participants"
          badge={participantCount}
          onClick={onToggleParticipants}
        />
        <ControlButton
          icon={ChatIcon}
          label="Chat"
          badge={unreadChat}
          onClick={onToggleChat}
        />
        <ControlButton
          icon={HandIcon}
          label={handRaised ? 'Lower Hand' : 'Raise Hand'}
          active={handRaised}
          onClick={onToggleHand}
        />

        <div className="relative">
          <ControlButton icon={MoreIcon} label="More" onClick={() => setMoreOpen((o) => !o)} />
          {moreOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMoreOpen(false)}
              />
              <div className="absolute bottom-full z-20 mb-2 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-card">
                <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Layout
                </p>
                {[
                  { value: MeetingLayout.Gallery, label: 'Gallery view' },
                  { value: MeetingLayout.Speaker, label: 'Speaker view' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChangeLayout(option.value);
                      setMoreOpen(false);
                    }}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 ${
                      layout === option.value ? 'font-semibold text-brand-700' : 'text-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}

                {canEndForAll && (
                  <>
                    <hr className="my-1 border-slate-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        onEndForAll();
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      End meeting for all
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onLeave}
        className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
      >
        Leave
      </button>
    </div>
  );
}
