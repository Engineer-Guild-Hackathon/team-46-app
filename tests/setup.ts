import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/svelte";

// Auto cleanup DOM between tests
afterEach(() => {
  cleanup();
});

// Polyfill IntersectionObserver for jsdom
// Provide minimal type fallbacks when DOM lib isn't fully available (jsdom already injects most)
type _IOCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver,
) => void;

if (
  typeof (globalThis as unknown as { IntersectionObserver?: unknown })
    .IntersectionObserver === "undefined"
) {
  class IO implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];
    constructor(private cb: _IOCallback) {}
    disconnect(): void {}
    observe(target: Element): void {
      const rect = target.getBoundingClientRect();
      const entry: IntersectionObserverEntry = {
        time: Date.now(),
        target,
        isIntersecting: true,
        intersectionRatio: 1,
        boundingClientRect: rect,
        intersectionRect: rect,
        rootBounds: rect,
      };
      queueMicrotask(() => this.cb([entry], this));
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    unobserve(): void {}
  }
  (
    globalThis as unknown as {
      IntersectionObserver: typeof IntersectionObserver;
    }
  ).IntersectionObserver = IO as unknown as typeof IntersectionObserver;
}

// Improved fetch mock returning deterministic book pages
// Narrow input to string | URL to avoid relying on RequestInfo type
const fetchMock = vi.fn(async (input: string | URL) => {
  const urlStr = typeof input === "string" ? input : input.toString();
  if (urlStr.startsWith("/api/books")) {
    const params = new URL(urlStr, "http://localhost").searchParams;
    const start = Number(params.get("start") || "0");
    const size = Number(params.get("size") || "12");
    const raw: Record<string, { title: string; author: string }> = {};
    for (let i = start; i < start + Math.min(size, 2); i++) {
      raw["ID" + i] = { title: "Book " + i, author: "Author " + i };
    }
    return new Response(JSON.stringify(raw), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response("Not Mocked", { status: 404 });
});
globalThis.fetch = fetchMock as unknown as typeof fetch;

// Basic ResizeObserver polyfill for jsdom (only invokes callback once per observe)
if (!(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver) {
  // Minimal ResizeObserver callback + entry types for test environment
  interface _ROEntry {
    target: Element;
    contentRect: DOMRect;
  }
  type _ROCB = (entries: _ROEntry[], observer: RO) => void;
  class RO {
    private _cb: _ROCB;
    constructor(cb: _ROCB) {
      this._cb = cb;
    }
    observe(target: Element) {
      setTimeout(() => {
        const entry: _ROEntry[] = [
          { target, contentRect: target.getBoundingClientRect() },
        ];
        try {
          this._cb(entry, this);
        } catch {
          /* ignore callback errors */
        }
      }, 0);
    }
    unobserve() {
      /* noop */
    }
    disconnect() {
      /* noop */
    }
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    RO as unknown;
}

// Polyfill window.matchMedia for components relying on media queries in jsdom
if (
  typeof window !== "undefined" &&
  typeof (window as unknown as { matchMedia?: unknown }).matchMedia !== "function"
) {
  window.matchMedia = (query: string) => {
    const mql: MediaQueryList = {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // deprecated API
      removeListener: () => {}, // deprecated API
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
    return mql;
  };
}
