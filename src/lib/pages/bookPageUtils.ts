// Utilities for BookPage component: rendering and pointer/word selection helpers
export type Sentence = {
  type: "text" | "subtitle";
  en: string;
  jp?: string;
  // legacy word-level translations (kept for backward compatibility)
  jp_word?: string[];
  // phrase-level segmentation uses en_word as provided by backend
  en_word?: string[];
  level?: string;
  sentenceNo?: number;
};

export function esc(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatSentence(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

export function renderSentenceHTML(
  i: number,
  s: Sentence,
  highlightSet?: Set<number>,
  tooltipVisible?: boolean,
  tooltipWordIdx?: number,
): string {
  const raw = formatSentence(s.en);
  // If phrase segmentation is provided (via en_word array), render phrases by
  // merging base words with a two-pointer algorithm to preserve punctuation.
  const enPhrases =
    Array.isArray(s.en_word) && s.en_word.length > 0 ? s.en_word : null;
  if (enPhrases) {
    const wordRe = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
    // Collect base word matches with positions
    const wordMatches: Array<{ start: number; end: number; text: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = wordRe.exec(raw)) !== null) {
      wordMatches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
      });
    }
    const out: string[] = [];
    let prevEnd = 0;
    let wi = 0; // index in wordMatches
    let pi = 0; // index in enPhrases
    while (pi < enPhrases.length && wi < wordMatches.length) {
      const phr = (enPhrases[pi] || "").trim();
      if (phr === "") {
        pi++;
        continue;
      }
      // Split phrase into words using the same regex to normalize
      const parts: string[] = [];
      let mm: RegExpExecArray | null;
      wordRe.lastIndex = 0;
      while ((mm = wordRe.exec(phr)) !== null) parts.push(mm[0]);
      const len = parts.length || 1;
      // Compare the next `len` base words to the phrase parts
      const slice = wordMatches.slice(wi, wi + len);
      const joined = slice.map((w) => w.text).join(" ");
      const want = parts.join(" ");
      if (slice.length === len && joined.toLowerCase() === want.toLowerCase()) {
        const start = slice[0].start;
        const end = slice[slice.length - 1].end;
        // push any text between previous end and this phrase start (spaces/punct)
        if (start > prevEnd) out.push(esc(raw.slice(prevEnd, start)));
        const visible = raw.slice(start, end);
        const isHighlighted = !!highlightSet && highlightSet.has(pi);
        const baseCls = "word inline relative cursor-pointer whitespace-normal";
        const highlightCls =
          "text-[#0a56ad] underline decoration-[#0a56ad] decoration-2 underline-offset-2";
        const cls = isHighlighted ? `${baseCls} ${highlightCls}` : baseCls;
        if (isHighlighted && tooltipVisible && pi === tooltipWordIdx) {
          const jp = s.jp_word?.[pi];
          const tip =
            jp && jp.trim() !== "" ? esc(jp) : "Translation unavailable";
          const tipCls =
            "word-tooltip absolute left-1/2 -translate-x-1/2 bottom-full mb-2 transform bg-slate-800 text-white text-xs leading-tight px-2 py-1 rounded shadow z-50 pointer-events-none whitespace-nowrap";
          out.push(
            `<span class="${cls}" data-wi="${pi}">${esc(visible)}<span class="${tipCls}" aria-label="Japanese translation">${tip}</span></span>`,
          );
        } else {
          out.push(
            `<span class="${cls}" data-wi="${pi}">${esc(visible)}</span>`,
          );
        }
        prevEnd = end;
        wi += len;
        pi++;
      } else {
        // If phrase doesn't align (unexpected), fallback to single base word as its own segment
        const w = wordMatches[wi];
        if (w.start > prevEnd) out.push(esc(raw.slice(prevEnd, w.start)));
        const isHighlighted = !!highlightSet && highlightSet.has(pi);
        const baseCls = "word inline relative cursor-pointer whitespace-normal";
        const highlightCls =
          "text-[#0a56ad] underline decoration-[#0a56ad] decoration-2 underline-offset-2";
        const cls = isHighlighted ? `${baseCls} ${highlightCls}` : baseCls;
        out.push(`<span class="${cls}" data-wi="${pi}">${esc(w.text)}</span>`);
        prevEnd = w.end;
        wi += 1;
        pi += 1; // advance phrase as well to keep indices roughly aligned
      }
    }
    // flush remaining tail text (including any punctuation after the last word)
    if (wi < wordMatches.length) {
      const lastEnd = wordMatches[wordMatches.length - 1].end;
      if (prevEnd < lastEnd) out.push(esc(raw.slice(prevEnd, lastEnd)));
      prevEnd = lastEnd;
    }
    if (prevEnd < raw.length) out.push(esc(raw.slice(prevEnd)));
    return out.join("");
  }

  // Split into italic segments using underscore delimiters: _..._
  // Underscores are removed from output; text between is italic.
  const segments: Array<{ text: string; italic: boolean }> = [];
  {
    let italic = false;
    let buf = "";
    for (let ci = 0; ci < raw.length; ci++) {
      const ch = raw[ci];
      if (ch === "_") {
        if (buf) {
          segments.push({ text: buf, italic });
          buf = "";
        }
        italic = !italic;
      } else {
        buf += ch;
      }
    }
    if (buf) segments.push({ text: buf, italic });
  }

  // match words including internal apostrophes (ASCII and Unicode) and hyphens
  const re = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
  let wi = 0;
  const out: string[] = [];
  for (const seg of segments) {
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg.text)) !== null) {
      if (m.index > last) {
        const plain = esc(seg.text.slice(last, m.index));
        if (plain)
          out.push(seg.italic ? `<span class="italic">${plain}</span>` : plain);
      }
      const word = m[0];
      const isHighlighted = !!highlightSet && highlightSet.has(wi);
      const baseCls = "word inline relative cursor-pointer whitespace-normal";
      const highlightCls =
        "text-secondary-foreground underline decoration-secondary-foreground decoration-2 underline-offset-2";
      const cls =
        (isHighlighted ? `${baseCls} ${highlightCls}` : baseCls) +
        (seg.italic ? " italic" : "");
      if (isHighlighted && tooltipVisible && wi === tooltipWordIdx) {
        const jpWord = s.jp_word?.[wi];
        const tip =
          jpWord && jpWord.trim() !== ""
            ? esc(jpWord)
            : "Translation unavailable";
        const tipCls =
          "word-tooltip absolute left-1/2 -translate-x-1/2 bottom-full mb-2 transform bg-slate-800 text-white text-xs leading-tight px-2 py-1 rounded shadow z-50 pointer-events-none whitespace-nowrap";
        out.push(
          `<span class="${cls}" data-wi="${wi}">${esc(word)}<span class="${tipCls}" aria-label="Japanese translation">${tip}</span></span>`,
        );
      } else {
        out.push(`<span class="${cls}" data-wi="${wi}">${esc(word)}</span>`);
      }
      wi++;
      last = m.index + word.length;
    }
    if (last < seg.text.length) {
      const rest = esc(seg.text.slice(last));
      if (rest)
        out.push(seg.italic ? `<span class="italic">${rest}</span>` : rest);
    }
  }
  return out.join("");
}

