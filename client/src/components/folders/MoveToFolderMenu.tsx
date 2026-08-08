import { Check, FolderInput } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../api/client";
import type { FolderSummary, MovableType } from "../../api/types";

const PATCH_PATH: Record<MovableType, (id: string) => string> = {
  note: (id) => `/notes/${id}`,
  deck: (id) => `/decks/${id}`,
  quiz: (id) => `/exercise-sets/${id}`,
};

const MENU_WIDTH = 208; // w-52

/** Small folder-icon button that moves an item into a folder or out to the class root. */
export function MoveToFolderMenu({
  type,
  itemId,
  currentFolderId,
  folders,
  onMoved,
}: {
  type: MovableType;
  itemId: string;
  currentFolderId: string | null;
  folders: FolderSummary[];
  onMoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The menu is rendered in a portal (so it floats above every card), so its
  // position is pinned to the trigger button in viewport coordinates and kept
  // in sync as the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - MENU_WIDTH) });
    }
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function move(folderId: string | null) {
    setBusy(true);
    try {
      await api.patch(PATCH_PATH[type](itemId), { folderId });
      setOpen(false);
      onMoved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Move to folder"
        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-700"
      >
        <FolderInput className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH, zIndex: 60 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Move to
            </p>
            <MenuRow
              label="Class (no folder)"
              active={currentFolderId === null}
              disabled={busy}
              onClick={() => void move(null)}
            />
            {folders.map((f) => (
              <MenuRow
                key={f.id}
                label={f.name}
                active={currentFolderId === f.id}
                disabled={busy}
                onClick={() => void move(f.id)}
              />
            ))}
            {folders.length === 0 && (
              <p className="px-3 py-1.5 text-xs text-slate-400">No folders yet in this class.</p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuRow({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-slate-700 transition-colors hover:bg-violet-50 disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <span className="truncate">{label}</span>
      {active && <Check className="h-3.5 w-3.5 text-violet-500" />}
    </button>
  );
}
