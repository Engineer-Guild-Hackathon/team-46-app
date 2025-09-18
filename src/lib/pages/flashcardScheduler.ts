// Simplified SM-2 style scheduler for flashcards
// References: Anki scheduler concepts and SM-2 algorithm

export type Grade = 1 | 2 | 3 | 4 | 5; // 1: Again, 2: (unused), 3: Hard, 4: Good, 5: Easy

export type CardItem = {
  id: string;
  front: string;
  back: string;
};

export type ReviewState = {
  id: string;
  // SM-2 fields
  interval: number; // in days
  ease: number; // EF (default 2.5)
  repetitions: number; // consecutive successful reviews
  due: number; // epoch ms when due
  // metrics
  lapses: number; // times failed
  createdAt: number;
  updatedAt: number;
};

export type ScheduledCard = CardItem & ReviewState;

export const now = () => Date.now();
export const days = (n: number) => n * 24 * 60 * 60 * 1000;

export function initState(card: CardItem, at = now()): ScheduledCard {
  return {
    ...card,
    interval: 0,
    ease: 2.5,
    repetitions: 0,
    due: at,
    lapses: 0,
    createdAt: at,
    updatedAt: at,
  };
}

export function isDue(card: ReviewState, at = now()): boolean {
  return card.due <= at;
}

export type GradeResult = {
  next: ReviewState;
  kind: "new" | "review" | "relearning";
};

// Basic SM-2 adjustments with small tweaks for UX
export function gradeCard(
  state: ReviewState,
  q: Grade,
  at = now(),
): GradeResult {
  // Deep copy primitive fields
  let interval = state.interval;
  let ease = state.ease;
  let repetitions = state.repetitions;
  let lapses = state.lapses;

  const wasNew = repetitions === 0 && interval === 0;

  if (q <= 2) {
    // Again (fail): reset reps, reduce ease, short relearn interval
    repetitions = 0;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    interval = 0; // will set to minutes-equivalent short delay
    const due = at + minutes(10); // 10 minutes relearn
    return {
      next: {
        ...state,
        interval,
        ease,
        repetitions,
        lapses,
        due,
        updatedAt: at,
      },
      kind: wasNew ? "new" : "relearning",
    };
  }

  // Successful recall
  if (repetitions === 0) {
    // First success: introduce day 1
    repetitions = 1;
    interval = 1; // 1 day
  } else if (repetitions === 1) {
    // Second success
    repetitions = 2;
    interval = 3; // 3 days
  } else {
    // Subsequent reviews
    repetitions += 1;
    interval = Math.round(interval * easeFactor(ease, q));
    interval = Math.max(interval, 1);
  }

  // Adjust ease based on quality
  ease = clampEase(ease + easeDelta(q));

  const due = at + days(interval);
  return {
    next: { ...state, interval, ease, repetitions, due, updatedAt: at },
    kind: wasNew ? "new" : "review",
  };
}

function easeFactor(ease: number, q: Grade): number {
  // Hard should grow slower, Good at EF, Easy slightly faster
  if (q === 3) return Math.max(1.2, ease - 0.15);
  if (q === 4) return ease;
  if (q === 5) return ease + 0.15;
  return 1.0;
}

function easeDelta(q: Grade): number {
  switch (q) {
    case 3:
      return -0.05;
    case 4:
      return 0.0;
    case 5:
      return 0.05;
    default:
      return -0.2; // Again
  }
}

function clampEase(e: number): number {
  return Math.min(3.0, Math.max(1.3, e));
}

export function minutes(n: number) {
  return n * 60 * 1000;
}

export type DeckState = {
  cards: ScheduledCard[];
};

export function buildDeck(
  cards: CardItem[],
  existing?: Partial<Record<string, ReviewState>>,
  at = now(),
): DeckState {
  const map = existing ?? {};
  return {
    cards: cards.map((c) => {
      const prev = map[c.id];
      return prev ? { ...c, ...prev } : initState(c, at);
    }),
  };
}

export function dueQueue(deck: DeckState, at = now()): ScheduledCard[] {
  return deck.cards.filter((c) => isDue(c, at)).sort((a, b) => a.due - b.due);
}

export function stats(deck: DeckState, at = now()) {
  const total = deck.cards.length;
  const due = deck.cards.filter((c) => isDue(c, at)).length;
  const newCount = deck.cards.filter(
    (c) => c.repetitions === 0 && c.interval === 0,
  ).length;
  const mature = deck.cards.filter((c) => c.interval >= 21).length;
  return { total, due, new: newCount, mature };
}

// Category helpers for UI grouping
export type Category = "not-learned" | "learning" | "developed" | "mastered";

export function categoryOf(card: ReviewState): Category {
  if (card.repetitions === 0 && card.interval === 0) return "not-learned";
  if (card.interval < 7) return "learning"; // up to ~1 week
  if (card.interval < 21) return "developed"; // 1-3 weeks
  return "mastered"; // 3+ weeks
}

export function categorize(deck: DeckState): Record<Category, number> {
  const res: Record<Category, number> = {
    "not-learned": 0,
    learning: 0,
    developed: 0,
    mastered: 0,
  };
  for (const c of deck.cards) {
    res[categoryOf(c)]++;
  }
  return res;
}

// Persistence helpers
const STORAGE_KEY = "flashcards-state-v1";

export function saveState(deck: DeckState) {
  if (typeof localStorage === "undefined") return;
  const minimal: Record<string, ReviewState> = {} as Record<string, ReviewState>;
  for (const c of deck.cards) {
    const {
      id,
      interval,
      ease,
      repetitions,
      due,
      lapses,
      createdAt,
      updatedAt,
    } = c;
    minimal[id] = {
      id,
      interval,
      ease,
      repetitions,
      due,
      lapses,
      createdAt,
      updatedAt,
    };
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
}

export function loadState(): Partial<Record<string, ReviewState>> | undefined {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
