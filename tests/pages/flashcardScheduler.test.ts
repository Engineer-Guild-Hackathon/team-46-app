import { describe, it, expect } from "vitest";
import {
  gradeCard,
  initState,
  minutes,
  type CardItem,
} from "../../src/lib/pages/flashcards/flashcardScheduler";

// Fixed timestamp for deterministic tests (represents a specific point in time)
const FIXED_TIMESTAMP = 1_700_000_000_000;
const fixedNow = FIXED_TIMESTAMP;

function make(card: CardItem) {
  return initState(card, fixedNow);
}

describe("flashcardScheduler", () => {
  it("initializes state", () => {
    const c = make({ id: "a", front: "a", back: "A" });
    expect(c.interval).toBe(0);
    expect(c.repetitions).toBe(0);
    expect(c.due).toBe(fixedNow);
  });

  it("Again schedules short relearn", () => {
    let c = make({ id: "a", front: "a", back: "A" });
    const { next } = gradeCard(c, 1 as const, fixedNow);
    expect(next.repetitions).toBe(0);
    expect(next.due).toBe(fixedNow + minutes(10));
  });

  it("Good sets day 1 then day 3", () => {
    let s = make({ id: "a", front: "a", back: "A" });
    let r1 = gradeCard(s, 4 as const, fixedNow).next;
    expect(r1.interval).toBe(1);
    expect(r1.repetitions).toBe(1);
    let r2 = gradeCard(r1, 4 as const, fixedNow).next;
    expect(r2.interval).toBe(3);
    expect(r2.repetitions).toBe(2);
  });

  it("Hard grows slower than Good", () => {
    let s = {
      ...make({ id: "a", front: "a", back: "A" }),
      repetitions: 3,
      interval: 7,
    };
    const hard = gradeCard(s, 3 as const, fixedNow).next.interval;
    const good = gradeCard(s, 4 as const, fixedNow).next.interval;
    expect(hard).toBeLessThanOrEqual(good);
  });
});
