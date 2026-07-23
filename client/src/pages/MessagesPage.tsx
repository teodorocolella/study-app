import {
  Check,
  FileText,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type {
  ClassFolder,
  Conversation,
  ImportResult,
  Message,
  MessagePartner,
  MessageThread,
} from "../api/types";
import { AppShell } from "../components/layout/AppShell";
import { Avatar } from "../components/layout/Avatar";
import { useAuth } from "../hooks/useAuth";

export function MessagesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const activeUserId = searchParams.get("with");

  const loadConversations = useCallback(async () => {
    const data = await api.get<Conversation[]>("/messages/conversations");
    setConversations(data);
  }, []);

  const loadThread = useCallback(async (userId: string) => {
    const data = await api.get<MessageThread>(`/messages/with/${userId}`);
    setThread(data);
  }, []);

  useEffect(() => {
    loadConversations().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Failed to load messages"),
    );
  }, [loadConversations]);

  useEffect(() => {
    if (!activeUserId) {
      setThread(null);
      return;
    }
    loadThread(activeUserId).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Failed to load conversation"),
    );
  }, [activeUserId, loadThread]);

  function openThread(userId: string) {
    setComposing(false);
    setSearchParams({ with: userId });
    setConversations((prev) =>
      prev.map((c) => (c.partner.id === userId ? { ...c, unreadCount: 0 } : c)),
    );
  }

  async function handleSent(partner: MessagePartner) {
    setComposing(false);
    await loadConversations();
    setSearchParams({ with: partner.id });
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display flex items-center gap-2 text-2xl font-semibold text-slate-800">
          <MessageSquare className="h-5.5 w-5.5 text-violet-500" />
          Messages
        </h1>
        <button
          onClick={() => {
            setComposing(true);
            setSearchParams({});
          }}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          New message
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {conversations.length === 0 && !composing && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              No conversations yet. Message a classmate by their Study Hub email to share
              notes and flashcard decks.
            </div>
          )}
          {conversations.map((c) => (
            <button
              key={c.partner.id}
              onClick={() => openThread(c.partner.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                activeUserId === c.partner.id
                  ? "border-violet-300 bg-violet-50"
                  : "border-slate-200 bg-white hover:border-violet-200"
              }`}
            >
              <Avatar displayName={c.partner.displayName} avatarUrl={c.partner.avatarUrl} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-700">
                  {c.partner.displayName}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {c.lastMessage.body ??
                    (c.lastMessage.attachment?.type === "deck" ? "Shared a deck" : "Shared a note")}
                </span>
              </span>
              {c.unreadCount > 0 && (
                <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {c.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {composing ? (
            <ComposePanel onSent={(partner) => void handleSent(partner)} onCancel={() => setComposing(false)} />
          ) : thread ? (
            <ThreadPanel
              thread={thread}
              myUserId={user?.id ?? ""}
              onMessageSent={() => void loadThread(thread.partner.id)}
            />
          ) : (
            <div className="flex h-72 items-center justify-center p-6 text-sm text-slate-400">
              Select a conversation, or start a new one.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ComposePanel({
  onSent,
  onCancel,
}: {
  onSent: (partner: MessagePartner) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const sent = await api.post<Message & { recipient: MessagePartner }>("/messages", {
        recipientEmail: email.trim(),
        body: body.trim(),
      });
      onSent(sent.recipient);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">New message</p>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        type="email"
        placeholder="Classmate's Study Hub email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
      />
      <textarea
        placeholder="Write a message…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={sending || !email.trim() || !body.trim()}
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send
      </button>
    </form>
  );
}

function ThreadPanel({
  thread,
  myUserId,
  onMessageSent,
}: {
  thread: MessageThread;
  myUserId: string;
  onMessageSent: () => void;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await api.post("/messages", { recipientEmail: thread.partner.email, body });
      setInput("");
      onMessageSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[min(560px,70vh)] flex-col">
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3">
        <Avatar displayName={thread.partner.displayName} avatarUrl={thread.partner.avatarUrl} size={30} />
        <div>
          <p className="text-sm font-semibold text-slate-700">{thread.partner.displayName}</p>
          <p className="text-xs text-slate-400">{thread.partner.email}</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {thread.messages.map((m) => (
          <MessageBubble key={m.id} message={m} mine={m.senderId === myUserId} />
        ))}
      </div>

      {error && <p className="px-4 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${thread.partner.displayName}…`}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="flex items-center rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-white shadow-sm disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <div className={mine ? "text-right" : "text-left"}>
      {message.body && (
        <span
          className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-sm ${
            mine
              ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {message.body}
        </span>
      )}
      {message.attachment && (
        <AttachmentCard messageId={message.id} attachment={message.attachment} mine={mine} />
      )}
    </div>
  );
}

function AttachmentCard({
  messageId,
  attachment,
  mine,
}: {
  messageId: string;
  attachment: NonNullable<Message["attachment"]>;
  mine: boolean;
}) {
  const [classes, setClasses] = useState<ClassFolder[] | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDeck = attachment.type === "deck";
  const title = isDeck ? attachment.name : attachment.title;
  const subtitle = isDeck
    ? `Flashcard deck · ${attachment.cards.length} card${attachment.cards.length === 1 ? "" : "s"}`
    : "Note";
  const Icon = isDeck ? Layers : FileText;

  async function startSave() {
    if (classes) return;
    try {
      const list = await api.get<ClassFolder[]>("/classes");
      setClasses(list);
      if (list.length > 0) setSelectedClassId(list[0].id);
    } catch {
      setError("Couldn't load your classes");
    }
  }

  async function handleSave() {
    if (!selectedClassId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.post<ImportResult>(`/messages/${messageId}/import`, {
        classId: selectedClassId,
      });
      setSaved(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`mt-1.5 inline-block max-w-[85%] rounded-xl border p-3 text-left ${
        mine ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
          <Icon className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-medium text-slate-700">{title}</span>
          <span className="block text-xs text-slate-400">{subtitle}</span>
        </span>
      </div>

      {!mine && !saved && (
        <div className="mt-2.5">
          {classes === null ? (
            <button
              onClick={() => void startSave()}
              className="rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
            >
              Save to my classes
            </button>
          ) : classes.length === 0 ? (
            <p className="text-xs text-slate-500">Create a class first, then save this here.</p>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {saved && (
        <Link
          to={
            saved.type === "deck"
              ? `/decks/${saved.deckId}`
              : `/classes/${saved.classId}/notes/${saved.noteId}`
          }
          className="mt-2.5 flex w-fit items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          <Check className="h-3 w-3" />
          Saved — open it
        </Link>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
