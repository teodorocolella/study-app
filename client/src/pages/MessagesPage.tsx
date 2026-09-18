import {
  BrainCircuit,
  Check,
  FileText,
  Layers,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
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
import { UserPicker } from "../components/messaging/UserPicker";
import { useAuth } from "../hooks/useAuth";
import { useTypingUsers } from "../hooks/useTypingUsers";

type LiveEvent =
  | { type: "message"; message: Message }
  | { type: "message-updated"; message: Message }
  | { type: "typing"; userId: string; name: string };

const TYPING_THROTTLE_MS = 2000;

// Add a new message, or replace an existing one (edits/unsends arrive by id).
function applyMessage(prev: Message[], msg: Message): Message[] {
  return prev.some((m) => m.id === msg.id)
    ? prev.map((m) => (m.id === msg.id ? msg : m))
    : [...prev, msg];
}

/** Short preview of a conversation's last message for the sidebar list. */
function previewText(m: Message): string {
  if (m.deleted) return "Unsent a message";
  if (m.body) return m.body;
  if (m.attachment?.type === "deck") return "Shared a deck";
  if (m.attachment?.type === "exercise_set") return "Shared a quiz";
  return "Shared a note";
}

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
        <h1 className="font-display flex items-center gap-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
          <MessageSquare className="h-5.5 w-5.5 text-violet-500" />
          Direct messages
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
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-sm text-slate-500 dark:text-slate-400">
              No conversations yet. Message a classmate by name to share notes, flashcard
              decks, and quizzes.
            </div>
          )}
          {conversations.map((c) => (
            <button
              key={c.partner.id}
              onClick={() => openThread(c.partner.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                activeUserId === c.partner.id
                  ? "border-violet-300 bg-violet-50"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-200"
              }`}
            >
              <Avatar displayName={c.partner.displayName} avatarUrl={c.partner.avatarUrl} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {c.partner.displayName}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {previewText(c.lastMessage)}
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

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          {composing ? (
            <ComposePanel onSent={(partner) => void handleSent(partner)} onCancel={() => setComposing(false)} />
          ) : thread ? (
            <ThreadPanel
              key={thread.partner.id}
              thread={thread}
              myUserId={user?.id ?? ""}
              onConversationsChanged={() => void loadConversations()}
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
  const [recipient, setRecipient] = useState<MessagePartner | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!recipient || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const sent = await api.post<Message & { recipient: MessagePartner }>("/messages", {
        recipientId: recipient.id,
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
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">New message</p>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <UserPicker selected={recipient} onSelect={setRecipient} autoFocus />
      <textarea
        placeholder="Write a message…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={sending || !recipient || !body.trim()}
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
  onConversationsChanged,
}: {
  thread: MessageThread;
  myUserId: string;
  onConversationsChanged: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>(thread.messages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastTypingSentRef = useRef(0);
  const { typing, markTyping } = useTypingUsers();

  // Live updates: new messages and typing for this conversation.
  useEffect(() => {
    const close = api.liveStream(`/messages/stream/${thread.partner.id}`, (raw) => {
      const event = raw as LiveEvent;
      if (event.type === "message" || event.type === "message-updated") {
        setMessages((prev) => applyMessage(prev, event.message));
        onConversationsChanged();
        if (event.type === "message" && event.message.senderId !== myUserId) {
          void api.post(`/messages/with/${thread.partner.id}/read`).catch(() => {});
        }
      } else if (event.type === "typing" && event.userId !== myUserId) {
        markTyping(event.userId, event.name);
      }
    });
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.partner.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const sent = await api.post<Message>("/messages", { recipientId: thread.partner.id, body });
      setMessages((prev) => applyMessage(prev, sent));
      setInput("");
      onConversationsChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function handleInputChange(value: string) {
    setInput(value);
    if (!value.trim()) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    void api.post("/messages/typing", { recipientId: thread.partner.id }).catch(() => {});
  }

  return (
    <div className="flex h-[min(560px,70vh)] flex-col">
      <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <Avatar displayName={thread.partner.displayName} avatarUrl={thread.partner.avatarUrl} size={30} />
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{thread.partner.displayName}</p>
          <p className="text-xs text-slate-400">{thread.partner.email}</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            mine={m.senderId === myUserId}
            onChanged={(updated) => {
              setMessages((prev) => applyMessage(prev, updated));
              onConversationsChanged();
            }}
          />
        ))}
      </div>

      {Object.keys(typing).length > 0 && (
        <p className="px-4 pb-1 text-xs italic text-slate-400">{thread.partner.displayName} is typing…</p>
      )}

      {error && <p className="px-4 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 dark:border-slate-700 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={`Message ${thread.partner.displayName}…`}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
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

function MessageBubble({
  message,
  mine,
  onChanged,
}: {
  message: Message;
  mine: boolean;
  onChanged: (updated: Message) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body ?? "");
  const [busy, setBusy] = useState(false);

  // Unsent message: a small neutral tombstone, no actions.
  if (message.deleted) {
    return (
      <div className={mine ? "text-right" : "text-left"}>
        <span className="inline-block rounded-2xl bg-slate-100 px-3.5 py-2 text-sm italic text-slate-400 dark:bg-slate-700/50">
          {mine ? "You unsent a message" : "This message was unsent"}
        </span>
      </div>
    );
  }

  async function saveEdit() {
    const body = draft.trim();
    if (!body || body === message.body) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const updated = await api.patch<Message>(`/messages/${message.id}`, { body });
      onChanged(updated);
      setEditing(false);
    } catch {
      // keep the editor open on failure
    } finally {
      setBusy(false);
    }
  }

  async function unsend() {
    if (!confirm("Unsend this message? It'll be removed for both of you.")) return;
    setBusy(true);
    try {
      const updated = await api.delete<Message>(`/messages/${message.id}`);
      onChanged(updated);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  const canEdit = mine && !!message.body; // only text messages are editable

  return (
    <div className={`group ${mine ? "text-right" : "text-left"}`}>
      {editing ? (
        <div className="inline-flex w-full max-w-[85%] flex-col gap-1.5">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-left text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:bg-slate-900"
          />
          <div className="flex justify-end gap-2 text-xs">
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
              Cancel
            </button>
            <button
              onClick={() => void saveEdit()}
              disabled={busy}
              className="font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        message.body && (
          <div className={`flex items-center gap-1.5 ${mine ? "flex-row-reverse" : "flex-row"}`}>
            <span
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-sm ${
                mine
                  ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              {message.body}
              {message.editedAt && <span className="ml-1.5 text-[10px] opacity-70">(edited)</span>}
            </span>
            {mine && (
              <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {canEdit && (
                  <button
                    onClick={() => {
                      setDraft(message.body ?? "");
                      setEditing(true);
                    }}
                    disabled={busy}
                    title="Edit"
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => void unsend()}
                  disabled={busy}
                  title="Unsend"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
        )
      )}
      {message.attachment && (
        <div className={`flex ${mine ? "flex-row-reverse" : "flex-row"} items-start gap-1.5`}>
          <AttachmentCard messageId={message.id} attachment={message.attachment} mine={mine} />
          {mine && (
            <button
              onClick={() => void unsend()}
              disabled={busy}
              title="Unsend"
              className="mt-2 shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-slate-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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

  const title = attachment.type === "note" ? attachment.title : attachment.name;
  const subtitle =
    attachment.type === "deck"
      ? `Flashcard deck · ${attachment.cards.length} card${attachment.cards.length === 1 ? "" : "s"}`
      : attachment.type === "exercise_set"
        ? `Quiz · ${attachment.exercises.length} question${attachment.exercises.length === 1 ? "" : "s"}`
        : "Note";
  const Icon =
    attachment.type === "deck" ? Layers : attachment.type === "exercise_set" ? BrainCircuit : FileText;

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
        mine
          ? "border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
          <Icon className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">{title}</span>
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
            <p className="text-xs text-slate-500 dark:text-slate-400">Create a class first, then save this here.</p>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs"
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
              : saved.type === "exercise_set"
                ? `/practice/${saved.setId}`
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
