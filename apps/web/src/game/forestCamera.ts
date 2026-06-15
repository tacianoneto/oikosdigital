interface GridLike {
  x: number;
  y: number;
}

interface ForestContentModel {
  cards: GridLike[];
  expansionTargets: GridLike[];
  placementPreview: { position: GridLike } | null;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface ForestCameraFit {
  viewport: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zoom: number;
  center: WorldPoint;
}

export interface ForestBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

function rectangle(x: number, y: number, width: number, height: number): ForestBounds {
  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function gridToWorld(position: GridLike, step: number): WorldPoint {
  return {
    x: position.x * step,
    y: position.y * step
  };
}

export function worldToScreenPoint(
  world: WorldPoint,
  camera: { x: number; y: number; scrollX: number; scrollY: number; zoom: number }
): WorldPoint {
  return {
    x: camera.x + (world.x - camera.scrollX) * camera.zoom,
    y: camera.y + (world.y - camera.scrollY) * camera.zoom
  };
}

export function getForestContentBounds(
  vm: ForestContentModel,
  cardSize: number,
  step: number
): ForestBounds {
  const slots = [
    ...vm.cards,
    ...vm.expansionTargets,
    ...(vm.placementPreview ? [vm.placementPreview.position] : [])
  ];

  if (slots.length === 0) {
    return rectangle(-cardSize * 1.5, -cardSize * 1.5, cardSize * 3, cardSize * 3);
  }

  const xs = slots.map((slot) => slot.x);
  const ys = slots.map((slot) => slot.y);
  const minX = Math.min(...xs) * step - cardSize / 2;
  const maxX = Math.max(...xs) * step + cardSize / 2;
  const minY = Math.min(...ys) * step - cardSize / 2;
  const maxY = Math.max(...ys) * step + cardSize / 2;
  return rectangle(minX, minY, maxX - minX, maxY - minY);
}

export function getForestCameraFit(
  bounds: Pick<ForestBounds, "width" | "height" | "centerX" | "centerY">,
  fullWidth: number,
  fullHeight: number
): ForestCameraFit {
  const compactDesktop = fullWidth >= 1024 && fullWidth <= 1600 && fullHeight <= 800;
  const topInset = compactDesktop ? Math.min(120, Math.round(fullHeight * 0.2)) : 0;
  const bottomInset = compactDesktop ? Math.min(150, Math.round(fullHeight * 0.24)) : 0;
  const viewportHeight = Math.max(240, fullHeight - topInset - bottomInset);
  const pad = compactDesktop ? 60 : 120;
  const rawZoom = Math.min(
    fullWidth / (bounds.width + pad * 2),
    viewportHeight / (bounds.height + pad * 2)
  );

  return {
    viewport: {
      x: 0,
      y: topInset,
      width: fullWidth,
      height: viewportHeight
    },
    zoom: clamp(rawZoom, 0.28, 1),
    center: {
      x: bounds.centerX,
      y: bounds.centerY
    }
  };
}
