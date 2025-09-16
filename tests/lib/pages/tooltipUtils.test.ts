import { describe, it, expect } from "vitest";
import {
  showWordTooltipState,
  hideWordTooltipState,
} from "$lib/pages/tooltipUtils";

describe("tooltipUtils", () => {
  it("show/hide toggles visibility object", () => {
    let vis: Record<number, boolean> = {};
    vis = showWordTooltipState(vis, 2);
    expect(vis[2]).toBe(true);
    vis = hideWordTooltipState(vis, 2);
    expect(vis[2]).toBeUndefined();
  });
});
