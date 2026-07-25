import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { RequireAuth } from "./components/layout/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { trackPageView } from "./lib/analytics";
// Entry pages load eagerly so the first paint is instant; everything behind
// auth is code-split so heavy deps (TipTap, KaTeX, games) load on demand.
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";

// Helper: lazy-load a module's named export as a default for React.lazy.
function page(loader: () => Promise<Record<string, unknown>>, name: string) {
  return lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));
}

const WelcomePage = page(() => import("./pages/WelcomePage"), "WelcomePage");
const DashboardPage = page(() => import("./pages/DashboardPage"), "DashboardPage");
const ClassesPage = page(() => import("./pages/ClassesPage"), "ClassesPage");
const ClassFolderPage = page(() => import("./pages/ClassFolderPage"), "ClassFolderPage");
const NoteEditorPage = page(() => import("./pages/NoteEditorPage"), "NoteEditorPage");
const DeckPage = page(() => import("./pages/DeckPage"), "DeckPage");
const ExerciseSetPage = page(() => import("./pages/ExerciseSetPage"), "ExerciseSetPage");
const PracticeSessionPage = page(() => import("./pages/PracticeSessionPage"), "PracticeSessionPage");
const StudySessionPage = page(() => import("./pages/StudySessionPage"), "StudySessionPage");
const GroupsPage = page(() => import("./pages/GroupsPage"), "GroupsPage");
const GroupChatPage = page(() => import("./pages/GroupChatPage"), "GroupChatPage");
const MessagesPage = page(() => import("./pages/MessagesPage"), "MessagesPage");
const ReferencePage = page(() => import("./pages/ReferencePage"), "ReferencePage");
const GamesPage = page(() => import("./pages/GamesPage"), "GamesPage");
const GamePlayPage = page(() => import("./pages/GamePlayPage"), "GamePlayPage");

function protect(element: React.ReactNode) {
  return <RequireAuth>{element}</RequireAuth>;
}

function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-400 dark:text-slate-500">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AnalyticsTracker />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/welcome" element={protect(<WelcomePage />)} />
          <Route path="/dashboard" element={protect(<DashboardPage />)} />
          <Route path="/classes" element={protect(<ClassesPage />)} />
          <Route path="/classes/:classId" element={protect(<ClassFolderPage />)} />
          <Route
            path="/classes/:classId/notes/:noteId"
            element={protect(<NoteEditorPage />)}
          />
          <Route path="/decks/:deckId" element={protect(<DeckPage />)} />
          <Route path="/decks/:deckId/study" element={protect(<StudySessionPage />)} />
          <Route path="/practice/:setId" element={protect(<ExerciseSetPage />)} />
          <Route path="/practice/:setId/run" element={protect(<PracticeSessionPage />)} />
          <Route path="/study" element={protect(<StudySessionPage />)} />
          <Route path="/groups" element={protect(<GroupsPage />)} />
          <Route path="/groups/:groupId" element={protect(<GroupChatPage />)} />
          <Route path="/direct" element={protect(<MessagesPage />)} />
          <Route path="/messages" element={<Navigate to="/direct" replace />} />
          <Route path="/reference" element={protect(<ReferencePage />)} />
          <Route path="/games" element={protect(<GamesPage />)} />
          <Route path="/games/:deckId/:gameId" element={protect(<GamePlayPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
