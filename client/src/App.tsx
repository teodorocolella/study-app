import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { RequireAuth } from "./components/layout/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { initAnalytics, trackPageView } from "./lib/analytics";
import { ClassFolderPage } from "./pages/ClassFolderPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeckPage } from "./pages/DeckPage";
import { LoginPage } from "./pages/LoginPage";
import { NoteEditorPage } from "./pages/NoteEditorPage";
import { SignupPage } from "./pages/SignupPage";
import { StudySessionPage } from "./pages/StudySessionPage";

function protect(element: React.ReactNode) {
  return <RequireAuth>{element}</RequireAuth>;
}

function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <AnalyticsTracker />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={protect(<DashboardPage />)} />
        <Route path="/classes/:classId" element={protect(<ClassFolderPage />)} />
        <Route
          path="/classes/:classId/notes/:noteId"
          element={protect(<NoteEditorPage />)}
        />
        <Route path="/decks/:deckId" element={protect(<DeckPage />)} />
        <Route path="/decks/:deckId/study" element={protect(<StudySessionPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
