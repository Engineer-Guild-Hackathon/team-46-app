import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import BookPage from "../../src/lib/pages/BookPage.svelte";

// Mock the API module used by BookPage
vi.mock("../../src/lib/api/text", () => ({
  getTextPage: vi.fn(async (_params: any) => {
    return {
      text: [
        { type: "text", sentenceNo: 1, en: "Hello world", jp: "こんにちは" },
      ],
      endSentenceNo: 1,
      rate: null,
    };
  }),
}));

import { getTextPage } from "../../src/lib/api/text";

describe("BookPage infinite scroll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (getTextPage as unknown as any).mockClear?.();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls API only once when user scrolls twice within cooldown", async () => {
    const { container, component } = render(BookPage, { bookId: "book-1" });

    // wait for initial load to settle
    await vi.runAllTimersAsync();

    // find reader element
    const reader = container.querySelector("article.reader") as HTMLElement;
    expect(reader).toBeTruthy();

    // populate large scrollHeight so distanceFromBottom calculations are meaningful
    // JSDOM doesn't compute layout; manually set scrollHeight and clientHeight
    Object.defineProperty(reader, "scrollHeight", {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(reader, "clientHeight", {
      value: 400,
      configurable: true,
    });

    // initial scroll position near bottom but not within threshold
    Object.defineProperty(reader, "scrollTop", {
      value: 1500,
      configurable: true,
    });
    await fireEvent.scroll(reader);

    // advance timers so debounced handler runs
    await vi.advanceTimersByTimeAsync(200);

    // now simulate another scroll that enters the threshold (near bottom)
    // set scrollTop to value that will compute small distanceFromBottom
    Object.defineProperty(reader, "scrollTop", {
      value: 1600,
      configurable: true,
    });
    await fireEvent.scroll(reader);

    // advance timers so debounced handler fires and trigger cooldown
    await vi.advanceTimersByTimeAsync(200);

    // simulate quick scroll back up and down within cooldown
    Object.defineProperty(reader, "scrollTop", {
      value: 1500,
      configurable: true,
    });
    await fireEvent.scroll(reader);
    await vi.advanceTimersByTimeAsync(200);
    Object.defineProperty(reader, "scrollTop", {
      value: 1600,
      configurable: true,
    });
    await fireEvent.scroll(reader);

    // advance timers but still within cooldown (2.5s)
    await vi.advanceTimersByTimeAsync(1000);

    // The mocked getTextPage should have been called for initial load and then at most once for the near-bottom trigger
    // initial call + at most one extra due to cooldown
    const calls = (getTextPage as unknown as any).mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(1);
    expect(calls).toBeLessThanOrEqual(2);
  });
});
