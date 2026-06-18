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
    boardAsset: "/assets/boards/1. Onça-pintada.webp",
    meepleAsset: "/assets/meeples/Onça.webp",
    portraitAsset: "/assets/portraits/onca.webp",
    movementAsset: "/assets/movimentos/Movimentos_onca.webp"
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
    boardAsset: "/assets/boards/3. Lobo-guará.webp",
    meepleAsset: "/assets/meeples/Lobo.webp",
    portraitAsset: "/assets/portraits/lobo_guara.webp",
    movementAsset: "/assets/movimentos/Movimentos_lobo.webp"
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
    boardAsset: "/assets/boards/4. Tatu-bola.webp",
    meepleAsset: "/assets/meeples/Tatu.webp",
    portraitAsset: "/assets/portraits/tatu_bola.webp",
    movementAsset: "/assets/movimentos/Movimentos_tatu.webp"
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
    boardAsset: "/assets/boards/6. Arara-azul.webp",
    meepleAsset: "/assets/meeples/Arara.webp",
    portraitAsset: "/assets/portraits/arara.webp",
    movementAsset: "/assets/movimentos/Movimentos_arara.webp"
  },
  galo_de_campina: {
    speciesId: "galo_de_campina",
    displayName: "Galo-de-campina",
    scientificName: "Paroaria dominicana",
    category: "base",
    totalPieces: 7,
    initialPieces: 3,
    usesForestCards: true,
    actions: ["A", "B", "C", "D"],
    movementPatternsByHabitat: {
      forest: "diagonal",
      field: "adjacent",
      river: "knight_jump"
    },
    boardAsset: "/assets/interface/galo/UI_galodecampinaTOP.webp",
    meepleAsset: "/assets/meeples/galo de campina.webp",
    portraitAsset: "/assets/portraits/galo_de_campina.webp",
    movementAsset: "/assets/movimentos/Movimentos_galodecampina.webp"
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
    boardAsset: "/assets/boards/7. Macaco-prego.webp",
    meepleAsset: "/assets/meeples/Macaco.webp",
    portraitAsset: "/assets/portraits/macaco.webp",
    movementAsset: "/assets/movimentos/Movimentos_macaco.webp"
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
    boardAsset: "/assets/boards/8. Quati.webp",
    meepleAsset: "/assets/meeples/Quati.webp",
    portraitAsset: "/assets/portraits/quati.webp",
    movementAsset: "/assets/movimentos/Movimentos_quati.webp"
  }
};

export const speciesOrderBySetup: SpeciesId[] = [
  "jaguar",
  "maned_wolf",
  "armadillo",
  "galo_de_campina",
  "macaw",
  "capuchin",
  "coati"
];

export const speciesOrderByTurn: SpeciesId[] = [
  "coati",
  "capuchin",
  "galo_de_campina",
  "macaw",
  "armadillo",
  "maned_wolf",
  "jaguar"
];
