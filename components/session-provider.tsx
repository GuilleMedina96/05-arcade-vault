"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface User {
  name: string;
}

interface Session {
  user: User | null;
  ready: boolean;
  login: (u: User | null) => void;
  signOut: () => void;
  saveScore: (e: { game: string; score: number; name: string }) => void;
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Se lee tras hidratar para no provocar mismatch entre servidor y cliente.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) setUser(JSON.parse(raw) as User | null);
    } catch {}
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const login = useCallback((u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
      else localStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  const saveScore = useCallback(
    (entry: { game: string; score: number; name: string }) => {
      try {
        const all = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
        all.push({ ...entry, at: Date.now() });
        localStorage.setItem(SCORES_KEY, JSON.stringify(all));
      } catch {}
    },
    [],
  );

  const value = useMemo(
    () => ({ user, ready, login, signOut, saveScore }),
    [user, ready, login, signOut, saveScore],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
