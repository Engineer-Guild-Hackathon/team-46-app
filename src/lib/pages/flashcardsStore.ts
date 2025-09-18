export type FlashcardItem = {
  id: string; // unique identifier, e.g., the word
  front: string; // prompt (e.g., word)
  back?: string; // answer (e.g., definition); optional
};

const KEY = "flashcards-cards-v1";

export function loadCards(): FlashcardItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as FlashcardItem[]) : [];
    return Array.isArray(list) ? list.filter((c) => !!c && !!c.id) : [];
  } catch {
    return [];
  }
}

export function saveCards(cards: FlashcardItem[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cards));
  } catch {
    /* ignore */
  }
}

export function addCardIfMissing(item: FlashcardItem): boolean {
  const cards = loadCards();
  const idx = cards.findIndex((c) => c.id === item.id);
  if (idx === -1) {
    const next = [...cards, { ...item, back: item.back ?? "" }];
    saveCards(next);
    return true; // added new card
  }
  // Card exists: append definition if new and non-empty
  const existing = cards[idx];
  const incoming = (item.back ?? "").trim();
  if (!incoming) return false; // nothing to append
  const currentBack = (existing.back ?? "").trim();
  if (currentBack.length === 0) {
    const updated = { ...existing, back: incoming };
    const next = cards.slice();
    next[idx] = updated;
    saveCards(next);
    return true; // updated
  }
  // Avoid duplicates: split by our delimiter and compare trimmed tokens
  const delim = " / ";
  const parts = currentBack
    .split(delim)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.includes(incoming)) return false; // already present
  const updated = { ...existing, back: currentBack + delim + incoming };
  const next = cards.slice();
  next[idx] = updated;
  saveCards(next);
  return true; // appended
}

export function removeCard(id: string): boolean {
  const cards = loadCards();
  const next = cards.filter((c) => c.id !== id);
  if (next.length === cards.length) return false;
  saveCards(next);
  return true;
}

export function clearCards() {
  saveCards([]);
}
