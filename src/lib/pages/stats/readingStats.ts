export type ReadingStats = {
  weekStart: string; // YYYY-MM-DD (local)
  daily: number[]; // Mon..Sun (length 7)
  currentStreak: number; // consecutive days with >0 ending at lastReadDate
  longestStreak: number;
  lastReadDate?: string; // YYYY-MM-DD (local)
};

export const STORAGE_KEY = "reading-stats-v1";

const pad = (n: number) => n.toString().padStart(2, "0");
export const toYMDLocal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const dayStartLocal = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const startOfWeekMonday = (d: Date) => {
  const ds = dayStartLocal(d);
  const dow = ds.getDay(); // 0=Sun..6=Sat
  const monIndex = (dow + 6) % 7; // 0 for Mon, 6 for Sun
  const res = new Date(ds);
  res.setDate(res.getDate() - monIndex);
  return res;
};

const dayDiff = (a: Date, b: Date) => {
  const ms = dayStartLocal(a).getTime() - dayStartLocal(b).getTime();
  return Math.round(ms / 86400000);
};

export function defaultStats(today = new Date()): ReadingStats {
  const weekStart = toYMDLocal(startOfWeekMonday(today));
  return {
    weekStart,
    daily: Array(7).fill(0),
    currentStreak: 0,
    longestStreak: 0,
    lastReadDate: undefined,
  };
}

export function loadStats(): ReadingStats {
  if (typeof localStorage === "undefined") return defaultStats();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: ReadingStats | null = raw ? JSON.parse(raw) : null;
    const now = new Date();
    const thisWeekStart = toYMDLocal(startOfWeekMonday(now));
    if (!parsed) {
      const s = defaultStats(now);
      s.weekStart = thisWeekStart;
      return s;
    }
    if (parsed.weekStart !== thisWeekStart) {
      parsed.weekStart = thisWeekStart;
      parsed.daily = Array(7).fill(0);
    }
    if (!Array.isArray(parsed.daily) || parsed.daily.length !== 7) {
      parsed.daily = Array(7).fill(0);
    }
    return parsed;
  } catch {
    return defaultStats();
  }
}

export function saveStats(s: ReadingStats) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const dayIndexInWeek = (d: Date) => {
  const mon = startOfWeekMonday(d).getTime();
  const dd = dayStartLocal(d).getTime();
  return Math.max(0, Math.min(6, Math.round((dd - mon) / 86400000)));
};

// Record words read into persistent stats. Returns updated stats.
export function recordWordsRead(
  amount: number,
  when: Date = new Date(),
): ReadingStats {
  if (!amount || amount <= 0) return loadStats();
  let stats = loadStats();
  const thisWeekStart = toYMDLocal(startOfWeekMonday(when));
  if (stats.weekStart !== thisWeekStart) {
    stats = { ...stats, weekStart: thisWeekStart, daily: Array(7).fill(0) };
  }
  const idx = dayIndexInWeek(when);
  const daily = stats.daily.slice();
  daily[idx] = (daily[idx] ?? 0) + amount;

  // Streaks
  let currentStreak = stats.currentStreak;
  const ymd = toYMDLocal(when);
  if (!stats.lastReadDate) {
    currentStreak = 1;
  } else {
    const [Y, M, D] = stats.lastReadDate.split("-").map((x) => parseInt(x, 10));
    const lastDate = new Date(Y, M - 1, D);
    const diff = dayDiff(when, lastDate);
    if (diff === 0) currentStreak = Math.max(1, currentStreak);
    else if (diff === 1) currentStreak = currentStreak + 1;
    else if (diff > 1) currentStreak = 1;
  }
  const longestStreak = Math.max(stats.longestStreak, currentStreak);

  const updated: ReadingStats = {
    ...stats,
    daily,
    currentStreak,
    longestStreak,
    lastReadDate: ymd,
  };
  saveStats(updated);
  return updated;
}

export const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
