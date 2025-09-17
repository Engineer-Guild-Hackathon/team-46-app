import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTextPage,
  type GetTextPageResponse,
} from "../../../src/lib/api/text";

describe("getTextPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests page with defaults", async () => {
    const mock: GetTextPageResponse = {
      rate: 1234,
      endSentenceNo: 12,
      text: [
        {
          type: "text",
          sentenceNo: 0,
          en: "Hello world.",
          jp: "こんにちは世界。",
          en_word: ["Hello", "world"],
          jp_word: ["こんにちは", "世界"],
          word_difficulty: ["", ""],
          is_paragraph_start: true,
          is_paragraph_end: false,
        },
      ],
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => mock,
      text: async () => JSON.stringify(mock),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const res = await getTextPage({ bookId: "BookA" });
    expect(res).toEqual(mock);
    const url = String((fetchMock.mock.calls as unknown)[0][0]);
    expect(url).toMatch(/bookId=BookA/);
    expect(url).toMatch(/startSentenceNo=0/); // default
    expect(url).toMatch(/charCount=800/); // default
  });

  it("passes through optional telemetry params", async () => {
    const mock: GetTextPageResponse = {
      rate: null,
      endSentenceNo: 5,
      text: [],
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => mock,
      text: async () => JSON.stringify(mock),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await getTextPage({
      bookId: "B2",
      startSentenceNo: 10,
      userId: "u123",
      charCount: 900,
      wordClickCount: 2,
      sentenceClickCount: 1,
      time: 42,
    });

    const url = String((fetchMock.mock.calls as unknown)[0][0]);
    expect(url).toMatch(/bookId=B2/);
    expect(url).toMatch(/startSentenceNo=10/);
    expect(url).toMatch(/userId=u123/);
    expect(url).toMatch(/charCount=900/);
    expect(url).toMatch(/wordClickCount=2/);
    expect(url).toMatch(/sentenceClickCount=1/);
    expect(url).toMatch(/time=42/);
  });

  it("includes jp_word entries", async () => {
    const mock: GetTextPageResponse = {
      rate: null,
      endSentenceNo: 1,
      text: [
        {
          type: "text",
          sentenceNo: 0,
          en: "Good morning",
          jp: "おはよう",
          en_word: ["Good", "morning"],
          jp_word: ["おはよう", ""],
          word_difficulty: ["", ""],
          is_paragraph_start: true,
          is_paragraph_end: false,
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => mock,
        text: async () => JSON.stringify(mock),
      })) as unknown as typeof fetch,
    );
    const res = await getTextPage({ bookId: "J1" });
    expect(res.text[0].jp_word).toEqual(["おはよう", ""]);
  });

  it("validates required parameters", async () => {
    // @ts-expect-error missing bookId
    await expect(getTextPage({})).rejects.toThrow(/bookId/);
  });
});
