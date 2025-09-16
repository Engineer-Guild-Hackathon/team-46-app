// New simplified approach (previous canvas approach badly over-estimated):
// 1. Determine usable content box (subtract padding).
// 2. Derive lineHeight (px) & font setup (can be overridden via opts).
// 3. Binary search for max words that fit on ONE line (nowrap probe).
// 4. lines = floor(usableHeight / lineHeight).
// 5. wordsPerPage = wordsPerLine * lines.
// This yields tighter, empirically stable estimates (within ~5-10%).

export interface WordsPerPageOptions {
  fontSize?: number; // explicit font size in px (otherwise taken from element)
  lineHeight?: number; // explicit line height in px (or multiplier > 0 & < 10)
  maxWordsPerLine?: number; // (legacy – ignored by new algo)
  maxLines?: number; // safety cap (default 120)
  sampleWords?: string[]; // optional custom sample vocabulary for probe
}

export function computeWordsPerPage(
  el: HTMLElement | null,
  opts: WordsPerPageOptions = {},
): number {
  // Fallback when element not yet in DOM (skeleton phase): conservative guess
  if (!el) return 90;
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const padTop = parseFloat(style.paddingTop) || 0;
  const padBottom = parseFloat(style.paddingBottom) || 0;
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const padRight = parseFloat(style.paddingRight) || 0;
  const innerWidth = Math.max(
    0,
    (rect.width || el.clientWidth) - padLeft - padRight,
  );
  const innerHeight = Math.max(
    0,
    (rect.height || el.clientHeight) - padTop - padBottom,
  );

  // Font size
  const computedFontSize = parseFloat(style.fontSize) || 16;
  const fontSize = opts.fontSize || computedFontSize;

  // Line height: allow explicit px, multiplier, or fallback
  let lineHeightPx: number;
  if (opts.lineHeight) {
    if (opts.lineHeight < 10) lineHeightPx = opts.lineHeight * fontSize;
    else lineHeightPx = opts.lineHeight;
  } else {
    const lh = style.lineHeight;
    if (!lh || lh === "normal") lineHeightPx = fontSize * 1.35;
    else if (lh.endsWith("px")) lineHeightPx = parseFloat(lh);
    else {
      const parsed = parseFloat(lh);
      lineHeightPx =
        !Number.isNaN(parsed) && parsed > 0 && parsed < 10
          ? parsed * fontSize
          : fontSize * 1.35;
    }
  }

  const maxLines = opts.maxLines ?? 120;
  if (innerWidth < 40 || innerHeight < lineHeightPx) return 1;

  // FULL WRAPPING PROBE: measure words that fit in the whole rectangle (width+height)
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.left = "-9999px";
  probe.style.top = "-9999px";
  probe.style.width = innerWidth + "px";
  probe.style.height = innerHeight + "px";
  probe.style.overflow = "hidden";
  probe.style.whiteSpace = "normal";
  probe.style.fontFamily = style.fontFamily;
  probe.style.fontWeight = style.fontWeight;
  probe.style.fontSize = fontSize + "px";
  probe.style.lineHeight = lineHeightPx + "px";
  probe.style.letterSpacing = style.letterSpacing;
  probe.style.wordSpacing = style.wordSpacing;
  probe.style.padding = "0";
  probe.style.margin = "0";
  document.body.appendChild(probe);

  const vocab = opts.sampleWords ?? [
    "reading",
    "example",
    "language",
    "learning",
    "simple",
    "translation",
    "chapter",
    "through",
    "between",
    "important",
    "remember",
    "together",
    "during",
    "present",
    "another",
    "different",
    "question",
    "little",
    "people",
    "before",
  ];
  const build = (count: number) => {
    const arr: string[] = [];
    for (let i = 0; i < count; i++) arr.push(vocab[i % vocab.length]);
    return arr.join(" ") + " ";
  };

  // Heuristic upper bound: average word (incl space) ≈ 7 * fontSize/16 px
  const approxWordWidth = fontSize * 0.55;
  const approxWordsPerLine = Math.max(
    1,
    Math.floor(innerWidth / approxWordWidth),
  );
  const approxLines = Math.min(
    maxLines,
    Math.floor(innerHeight / lineHeightPx),
  );
  let hi = Math.min(approxWordsPerLine * approxLines * 2, 3000);
  if (hi < 50) hi = 50;
  let lo = 1;
  let best = 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    probe.textContent = build(mid);
    const overflow = probe.scrollHeight > probe.clientHeight + 1;
    if (!overflow) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  document.body.removeChild(probe);

  // Empirical cap: typical reading pane rarely exceeds 230 words at 1.25rem.
  const capped = Math.min(best, 240);
  console.debug("[wpp] wrap-probe", {
    innerWidth,
    innerHeight,
    fontSize,
    lineHeightPx,
    approxWordWidth,
    approxWordsPerLine,
    approxLines,
    rawBest: best,
    capped,
  });
  return Math.max(1, capped);
}

export function observeWordsPerPage(
  el: HTMLElement | null,
  cb: (n: number) => void,
  opts: WordsPerPageOptions = {},
) {
  if (!el) return () => {};
  const recompute = () => cb(computeWordsPerPage(el, opts));
  const ro = new ResizeObserver(() => requestAnimationFrame(recompute));
  ro.observe(el);
  window.addEventListener("resize", recompute);
  requestAnimationFrame(recompute);
  return () => {
    ro.disconnect();
    window.removeEventListener("resize", recompute);
  };
}
