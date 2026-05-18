import type { Habitat, MovementKind, SpeciesDefinition, SpeciesId } from "@oikos/shared";

export const habitatLabels: Record<Habitat, string> = {
  forest: "Bosque / Floresta",
  field: "Campo",
  river: "Rio / Água"
};

export const movementLabels: Record<MovementKind, string> = {
  adjacent: "Adjacente",
  diagonal: "Diagonal",
  straight_jump: "Salto reto",
  knight_jump: "Salto em curva"
};

export const speciesDefinitions: Record<SpeciesId, SpeciesDefinition> = {
  jaguar: {
    speciesId: "jaguar",
    displayName: "Onça-pintada",
    scientificName: "Panthera onca",
    category: "predator",
    totalPieces: 1,
    initialPieces: 1,
    usesForestCards: false,
    actions: ["A", "B", "C"],
    movementPatternsByHabitat: {
      forest: "knight_jump",
      field: "diagonal",
      river: "straight_jump"
    },
    boardAsset: "/assets/boards/1. Onça-pintada.png",
    meepleAsset: "/assets/meeples/Onça.png"
  },
  maned_wolf: {
    speciesId: "maned_wolf",
    displayName: "Lobo-guará",
    scientificName: "Chrysocyon brachyurus",
    category: "subpredator",
    totalPieces: 3,
    initialPieces: 2,
    usesForestCards: true,
    actions: ["A", "B", "C", "D"],
    movementPatternsByHabitat: {
      forest: "straight_jump",
      field: "adjacent",
      river: "diagonal"
    },
    boardAsset: "/assets/boards/3. Lobo-guará.png",
    meepleAsset: "/assets/meeples/Lobo.png"
  },
  armadillo: {
    speciesId: "armadillo",
    displayName: "Tatu-bola",
    scientificName: "Tolypeutes",
    category: "middle",
    totalPieces: 4,
    initialPieces: 2,
    usesForestCards: true,
    actions: ["A", "B", "C", "D"],
    movementPatternsByHabitat: {
      forest: "adjacent",
      field: "diagonal",
      river: "straight_jump"
    },
    boardAsset: "/assets/boards/4. Tatu-bola.png",
    meepleAsset: "/assets/meeples/Tatu.png"
  },
  macaw: {
    speciesId: "macaw",
    displayName: "Arara-azul",
    scientificName: "Anodorhynchus hyacinthinus",
    category: "middle",
    totalPieces: 6,
    initialPieces: 3,
    usesForestCards: true,
    actions: ["A", "B", "C", "D"],
    movementPatternsByHabitat: {
      forest: "knight_jump",
      field: "adjacent",
      river: "straight_jump"
    },
    boardAsset: "/assets/boards/6. Arara-azul.png",
    meepleAsset: "/assets/meeples/Arara.png"
  },
  capuchin: {
    speciesId: "capuchin",
    displayName: "Macaco-prego",
    scientificName: "Sapajus",
    category: "base",
    totalPieces: 7,
    initialPieces: 3,
    usesForestCards: true,
    actions: ["A", "B", "C", "D"],
    movementPatternsByHabitat: {
      forest: "straight_jump",
      field: "knight_jump",
      river: "diagonal"
    },
    boardAsset: "/assets/boards/7. Macaco-prego.png",
    meepleAsset: "/assets/meeples/Macaco.png"
  },
  coati: {
    speciesId: "coati",
    displayName: "Quati",
    scientificName: "Nasua",
    category: "base",
    totalPieces: 8,
    initialPieces: 2,
    usesForestCards: true,
    actions: ["A", "B", "C"],
    movementPatternsByHabitat: {
      forest: "straight_jump",
      field: "diagonal",
      river: "adjacent"
    },
    boardAsset: "/assets/boards/8. Quati.png",
    meepleAsset: "/assets/meeples/Quati.png"
  }
};

export const speciesOrderBySetup: SpeciesId[] = [
  "jaguar",
  "maned_wolf",
  "armadillo",
  "macaw",
  "capuchin",
  "coati"
];

export const speciesOrderByTurn: SpeciesId[] = [
  "coati",
  "capuchin",
  "macaw",
  "armadillo",
  "maned_wolf",
  "jaguar"
];
