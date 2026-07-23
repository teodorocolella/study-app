import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowLeft, BrainCircuit, Check, Loader2, Share2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Deck, ExerciseType, Note } from "../api/types";
import { AppShell } from "../components/layout/AppShell";
import { EditorToolbar } from "../components/notes/EditorToolbar";
import { ShareModal } from "../components/share/ShareModal";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function NoteEditorPage() {
  const { classId, noteId } = useParams<{ classId: string; noteId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef("");

  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [quizTypes, setQuizTypes] = useState<ExerciseType[]>([
    "mcq",
    "true_false",
    "fill_blank",
    "short_answer",
  ]);
  const [quizCount, setQuizCount] = useState(10);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  function scheduleSave(nextTitle: string, nextContentHtml: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatus("saving");
    debounceRef.current = setTimeout(async () => {
      try {
        await api.patch(`/notes/${noteId}`, { title: nextTitle, contentHtml: nextContentHtml });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 700);
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: "Write your notes…" }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[55vh] p-4",
      },
    },
    onUpdate: ({ editor }) => {
      scheduleSave(titleRef.current, editor.getHTML());
    },
  });

  useEffect(() => {
    if (!noteId || !editor) return;
    api
      .get<Note>(`/notes/${noteId}`)
      .then((note) => {
        setTitle(note.title);
        titleRef.current = note.title;
        editor.commands.setContent(note.contentHtml || "");
        setAiSummary(note.aiSummary);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load note"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, editor]);

  useEffect(() => {
    if (!classId) return;
    api
      .get<Deck[]>(`/classes/${classId}/decks`)
      .then((list) => {
        setDecks(list);
        if (list.length > 0) setSelectedDeckId(list[0].id);
      })
      .catch(() => {});
  }, [classId]);

  function handleTitleChange(value: string) {
    setTitle(value);
    titleRef.current = value;
    scheduleSave(value, editor?.getHTML() ?? "");
  }

  async function handleDelete() {
    if (!noteId || !confirm("Delete this note?")) return;
    await api.delete(`/notes/${noteId}`);
    navigate(`/classes/${classId}`);
  }

  async function handleSummarize() {
    setSummarizing(true);
    setAiMessage(null);
    try {
      const updated = await api.post<Note>("/ai/summarize-note", { noteId });
      setAiSummary(updated.aiSummary);
    } catch (err) {
      setAiMessage(err instanceof ApiError ? err.message : "Failed to summarize note");
    } finally {
      setSummarizing(false);
    }
  }

  async function handleGenerateFlashcards() {
    if (!selectedDeckId) {
      setAiMessage("Create a flashcard deck in this class first.");
      return;
    }
    setGenerating(true);
    setAiMessage(null);
    try {
      const created = await api.post<unknown[]>("/ai/generate-flashcards", {
        noteId,
        deckId: selectedDeckId,
      });
      setAiMessage(`Added ${created.length} flashcards to the deck.`);
    } catch (err) {
      setAiMessage(err instanceof ApiError ? err.message : "Failed to generate flashcards");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateQuiz() {
    if (!classId || quizTypes.length === 0) return;
    setGeneratingQuiz(true);
    setAiMessage(null);
    try {
      const set = await api.post<{ id: string }>("/ai/generate-exercises", {
        noteId,
        classId,
        types: quizTypes,
        count: quizCount,
      });
      navigate(`/practice/${set.id}`);
    } catch (err) {
      setAiMessage(err instanceof ApiError ? err.message : "Failed to generate the quiz");
    } finally {
      setGeneratingQuiz(false);
    }
  }

  function toggleQuizType(type: ExerciseType) {
    setQuizTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  return (
    <AppShell>
      <Link
        to={`/classes/${classId}`}
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-violet-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to class
      </Link>

      <div className="mt-2 mb-4 flex items-center justify-between gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="font-display w-full text-2xl font-semibold text-slate-800 focus:outline-none"
        />
        <div className="flex items-center gap-3 whitespace-nowrap">
          <SaveIndicator status={status} />
          <button
            onClick={() => setSharing(true)}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-violet-600"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button
            onClick={() => void handleDelete()}
            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          onClick={() => void handleSummarize()}
          disabled={summarizing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {summarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-violet-500" />}
          {summarizing ? "Summarizing…" : "Summarize"}
        </button>

        <select
          value={selectedDeckId}
          onChange={(e) => setSelectedDeckId(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          {decks.length === 0 && <option value="">No decks yet</option>}
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => void handleGenerateFlashcards()}
          disabled={generating || !selectedDeckId}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {generating ? "Generating…" : "Generate flashcards from this note"}
        </button>

        {aiMessage && <span className="text-sm text-slate-500">{aiMessage}</span>}

        <div className="flex w-full flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <BrainCircuit className="h-3.5 w-3.5 text-violet-500" />
            Practice quiz:
          </span>
          {(
            [
              ["mcq", "Multiple choice"],
              ["true_false", "True/false"],
              ["fill_blank", "Fill in blank"],
              ["short_answer", "Short answer"],
            ] as [ExerciseType, string][]
          ).map(([type, label]) => (
            <label key={type} className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={quizTypes.includes(type)}
                onChange={() => toggleQuizType(type)}
                className="accent-violet-600"
              />
              {label}
            </label>
          ))}
          <select
            value={quizCount}
            onChange={(e) => setQuizCount(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value={5}>5 questions</option>
            <option value={10}>10 questions</option>
            <option value={15}>15 questions</option>
            <option value={20}>20 questions</option>
          </select>
          <button
            onClick={() => void handleGenerateQuiz()}
            disabled={generatingQuiz || quizTypes.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {generatingQuiz ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}
            {generatingQuiz ? "Generating quiz…" : "Generate quiz"}
          </button>
        </div>
      </div>

      {aiSummary && (
        <div className="animate-flip-in mb-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-500">
            <Sparkles className="h-3.5 w-3.5" />
            AI summary
          </p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{aiSummary}</p>
        </div>
      )}

      <div>
        <EditorToolbar editor={editor} />
        <div className="rounded-b-xl border border-slate-300 bg-white shadow-sm">
          <EditorContent editor={editor} />
        </div>
      </div>

      {sharing && noteId && (
        <ShareModal
          attachment={{ type: "note", id: noteId }}
          label={title || "Untitled note"}
          onClose={() => setSharing(false)}
        />
      )}
    </AppShell>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const config = {
    idle: null,
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: "Saving…", color: "text-slate-400" },
    saved: { icon: <Check className="h-3.5 w-3.5" />, text: "Saved", color: "text-emerald-500" },
    error: { icon: null, text: "Failed to save", color: "text-red-500" },
  }[status];
  if (!config) return null;
  return (
    <span className={`flex items-center gap-1 text-xs ${config.color}`}>
      {config.icon}
      {config.text}
    </span>
  );
}
