import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SocketEvent, formatChatTimestamp } from '@vcs/shared';
import { chatApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Avatar, EmptyState, PageLoader } from '@/components/ui';
import { SendIcon } from '@/components/icons';

/** Screen 10: the conversation list beside the open thread. */
export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [conversations, setConversations] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const page = await chatApi.conversations({ limit: 50 });
      setConversations(page.items);
      // Open the newest thread by default on wide screens.
      if (!conversationId && page.items.length > 0) {
        navigate(`/app/chat/${page.items[0].id}`, { replace: true });
      }
    } catch (error) {
      toast.error(error.message);
      setConversations([]);
    }
  }, [conversationId, navigate, toast]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;
    setLoadingThread(true);

    chatApi
      .messages(conversationId, { limit: 60 })
      .then((page) => {
        if (cancelled) return;
        setMessages(page.items);
        return chatApi.markRead(conversationId);
      })
      .catch((error) => !cancelled && toast.error(error.message))
      .finally(() => !cancelled && setLoadingThread(false));

    return () => {
      cancelled = true;
    };
  }, [conversationId, toast]);

  // Live messages arrive on the socket the app already holds open.
  useEffect(() => {
    const socket = getSocket();
    const handler = ({ message }) => {
      if (message.conversationId !== conversationId) {
        loadConversations();
        return;
      }
      setMessages((current) =>
        current.some((entry) => entry.id === message.id) ? current : [...current, message],
      );
    };

    socket.on(SocketEvent.ChatMessage, handler);
    return () => socket.off(SocketEvent.ChatMessage, handler);
  }, [conversationId, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !conversationId) return;

    setDraft('');
    try {
      const message = await chatApi.send(conversationId, { body });
      setMessages((current) =>
        current.some((entry) => entry.id === message.id) ? current : [...current, message],
      );
      loadConversations();
    } catch (error) {
      toast.error(error.message);
      setDraft(body);
    }
  };

  const active = conversations?.find((conversation) => conversation.id === conversationId);

  return (
    <div className="flex h-full">
      {/* The list collapses away once a thread is open on small screens. */}
      <aside
        className={`w-full shrink-0 overflow-y-auto border-r border-slate-200 bg-white sm:w-80 ${
          conversationId ? 'hidden sm:block' : ''
        }`}
      >
        <h1 className="px-5 py-5 text-2xl font-extrabold text-slate-900">Chat</h1>

        {conversations === null ? (
          <PageLoader label="Loading chats" />
        ) : conversations.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            No conversations yet. Start one from the Contacts screen.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/chat/${conversation.id}`)}
                  className={`flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 ${
                    conversation.id === conversationId ? 'bg-brand-50/70' : ''
                  }`}
                >
                  <Avatar name={conversation.title} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-slate-900">
                        {conversation.title}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatChatTimestamp(conversation.updatedAt)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm text-slate-500">
                        {conversation.lastMessage?.body ?? 'No messages yet'}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className={`flex min-w-0 flex-1 flex-col ${conversationId ? '' : 'hidden sm:flex'}`}>
        {!conversationId ? (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState title="Pick a conversation" description="Your messages will show up here." />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-4">
              <button
                type="button"
                className="text-sm font-semibold text-brand-600 sm:hidden"
                onClick={() => navigate('/app/chat')}
              >
                Back
              </button>
              <Avatar name={active?.title} size="sm" />
              <h2 className="truncate font-bold text-slate-900">{active?.title ?? 'Conversation'}</h2>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-5">
              {loadingThread ? (
                <PageLoader label="Loading messages" />
              ) : (
                messages.map((message) => {
                  const mine = message.sender?.id === user?.id;
                  return (
                    <div key={message.id} className={mine ? 'text-right' : ''}>
                      {!mine && (
                        <div className="mb-1 flex items-center gap-2">
                          <Avatar user={message.sender} name={message.sender?.name} size="xs" />
                          <span className="text-xs font-semibold text-slate-600">
                            {message.sender?.name ?? 'Someone'}
                          </span>
                        </div>
                      )}
                      <p
                        className={`inline-block max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm ${
                          mine ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 shadow-sm'
                        }`}
                      >
                        {message.body}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatChatTimestamp(message.createdAt)}
                      </p>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-200 bg-white p-4">
              <input
                className="field"
                placeholder="Type a message…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="rounded-xl bg-brand-600 p-3 text-white transition hover:bg-brand-700 disabled:bg-brand-200"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
