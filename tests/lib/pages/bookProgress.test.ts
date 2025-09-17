import { beforeEach, describe, expect, it } from "vitest";
import {
  readPages,
  writePages,
  mergeWithSavedSentences,
  setSentenceClicked,
  addClickedWordIndex,
  removeClickedWordIndex,
} from "$lib/pages/bookProgress";

const bookId = "test-book-progress";

beforeEach(() => {
  localStorage.clear();
});

describe("bookProgress pages storage", () => {
  it("writePages/readPages roundtrip", () => {
    const pages = [
      [
        {
          type: "text",
          sentenceNo: 1,
          en: "Hello",
          jp: "ハロー",
          clickedWordIndex: [],
          sentenceClicked: false,
        },
      ],
    ] as any;
    writePages(bookId, pages);
    const got = readPages(bookId);
    expect(got).not.toBeNull();
    expect(got?.length).toBe(1);
    expect(got?.[0][0].en).toBe("Hello");
  });

  it("mergeWithSavedSentences merges saved UI state", () => {
    // pre-seed storage as pages
    const saved = [
      [
        {
          type: "text",
          sentenceNo: 2,
          en: "World",
          clickedWordIndex: [1],
          sentenceClicked: true,
        },
      ],
    ] as any;
    writePages(bookId, saved);
    const incoming = [{ type: "text", sentenceNo: 2, en: "World", jp: "世界" }];
    const merged = mergeWithSavedSentences(bookId, incoming as any) as any;
    expect(merged.length).toBe(1);
    expect(merged[0].clickedWordIndex).toEqual([1]);
    expect(merged[0].sentenceClicked).toBe(true);
    // ensure storage still contains pages form
    const stored = readPages(bookId) as any;
    expect(stored).not.toBeNull();
  });

  it("setSentenceClicked updates stored pages", () => {
    const pages = [
      [
        {
          type: "text",
          sentenceNo: 5,
          en: "Foo",
          clickedWordIndex: [],
          sentenceClicked: false,
        },
      ],
    ] as any;
    writePages(bookId, pages);
    setSentenceClicked(bookId, 5, "Foo", true);
    const stored = readPages(bookId) as any;
    const found = stored
      .flat()
      .find((s: any) => s.sentenceNo === 5 && s.en === "Foo");
    expect(found).toBeTruthy();
    expect(found.sentenceClicked).toBe(true);
  });

  it("add/remove clicked word index on pages", () => {
    const pages = [
      [
        {
          type: "text",
          sentenceNo: 10,
          en: "Bar",
          clickedWordIndex: [],
          sentenceClicked: false,
        },
      ],
    ] as any;
    writePages(bookId, pages);
    addClickedWordIndex(bookId, 10, "Bar", 2);
    let stored = readPages(bookId) as any;
    let found = stored
      .flat()
      .find((s: any) => s.sentenceNo === 10 && s.en === "Bar");
    expect(found.clickedWordIndex).toEqual([2]);
    // add another
    addClickedWordIndex(bookId, 10, "Bar", 1);
    stored = readPages(bookId) as any;
    found = stored
      .flat()
      .find((s: any) => s.sentenceNo === 10 && s.en === "Bar");
    expect(found.clickedWordIndex).toEqual([1, 2]);
    // remove
    removeClickedWordIndex(bookId, 10, "Bar", 2);
    stored = readPages(bookId) as any;
    found = stored
      .flat()
      .find((s: any) => s.sentenceNo === 10 && s.en === "Bar");
    expect(found.clickedWordIndex).toEqual([1]);
  });
});
