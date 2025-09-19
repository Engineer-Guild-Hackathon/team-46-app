import { render, waitFor } from "@testing-library/svelte";
// Type-only import for fetch signature
import type { RequestInfo } from "node-fetch";
import { describe, it, expect, beforeEach, vi } from "vitest";
import App from "../../src/App.svelte";

function resetStorage() {
  try {
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
  } catch {
    // ignore
  }
}

describe("App user auto userId integration", () => {
  beforeEach(() => {
    resetStorage();
    // Mock fetch for books list to silence network errors
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/books")) {
        return Promise.resolve(
          new Response(JSON.stringify({ books: [], total: 0 }), {
            status: 200,
          }),
        ) as unknown as Promise<Response>;
      }
      return Promise.resolve(
        new Response("{}", { status: 200 }),
      ) as unknown as Promise<Response>;
    });
  });

  it("does not show username modal and auto creates userId", async () => {
    const { queryByText } = render(App);
    // No modal text should be present
    expect(queryByText("Choose a username")).toBeNull();
    await waitFor(() => {
      const id = localStorage.getItem("userId");
      expect(id).toBeTruthy();
      // Looks like a UUID v4 (basic shape)
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });
});
