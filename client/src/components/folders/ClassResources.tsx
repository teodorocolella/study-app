import { BrainCircuit, FileText, Layers, Plus, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Deck, ExerciseSetSummary, FolderSummary, Note } from "../../api/types";
import { useAssistantRefresh } from "../../hooks/useAssistantRefresh";
import { itemAccent } from "../../lib/classColors";
import { ImportModal } from "../import/ImportModal";
import { ArchiveButton } from "./ArchiveButton";
import { ColorMenu } from "./ColorMenu";
import { MoveToFolderMenu } from "./MoveToFolderMenu";

type Section = "notes" | "decks" | "quizzes";

/**
 * The Notes / Flashcard decks / Practice quizzes sections for a class, scoped
 * to either the class root (folderId null) or a folder. Shared by the class
 * page and the folder page.
 */
export function ClassResources({
  classId,
  folderId,
  folders,
  onChanged,
}: {
  classId: string;
  folderId: string | null;
  folders: FolderSummary[];
  onChanged?: () => void;
}) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [sets, setSets] = useState<ExerciseSetSummary[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState<Record<Section, boolean>>({
    notes: false,
    decks: false,
    quizzes: false,
  });

  // Fetch active + archived together so we can show a "show archived" toggle.
  const folderQuery = folderId ? `?folder=${folderId}` : "?folder=root";
  const listQuery = `${folderQuery}&archived=all`;

  const load = useCallback(async () => {
    const [noteList, deckList, setList] = await Promise.all([
      api.get<Note[]>(`/classes/${classId}/notes${listQuery}`),
      api.get<Deck[]>(`/classes/${classId}/decks${listQuery}`),
      api.get<ExerciseSetSummary[]>(`/classes/${classId}/exercise-sets${listQuery}`),
    ]);
    setNotes(noteList);
    setDecks(deckList);
    setSets(setList);
    onChanged?.();
  }, [classId, listQuery, onChanged]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
  }, [load]);

  useAssistantRefresh(() => void load().catch(() => {}));

  async function createNote(e: FormEvent) {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    try {
      const note = await api.post<Note>(`/classes/${classId}/notes`, {
        title: newNoteTitle.trim(),
        contentHtml: "",
        folderId,
      });
      navigate(`/classes/${classId}/notes/${note.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create note");
    }
  }

  async function createDeck(e: FormEvent) {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    try {
      const deck = await api.post<Deck>(`/classes/${classId}/decks`, { name: newDeckName.trim(), folderId });
      navigate(`/decks/${deck.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create deck");
    }
  }

  async function createSet(e: FormEvent) {
    e.preventDefault();
    if (!newSetName.trim()) return;
    try {
      const set = await api.post<ExerciseSetSummary>(`/classes/${classId}/exercise-sets`, {
        name: newSetName.trim(),
        folderId,
      });
      navigate(`/practice/${set.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create practice set");
    }
  }

  const reload = () => void load().catch(() => {});
  const toggleArchived = (s: Section) => setShowArchived((prev) => ({ ...prev, [s]: !prev[s] }));

  const activeNotes = notes.filter((n) => !n.archived);
  const archivedNotes = notes.filter((n) => n.archived);
  const activeDecks = decks.filter((d) => !d.archived);
  const archivedDecks = decks.filter((d) => d.archived);
  const activeSets = sets.filter((s) => !s.archived);
  const archivedSets = sets.filter((s) => s.archived);

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
            <FileText className="h-4.5 w-4.5 text-slate-400" />
            Notes
          </h2>
          {folderId === null && (
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Import notes
            </button>
          )}
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {activeNotes.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No notes here yet.</p>
          )}
          {activeNotes.map((note) => (
            <ItemCard key={note.id} accentTag={note.colorTag} to={`/classes/${classId}/notes/${note.id}`} title={note.title}>
              <ColorMenu type="note" itemId={note.id} colorTag={note.colorTag} onChanged={reload} />
              <ArchiveButton type="note" itemId={note.id} archived={false} onChanged={reload} />
              <MoveToFolderMenu type="note" itemId={note.id} currentFolderId={note.folderId} folders={folders} onMoved={reload} />
            </ItemCard>
          ))}
        </div>
        <ArchivedGroup
          open={showArchived.notes}
          count={archivedNotes.length}
          onToggle={() => toggleArchived("notes")}
        >
          {archivedNotes.map((note) => (
            <ArchivedRow key={note.id} to={`/classes/${classId}/notes/${note.id}`} title={note.title}>
              <ArchiveButton type="note" itemId={note.id} archived onChanged={reload} />
            </ArchivedRow>
          ))}
        </ArchivedGroup>
        <form onSubmit={createNote} className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="New note title"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-slate-700"
          />
          <button type="submit" className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900">
            <Plus className="h-4 w-4" />
            Add note
          </button>
        </form>
      </section>

      <section className="mb-10">
        <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
          <Layers className="h-4.5 w-4.5 text-slate-400" />
          Flashcard decks
        </h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {activeDecks.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No decks here yet.</p>
          )}
          {activeDecks.map((deck) => (
            <ItemCard key={deck.id} accentTag={deck.colorTag} to={`/decks/${deck.id}`} title={deck.name}>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {deck._count.cards}
              </span>
              <ColorMenu type="deck" itemId={deck.id} colorTag={deck.colorTag} onChanged={reload} />
              <ArchiveButton type="deck" itemId={deck.id} archived={false} onChanged={reload} />
              <MoveToFolderMenu type="deck" itemId={deck.id} currentFolderId={deck.folderId} folders={folders} onMoved={reload} />
            </ItemCard>
          ))}
        </div>
        <ArchivedGroup
          open={showArchived.decks}
          count={archivedDecks.length}
          onToggle={() => toggleArchived("decks")}
        >
          {archivedDecks.map((deck) => (
            <ArchivedRow key={deck.id} to={`/decks/${deck.id}`} title={deck.name}>
              <ArchiveButton type="deck" itemId={deck.id} archived onChanged={reload} />
            </ArchivedRow>
          ))}
        </ArchivedGroup>
        <form onSubmit={createDeck} className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="New deck name"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-slate-700"
          />
          <button type="submit" className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900">
            <Plus className="h-4 w-4" />
            Add deck
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
          <BrainCircuit className="h-4.5 w-4.5 text-slate-400" />
          Practice quizzes
        </h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {activeSets.length === 0 && (
            <p className="col-span-2 text-sm text-slate-500 dark:text-slate-400">
              No practice quizzes here yet — create one below, generate one from a note, or ask the AI assistant.
            </p>
          )}
          {activeSets.map((set) => {
            const pct =
              set.lastAttempt && set.lastAttempt.total > 0
                ? Math.round((set.lastAttempt.score / set.lastAttempt.total) * 100)
                : null;
            return (
              <ItemCard key={set.id} accentTag={set.colorTag} to={`/practice/${set.id}`} title={set.name}>
                {pct !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      pct >= 80
                        ? "bg-emerald-100 text-emerald-700"
                        : pct >= 50
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-600"
                    }`}
                  >
                    {pct}%
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  {set.exerciseCount}
                </span>
                <ColorMenu type="quiz" itemId={set.id} colorTag={set.colorTag} onChanged={reload} />
                <ArchiveButton type="quiz" itemId={set.id} archived={false} onChanged={reload} />
                <MoveToFolderMenu type="quiz" itemId={set.id} currentFolderId={set.folderId} folders={folders} onMoved={reload} />
              </ItemCard>
            );
          })}
        </div>
        <ArchivedGroup
          open={showArchived.quizzes}
          count={archivedSets.length}
          onToggle={() => toggleArchived("quizzes")}
        >
          {archivedSets.map((set) => (
            <ArchivedRow key={set.id} to={`/practice/${set.id}`} title={set.name}>
              <ArchiveButton type="quiz" itemId={set.id} archived onChanged={reload} />
            </ArchivedRow>
          ))}
        </ArchivedGroup>
        <form onSubmit={createSet} className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="New practice quiz name"
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-slate-700"
          />
          <button type="submit" className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900">
            <Plus className="h-4 w-4" />
            Add quiz
          </button>
        </form>
      </section>

      {importOpen && (
        <ImportModal
          classId={classId}
          onClose={() => {
            setImportOpen(false);
            reload();
          }}
        />
      )}
    </>
  );
}

