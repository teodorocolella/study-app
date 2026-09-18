import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { MessagePartner } from "../../api/types";
import { Avatar } from "../layout/Avatar";

/**
 * Type-a-name picker for choosing a classmate to message. Searches by display
 * name (or email) so people don't need to know each other's email address.
 */
export function UserPicker({
  selected,
  onSelect,
  autoFocus,
}: {
  selected: MessagePartner | null;
  onSelect: (user: MessagePartner | null) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessagePartner[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .get<MessagePartner[]>(`/users/search?q=${encodeURIComponent(q)}`)
        .then((users) => {
          setResults(users);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 dark:border-violet-500/30 dark:bg-violet-500/10">
        <Avatar displayName={selected.displayName} avatarUrl={selected.avatarUrl} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
            {selected.displayName}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Choose someone else"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search classmates by name…"
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 py-2 pl-9 pr-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">
              {loading ? "Searching…" : "No one found by that name."}
            </p>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onSelect(u);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-violet-50 dark:hover:bg-slate-700"
              >
                <Avatar displayName={u.displayName} avatarUrl={u.avatarUrl} size={30} />
                <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {u.displayName}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
