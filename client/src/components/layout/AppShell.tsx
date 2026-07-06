import { GraduationCap, LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Avatar } from "./Avatar";
import { ProfileModal } from "./ProfileModal";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f6f5fb] bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.08),transparent_55%)]">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm shadow-violet-300 transition-transform group-hover:scale-105">
              <GraduationCap className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="font-display text-lg font-semibold text-slate-800">Study Hub</span>
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setProfileOpen(true)}
              className="hidden items-center gap-2 rounded-full transition-opacity hover:opacity-80 sm:flex"
            >
              <Avatar displayName={user?.displayName} avatarUrl={user?.avatarUrl} size={32} />
              <span className="text-sm font-medium text-slate-600">{user?.displayName}</span>
            </button>
            <button
              onClick={() => void logout()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
