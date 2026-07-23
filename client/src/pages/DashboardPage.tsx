import { BookOpen, Flame, Layers, Play, Plus, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { ClassFolder, DashboardSummary } from "../api/types";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../hooks/useAuth";
import { CLASS_COLORS, getClassColor } from "../lib/classColors";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [selectedColor, setSelectedColor] = useState(CLASS_COLORS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function loadSummary() {
    const data = await api.get<DashboardSummary>("/dashboard/summary");
    setSummary(data);
  }

  useEffect(() => {
    loadSummary().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
  }, []);

  async function handleCreateClass(e: FormEvent) {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const classFolder = await api.post<ClassFolder>("/classes", {
        name: newClassName.trim(),
        colorTag: selectedColor,
      });
      setNewClassName("");
      navigate(`/classes/${classFolder.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create class");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-6 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-700 p-8 text-white shadow-lg shadow-indigo-200 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm font-medium text-violet-100">Welcome back</p>
          <h1 className="font-display text-3xl font-semibold">{user?.displayName}</h1>
          <p className="mt-2 max-w-md text-sm text-violet-100">
            {summary && summary.totalDue > 0
              ? `You have ${summary.totalDue} card${summary.totalDue === 1 ? "" : "s"} ready for review.`
              : "You're all caught up — nice work!"}
          </p>
          {summary && summary.totalDue > 0 && (
            <Link
              to="/study"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm transition-transform hover:scale-[1.02]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Review everything
            </Link>
          )}
        </div>
        <Sparkles className="hidden h-16 w-16 text-white/20 sm:block" strokeWidth={1.5} />
      </div>

      <div className="mb-10 grid grid-cols-3 gap-4">
        <StatCard icon={Layers} label="Due today" value={summary?.totalDue ?? "—"} accent="violet" />
        <StatCard icon={BookOpen} label="Studied today" value={summary?.studiedToday ?? "—"} accent="sky" />
        <StatCard icon={Flame} label="Day streak" value={summary?.streak ?? "—"} accent="amber" />
      </div>

      <h2 className="font-display mb-4 text-lg font-semibold text-slate-800">Your classes</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {summary?.classes.length === 0 && (
          <p className="col-span-2 text-sm text-slate-500">No classes yet — create one below to get started.</p>
        )}
        {summary?.classes.map((c) => {
          const color = getClassColor(c.colorTag);
          return (
            <Link
              key={c.classId}
              to={`/classes/${c.classId}`}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${color.gradient}`} />
              <div className="flex items-center justify-between pl-2">
                <span className="font-medium text-slate-700 transition-colors group-hover:text-slate-900">
                  {c.name}
                </span>
                {c.dueCount > 0 && (
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    {c.dueCount} due
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <form
        onSubmit={handleCreateClass}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <p className="mb-3 text-sm font-medium text-slate-600">Add a new class</p>
        <div className="mb-3 flex gap-2">
          {CLASS_COLORS.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setSelectedColor(c.id)}
              aria-label={c.label}
              className={`h-6 w-6 rounded-full ${c.dot} transition-transform hover:scale-110 ${
                selectedColor === c.id ? "ring-2 ring-offset-2 ring-slate-400" : ""
              }`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Class name (e.g. Algebra II)"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
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
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Layers;
  label: string;
  value: string | number;
  accent: "violet" | "sky" | "amber";
}) {
  const accents = {
    violet: "bg-violet-100 text-violet-600",
    sky: "bg-sky-100 text-sky-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${accents[accent]}`}>
        <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-display mt-1 text-2xl font-semibold text-slate-800">{value}</p>
    </div>
  );
}
