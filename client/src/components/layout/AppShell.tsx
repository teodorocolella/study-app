import {
  BookOpen,
  ChevronLeft,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Moon,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { applyTheme, type Theme } from "../../lib/theme";
import { AssistantWidget } from "../ai/AssistantWidget";
import { Avatar } from "./Avatar";
import { ProfileModal } from "./ProfileModal";
import { SearchBox } from "./SearchBox";

const COLLAPSED_KEY = "sidebar.collapsed";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      Promise.all([
        api.get<{ count: number }>("/messages/unread-count").catch(() => ({ count: 0 })),
        api.get<{ count: number }>("/groups/unread-count").catch(() => ({ count: 0 })),
      ]).then(([direct, groups]) => {
        if (!cancelled) setUnread(direct.count + groups.count);
      });
    void load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [location.pathname]);

  const navItems: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/classes", label: "Classes", icon: BookOpen },
    { to: "/games", label: "Games", icon: Gamepad2 },
    { to: "/groups", label: "Study Groups", icon: Users, badge: unread },
    { to: "/reference", label: "Reference", icon: Library },
  ];

  const sidebarWidth = collapsed ? "w-[68px]" : "w-60";

  return (
    <div className="min-h-screen bg-[#f6f5fb] dark:bg-[#0f0e17] bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.08),transparent_55%)]">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 backdrop-blur-md md:hidden">
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-slate-600 dark:text-slate-300">
          <Menu className="h-6 w-6" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
            <GraduationCap className="h-4.5 w-4.5" strokeWidth={2.25} />
          </span>
          <span className="font-display font-semibold text-slate-800 dark:text-slate-100">Study Hub</span>
        </Link>
        <Link to="/groups" className="relative text-slate-600 dark:text-slate-300" aria-label="Study Groups">
          <Users className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex">
        <Sidebar
          navItems={navItems}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          sidebarWidth={sidebarWidth}
          currentPath={location.pathname}
          user={user}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onCloseMobile={() => setMobileOpen(false)}
          onOpenProfile={() => setProfileOpen(true)}
          onLogout={() => void logout()}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="min-h-screen flex-1 px-5 pb-24 pt-8 sm:px-8">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>

      <AssistantWidget />
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

function Sidebar({
  navItems,
  collapsed,
  mobileOpen,
  sidebarWidth,
  currentPath,
  user,
  onToggleCollapse,
  onCloseMobile,
  onOpenProfile,
  onLogout,
  theme,
  onToggleTheme,
}: {
  navItems: NavItem[];
  collapsed: boolean;
  mobileOpen: boolean;
  sidebarWidth: string;
  currentPath: string;
  user: { displayName: string; avatarUrl: string | null } | null;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${sidebarWidth} ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm shadow-violet-300">
            <GraduationCap className="h-5 w-5" strokeWidth={2.25} />
          </span>
          {!collapsed && (
            <span className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">Study Hub</span>
          )}
        </Link>
        <button onClick={onCloseMobile} className="text-slate-400 md:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className={`px-3 pb-1 ${collapsed ? "px-2" : ""}`}>
        <SearchBox collapsed={collapsed} onNavigate={onCloseMobile} />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const active = currentPath === item.to || currentPath.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 hover:text-slate-900"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="relative">
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.4 : 2} />
                {item.badge != null && item.badge > 0 && collapsed && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.badge != null && item.badge > 0 && (
                <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200/70 dark:border-slate-800 p-3">
        <button
          onClick={onOpenProfile}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Avatar displayName={user?.displayName} avatarUrl={user?.avatarUrl} size={32} />
          {!collapsed && (
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {user?.displayName}
              </span>
              <span className="block text-xs text-slate-400">Edit profile</span>
            </span>
          )}
        </button>
        <div className={`mt-1 flex ${collapsed ? "flex-col items-center gap-1" : "items-center justify-between"}`}>
          <button
            onClick={onLogout}
            title="Log out"
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Log out"}
          </button>
          <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
            <button
              onClick={onToggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={onToggleCollapse}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 md:block"
            >
              <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
