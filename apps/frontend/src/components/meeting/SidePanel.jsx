import { useEffect, useRef, useState } from 'react';
import { MeetingRole, formatChatTimestamp } from '@vcs/shared';
import { Avatar } from '@/components/ui';
import { MicIcon, MicOffIcon, SendIcon, VideoIcon, VideoOffIcon } from '@/components/icons';

function PanelShell({ title, onClose, children, footer }) {
  return (
    <aside className="flex h-full w-full flex-col bg-white lg:w-80 lg:rounded-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          aria-label={`Close ${title}`}
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.3 6.3a1 1 0 011.4 0L10 8.6l2.3-2.3a1 1 0 111.4 1.4L11.4 10l2.3 2.3a1 1 0 01-1.4 1.4L10 11.4l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 10 6.3 7.7a1 1 0 010-1.4z" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer}
    </aside>
  );
}

/** The chat panel docked beside the stage on screen 6. */
export function ChatPanel({ messages, currentUserId, onSend, onClose, disabled }) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const submit = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft('');
  };

  return (
    <PanelShell
      title="Chat"
      onClose={onClose}
      footer={
        <form onSubmit={submit} className="flex items-center gap-2 border-t border-slate-100 p-3">
          <input
            className="field py-2.5"
            placeholder={disabled ? 'Sign in to chat' : 'Type a message…'}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={disabled}
          />
          <button
            type="submit"
            disabled={disabled || !draft.trim()}
            className="rounded-xl bg-brand-600 p-2.5 text-white transition hover:bg-brand-700 disabled:bg-brand-200"
            aria-label="Send message"
          >
            <SendIcon className="h-5 w-5" />
          </button>
        </form>
      }
    >
      <div className="space-y-4 p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">No messages yet.</p>
        )}

        {messages.map((message) => {
          const mine = message.sender?.id === currentUserId;
          return (
            <div key={message.id} className={mine ? 'text-right' : ''}>
              {!mine && (
                <div className="mb-1 flex items-center gap-2">
                  <Avatar user={message.sender} name={message.sender?.name} size="xs" />
                  <span className="text-xs font-semibold text-slate-700">
                    {message.sender?.name ?? 'Someone'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatChatTimestamp(message.createdAt)}
                  </span>
                </div>
              )}
              <p
                className={`inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-left text-sm ${
                  mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {message.body}
              </p>
              {mine && (
                <p className="mt-1 text-xs text-slate-400">
                  {formatChatTimestamp(message.createdAt)}
                </p>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </PanelShell>
  );
}

/** Screen 13: the participant list with host controls. */
export function ParticipantsPanel({ participants, selfId, canManage, onMute, onRemove, onClose }) {
  const online = participants.filter((participant) => participant.isOnline);

  return (
    <PanelShell title={`Participants (${online.length})`} onClose={onClose}>
      <ul className="divide-y divide-slate-100">
        {online.map((participant) => {
          const isSelf = participant.id === selfId;
          const isHost = participant.role === MeetingRole.Host;

          return (
            <li key={participant.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar user={participant.user} name={participant.displayName} size="sm" />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">
                  {participant.displayName}
                  {isSelf && ' (You)'}
                </span>
                {(isHost || participant.role === MeetingRole.CoHost) && (
                  <span className="text-xs text-slate-500">
                    {isHost ? 'Host' : 'Co-host'}
                  </span>
                )}
              </span>

              <span className="flex items-center gap-2 text-slate-400">
                {participant.media?.audioEnabled ? (
                  <MicIcon className="h-4 w-4 text-emerald-500" />
                ) : (
                  <MicOffIcon className="h-4 w-4 text-red-500" />
                )}
                {participant.media?.videoEnabled ? (
                  <VideoIcon className="h-4 w-4" />
                ) : (
                  <VideoOffIcon className="h-4 w-4" />
                )}
              </span>

              {canManage && !isSelf && !isHost && (
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onMute(participant.id)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Mute
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(participant.id)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
}
