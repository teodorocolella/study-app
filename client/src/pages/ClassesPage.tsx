import { Archive, ArchiveRestore, BookOpen, BrainCircuit, Layers, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { ClassFolder, DashboardSummary } from "../api/types";
import { AppShell } from "../components/layout/AppShell";
import { useAssistantRefresh } from "../hooks/useAssistantRefresh";
import { ClassColorPicker } from "../components/layout/ClassColorPicker";
import { ClassLogo } from "../components/layout/ClassLogo";
import { CLASS_COLORS } from "../lib/classColors";

export function ClassesPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [archivedClasses, setArchivedClasses] = useState<ClassFolder[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [selectedColor, setSelectedColor] = useState(CLASS_COLORS[0].id);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [data, archived] = await Promise.all([
      api.get<DashboardSummary>("/dashboard/summary"),
      api.get<ClassFolder[]>("/classes?archived=1"),
    ]);
    setSummary(data);
    setArchivedClasses(archived);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
  }, []);

  useAssistantRefresh(() => void load().catch(() => {}));

  async function setArchived(classId: string, archived: boolean) {
    try {
      await api.patch(`/classes/${classId}`, { archived });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update class");
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.post<ClassFolder>("/classes", {
        name: newClassName.trim(),
        colorTag: selectedColor,
      });
      navigate(`/classes/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create class");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display mb-6 text-2xl font-semibold text-slate-800 dark:text-slate-100">Your classes</h1>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {summary?.classes.length === 0 && (
          <p className="col-span-2 text-sm text-slate-500 dark:text-slate-400">
            No classes yet — create your first one below.
          </p>
        )}
        {summary?.classes.map((c) => (
          <div key={c.classId} className="group relative">
            <Link
              to={`/classes/${c.classId}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <ClassLogo colorTag={c.colorTag} />
              <div className="min-w-0 flex-1 pr-6">
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200 transition-colors group-hover:text-slate-900">
                    {c.name}
                  </span>
                  {c.dueCount > 0 && (
                    <span className="ml-2 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                      {c.dueCount} due
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {c.noteCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {c.deckCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <BrainCircuit className="h-3 w-3" />
                    {c.quizCount}
                  </span>
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => void setArchived(c.classId, true)}
              title="Archive class"
              className="absolute right-2 top-2 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-violet-600 group-hover:opacity-100 dark:hover:bg-slate-700"
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {archivedClasses.length > 0 && (
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs font-medium text-slate-400 transition-colors hover:text-violet-500"
          >
            {showArchived ? "Hide" : "Show"} archived classes ({archivedClasses.length})
          </button>
          {showArchived && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {archivedClasses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-2.5 pl-3 pr-2.5 dark:border-slate-700 dark:bg-slate-800/40"
                >
                  <Link
                    to={`/classes/${c.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400"
                  >
                    <ClassLogo colorTag={c.colorTag} size={28} />
                    <span className="truncate">{c.name}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void setArchived(c.id, false)}
                    title="Unarchive class"
                    className="ml-2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-700"
                  >
                    <ArchiveRestore className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-300">Add a new class</p>
        <div className="mb-3">
          <ClassColorPicker value={selectedColor} onChange={setSelectedColor} />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Class name (e.g. Algebra II)"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>
    </AppShell>
  );
}
