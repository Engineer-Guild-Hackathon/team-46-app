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

  it("renders italic text between underscores", () => {
    const s = {
      en: "This is _italic text_ and normal text",
      type: "text",
    } as unknown as {
      en: string;
      type: "text";
    };
    const html = renderSentenceHTML(0, s);
    // Words in italic sections should have the italic class added to their word spans
    expect(html).toContain(
      'class="word inline relative cursor-pointer whitespace-normal italic"',
    );
    // Non-word content in italic sections should be wrapped in italic spans
    expect(html).toContain('<span class="italic"> </span>');
    // Underscores should be removed from output
    expect(html).not.toContain("_");
  });

  it("handles multiple italic segments", () => {
    const s = {
      en: "Start _first italic_ middle _second italic_ end",
      type: "text",
    } as unknown as {
      en: string;
      type: "text";
    };
    const html = renderSentenceHTML(0, s);
    // Count the number of words with italic class (should be 4: first, italic, second, italic)
    const italicWordMatches = html.match(/class="word[^"]*italic"/g);
    expect(italicWordMatches).toHaveLength(4);
    // Non-word content in italic sections should be wrapped in italic spans
    expect(html).toContain('<span class="italic"> </span>');
    // Underscores should be removed from output
    expect(html).not.toContain("_");
  });

  it("handles italic text with phrase segmentation", () => {
    const s = {
      en: "This is _very remarkable_ text",
      type: "text",
      en_word: ["This", "is", "very remarkable", "text"],
    } as unknown as {
      en: string;
      type: "text";
      en_word: string[];
    };
    const html = renderSentenceHTML(0, s);
    // Should contain phrase segmentation spans with data-wi attributes
    expect(html).toContain('data-wi="0"');
    expect(html).toContain('data-wi="2"'); // "very remarkable" phrase
    // The "very remarkable" phrase should have italic class since it contains italic text
    expect(html).toContain(
      'class="word inline relative cursor-pointer whitespace-normal italic"',
    );
    // Underscores should be removed from output
    expect(html).not.toContain("_");
  });
});
