import type { MovementKind } from "@oikos/shared";

const movementGlyphOffsets: Record<MovementKind, Array<[number, number]>> = {
  adjacent: [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1]
  ],
  diagonal: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ],
  straight_jump: [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0]
  ],
  knight_jump: [
    [-1, -2],
    [1, -2],
    [2, -1],
    [2, 1],
    [1, 2],
    [-1, 2],
    [-2, 1],
    [-2, -1]
  ]
};

export function MovementGlyph({ kind }: { kind: MovementKind }) {
  const offsets = movementGlyphOffsets[kind];
  const cell = 6;
  const center = 0;
  return (
    <svg
      className="movement-glyph"
      viewBox="-15 -15 30 30"
      width="22"
      height="22"
      aria-hidden="true"
    >
      <circle cx={center} cy={center} r={2.2} className="movement-glyph-origin" />
      {offsets.map(([dx, dy], i) => (
        <circle
          key={i}
          cx={dx * cell}
          cy={dy * cell}
          r={1.8}
          className="movement-glyph-target"
        />
      ))}
    </svg>
  );
}
