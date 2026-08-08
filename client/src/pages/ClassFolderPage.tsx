import { Archive, ArrowLeft, Check, Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { ClassFolder, FolderSummary } from "../api/types";
import { ClassResources } from "../components/folders/ClassResources";
import { FoldersSection } from "../components/folders/FoldersSection";
import { AppShell } from "../components/layout/AppShell";
import { ClassColorPicker } from "../components/layout/ClassColorPicker";
import { useAssistantRefresh } from "../hooks/useAssistantRefresh";
import { CLASS_COLORS, classGradient } from "../lib/classColors";

export function ClassFolderPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [classFolder, setClassFolder] = useState<ClassFolder | null>(null);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  const loadFolders = useCallback(async () => {
    if (!classId) return;
    setFolders(await api.get<FolderSummary[]>(`/classes/${classId}/folders?archived=all`));
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    api
      .get<ClassFolder>(`/classes/${classId}`)
      .then(setClassFolder)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    void loadFolders();
  }, [classId, loadFolders]);

  // Folder counts can change when the assistant adds/moves content.
  useAssistantRefresh(() => void loadFolders().catch(() => {}));

  async function handleDeleteClass() {
    if (!classId) return;
    if (
      !confirm(
        `Delete "${classFolder?.name ?? "this class"}"? This permanently deletes everything in it — all folders, notes, decks, and quizzes.`,
      )
    )
      return;
    await api.delete(`/classes/${classId}`);
    navigate("/dashboard");
  }

  async function handleToggleArchiveClass() {
    if (!classId || !classFolder) return;
    const nextArchived = !classFolder.archived;
    const updated = await api.patch<ClassFolder>(`/classes/${classId}`, { archived: nextArchived });
    if (nextArchived) navigate("/dashboard");
    else setClassFolder(updated);
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

  const headerGradient = classGradient(classFolder?.colorTag, "br");

  return (
    <AppShell>
      <Link
        to="/dashboard"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Dashboard
      </Link>

      {isEditing ? (
        <div className="mb-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Class name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Color</label>
          <div className="mb-4">
            <ClassColorPicker value={editColor} onChange={setEditColor} size={7} />
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
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`mb-8 flex items-center justify-between rounded-2xl ${headerGradient.className} p-6 text-white shadow-md`}
          style={headerGradient.style}
        >
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
              onClick={() => void handleToggleArchiveClass()}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/25"
            >
              <Archive className="h-3.5 w-3.5" />
              {classFolder?.archived ? "Unarchive" : "Archive"}
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

      {classId && <FoldersSection classId={classId} folders={folders} onChanged={() => void loadFolders()} />}
      {classId && (
        <ClassResources
          classId={classId}
          folderId={null}
          folders={folders.filter((f) => !f.archived)}
          onChanged={loadFolders}
        />
      )}
    </AppShell>
  );
}
