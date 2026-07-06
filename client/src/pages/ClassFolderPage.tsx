import { ArrowLeft, Check, FileText, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { ClassFolder, Deck, Note } from "../api/types";
import { AppShell } from "../components/layout/AppShell";
import { TutorChatPanel } from "../components/ai/TutorChatPanel";
import { CLASS_COLORS, getClassColor } from "../lib/classColors";

export function ClassFolderPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [classFolder, setClassFolder] = useState<ClassFolder | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!classId) return;
    const [cf, noteList, deckList] = await Promise.all([
      api.get<ClassFolder>(`/classes/${classId}`),
      api.get<Note[]>(`/classes/${classId}/notes`),
      api.get<Deck[]>(`/classes/${classId}/decks`),
    ]);
    setClassFolder(cf);
    setNotes(noteList);
    setDecks(deckList);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function handleCreateNote(e: FormEvent) {
    e.preventDefault();
    if (!newNoteTitle.trim() || !classId) return;
    try {
      const note = await api.post<Note>(`/classes/${classId}/notes`, {
        title: newNoteTitle.trim(),
        contentMarkdown: "",
      });
      setNewNoteTitle("");
      navigate(`/classes/${classId}/notes/${note.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create note");
    }
  }

  async function handleCreateDeck(e: FormEvent) {
    e.preventDefault();
    if (!newDeckName.trim() || !classId) return;
    try {
      const deck = await api.post<Deck>(`/classes/${classId}/decks`, { name: newDeckName.trim() });
      setNewDeckName("");
      navigate(`/decks/${deck.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create deck");
    }
  }

  async function handleDeleteClass() {
    if (!classId || !confirm("Delete this class and everything in it?")) return;
    await api.delete(`/classes/${classId}`);
    navigate("/dashboard");
  }

  function startEdit() {
    if (!classFolder) return;
    setEditName(classFolder.name);
    setEditColor(classFolder.colorTag ?? CLASS_COLORS[0].id);
    setIsEditing(true);
  }

  async function handleSaveEdit() {
    if (!classId || !editName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<ClassFolder>(`/classes/${classId}`, {
        name: editName.trim(),
        colorTag: editColor,
      });
      setClassFolder(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update class");
    } finally {
      setSaving(false);
    }
  }

  const color = getClassColor(classFolder?.colorTag);

  return (
    <AppShell>
      <Link
        to="/dashboard"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-violet-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Dashboard
      </Link>

      {isEditing ? (
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Class name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Color</label>
          <div className="mb-4 flex gap-2">
            {CLASS_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setEditColor(c.id)}
                aria-label={c.label}
                className={`h-7 w-7 rounded-full ${c.dot} transition-transform hover:scale-110 ${
                  editColor === c.id ? "ring-2 ring-offset-2 ring-slate-400" : ""
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void handleSaveEdit()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={`mb-8 flex items-center justify-between rounded-2xl bg-gradient-to-br ${color.gradient} p-6 text-white shadow-md`}>
          <h1 className="font-display text-2xl font-semibold">{classFolder?.name}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/25"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              onClick={() => void handleDeleteClass()}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/25"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {classId && (
        <div className="mb-8">
          <TutorChatPanel classId={classId} />
        </div>
      )}

      <section className="mb-10">
        <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <FileText className="h-4.5 w-4.5 text-slate-400" />
          Notes
        </h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {notes.length === 0 && <p className="text-sm text-slate-500">No notes yet.</p>}
          {notes.map((note) => (
            <Link
              key={note.id}
              to={`/classes/${classId}/notes/${note.id}`}
              className="group rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
            >
              <span className="font-medium text-slate-700 transition-colors group-hover:text-violet-700">
                {note.title}
              </span>
            </Link>
          ))}
        </div>
        <form onSubmit={handleCreateNote} className="flex gap-2">
          <input
            type="text"
            placeholder="New note title"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900"
          >
            <Plus className="h-4 w-4" />
            Add note
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Layers className="h-4.5 w-4.5 text-slate-400" />
          Flashcard decks
        </h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {decks.length === 0 && <p className="text-sm text-slate-500">No decks yet.</p>}
          {decks.map((deck) => (
            <Link
              key={deck.id}
              to={`/decks/${deck.id}`}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
            >
              <span className="font-medium text-slate-700 transition-colors group-hover:text-violet-700">
                {deck.name}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {deck._count.cards} cards
              </span>
            </Link>
          ))}
        </div>
        <form onSubmit={handleCreateDeck} className="flex gap-2">
          <input
            type="text"
            placeholder="New deck name"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900"
          >
            <Plus className="h-4 w-4" />
            Add deck
          </button>
        </form>
      </section>
    </AppShell>
  );
}
