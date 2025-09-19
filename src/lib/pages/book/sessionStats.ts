export type SessionStats = {
  wordsRead: number;
  wordsLearned: number;
  timeSpent: number; // in milliseconds
  startTime: number; // timestamp
};

const SESSION_KEY = "current-book-session";
const COMPLETED_SESSION_KEY = "completed-book-session";

export function initSession(): SessionStats {
  const session: SessionStats = {
    wordsRead: 0,
    wordsLearned: 0,
    timeSpent: 0,
    startTime: Date.now(),
  };

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* ignore storage errors */
    }
  }

  return session;
}

export function getSession(): SessionStats | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function updateSessionWordsRead(count: number): SessionStats | null {
  const session = getSession();
  if (!session) return null;

  session.wordsRead += count;

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* ignore storage errors */
    }
  }

  return session;
}

export function updateSessionWordsLearned(
  count: number = 1,
): SessionStats | null {
  const session = getSession();
  if (!session) return null;

  session.wordsLearned += count;

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* ignore storage errors */
    }
  }

  return session;
}

export function getSessionDuration(): number {
  const session = getSession();
  if (!session) return 0;

  return Date.now() - session.startTime;
}

export function clearSession(): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore storage errors */
    }
  }
}

export function completeSession(): SessionStats | null {
  const session = getSession();
  if (!session) return null;

  // Calculate final time spent
  const finalSession = {
    ...session,
    timeSpent: Date.now() - session.startTime,
  };

  if (typeof localStorage !== "undefined") {
    try {
      // Save completed session for main page to pick up
      localStorage.setItem(COMPLETED_SESSION_KEY, JSON.stringify(finalSession));
      // Clear current session
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore storage errors */
    }
  }

  return finalSession;
}

export function getCompletedSession(): SessionStats | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(COMPLETED_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCompletedSession(): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(COMPLETED_SESSION_KEY);
    } catch {
      /* ignore storage errors */
    }
  }
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
