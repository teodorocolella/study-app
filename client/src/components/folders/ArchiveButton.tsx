import { Archive, ArchiveRestore } from "lucide-react";
import { useState } from "react";
import { api } from "../../api/client";
import type { MovableType } from "../../api/types";

const PATCH_PATH: Record<MovableType, (id: string) => string> = {
  note: (id) => `/notes/${id}`,
  deck: (id) => `/decks/${id}`,
  quiz: (id) => `/exercise-sets/${id}`,
};

/** Small icon button that archives an item (or restores it if already archived). */
export function ArchiveButton({
  type,
  itemId,
  archived,
  onChanged,
}: {
  type: MovableType;
  itemId: string;
  archived: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await api.patch(PATCH_PATH[type](itemId), { archived: !archived });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const Icon = archived ? ArchiveRestore : Archive;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      title={archived ? "Unarchive" : "Archive"}
      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-violet-600 disabled:opacity-50 dark:hover:bg-slate-700"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