/** A live (non-archived) resource card: accent pill, a title link, and controls. */
function ItemCard({
  accentTag,
  to,
  title,
  children,
}: {
  accentTag: string | null;
  to: string;
  title: string;
  children: ReactNode;
}) {
  const accent = itemAccent(accentTag);
  return (
    <div className="group relative flex items-center justify-between rounded-xl border border-slate-200 bg-white py-3.5 pl-5 pr-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className={`absolute inset-y-1.5 left-1.5 w-1 rounded-full ${accent.className}`} style={accent.style} />
      <Link to={to} className="min-w-0 flex-1 truncate font-medium text-slate-700 transition-colors group-hover:text-violet-700 dark:text-slate-200">
        {title}
      </Link>
      <span className="ml-2 flex items-center gap-1.5">{children}</span>
    </div>
  );
}

/** Collapsible "Show archived (N)" region under a section. */
function ArchivedGroup({
  open,
  count,
  onToggle,
  children,
}: {
  open: boolean;
  count: number;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        className="text-xs font-medium text-slate-400 transition-colors hover:text-violet-500"
      >
        {open ? "Hide" : "Show"} archived ({count})
      </button>
      {open && <div className="mt-2 grid gap-2 sm:grid-cols-2">{children}</div>}
    </div>
  );
}

/** A dimmed, dashed row for an archived item with its restore control. */
function ArchivedRow({ to, title, children }: { to: string; title: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-2.5 pl-4 pr-2.5 dark:border-slate-700 dark:bg-slate-800/40">
      <Link to={to} className="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400">
        {title}
      </Link>
      <span className="ml-2 flex items-center gap-1.5">{children}</span>
    </div>
  );
}
