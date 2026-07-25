import {
  ArrowLeft,
  BrainCircuit,
  Check,
  FileText,
  Layers,
  Loader2,
  LogOut,
  Paperclip,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { ClassFolder, GroupAttachment, GroupDetail, GroupMessageDto } from "../api/types";
import { ResourcePicker, type PickedResource } from "../components/groups/ResourcePicker";
import { AppShell } from "../components/layout/AppShell";
import { Avatar } from "../components/layout/Avatar";
import { useAuth } from "../hooks/useAuth";

export function GroupChatPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [messages, setMessages] = useState<GroupMessageDto[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    if (!groupId) return;
    const data = await api.get<GroupMessageDto[]>(`/groups/${groupId}/messages`);
    setMessages(data);
  }, [groupId]);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    const data = await api.get<GroupDetail>(`/groups/${groupId}`);
    setGroup(data);
  }, [groupId]);

  useEffect(() => {
    loadGroup().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load group"));
  }, [loadGroup]);

  useEffect(() => {
    loadMessages().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load messages"));
    // Light polling so group chat feels live.
    const t = setInterval(() => void loadMessages().catch(() => {}), 8000);
    return () => clearInterval(t);
  }, [loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send(body: string, attachment?: PickedResource) {
    if (!groupId) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/groups/${groupId}/messages`, { body: body || undefined, attachment });
      setInput("");
      await loadMessages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    void send(input.trim());
  }

  async function handleLeave() {
    if (!groupId || !confirm("Leave this group?")) return;
    await api.delete(`/groups/${groupId}/members/me`);
    navigate("/groups");
  }

  return (
    <AppShell>
      <Link
        to="/groups"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-violet-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All groups
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-800">{group?.name}</h1>
          {group && (
            <div className="mt-1 flex items-center gap-1.5">
              {group.members.slice(0, 6).map((m) => (
                <span key={m.id} title={m.displayName}>
                  <Avatar displayName={m.displayName} avatarUrl={m.avatarUrl} size={24} />
                </span>
              ))}
              <span className="ml-1 text-xs text-slate-400">
                {group.members.length} member{group.members.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddingMember(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add member
          </button>
          <button
            onClick={() => void handleLeave()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex h-[min(600px,68vh)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              No messages yet. Say hi, or share a note, deck, or quiz with the group.
            </p>
          )}
          {messages.map((m) => (
            <GroupBubble key={m.id} message={m} mine={m.senderId === user?.id} groupId={groupId!} />
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={() => setPicking(true)}
            title="Share a note, deck, or quiz"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-violet-600"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the group…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex items-center rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-white shadow-sm disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {picking && (
        <ResourcePicker
          onClose={() => setPicking(false)}
          onPick={(resource) => {
            setPicking(false);
            void send("", resource);
          }}
        />
      )}
      {addingMember && groupId && (
        <AddMemberModal
          groupId={groupId}
          onClose={() => setAddingMember(false)}
          onAdded={() => {
            setAddingMember(false);
            void loadGroup();
          }}
        />
      )}
    </AppShell>
  );
}

function GroupBubble({ message, mine, groupId }: { message: GroupMessageDto; mine: boolean; groupId: string }) {
  return (
    <div className={mine ? "text-right" : "text-left"}>
      {!mine && <p className="mb-0.5 pl-1 text-xs font-medium text-slate-400">{message.senderName}</p>}
      {message.body && (
        <span
          className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-sm ${
            mine ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {message.body}
        </span>
      )}
      {message.attachment && (
        <GroupAttachmentCard messageId={message.id} attachment={message.attachment} groupId={groupId} mine={mine} />
      )}
    </div>
  );
}

function GroupAttachmentCard({
  messageId,
  attachment,
  groupId,
  mine,
}: {
  messageId: string;
  attachment: GroupAttachment;
  groupId: string;
  mine: boolean;
}) {
  const [classes, setClasses] = useState<ClassFolder[] | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta =
    attachment.type === "deck"
      ? { icon: Layers, title: attachment.name, sub: `Flashcard deck · ${attachment.cards.length} cards` }
      : attachment.type === "exercise_set"
        ? { icon: BrainCircuit, title: attachment.name, sub: `Quiz · ${attachment.exercises.length} questions` }
        : { icon: FileText, title: attachment.title, sub: "Note" };
  const Icon = meta.icon;

  async function startSave() {
    if (classes) return;
    const list = await api.get<ClassFolder[]>("/classes");
    setClasses(list);
    if (list.length > 0) setSelectedClassId(list[0].id);
  }

  async function handleSave() {
    if (!selectedClassId) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/groups/${groupId}/messages/${messageId}/import`, { classId: selectedClassId });
      setSaved(true);
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
          <span className="block text-sm font-medium text-slate-700">{meta.title}</span>
          <span className="block text-xs text-slate-400">{meta.sub}</span>
        </span>
      </div>

      {saved ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <Check className="h-3 w-3" />
          Saved to your classes
        </p>
      ) : classes === null ? (
        <button
          onClick={() => void startSave()}
          className="mt-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
        >
          Save to my classes
        </button>
      ) : classes.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">Create a class first, then save this.</p>
      ) : (
        <div className="mt-2.5 flex items-center gap-2">
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
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function AddMemberModal({
  groupId,
  onClose,
  onAdded,
}: {
  groupId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/groups/${groupId}/members`, { email: email.trim() });
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <form
        onSubmit={handleAdd}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display font-semibold text-slate-800">Add a member</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <input
          autoFocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Classmate's Study Hub email"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Add to group
        </button>
      </form>
    </div>
  );
}
