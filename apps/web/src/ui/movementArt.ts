import type { Habitat, MovementKind } from "@oikos/shared";

const movementKindAssetSuffix: Record<MovementKind, string> = {
  adjacent: "ortogonal",
  diagonal: "diagonal",
  straight_jump: "salto",
  knight_jump: "cavalo"
};

const habitatAssetPrefix: Record<Habitat, string> = {
  forest: "bosque",
  field: "campo",
  river: "rios"
};

export function movementArtPath(habitat: Habitat, kind: MovementKind): string {
  return `/assets/movimentos/separados/${habitatAssetPrefix[habitat]}_${movementKindAssetSuffix[kind]}.webp`;
}
