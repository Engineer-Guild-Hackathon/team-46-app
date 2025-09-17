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

type TestStored = {
  type: "text" | "subtitle";
  sentenceNo: number;
  en: string;
  jp?: string;
  clickedWordIndex: number[];
  sentenceClicked: boolean;
};

beforeEach(() => {
  localStorage.clear();
});

describe("bookProgress pages storage", () => {
  it("writePages/readPages roundtrip", () => {
    const pages: TestStored[][] = [
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
    ];
    writePages(bookId, pages);
    const got = readPages(bookId);
    expect(got).not.toBeNull();
    expect(got?.length).toBe(1);
    expect(got?.[0][0].en).toBe("Hello");
  });

  it("mergeWithSavedSentences merges saved UI state", () => {
    // pre-seed storage as pages
    const saved: TestStored[][] = [
      [
        {
          type: "text",
          sentenceNo: 2,
          en: "World",
          clickedWordIndex: [1],
          sentenceClicked: true,
        },
      ],
    ];
    writePages(bookId, saved);
    const incoming = [{ type: "text", sentenceNo: 2, en: "World", jp: "世界" }];
    const merged = mergeWithSavedSentences(
      bookId,
      incoming as Array<{
        type: "text";
        sentenceNo: number;
        en: string;
        jp?: string;
      }>,
    ) as TestStored[];
    expect(merged.length).toBe(1);
    expect(merged[0].clickedWordIndex).toEqual([1]);
    expect(merged[0].sentenceClicked).toBe(true);
    // ensure storage still contains pages form
    const stored = readPages(bookId) as TestStored[][];
    expect(stored).not.toBeNull();
  });

  it("setSentenceClicked updates stored pages", () => {
    const pages2: TestStored[][] = [
      [
        {
          type: "text",
          sentenceNo: 5,
          en: "Foo",
          clickedWordIndex: [],
          sentenceClicked: false,
        },
      ],
    ];
    writePages(bookId, pages2);
    setSentenceClicked(bookId, 5, "Foo", true);
    const stored2 = readPages(bookId) as TestStored[][];
    const found = stored2
      .flat()
      .find((s) => s.sentenceNo === 5 && s.en === "Foo");
    expect(found).toBeTruthy();
    expect(found.sentenceClicked).toBe(true);
  });

  it("add/remove clicked word index on pages", () => {
    const pages3: TestStored[][] = [
      [
        {
          type: "text",
          sentenceNo: 10,
          en: "Bar",
          clickedWordIndex: [],
          sentenceClicked: false,
        },
      ],
    ];
    writePages(bookId, pages3);
    addClickedWordIndex(bookId, 10, "Bar", 2);
    let stored = readPages(bookId) as TestStored[][];
    let found = stored
      .flat()
      .find((s) => s.sentenceNo === 10 && s.en === "Bar");
    expect(found.clickedWordIndex).toEqual([2]);
    // add another
    addClickedWordIndex(bookId, 10, "Bar", 1);
    stored = readPages(bookId) as TestStored[][];
    found = stored.flat().find((s) => s.sentenceNo === 10 && s.en === "Bar");
    expect(found.clickedWordIndex).toEqual([1, 2]);
    // remove
    removeClickedWordIndex(bookId, 10, "Bar", 2);
    stored = readPages(bookId) as TestStored[][];
    found = stored.flat().find((s) => s.sentenceNo === 10 && s.en === "Bar");
    expect(found.clickedWordIndex).toEqual([1]);
  });
});
