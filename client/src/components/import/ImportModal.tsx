import {
  ArrowUpRight,
  BrainCircuit,
  Check,
  FileText,
  Layers,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { ClassFolder } from "../../api/types";
import { resizeImageToDataUrl } from "../../lib/imageResize";

interface ImportResult {
  classId: string;
  note: { id: string; title: string };
  deck?: { id: string; count: number };
  quiz?: { id: string; count: number };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

/** Turns pasted text or an uploaded photo/PDF into a note (+ optional deck & quiz) via Claude. */
export function ImportModal({ classId, onClose }: { classId?: string; onClose: () => void }) {
  const [classes, setClasses] = useState<ClassFolder[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(classId ?? "");
  const [tab, setTab] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [makeDeck, setMakeDeck] = useState(true);
  const [makeQuiz, setMakeQuiz] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    api
      .get<ClassFolder[]>("/classes")
      .then((list) => {
        setClasses(list);
        if (!classId && list.length > 0) setSelectedClassId((c) => c || list[0].id);
      })
      .catch(() => {});
  }, [classId]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      if (file.type === "application/pdf") {
        if (file.size > 10 * 1024 * 1024) {
          setError("That PDF is over 10 MB — try a smaller one.");
          return;
        }
        setDataUrl(await readFileAsDataUrl(file));
      } else if (file.type.startsWith("image/")) {
        // Downscale but keep it legible for Claude to read.
        setDataUrl(await resizeImageToDataUrl(file, 1600));
      } else {
        setError("Upload a photo or a PDF.");
        return;
      }
      setFileName(file.name);
    } catch {
      setError("Could not read that file.");
    }
    e.target.value = "";
  }

  async function handleImport() {
    if (!selectedClassId) {
      setError("Choose a class first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        classId: selectedClassId,
        ...(tab === "text" ? { text } : { dataUrl }),
        makeDeck,
        makeQuiz,
      };
      setResult(await api.post<ImportResult>("/ai/import", body));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed — try again");
    } finally {
      setBusy(false);
    }
  }

  const canImport = selectedClassId && (tab === "text" ? text.trim().length > 20 : !!dataUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-display flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
              <Sparkles className="h-4.5 w-4.5 text-violet-500" />
              Import notes
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Paste text or upload a photo/PDF — Claude turns it into a note, flashcards, and a quiz.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-2">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <Check className="h-4 w-4" />
              Created from your material:
            </p>
            <ResultRow icon={FileText} label={`Note: ${result.note.title}`} to={`/classes/${result.classId}/notes/${result.note.id}`} />
            {result.deck && (
              <ResultRow icon={Layers} label={`Deck · ${result.deck.count} flashcards`} to={`/decks/${result.deck.id}`} />
            )}
            {result.quiz && (
              <ResultRow icon={BrainCircuit} label={`Quiz · ${result.quiz.count} questions`} to={`/practice/${result.quiz.id}`} />
            )}
            <button
              onClick={onClose}
              className="mt-3 w-full rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {classes.length === 0 && <option value="">No classes yet — create one first</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="mb-3 flex gap-2">
              <TabButton active={tab === "text"} onClick={() => setTab("text")}>
                Paste text
              </TabButton>
              <TabButton active={tab === "file"} onClick={() => setTab("file")}>
                Photo or PDF
              </TabButton>
            </div>

            {tab === "text" ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="Paste your notes, a textbook passage, or a lecture transcript…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900"
              />
            ) : (
              <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-violet-300 hover:text-violet-600 dark:border-slate-700">
                <Upload className="h-6 w-6" />
                {fileName || "Choose a photo of your notes or a PDF"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(e) => void handleFile(e)}
                  className="hidden"
                />
              </label>
            )}

            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={makeDeck} onChange={(e) => setMakeDeck(e.target.checked)} className="accent-violet-600" />
                Also make flashcards
              </label>
              <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={makeQuiz} onChange={(e) => setMakeQuiz(e.target.checked)} className="accent-violet-600" />
                Also make a quiz
              </label>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              onClick={() => void handleImport()}
              disabled={busy || !canImport}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? "Claude is reading it…" : "Import with Claude"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
          : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function ResultRow({ icon: Icon, label, to }: { icon: typeof FileText; label: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-violet-500" />
        {label}
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
    </Link>
  );
}
