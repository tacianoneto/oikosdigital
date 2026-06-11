import type { CardConnections, ForestCardDefinition, Habitat } from "@oikos/shared";

const commonBasePath = "/assets/forest-cards";
const initialBasePath = "/assets/forest-cards/initial";

const noRiverConnections: CardConnections = {
  north: null,
  east: null,
  south: null,
  west: null
};

function riverConnections(sides: Array<keyof CardConnections>): CardConnections {
  return {
    north: sides.includes("north") ? "river" : null,
    east: sides.includes("east") ? "river" : null,
    south: sides.includes("south") ? "river" : null,
    west: sides.includes("west") ? "river" : null
  };
}

// Bocas de rio transcritas do jogo fisico (rotacao 0 = arte como no arquivo;
// N=topo, E=direita, S=baixo, W=esquerda). Uma boca so conecta com boca; girar
// a carta gira as bocas junto. Bosque e Campo nao tem rio.
//   Canal: bocas norte/sul (atravessa reto).        -> Inicial 1, 9, rios 1/2
//   Curva: bocas norte/leste (vira em L).            -> Inicial 1 V, Inicial 8
//   Ponta: boca so no norte (fim de rio / lago).     -> Inicial 8 V, Inicial 9 V
const riverChannel = riverConnections(["north", "south"]);
const riverBend = riverConnections(["north", "east"]);
const riverEnd = riverConnections(["north"]);

function commonCard(
  id: string,
  label: string,
  fileName: string,
  habitat: Habitat,
  resources: ForestCardDefinition["resources"] = [],
  connections: CardConnections = noRiverConnections
): ForestCardDefinition {
  const resource = resources[0] ?? null;

  return {
    id,
    label,
    kind: "common",
    habitat,
    resource,
    resources,
    sites: createCardSites(habitat, resource),
    imagePath: `${commonBasePath}/${fileName}`,
    connections,
    metadataStatus: "complete"
  };
}

function initialCard(
  id: string,
  label: string,
  fileName: string,
  habitat: Habitat,
  resources: ForestCardDefinition["resources"] = [],
  connections: CardConnections = noRiverConnections
): ForestCardDefinition {
  const resource = resources[0] ?? null;

  return {
    id,
    label,
    kind: "initial",
    habitat,
    resource,
    resources,
    sites: createCardSites(habitat, resource),
    imagePath: `${initialBasePath}/${fileName}`,
    connections,
    metadataStatus: "complete",
    notes:
      "Carta inicial. O setup 3x3 usa 9 cartas: 3 rios de face dupla (ovo, semente, carne) " +
      "e 6 de terra (bosque/campo). Cada rio mostra a frente OU o verso, nunca os dois."
  };
}

function createCardSites(habitat: Habitat, resource: ForestCardDefinition["resource"]): ForestCardDefinition["sites"] {
  return [
    {
      siteId: "main",
      habitat,
      resource,
      maxPieces: null
    }
  ];
}

