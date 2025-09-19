/**
 * bookProgress.ts
 * Utilities to persist per-book sentence and word click state in localStorage.
 * Storage format: { pages: StoredSentence[][] } (backwards-compatible with
 * a legacy flat StoredSentence[]). The helpers keep persistence logic
 * outside of UI components.
 */

type StoredSentence = {
  type: "text" | "subtitle";
  sentenceNo: number;
  en: string;
  jp?: string;
  jp_word?: string[];
  en_word?: string[];
  word_difficulty?: string[];
  // persisted UI state
  clickedWordIndex: number[];
  sentenceClicked: boolean;
};

const PREFIX = "bookProgress:";
const safeParse = (v: string | null) => {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

function storageKey(bookId: string) {
  return `${PREFIX}${bookId}`;
}

function readStorage(bookId: string): StoredSentence[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(storageKey(bookId));
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed as StoredSentence[];
}

function writeStorage(bookId: string, list: StoredSentence[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(bookId), JSON.stringify(list));
  } catch {
    // ignore quota or unavailable localStorage
  }
}

// New: page-based storage helpers. Format is { pages: StoredSentence[][] }
export function readPages(bookId: string): StoredSentence[][] | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(storageKey(bookId));
  const parsed = safeParse(raw);
  if (!parsed) return null;
  // Accept legacy flat array by wrapping it in a single page
  if (Array.isArray(parsed)) return [parsed as StoredSentence[]];
  if (typeof parsed === "object" && parsed !== null) {
    const asObj = parsed as Record<string, unknown>;
    if (Array.isArray(asObj.pages)) {
      return asObj.pages as StoredSentence[][];
    }
  }
  return null;
}

export function writePages(bookId: string, pages: StoredSentence[][]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(bookId), JSON.stringify({ pages }));
  } catch {
    /* ignore */
  }
}

function makeKey(s: { sentenceNo?: number; en?: string }) {
  // use both sentenceNo and en text to disambiguate non-unique sentenceNo
  return `${s.sentenceNo ?? "-"}::${(s.en || "").slice(0, 128)}`;
}

/**
 * Merge freshly-fetched sentences with any saved UI state. If page-based
 * storage exists, we prefer it; otherwise we read the legacy flat array and
 * upgrade it when appropriate.
 */
export function mergeWithSavedSentences(
  bookId: string,
  incoming: Array<{
    type: "text" | "subtitle";
    sentenceNo: number;
    en: string;
    jp?: string;
    jp_word?: string[];
    en_word?: string[];
    word_difficulty?: string[];
  }>,
) {
  // Read existing saved sentences (prefer page-based storage).
  const pages = readPages(bookId);
  const saved =
    pages && pages.length > 0
      ? ([] as StoredSentence[]).concat(...pages)
      : readStorage(bookId);
  const map = new Map<string, StoredSentence>();
  for (const s of saved) map.set(makeKey(s), s);

  // Build merged list: for each incoming sentence, preserve saved UI state if present.
  // If page-based storage exists, we only map incoming sentences (don't append
  // leftover saved sentences) to avoid changing stored ordering.
  const merged: StoredSentence[] = [];
  for (const s of incoming) {
    const key = makeKey(s);
    const found = map.get(key);
    const entry: StoredSentence = {
      type: s.type,
      sentenceNo: s.sentenceNo,
      en: s.en,
      jp: s.jp,
      jp_word: s.jp_word,
      en_word: s.en_word,
      word_difficulty: s.word_difficulty,
      clickedWordIndex: found?.clickedWordIndex
        ? [...found.clickedWordIndex]
        : [],
      sentenceClicked: !!found?.sentenceClicked,
    };
    merged.push(entry);
    map.delete(key);
  }

  // If there was no page-based storage (we only read a flat array), persist
  // the merged flat list so older storage is upgraded to the pages format.
  if (!pages || pages.length === 0) {
    try {
      writeStorage(bookId, merged);
    } catch {
      /* ignore storage errors */
    }
  }

  return merged;
}

