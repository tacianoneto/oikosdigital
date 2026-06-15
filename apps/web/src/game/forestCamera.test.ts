import { describe, expect, it } from "vitest";
import {
  getForestCameraFit,
  getForestContentBounds,
  gridToWorld,
  worldToScreenPoint
} from "./forestCamera";

const CARD = 196;
const STEP = 202;

describe("forest camera helpers", () => {
  it("converts grid positions to deterministic world coordinates", () => {
    expect(gridToWorld({ x: 2, y: -1 }, STEP)).toEqual({ x: 404, y: -202 });
  });

  it("converts world coordinates to canvas-local screen coordinates", () => {
    const camera = {
      x: 10,
      y: 20,
      scrollX: 100,
      scrollY: -50,
      zoom: 0.5
    };

    expect(worldToScreenPoint({ x: 302, y: 152 }, camera)).toEqual({
      x: 111,
      y: 121
    });
  });

  it("returns a centered default bounds rectangle for an empty forest", () => {
    const bounds = getForestContentBounds(
      { cards: [], expansionTargets: [], placementPreview: null },
      CARD,
      STEP
    );

    expect(bounds.x).toBe(-294);
    expect(bounds.y).toBe(-294);
    expect(bounds.width).toBe(588);
    expect(bounds.height).toBe(588);
  });

  it("includes cards, expansion targets and placement preview in content bounds", () => {
    const bounds = getForestContentBounds(
      {
        cards: [{ x: -1, y: 2 }],
        expansionTargets: [{ x: 3, y: -2 }],
        placementPreview: { position: { x: 1, y: 4 } }
      },
      CARD,
      STEP
    );

    expect(bounds.x).toBe(-300);
    expect(bounds.y).toBe(-502);
    expect(bounds.width).toBe(1004);
    expect(bounds.height).toBe(1408);
  });

  it("keeps compact desktop camera fit identical to the scene rules", () => {
    const fit = getForestCameraFit(
      { width: 808, height: 1212, centerX: 104, centerY: 104 },
      1280,
      720
    );

    expect(fit.viewport).toEqual({ x: 0, y: 120, width: 1280, height: 450 });
    expect(fit.center).toEqual({ x: 104, y: 104 });
    expect(fit.zoom).toBeCloseTo(450 / (1212 + 120), 8);
  });
});
