// Utilities for BookPage component: rendering and pointer/word selection helpers
export type Sentence = {
  type: "text" | "subtitle";
  en: string;
  jp?: string;
  jp_word?: string[];
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
  const re = /[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g;
  let last = 0;
  let wi = 0;
  let out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) {
      out.push(esc(raw.slice(last, m.index)));
    }
    const word = m[0];
    const isHighlighted = !!highlightSet && highlightSet.has(wi);
    // Keep the structural class names (word / word-tooltip) so JS selectors
    // continue to work, but also emit Tailwind utility classes for styling.
    // Highlighted words become blue, bold and underlined via Tailwind.
    const baseCls = "word inline relative cursor-pointer whitespace-normal";
    const highlightCls =
      "text-[#0a56ad] underline decoration-[#0a56ad] decoration-2 underline-offset-2";
    const cls = isHighlighted ? `${baseCls} ${highlightCls}` : baseCls;
    if (isHighlighted && tooltipVisible && wi === tooltipWordIdx) {
      const jpWord = s.jp_word?.[wi];
      const tip =
        jpWord && jpWord.trim() !== ""
          ? esc(jpWord)
          : "Translation unavailable";
      // Tooltip uses Tailwind utilities for visual styling and absolute placement
      // JS positioning will adjust inline styles for edge cases (flip/shift).
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
  if (last < raw.length) out.push(esc(raw.slice(last)));
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
  if (target && target.dataset.wi) return Number(target.dataset.wi);
  return undefined;
}

export function selectWordAtPointer(
  spanEl: HTMLElement | null,
  e: PointerEvent,
): number | undefined {
  if (!spanEl) return undefined;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && spanEl.contains(el)) {
    const candidate = (el.closest("span.word") || el) as HTMLElement;
    if (candidate && candidate.dataset?.wi !== undefined) {
      const idx = Number(candidate.dataset.wi);
      if (!Number.isNaN(idx)) return idx;
    }
  }
  return pickWordByRatio(spanEl, e);
}
