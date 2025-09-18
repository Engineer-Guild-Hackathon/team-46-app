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
  if (cards.some((c) => c.id === item.id)) return false;
  const next = [...cards, { ...item, back: item.back ?? "" }];
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
