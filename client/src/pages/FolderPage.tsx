import { ArrowLeft, Check, Folder as FolderIcon, Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Folder, FolderSummary } from "../api/types";
import { ClassResources } from "../components/folders/ClassResources";
import { AppShell } from "../components/layout/AppShell";

export function FolderPage() {
  const { classId, folderId } = useParams<{ classId: string; folderId: string }>();
  const navigate = useNavigate();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadFolders = useCallback(async () => {
    if (!classId) return;
    setFolders(await api.get<FolderSummary[]>(`/classes/${classId}/folders`));
  }, [classId]);

  useEffect(() => {
    if (!folderId) return;
    api
      .get<Folder>(`/folders/${folderId}`)
      .then(setFolder)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load folder"));
    void loadFolders();
  }, [folderId, loadFolders]);

  async function saveRename() {
    if (!folderId || !editName.trim()) return;
    const updated = await api.patch<Folder>(`/folders/${folderId}`, { name: editName.trim() });
    setFolder(updated);
    setEditing(false);
  }

  async function handleDelete() {
    if (!folderId || !folder) return;
    if (!confirm(`Delete the folder "${folder.name}"? Its notes, decks, and quizzes are kept and moved back to the class.`)) return;
    await api.delete(`/folders/${folderId}`);
    navigate(`/classes/${classId}`);
  }

  return (
    <AppShell>
      <Link
        to={`/classes/${classId}`}
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-violet-600 dark:text-slate-400"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to class
      </Link>

      <div className="mt-2 mb-8 flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-lg font-semibold focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
            <button onClick={() => void saveRename()} className="rounded-lg bg-violet-600 p-2 text-white" aria-label="Save">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 p-2 text-slate-500 dark:border-slate-700" aria-label="Cancel">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <h1 className="font-display flex items-center gap-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
            <FolderIcon className="h-6 w-6 text-violet-500" />
            {folder?.name}
          </h1>
        )}
        {folder && !editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditName(folder.name);
                setEditing(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </button>
            <button
              onClick={() => void handleDelete()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete folder
            </button>
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {classId && folderId && (
        <ClassResources classId={classId} folderId={folderId} folders={folders} onChanged={loadFolders} />
      )}
    </AppShell>
  );
}
