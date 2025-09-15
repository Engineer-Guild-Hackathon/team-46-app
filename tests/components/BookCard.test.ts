import { render, fireEvent } from "@testing-library/svelte";
import { describe, it, expect, vi } from "vitest";
import BookCard from "$lib/components/BookCard.svelte";

describe("BookCard", () => {
  const book = { id: "1", title: "Test Book", author: "Author" };
  it("renders title and author", () => {
    const { getByText } = render(BookCard, { book, onOpen: () => {} });
    getByText("Test Book");
    getByText("Author");
  });
  it("calls onOpen when clicked", async () => {
    const onOpen = vi.fn();
    const { getByRole } = render(BookCard, { book, onOpen });
    const btn = getByRole("button", { name: /open test book/i });
    await fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledWith(book);
  });
});
