// Generic API client helpers for the FlexRead backend
// The backend currently exposes a Google Cloud Function endpoint for books.
// We keep this file intentionally small and framework agnostic so it can be
// reused inside Svelte load functions, components, or custom stores.

// Ensure DOM lib types; if ambient types missing (node test), fall back to minimal declarations.
// (ESLint no-undef flagged RequestInit in some contexts.)
// Infer the init type from global fetch without using explicit 'any'. Fallback to generic object.
type _FetchFn = typeof fetch extends (
  input: infer _I,
  init?: infer R,
) => Promise<unknown>
  ? { init: R }
  : never;
type _RequestInit = _FetchFn extends { init: infer R }
  ? R
  : Record<string, unknown>;

export interface RequestOptions {
  /** Additional fetch init overrides */
  init?: _RequestInit;
  /** Abort controller signal to cancel an in-flight request */
  signal?: AbortSignal;
  /** Optional timeout (ms). Defaults to 10s if not provided. */
  timeoutMs?: number;
  /** Number of retry attempts on retryable failures (5xx/429/network). Default: 3 */
  retries?: number;
  /** Base delay for exponential backoff in ms. Default: 300 */
  retryBaseMs?: number;
  /** Minimum interval between repeated calls to the same URL+query in ms. Default: 2000 */
  minIntervalMs?: number;
}

const BOOKS_ENDPOINT =
  "https://us-central1-flexread-egh.cloudfunctions.net/books";
const TEXT_ENDPOINT =
  "https://us-central1-flexread-egh.cloudfunctions.net/text";

/** Build a query string from an object, skipping undefined / null values */
export function buildQuery(params: Record<string, unknown> = {}): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.append(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

/** Low-level request wrapper (GET only for now) */
export async function getJson<T>(
  url: string,
  params?: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<T> {
  const fullUrl = `${url}${buildQuery(params)}`;
  const timeoutMs = Math.max(0, options.timeoutMs ?? 10000);
  const retries = Math.max(0, options.retries ?? 3);
  const base = Math.max(1, options.retryBaseMs ?? 300);
  const isTestEnv =
    typeof process !== "undefined" && process?.env?.NODE_ENV === "test";
  const minInterval = Math.max(
    0,
    options.minIntervalMs ?? (isTestEnv ? 0 : 2000),
  );

  // Enforce per-URL throttle separate from the request timeout
  await enforceMinInterval(fullUrl, minInterval, options.signal);

  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timers: number[] = [];
    const signal = composeSignals(ac.signal, options.signal);
    if (timeoutMs > 0) {
      const t = setTimeout(
        () => ac.abort(new DOMException("Timeout", "AbortError")),
        timeoutMs,
      ) as unknown as number;
      timers.push(t);
    }
    try {
      const res = await fetch(fullUrl, {
        method: "GET",
        ...(options.init || {}),
        signal,
        headers: {
          Accept: "application/json",
          ...(options.init?.headers || {}),
        },
      });
      if (!res.ok) {
        const text = await safeText(res);
        const status = res.status;
        const err = new Error(
          `Request failed (${status} ${res.statusText}) for ${fullUrl}: ${text}`,
        );
        if (attempt < retries && isRetryableStatus(status)) {
          await backoffWait(base, attempt, options.signal);
          continue;
        }
        throw err;
      }
      return (await res.json()) as T;
    } catch (e: any) {
      // Propagate timeout/abort as a clean message
      if (e?.name === "AbortError") {
        lastErr = new Error(
          `Request aborted (timeout ${timeoutMs}ms) for ${fullUrl}`,
        );
      } else if (attempt < retries && isNetworkLikeError(e)) {
        // network error, retry
        await backoffWait(base, attempt, options.signal);
        continue;
      } else {
        lastErr = e;
      }
    } finally {
      for (const t of timers) clearTimeout(t);
    }
    // If we reached here and didn't continue, break
    if (attempt === retries) break;
  }
  throw lastErr ?? new Error(`Unknown error fetching ${fullUrl}`);
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no-body>";
  }
}

export const endpoints = {
  books: BOOKS_ENDPOINT,
  text: TEXT_ENDPOINT,
};

/** Compose multiple abort signals into one signal (aborts when any aborts). */
function composeSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  // If AbortSignal.any exists, use it
  const anyFn = (AbortSignal as any).any as
    | ((signals: AbortSignal[]) => AbortSignal)
    | undefined;
  if (typeof anyFn === "function") return anyFn([a, b]);
  const ac = new AbortController();
  function onAbortFromA() {
    ac.abort(a.reason ?? new DOMException("Aborted", "AbortError"));
  }
  function onAbortFromB() {
    if (!b) return;
    ac.abort(b.reason ?? new DOMException("Aborted", "AbortError"));
  }
  if (a.aborted) onAbortFromA();
  if (b.aborted) onAbortFromB();
  a.addEventListener("abort", onAbortFromA);
  b.addEventListener("abort", onAbortFromB);
  return ac.signal;
}

// Retry helpers
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}
function isNetworkLikeError(e: any): boolean {
  // fetch throws TypeError on network failures in many environments
  return e && (e.name === "TypeError" || e.message?.includes("NetworkError"));
}
async function backoffWait(
  base: number,
  attempt: number,
  signal?: AbortSignal,
) {
  // Exponential backoff with jitter: base * 2^attempt plus 0-100ms
  const jitter = Math.floor(Math.random() * 100);
  const ms = base * Math.pow(2, attempt) + jitter;
  await sleep(ms, signal);
}

// Global per-URL throttle map
const nextAllowed = new Map<string, number>();
async function enforceMinInterval(
  urlWithQuery: string,
  minMs: number,
  signal?: AbortSignal,
) {
  if (minMs <= 0) return;
  const now = Date.now();
  const allowed = nextAllowed.get(urlWithQuery) ?? 0;
  if (allowed > now) {
    await sleep(allowed - now, signal);
  }
  // After finishing the wait, set the next allowed time to now + minMs
  nextAllowed.set(urlWithQuery, Date.now() + minMs);
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const cleanup = () => {
      clearTimeout(t);
      if (signal) signal.removeEventListener("abort", onAbort);
    };
    if (signal) signal.addEventListener("abort", onAbort);
  });
}