// Pointer helpers: work on a sentence element (span) and return a word index or undefined
export function pickWordByRatio(
  spanEl: HTMLElement | null,
  e: PointerEvent,
): number | undefined {
  if (!spanEl) return undefined;
  const wordEls = Array.from(
    spanEl.querySelectorAll("span.word"),
  ) as HTMLElement[];
  if (wordEls.length === 0) return undefined;
  const rect = spanEl.getBoundingClientRect();
  const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
  const ratio = rect.width > 0 ? x / rect.width : 0;
  const idx = Math.min(
    wordEls.length - 1,
    Math.max(0, Math.floor(ratio * wordEls.length)),
  );
  const target = wordEls[idx];
  if (target && target.dataset?.wi) return Number(target.dataset.wi);
  return undefined;
}

export function selectWordAtPointer(
  spanEl: HTMLElement | null,
  e: PointerEvent,
): number | undefined {
  if (!spanEl) return undefined;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  // Only select when the event target (or its closest ancestor) is a
  // `.word` span (which is a phrase span logically). Avoid heuristic fallback by ratio because clicks on
  // punctuation or whitespace should not select a nearby word.
  if (el && spanEl.contains(el)) {
    const candidate = el.closest("span.word") as HTMLElement | null;
    if (candidate && candidate.dataset?.wi !== undefined) {
      const idx = Number(candidate.dataset.wi);
      if (!Number.isNaN(idx)) return idx;
    }
  }
  return undefined;
}
