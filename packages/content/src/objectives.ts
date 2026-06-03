import type { ObjectiveCardDefinition, ObjectiveEligibilityCategory, ObjectiveRuleTier, Resource } from "@oikos/shared";

const objectiveBasePath = "/assets/objective-cards";
export const objectiveCardBackPath = `${objectiveBasePath}/Verso das cartas OBJ.png`;

const tierByCategory: Record<ObjectiveEligibilityCategory, ObjectiveRuleTier> = {
  predator: "red",
  middle: "yellow",
  base: "blue"
};

function rulesFor(categories: ObjectiveEligibilityCategory[], text: string): ObjectiveCardDefinition["rules"] {
  return Object.fromEntries(categories.map((category) => [tierByCategory[category], text]));
}

function objectiveCard(
  number: number,
  eligibleCategories: ObjectiveEligibilityCategory[],
  scoring: ObjectiveCardDefinition["scoring"],
  ruleText: string
): ObjectiveCardDefinition {
  return {
    id: `objective_${number}`,
    label: `Objetivo ${number}`,
    imagePath: `${objectiveBasePath}/${number}.png`,
    eligibleCategories,
    scoring,
    rules: rulesFor(eligibleCategories, ruleText)
  };
}

export const objectiveCards: ObjectiveCardDefinition[] = [
  objectiveCard(
    1,
    ["predator"],
    { kind: "removed_species" },
    "Ganhe 1 ponto se remover 2 especies diferentes na partida, ou 2 pontos se remover 3 ou mais especies."
  ),
  objectiveCard(
    2,
    ["middle", "base"],
    { kind: "resource_majority", resource: "fruit" },
    "Ganhe 1 ponto extra se tiver maioria de fruta. Ganhe +1 ponto extra se nao empatar essa maioria com outro jogador."
  ),
  objectiveCard(
    3,
    ["predator"],
    { kind: "seed_spend", spendSeedCount: 3, points: 3 },
    "Ao final da partida, voce pode gastar 3 pinhas para ganhar 3 pontos."
  ),
  objectiveCard(
    4,
    ["middle", "base"],
    { kind: "resource_majority", resource: "meat" },
    "Ganhe 1 ponto extra se tiver maioria de carne. Ganhe +1 ponto extra se nao empatar essa maioria com outro jogador."
  ),
  objectiveCard(
    5,
    ["predator"],
    { kind: "resource_majority_count" },
    "Ao final da partida, ganhe 1 ponto extra por cada maioria que voce tiver de recursos."
  ),
  objectiveCard(
    6,
    ["middle", "base"],
    { kind: "habitat_line", habitat: "field", minLength: 3, maxPoints: 2 },
    "Ganhe 1 ponto por cada linha de 3 ou mais campos adjacentes na floresta. Maximo 2 pontos."
  ),
  objectiveCard(
    7,
    ["predator"],
    { kind: "resource_majority_count" },
    "Ao final da partida, ganhe 1 ponto extra por cada maioria que voce tiver de recursos."
  ),
  objectiveCard(
    8,
    ["middle", "base"],
    { kind: "habitat_line", habitat: "river", minLength: 4, maxPoints: 2 },
    "Ganhe 1 ponto por cada rio de 4 ou mais cartas consecutivas na floresta. Maximo 2 pontos."
  ),
  objectiveCard(
    9,
    ["predator"],
    { kind: "removed_species" },
    "Ganhe 1 ponto se remover 2 especies diferentes na partida, ou 2 pontos se remover 3 ou mais especies."
  ),
  objectiveCard(
    10,
    ["middle", "base"],
    { kind: "resource_majority", resource: "egg" },
    "Ganhe 1 ponto extra se tiver maioria de ovo. Ganhe +1 ponto extra se nao empatar essa maioria com outro jogador."
  ),
  objectiveCard(
    11,
    ["predator"],
    { kind: "seed_spend", spendSeedCount: 3, points: 3 },
    "Ao final da partida, voce pode gastar 3 pinhas para ganhar 3 pontos."
  ),
  objectiveCard(
    12,
    ["middle", "base"],
    { kind: "habitat_line", habitat: "forest", minLength: 3, diagonalsOnly: true, maxPoints: 2 },
    "Ganhe 1 ponto por cada diagonal de 3 ou mais bosques alinhados na floresta. Maximo 2 pontos."
  ),
  objectiveCard(
    13,
    ["base"],
    { kind: "resource_line", resource: "seed", minLength: 3, maxPoints: 2 },
    "Ganhe 1 ponto por cada linha reta de 3 locais de pinha adjacentes. Maximo 2 pontos."
  ),
  objectiveCard(
    14,
    ["predator", "middle"],
    { kind: "missing_resources", maxPoints: 2 },
    "Ganhe 1 ponto por cada recurso que nao possuir no final da partida. Maximo 2 pontos."
  ),
  objectiveCard(
    15,
    ["predator"],
    { kind: "extra_turn" },
    "Gaste 1 ponto para jogar um turno extra apos a contagem de maiorias."
  ),
  objectiveCard(
    16,
    ["middle", "base"],
    { kind: "resource_line", resource: "meat", minLength: 3, maxPoints: 2 },
    "Ganhe 1 ponto por cada linha reta de 3 locais de carne adjacentes. Maximo 2 pontos."
  ),
  objectiveCard(
    17,
    ["middle", "base"],
    { kind: "resource_line", resource: "egg", minLength: 3, maxPoints: 2 },
    "Ganhe 1 ponto por cada linha reta de 3 locais de ovo adjacentes. Maximo 2 pontos."
  ),
  objectiveCard(
    18,
    ["predator"],
    { kind: "discard_for_resources" },
    "Descarte esta carta a qualquer momento para ganhar 1 recurso de cada."
  ),
  objectiveCard(
    19,
    ["middle", "base"],
    { kind: "resource_line", resource: "fruit", minLength: 3, maxPoints: 2 },
    "Ganhe 1 ponto por cada linha reta de 3 locais de fruta adjacentes. Maximo 2 pontos."
  ),
  objectiveCard(
    20,
    ["predator"],
    { kind: "extra_turn" },
    "Gaste 1 ponto para jogar um turno extra apos a contagem de maiorias."
  ),
  objectiveCard(
    21,
    ["middle", "base"],
    { kind: "resource_square", maxPoints: 2 },
    "Ganhe 1 ponto por cada quadrado de locais com os 4 recursos diferentes. Maximo 2 pontos."
  ),
  objectiveCard(
    22,
    ["predator", "middle"],
    { kind: "missing_resources", maxPoints: 2 },
    "Ganhe 1 ponto por cada recurso que nao possuir no final da partida. Maximo 2 pontos."
  ),
  objectiveCard(
    23,
    ["base"],
    { kind: "pieces_in_forest" },
    "Ganhe 1 ponto se mais da metade de suas pecas estiver na floresta. Ganhe +1 ponto extra se todas estiverem na floresta."
  )
];

export const objectiveCardsById = new Map(objectiveCards.map((card) => [card.id, card]));

export const objectiveResourceByCard: Partial<Record<string, Resource>> = Object.fromEntries(
  objectiveCards
    .filter((card) => card.scoring.resource)
    .map((card) => [card.id, card.scoring.resource as Resource])
);

export function getObjectiveCardDefinition(id: string): ObjectiveCardDefinition {
  const card = objectiveCardsById.get(id);
  if (!card) {
    throw new Error(`Unknown objective card definition: ${id}`);
  }

  return card;
}
