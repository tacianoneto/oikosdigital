// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppShellClass } from "./useAppShellClass";

const base = {
  hasStartedGame: false,
  isMobile: false,
  cleanBoardMode: false,
  isBasicTutorial: false,
  currentSpeciesId: null,
  visualAccessibility: false,
  mobileSheet: null
} as const;

describe("useAppShellClass", () => {
  it("uses menu-active before a game starts", () => {
    const { result } = renderHook(() => useAppShellClass({ ...base }));
    expect(result.current.className).toBe("app-shell menu-active");
    expect(result.current.dataVisualAccessibility).toBe("false");
    expect(result.current.dataSheet).toBeUndefined();
  });

  it("adds the per-species theme class while a game is active", () => {
    const { result } = renderHook(() =>
      useAppShellClass({ ...base, hasStartedGame: true, currentSpeciesId: "maned_wolf" })
    );
    expect(result.current.className).toBe("app-shell game-active is-wolf-active");
  });

  it("suppresses the species theme during the basic tutorial", () => {
    const { result } = renderHook(() =>
      useAppShellClass({ ...base, hasStartedGame: true, isBasicTutorial: true, currentSpeciesId: "jaguar" })
    );
    expect(result.current.className).toBe("app-shell game-active");
  });

  it("flags mobile HUD and sheet, and accessibility mode", () => {
    const { result } = renderHook(() =>
      useAppShellClass({
        ...base,
        hasStartedGame: true,
        isMobile: true,
        currentSpeciesId: "macaw",
        visualAccessibility: true,
        mobileSheet: "players"
      })
    );
    expect(result.current.className).toBe(
      "app-shell game-active mobile-hud is-macaw-active accessibility-visual-mode"
    );
    expect(result.current.dataVisualAccessibility).toBe("true");
    expect(result.current.dataSheet).toBe("players");
  });

  it("defaults the sheet to none on mobile HUD with no sheet open", () => {
    const { result } = renderHook(() =>
      useAppShellClass({ ...base, hasStartedGame: true, isMobile: true })
    );
    expect(result.current.dataSheet).toBe("none");
  });
});
