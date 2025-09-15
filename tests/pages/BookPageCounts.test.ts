import { vi, describe, it, expect } from "vitest";

declare global {
  interface Window {
    __VITEST__?: boolean;
  }
}
import { render, waitFor } from "@testing-library/svelte";
import BookPage from "$lib/pages/BookPage.svelte";

describe("BookPage initial telemetry counts", () => {
  it("omits counts (null) on first load", async () => {
    (window as unknown as { __VITEST__?: boolean }).__VITEST__ = true;
    // Minimal RequestInfo fallback type for tests (avoid DOM lib dependency)
    type Req = string | URL;
    const fetchMock = vi.fn(async (input: Req) => {
      const url = String(input);
      if (url.includes("/text")) {
        const u = new URL(url);
        expect(u.searchParams.get("wordClickCount")).toBeNull();
        expect(u.searchParams.get("sentenceClickCount")).toBeNull();
        return new Response(
          JSON.stringify({ rate: null, endSentenceNo: 0, text: [] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(BookPage, { bookId: "test" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), {
      timeout: 1500,
    });
  });
});
