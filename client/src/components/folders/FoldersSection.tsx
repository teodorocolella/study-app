import { Archive, ArchiveRestore, Folder as FolderIcon, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { FolderSummary } from "../../api/types";

/** Lists a class's folders and lets the student create, archive, or restore them. */
export function FoldersSection({
  classId,
  folders,
  onChanged,
}: {
  classId: string;
  folders: FolderSummary[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activeFolders = folders.filter((f) => !f.archived);
  const archivedFolders = folders.filter((f) => f.archived);

  async function createFolder(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post(`/classes/${classId}/folders`, { name: name.trim() });
      setName("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create folder");
    }
  }

  async function setArchived(folderId: string, archived: boolean) {
    try {
      await api.patch(`/folders/${folderId}`, { archived });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update folder");
    }
  }

  return (
    <section className="mb-10">
      <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
        <FolderIcon className="h-4.5 w-4.5 text-slate-400" />
        Folders
      </h2>

      {activeFolders.length > 0 && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {activeFolders.map((f) => {
            const total = f.noteCount + f.deckCount + f.quizCount;
            return (
              <div
                key={f.id}
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white pl-4 pr-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
              >
                <Link
                  to={`/classes/${classId}/folders/${f.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2 py-3.5 font-medium text-slate-700 transition-colors group-hover:text-violet-700 dark:text-slate-200"
                >
                  <FolderIcon className="h-4 w-4 shrink-0 text-violet-400" />
                  <span className="truncate">{f.name}</span>
                </Link>
                <span className="ml-2 flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {total} item{total === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void setArchived(f.id, true)}
                    title="Archive folder"
                    className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-700"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {archivedFolders.length > 0 && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs font-medium text-slate-400 transition-colors hover:text-violet-500"
          >
            {showArchived ? "Hide" : "Show"} archived folders ({archivedFolders.length})
          </button>
          {showArchived && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {archivedFolders.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50/60 pl-4 pr-2.5 dark:border-slate-700 dark:bg-slate-800/40"
                >
                  <Link
                    to={`/classes/${classId}/folders/${f.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-sm text-slate-500 dark:text-slate-400"
                  >
                    <FolderIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{f.name}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void setArchived(f.id, false)}
                    title="Unarchive folder"
                    className="ml-2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-700"
                  >
                    <ArchiveRestore className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={createFolder} className="flex gap-2">
        <input
          type="text"
          placeholder="New folder name (e.g. Unit 1, Midterm)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-slate-700"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add folder
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
