import { Loader2, MessageSquare, Plus, Users, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { GroupSummary } from "../api/types";
import { AppShell } from "../components/layout/AppShell";

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await api.get<GroupSummary[]>("/groups");
    setGroups(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load groups"));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/groups", { name: name.trim() });
      setName("");
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display flex items-center gap-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
          <Users className="h-6 w-6 text-violet-500" />
          Study Groups
        </h1>
        <div className="flex items-center gap-2">
          <Link
            to="/direct"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50"
          >
            <MessageSquare className="h-4 w-4" />
            Direct messages
          </Link>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            New group
          </button>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {creating && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-violet-200 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Create a study group</p>
            <button type="button" onClick={() => setCreating(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group name (e.g. Bio study squad)"
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">You can invite classmates by email once it's created.</p>
        </form>
      )}

      {groups.length === 0 && !creating && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-sm text-slate-500 dark:text-slate-400">
          No study groups yet. Create one to chat with classmates and share notes, decks, and
          quizzes with everyone at once.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <Link
            key={g.id}
            to={`/groups/${g.id}`}
            className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-violet-700">
                {g.name}
              </span>
              {g.unreadCount > 0 && (
                <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {g.unreadCount}
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <Users className="h-3 w-3" />
              {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
            </p>
            <p className="mt-2 truncate text-sm text-slate-500 dark:text-slate-400">
              {g.lastMessage
                ? `${g.lastMessage.senderName}: ${
                    g.lastMessage.body ?? (g.lastMessage.hasAttachment ? "shared something" : "")
                  }`
                : "No messages yet"}
            </p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
