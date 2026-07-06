import { Camera, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../api/client";
import { resizeImageToDataUrl } from "../../lib/imageResize";
import { Avatar } from "./Avatar";

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarPreview(dataUrl);
    } catch {
      setError("Could not process that image. Try a different file.");
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ displayName: displayName.trim(), avatarUrl: avatarPreview });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="animate-flip-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-800">Edit profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mb-5 flex flex-col items-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="group relative"
            aria-label="Change photo"
          >
            <Avatar displayName={displayName} avatarUrl={avatarPreview} size={80} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
              <Camera className="h-5 w-5" />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            Change photo
          </button>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-slate-600">Display name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => void handleSave()}
            disabled={saving || !displayName.trim()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
