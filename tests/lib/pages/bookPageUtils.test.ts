import { describe, it, expect } from "vitest";
import {
  esc,
  formatSentence,
  renderSentenceHTML,
} from "$lib/pages/bookPageUtils";

describe("bookPageUtils", () => {
  it("escapes html", () => {
    expect(esc("<a&b>")).toBe("&lt;a&amp;b&gt;");
  });
  it("formats sentence", () => {
    expect(formatSentence("  hello   world  ")).toBe("hello world");
  });
  it("renders sentence with words", () => {
    const s = { en: "hello world", type: "text" } as unknown as {
      en: string;
      type: "text";
    };
    const html = renderSentenceHTML(0, s);
    expect(html.includes("span")).toBe(true);
    expect(html.includes("hello")).toBe(true);
  });
});
