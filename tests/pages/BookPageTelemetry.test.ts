import { describe, it, expect, vi } from "vitest";

declare global {
  interface Window {
    __VITEST__?: boolean;
    __bookPageForceNext?: () => void;
  }
}
import { render, waitFor } from "@testing-library/svelte";
import BookPage from "$lib/pages/book/BookPage.svelte";

// Helper to parse URL params
function getParam(url: string, key: string) {
  const u = new URL(url);
  return u.searchParams.get(key);
}

describe("BookPage telemetry first vs subsequent loads", () => {
  it("sends null counts first then zero on second page load with no interactions", async () => {
    (
      window as unknown as {
        __VITEST__?: boolean;
        __bookPageForceNext?: () => void;
      }
    ).__VITEST__ = true;
    let callIndex = 0;
    type Req = string | URL;
    vi.stubGlobal("fetch", (input: Req) => {
      const url = String(input);
      if (url.includes("/text")) {
        callIndex++;
        const word = getParam(url, "wordClickCount");
        const sentence = getParam(url, "sentenceClickCount");
        if (callIndex === 1) {
          // first load -> null omitted from query (should be absent)
          expect(word).toBeNull();
          expect(sentence).toBeNull();
        } else if (callIndex === 2) {
          // second load, no clicks performed -> should send 0
          expect(word).toBe("0");
          expect(sentence).toBe("0");
        }
        // Return at least one sentence so lastEnd updates and second load param changes
        return Promise.resolve(
          new Response(
            JSON.stringify({
              rate: null,
              endSentenceNo: callIndex * 10,
              text: [
                {
                  type: "text",
                  sentenceNo: callIndex * 10 - 9,
                  en: "Hello world " + callIndex,
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ) as Promise<Response>;
      }
      return Promise.resolve(
        new Response("{}", { status: 200 }),
      ) as Promise<Response>;
    });

    render(BookPage, { bookId: "telemetry" });
    // wait for first load
    await waitFor(() => expect(callIndex).toBe(1), { timeout: 1500 });
    // trigger a second load via test hook
    (
      window as unknown as { __bookPageForceNext?: () => void }
    ).__bookPageForceNext?.();
    await waitFor(() => expect(callIndex).toBeGreaterThanOrEqual(2), {
      timeout: 1500,
    });
  });
});
