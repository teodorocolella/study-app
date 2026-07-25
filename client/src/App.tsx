import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { RequireAuth } from "./components/layout/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { trackPageView } from "./lib/analytics";
import { ClassesPage } from "./pages/ClassesPage";
import { ClassFolderPage } from "./pages/ClassFolderPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeckPage } from "./pages/DeckPage";
import { ExerciseSetPage } from "./pages/ExerciseSetPage";
import { PracticeSessionPage } from "./pages/PracticeSessionPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { MessagesPage } from "./pages/MessagesPage";
import { NoteEditorPage } from "./pages/NoteEditorPage";
import { SignupPage } from "./pages/SignupPage";
import { StudySessionPage } from "./pages/StudySessionPage";
import { WelcomePage } from "./pages/WelcomePage";

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

function App() {
  return (
    <AuthProvider>
      <AnalyticsTracker />
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
        <Route path="/groups" element={protect(<MessagesPage />)} />
        <Route path="/messages" element={<Navigate to="/groups" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
