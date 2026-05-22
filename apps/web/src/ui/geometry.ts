import type { GridPosition } from "@oikos/shared";

export function elementCenter(element: HTMLElement | null | undefined): { x: number; y: number } | null {
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

export function sameGridPosition(a: GridPosition | null | undefined, b: GridPosition | null | undefined): boolean {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}
