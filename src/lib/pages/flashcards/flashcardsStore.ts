export type FlashcardItem = {
  id: string; // unique identifier, e.g., the word
  front: string; // prompt (e.g., word)
  back?: string; // answer (e.g., definition); optional
};

const KEY = "flashcards-cards-v1";
export const DEF_DELIM = " / ";

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
    console.debug("[Flashcards] add new", {
      id: item.id,
      front: item.front,
      back: item.back,
    });
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
    console.debug("[Flashcards] set first def", {
      id: item.id,
      back: incoming,
    });
    saveCards(next);
    return true; // updated
  }
  // Avoid duplicates: split by our delimiter and compare trimmed tokens
  const parts = currentBack
    .split(DEF_DELIM)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.includes(incoming)) return false; // already present
  const updated = { ...existing, back: currentBack + DEF_DELIM + incoming };
  const next = cards.slice();
  next[idx] = updated;
  console.debug("[Flashcards] append def", {
    id: item.id,
    added: incoming,
    back: updated.back,
  });
  saveCards(next);
  return true; // appended
}

/** Remove a specific definition from a card; if none remain, delete the card. */
export function removeDefinitionOrDelete(id: string, def: string): boolean {
  const cards = loadCards();
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  const current = cards[idx];
  const toRemove = (def ?? "").trim();
  if (!toRemove) return false;
  const parts = (current.back ?? "")
    .split(DEF_DELIM)
    .map((p) => p.trim())
    .filter(Boolean);
  console.debug("[Flashcards] remove def?", {
    id,
    toRemove,
    currentBack: current.back,
    tokens: parts,
  });
  const filtered = parts.filter((p) => p !== toRemove);
  if (filtered.length === parts.length) return false; // nothing removed
  if (filtered.length === 0) {
    const next = cards.filter((c) => c.id !== id);
    console.debug("[Flashcards] delete card", { id });
    saveCards(next);
    return true;
  }
  const updated = { ...current, back: filtered.join(DEF_DELIM) };
  const next = cards.slice();
  next[idx] = updated;
  console.debug("[Flashcards] removed def", { id, newBack: updated.back });
  saveCards(next);
  return true;
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
