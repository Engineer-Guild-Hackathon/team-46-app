# BookPage resume behavior and storage

This document describes the local persistence and resume logic used by the BookPage reader.

## Storage format

Persisted data is stored in `localStorage` under the key `bookProgress:<bookId>`.
The canonical format written by the app is an object with a `pages` array:

{
"pages": [
[ /* page 1: array of StoredSentence */ ],
[ /* page 2 */ ],
...
]
}

Each StoredSentence contains:

- type: "text" | "subtitle"
- sentenceNo: number (backend sentence id)
- en: English text (used as a secondary disambiguator)
- jp, jp_word?: optional Japanese payload
- clickedWordIndex: number[] (indexes of highlighted words)
- sentenceClicked: boolean (whether sentence translation is open)

The read helpers accept an older flat array format and will wrap it in a single page to remain compatible.

## Resume behavior

On mount, `BookPage.svelte` calls the persistence helpers:

- If stored pages exist: the UI will restore pages instead of requesting the initial API page. The in-memory `sentences` array is populated from the stored pages, selected sentences and word highlights are restored, and pagination boundaries are recomputed.
- The reader then scrolls instantly to the start of the last stored page so the user resumes where they left off.
- To avoid accidentally triggering infinite-load network requests during this programmatic scroll, the IntersectionObserver is temporarily disconnected and an internal `_suppressAutoLoad` flag is set briefly.

If no stored pages exist (first visit or invalid storage), the component requests the first page from the backend as before.

## Helpers

- `readPages(bookId)` -> StoredSentence[][] | null
- `writePages(bookId, pages)` -> void
- `mergeWithSavedSentences(bookId, incoming)` -> merges new incoming sentences with saved UI state when fetching from the backend
- `setSentenceClicked`, `addClickedWordIndex`, `removeClickedWordIndex` -> update persisted pages

## Notes and future ideas

- The current resume behavior treats a reload and a navigation back-from-main-page the same. If you want to distinguish those flows, consider storing a short-lived session flag (e.g. in `sessionStorage`) when navigating from the main page and using it on mount to decide whether to resume automatically.
- Keep the mapping between on-screen boundaries and API-provided startSentenceNo; boundaries loaded purely from stored pages are not observed to avoid accidental network requests.