// Upsert helpers to record sentence/word clicks.
function upsert(
  bookId: string,
  patch: Partial<StoredSentence> & { sentenceNo: number; en: string },
) {
  // Try to update within page-based storage first
  const pages = readPages(bookId);
  if (pages && pages.length > 0) {
    let found = false;
    for (let p = 0; p < pages.length; p++) {
      for (let i = 0; i < pages[p].length; i++) {
        if (makeKey(pages[p][i]) === makeKey(patch)) {
          pages[p][i] = { ...pages[p][i], ...patch } as StoredSentence;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      // append to last page
      const entry: StoredSentence = {
        type: patch.type ?? "text",
        sentenceNo: patch.sentenceNo,
        en: patch.en,
        jp: patch.jp,
        jp_word: patch.jp_word,
        en_word: patch.en_word as string[] | undefined,
        word_difficulty: patch.word_difficulty as string[] | undefined,
        clickedWordIndex: patch.clickedWordIndex ?? [],
        sentenceClicked: !!patch.sentenceClicked,
      };
      pages[pages.length - 1].push(entry);
    }
    writePages(bookId, pages);
    return;
  }

  // Fallback: update flat array
  const list = readStorage(bookId);
  const idx = list.findIndex((s) => makeKey(s) === makeKey(patch));
  if (idx >= 0) {
    const base = list[idx];
    list[idx] = { ...base, ...patch } as StoredSentence;
  } else {
    // ensure arrays/flags are present
    const entry: StoredSentence = {
      type: patch.type ?? "text",
      sentenceNo: patch.sentenceNo,
      en: patch.en,
      jp: patch.jp,
      jp_word: patch.jp_word,
      en_word: patch.en_word as string[] | undefined,
      word_difficulty: patch.word_difficulty as string[] | undefined,
      clickedWordIndex: patch.clickedWordIndex ?? [],
      sentenceClicked: !!patch.sentenceClicked,
    };
    list.push(entry);
  }
  // Persist as single-page pages structure (upgrade legacy format)
  writePages(bookId, [list]);
}

export function setSentenceClicked(
  bookId: string,
  sentenceNo: number,
  en: string,
  clicked = true,
) {
  upsert(bookId, { sentenceNo, en, sentenceClicked: clicked });
}

export function addClickedWordIndex(
  bookId: string,
  sentenceNo: number,
  en: string,
  idx: number,
) {
  const pages = readPages(bookId);
  if (pages && pages.length > 0) {
    const key = makeKey({ sentenceNo, en });
    for (let p = 0; p < pages.length; p++) {
      for (let i = 0; i < pages[p].length; i++) {
        const item = pages[p][i];
        if (makeKey(item) === key) {
          const arr = new Set(item.clickedWordIndex || []);
          arr.add(idx);
          item.clickedWordIndex = Array.from(arr).sort((a, b) => a - b);
          writePages(bookId, pages);
          return;
        }
      }
    }
    // not found -> append to last page
    const entry: StoredSentence = {
      type: "text",
      sentenceNo,
      en,
      clickedWordIndex: [idx],
      sentenceClicked: false,
    };
    pages[pages.length - 1].push(entry);
    writePages(bookId, pages);
    return;
  }

  // fallback to flat array
  const list = readStorage(bookId);
  const key = makeKey({ sentenceNo, en });
  const i = list.findIndex((s) => makeKey(s) === key);
  if (i >= 0) {
    const item = list[i];
    const arr = new Set(item.clickedWordIndex || []);
    arr.add(idx);
    item.clickedWordIndex = Array.from(arr).sort((a, b) => a - b);
    // persist as pages
    writePages(bookId, [list]);
    return;
  }
  // create new
  const entry: StoredSentence = {
    type: "text",
    sentenceNo,
    en,
    clickedWordIndex: [idx],
    sentenceClicked: false,
  };
  list.push(entry);
  writePages(bookId, [list]);
}

export function removeClickedWordIndex(
  bookId: string,
  sentenceNo: number,
  en: string,
  idx: number,
) {
  const pages = readPages(bookId);
  if (pages && pages.length > 0) {
    const key = makeKey({ sentenceNo, en });
    for (let p = 0; p < pages.length; p++) {
      for (let i = 0; i < pages[p].length; i++) {
        const item = pages[p][i];
        if (makeKey(item) === key) {
          item.clickedWordIndex = (item.clickedWordIndex || []).filter(
            (v) => v !== idx,
          );
          writePages(bookId, pages);
          return;
        }
      }
    }
    return;
  }

  const list = readStorage(bookId);
  const key = makeKey({ sentenceNo, en });
  const i = list.findIndex((s) => makeKey(s) === key);
  if (i >= 0) {
    const item = list[i];
    item.clickedWordIndex = (item.clickedWordIndex || []).filter(
      (v) => v !== idx,
    );
    writePages(bookId, [list]);
  }
}
