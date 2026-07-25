import { BrainCircuit, FileText, Layers, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface Resources {
  notes: { id: string; title: string; className: string }[];
  decks: { id: string; name: string; className: string; cardCount: number }[];
  quizzes: { id: string; name: string; className: string; questionCount: number }[];
}

export type PickedResource = { type: "note" | "deck" | "exercise_set"; id: string };

/** Modal to pick one of the user's notes, decks, or quizzes to share. */
export function ResourcePicker({
  onPick,
  onClose,
}: {
  onPick: (resource: PickedResource) => void;
  onClose: () => void;
}) {
  const [resources, setResources] = useState<Resources | null>(null);

  useEffect(() => {
    api.get<Resources>("/resources").then(setResources).catch(() => setResources({ notes: [], decks: [], quizzes: [] }));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display font-semibold text-slate-800 dark:text-slate-100">Share to the group</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {!resources ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : resources.notes.length + resources.decks.length + resources.quizzes.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
            Nothing to share yet — create a note, deck, or quiz first.
          </p>
        ) : (
          <div className="space-y-4">
            <Section title="Notes" icon={FileText}>
              {resources.notes.map((n) => (
                <Row
                  key={n.id}
                  label={n.title}
                  sub={n.className}
                  onClick={() => onPick({ type: "note", id: n.id })}
                />
              ))}
            </Section>
            <Section title="Flashcard decks" icon={Layers}>
              {resources.decks.map((d) => (
                <Row
                  key={d.id}
                  label={d.name}
                  sub={`${d.className} · ${d.cardCount} cards`}
                  onClick={() => onPick({ type: "deck", id: d.id })}
                />
              ))}
            </Section>
            <Section title="Practice quizzes" icon={BrainCircuit}>
              {resources.quizzes.map((q) => (
                <Row
                  key={q.id}
                  label={q.name}
                  sub={`${q.className} · ${q.questionCount} questions`}
                  onClick={() => onPick({ type: "exercise_set", id: q.id })}
                />
              ))}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  if (items.filter(Boolean).length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/40"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="block truncate text-xs text-slate-400">{sub}</span>
      </span>
    </button>
  );
}
