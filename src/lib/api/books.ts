import { endpoints, getJson } from "./client";
import { writable, type Readable } from "svelte/store";

export interface RawBooksResponse {
  // Dynamic keys bookId -> book metadata
  [bookId: string]: {
    title: string;
    author: string; // Currently returns a URL instead. Wait for backend update.
    thumbnail?: string;
  };
}

export interface BookItem {
  id: string;
  title: string;
  author: string;
  thumbnail?: string;
}

export interface FetchBooksParams {
  search?: string;
  start?: number; // offset (start index)
  size?: number; // page size
  sort?: string; // optional sort string, backend-specific
}

export interface BooksPage {
  items: BookItem[];
  start: number;
  size: number;
  hasMore: boolean; // Derived
}

export async function fetchBooks(
  params: FetchBooksParams = {},
): Promise<BooksPage> {
  const { search, start = 0, size = 20, sort } = params;
  const raw = await getJson<RawBooksResponse>(endpoints.books, {
    search,
    start,
    size,
    sort,
  });
  const items: BookItem[] = Object.entries(raw).map(([id, meta]) => ({
    id,
    title: meta.title,
    author: meta.author,
    thumbnail: meta.thumbnail,
  }));
  // If backend gives exactly 'size' items we assume maybe more unless zero.
  const hasMore = items.length === size && items.length > 0;
  return { items, start, size, hasMore };
}

// Lightweight SWR-ish cache keyed by serialized params.
const booksCache = new Map<string, Promise<BooksPage>>();

function serialize(p: FetchBooksParams): string {
  return JSON.stringify({
    search: p.search || "",
    start: p.start ?? 0,
    size: p.size ?? 20,
    sort: p.sort || "",
  });
}

export function fetchBooksCached(
  params: FetchBooksParams = {},
): Promise<BooksPage> {
  const key = serialize(params);
  if (!booksCache.has(key)) {
    booksCache.set(key, fetchBooks(params));
  }
  return booksCache.get(key)!;
}

export interface PaginatedBooksStore extends Readable<BooksPage> {
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function createPaginatedBooksStore(
  initialParams: Omit<FetchBooksParams, "start"> & { size?: number },
): PaginatedBooksStore {
  let current: BooksPage = {
    items: [],
    start: 0,
    size: initialParams.size ?? 20,
    hasMore: true,
  };
  const { subscribe, set } = writable<BooksPage>(current);

  let loading = false;

  async function load(startOverride?: number) {
    if (loading) return;
    loading = true;
    try {
      const start = startOverride ?? current.start;
      const page = await fetchBooks({
        ...initialParams,
        start,
        size: current.size,
      });
      if (start === 0) {
        current = page;
      } else {
        current = {
          ...page,
          items: [...current.items, ...page.items],
          start,
        };
      }
      set(current);
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!current.hasMore) return;
    await load(current.start + current.size);
  }

  async function refresh() {
    await load(0);
  }

  // initial fetch (don't block caller)
  load(0);

  return { subscribe, loadMore, refresh };
}