export const commonForestCards: ForestCardDefinition[] = [
  commonCard("bosque_1", "Bosque 1", "bosque (1).webp", "forest", ["fruit"]),
  commonCard("bosque_1_copy", "Bosque 1 - Copia", "bosque (1) - Copia.webp", "forest", ["fruit"]),
  commonCard("bosque_5_copy", "Bosque 5 - Copia", "bosque (5) - Copia.webp", "forest", ["fruit"]),
  commonCard("bosque_2", "Bosque 2", "bosque (2).webp", "forest", ["egg"]),
  commonCard("bosque_2_copy", "Bosque 2 - Copia", "bosque (2) - Copia.webp", "forest", ["egg"]),
  commonCard("bosque_2_copy_2", "Bosque 2 - Copia - Copia", "bosque (2) - Copia - Copia.webp", "forest", ["egg"]),
  commonCard("bosque_3", "Bosque 3", "bosque (3).webp", "forest", ["seed"]),
  commonCard("bosque_3_copy", "Bosque 3 - Copia", "bosque (3) - Copia.webp", "forest", ["seed"]),
  commonCard("bosque_3_copy_2", "Bosque 3 - Copia - Copia", "bosque (3) - Copia - Copia.webp", "forest", ["seed"]),
  commonCard("bosque_4", "Bosque 4", "bosque (4).webp", "forest", ["meat"]),
  commonCard("bosque_4_copy", "Bosque 4 - Copia", "bosque (4) - Copia.webp", "forest", ["meat"]),
  commonCard("bosque_4_copy_2", "Bosque 4 - Copia - Copia", "bosque (4) - Copia - Copia.webp", "forest", ["meat"]),
  commonCard("campo_1", "Campo 1", "campos (1).webp", "field", ["seed"]),
  commonCard("campo_1_copy", "Campo 1 - Copia", "campos (1) - Copia.webp", "field", ["seed"]),
  commonCard("campo_1_copy_2", "Campo 1 - Copia - Copia", "campos (1) - Copia - Copia.webp", "field", ["seed"]),
  commonCard("campo_2", "Campo 2", "campos (2).webp", "field", ["meat"]),
  commonCard("campo_2_copy", "Campo 2 - Copia", "campos (2) - Copia.webp", "field", ["meat"]),
  commonCard("campo_2_copy_2", "Campo 2 - Copia - Copia", "campos (2) - Copia - Copia.webp", "field", ["meat"]),
  commonCard("campo_3", "Campo 3", "campos (3).webp", "field", ["fruit"]),
  commonCard("campo_3_copy", "Campo 3 - Copia", "campos (3) - Copia.webp", "field", ["fruit"]),
  commonCard("campo_3_copy_2", "Campo 3 - Copia - Copia", "campos (3) - Copia - Copia.webp", "field", ["fruit"]),
  commonCard("campo_4", "Campo 4", "campos (4).webp", "field", ["egg"]),
  commonCard("campo_4_copy", "Campo 4 - Copia", "campos (4) - Copia.webp", "field", ["egg"]),
  commonCard("campo_4_copy_2", "Campo 4 - Copia - Copia", "campos (4) - Copia - Copia.webp", "field", ["egg"]),
  commonCard("rio_1", "Rio 1", "rios (1).webp", "river", ["seed"], riverChannel),
  commonCard("rio_2", "Rio 2", "rios (2).webp", "river", ["meat"], riverChannel),
  commonCard("rio_3", "Rio 3", "rios (3).webp", "river", ["meat"], riverBend),
  commonCard("rio_4", "Rio 4", "rios (4).webp", "river", ["meat"], riverEnd),
  commonCard("rio_5", "Rio 5", "rios (5).webp", "river", ["fruit"], riverBend),
  commonCard("rio_6", "Rio 6", "rios (6).webp", "river", ["fruit"], riverChannel),
  commonCard("rio_7", "Rio 7", "rios (7).webp", "river", ["fruit"], riverEnd),
  commonCard("rio_8", "Rio 8", "rios (8).webp", "river", ["seed"], riverBend),
  commonCard("rio_9", "Rio 9", "rios (9).webp", "river", ["egg"], riverEnd),
  commonCard("rio_10", "Rio 10", "rios (10).webp", "river", ["egg"], riverChannel),
  commonCard("rio_11", "Rio 11", "rios (11).webp", "river", ["egg"], riverBend),
  commonCard("rio_12", "Rio 12", "rios (12).webp", "river", ["seed"], riverEnd)
];

// As 9 cartas iniciais. Os 3 rios sao de face dupla (frente/verso): a mesma
// carta fisica vira para mostrar uma boca diferente, entao a frente e o verso
// de um rio nunca aparecem juntos na mesma floresta. Sempre ha exatamente 1 rio
// de ovo, 1 de semente (seed) e 1 de carne; as outras 6 sao de terra.
//   Rio ovo   : frente initial_1 (canal N/S)  | verso initial_1_v (curva N/E)
//   Rio semente : frente initial_8 (curva N/E)   | verso initial_8_v (ponta N)
//   Rio carne : frente initial_9 (canal N/S)   | verso initial_9_v (ponta N)
export const initialForestCardCandidates: ForestCardDefinition[] = [
  initialCard("initial_1", "Inicial 1", "Inicial (1).webp", "river", ["egg"], riverChannel),
  initialCard("initial_1_v", "Inicial 1 V", "Inicial (1) V.webp", "river", ["egg"], riverBend),
  initialCard("initial_2", "Inicial 2", "Inicial (2).webp", "forest", ["egg"]),
  initialCard("initial_3", "Inicial 3", "Inicial (3).webp", "forest", ["fruit"]),
  initialCard("initial_4", "Inicial 4", "Inicial (4).webp", "forest", ["seed"]),
  initialCard("initial_5", "Inicial 5", "Inicial (5).webp", "field", ["fruit"]),
  initialCard("initial_6", "Inicial 6", "Inicial (6).webp", "field", ["seed"]),
  initialCard("initial_7", "Inicial 7", "Inicial (7).webp", "field", ["meat"]),
  initialCard("initial_8", "Inicial 8", "Inicial (8).webp", "river", ["seed"], riverBend),
  initialCard("initial_8_v", "Inicial 8 V", "Inicial (8) V.webp", "river", ["seed"], riverEnd),
  initialCard("initial_9", "Inicial 9", "Inicial (9).webp", "river", ["meat"], riverChannel),
  initialCard("initial_9_v", "Inicial 9 V", "Inicial (9) v.webp", "river", ["meat"], riverEnd)
];

export const forestCardsById = new Map(
  [...commonForestCards, ...initialForestCardCandidates].map((card) => [card.id, card])
);

export function getForestCardDefinition(id: string): ForestCardDefinition {
  const card = forestCardsById.get(id);
  if (!card) {
    throw new Error(`Unknown forest card definition: ${id}`);
  }

  return card;
}
