import { createContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, configureApiClient } from "../api/client";

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  hasOnboarded: boolean;
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: {
    displayName?: string;
    avatarUrl?: string | null;
    hasOnboarded?: true;
  }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    configureApiClient(
      () => accessTokenRef.current,
      (token) => {
        accessTokenRef.current = token;
      },
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.post<{ accessToken: string }>("/auth/refresh");
        accessTokenRef.current = data.accessToken;
        const me = await api.get<User>("/auth/me");
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const data = await api.post<{ accessToken: string; user: User }>("/auth/login", {
      email,
      password,
    });
    accessTokenRef.current = data.accessToken;
    setUser(data.user);
  }

  async function signup(email: string, password: string, displayName: string) {
    const data = await api.post<{ accessToken: string; user: User }>("/auth/signup", {
      email,
      password,
      displayName,
    });
    accessTokenRef.current = data.accessToken;
    setUser(data.user);
  }

  async function logout() {
    await api.post("/auth/logout").catch(() => {});
    accessTokenRef.current = null;
    setUser(null);
  }

  async function updateProfile(updates: {
    displayName?: string;
    avatarUrl?: string | null;
    hasOnboarded?: true;
  }) {
    const updated = await api.patch<User>("/auth/me", updates);
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
