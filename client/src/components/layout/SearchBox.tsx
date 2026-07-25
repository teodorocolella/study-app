import { BookOpen, BrainCircuit, FileText, Layers, Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";

interface SearchResults {
  classes: { id: string; name: string }[];
  notes: { id: string; title: string; classId: string; className: string }[];
  decks: { id: string; name: string; classId: string; className: string }[];
  quizzes: { id: string; name: string; classId: string; className: string }[];
}

const EMPTY: SearchResults = { classes: [], notes: [], decks: [], quizzes: [] };

export function SearchBox({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search as the user types.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get<SearchResults>(`/search?q=${encodeURIComponent(q)}`)
        .then((r) => setResults(r))
        .catch(() => setResults(EMPTY))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(to: string) {
    setOpen(false);
    setQuery("");
    onNavigate?.();
    navigate(to);
  }

  const total =
    results.classes.length + results.notes.length + results.decks.length + results.quizzes.length;

  // Collapsed sidebar: just an icon that expands nothing — search lives in the full sidebar.
  if (collapsed) {
    return (
      <button
        onClick={onNavigate}
        title="Search"
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-violet-600"
      >
        <Search className="h-4.5 w-4.5" />
      </button>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search…"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pl-8 pr-7 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 shadow-lg">
          {loading && (
            <p className="flex items-center gap-2 px-2 py-3 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </p>
          )}
          {!loading && total === 0 && (
            <p className="px-2 py-3 text-sm text-slate-400">No matches for “{query.trim()}”.</p>
          )}
          {!loading && (
            <>
              <Group
                label="Classes"
                icon={BookOpen}
                items={results.classes.map((c) => ({ id: c.id, label: c.name, to: `/classes/${c.id}` }))}
                onGo={go}
              />
              <Group
                label="Notes"
                icon={FileText}
                items={results.notes.map((n) => ({
                  id: n.id,
                  label: n.title,
                  sub: n.className,
                  to: `/classes/${n.classId}/notes/${n.id}`,
                }))}
                onGo={go}
              />
              <Group
                label="Decks"
                icon={Layers}
                items={results.decks.map((d) => ({ id: d.id, label: d.name, sub: d.className, to: `/decks/${d.id}` }))}
                onGo={go}
              />
              <Group
                label="Quizzes"
                icon={BrainCircuit}
                items={results.quizzes.map((s) => ({ id: s.id, label: s.name, sub: s.className, to: `/practice/${s.id}` }))}
                onGo={go}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  icon: Icon,
  items,
  onGo,
}: {
  label: string;
  icon: typeof FileText;
  items: { id: string; label: string; sub?: string; to: string }[];
  onGo: (to: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-1">
      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onGo(item.to)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-violet-50 dark:hover:bg-slate-700"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-slate-700 dark:text-slate-200">{item.label}</span>
            {item.sub && <span className="block truncate text-xs text-slate-400">{item.sub}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
