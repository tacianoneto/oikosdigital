import type { ObjectiveCardDefinition, Resource } from "@oikos/shared";

const objectiveBasePath = "/assets/objective-cards";
export const objectiveCardBackPath = `${objectiveBasePath}/Verso das cartas OBJ.png`;

function objectiveCard(
  id: string,
  label: string,
  fileName: string,
  rules: ObjectiveCardDefinition["rules"]
): ObjectiveCardDefinition {
  return {
    id,
    label,
    imagePath: `${objectiveBasePath}/${fileName}`,
    rules
  };
}

export const objectiveCards: ObjectiveCardDefinition[] = [
  objectiveCard("objective_1", "Objetivo 1", "1.png", {
    red: "Ganhe 1 ponto se remover 2 ou mais especies diferentes na partida. Ou 2 pontos se remover 3 ou mais especies.",
    yellow:
      "Ganhe 1 ponto extra se tiver maioria de frutas. Ganhe +1 ponto extra se nao empatar essa maioria com outro jogador."
  }),
  objectiveCard("objective_2", "Objetivo 2", "2.png", {
    red: "Ao final da partida, voce pode gastar 3 pinhas para ganhar 3 pontos.",
    yellow:
      "Ganhe 1 ponto extra se tiver maioria de carne. Ganhe +1 ponto extra se nao empatar essa maioria com outro jogador."
  }),
  objectiveCard("objective_3", "Objetivo 3", "3.png", {
    red: "Ao final da partida, ganhe 1 ponto extra por cada maioria que voce tiver de recursos.",
    yellow: "Ganhe 1 ponto por cada linha de 3 ou mais campos adjacentes na floresta. Maximo 2 pontos."
  }),
  objectiveCard("objective_4", "Objetivo 4", "4.png", {
    red: "Ao final da partida, ganhe 1 ponto extra por cada maioria que voce tiver de recursos.",
    yellow: "Ganhe 1 ponto por cada rio de 4 ou mais cartas consecutivas na floresta. Maximo 2 pontos."
  }),
  objectiveCard("objective_5", "Objetivo 5", "5.png", {
    red: "Ganhe 1 ponto se remover 2 ou mais especies diferentes na partida. Ou 2 pontos se remover 3 ou mais especies.",
    yellow:
      "Ganhe 1 ponto extra se tiver maioria de ovo. Ganhe +1 ponto extra se nao empatar essa maioria com outro jogador."
  }),
  objectiveCard("objective_6", "Objetivo 6", "6.png", {
    red: "Ao final da partida, voce pode gastar 3 pinhas para ganhar 3 pontos.",
    yellow: "Ganhe 1 ponto por cada diagonal de 3 ou mais bosques alinhados na floresta. Maximo 2 pontos."
  }),
  objectiveCard("objective_7", "Objetivo 7", "7.png", {
    yellow: "Ganhe 1 ponto por cada recurso que nao possuir no final da partida. Maximo 2 pontos.",
    blue: "Ganhe 1 ponto por cada linha reta de 3 locais de pinha adjacentes. Maximo 2 pontos."
  }),
  objectiveCard("objective_8", "Objetivo 8", "8.png", {
    red: "Gaste 1 ponto para jogar um turno extra no final da partida.",
    blue: "Ganhe 1 ponto por cada linha reta de 3 locais de carne adjacentes. Maximo 2 pontos."
  }),
  objectiveCard("objective_9", "Objetivo 9", "9.png", {
    red: "Descarte esta carta a qualquer momento para ganhar 1 recurso de cada.",
    blue: "Ganhe 1 ponto por cada linha reta de 3 locais de ovo adjacentes. Maximo 2 pontos."
  }),
  objectiveCard("objective_10", "Objetivo 10", "10.png", {
    red: "Descarte esta carta a qualquer momento para ganhar 1 recurso de cada.",
    blue: "Ganhe 1 ponto por cada linha reta de 3 locais de fruta adjacentes. Maximo 2 pontos."
  }),
  objectiveCard("objective_11", "Objetivo 11", "11.png", {
    red: "Gaste 1 ponto para jogar um turno extra no final da partida.",
    blue: "Ganhe 1 ponto por cada quadrado de locais com os 4 recursos diferentes. Maximo 2 pontos."
  }),
  objectiveCard("objective_12", "Objetivo 12", "12.png", {
    yellow: "Ganhe 1 ponto por cada recurso que nao possuir no final da partida. Maximo 2 pontos.",
    blue: "Ganhe 1 ponto se mais da metade de suas pecas estiver na floresta. +1 ponto extra se todas estiverem na floresta."
  })
];

export const objectiveCardsById = new Map(objectiveCards.map((card) => [card.id, card]));

export const objectiveResourceByCard: Partial<Record<string, Resource>> = {
  objective_1: "fruit",
  objective_2: "meat",
  objective_5: "egg",
  objective_7: "seed",
  objective_8: "meat",
  objective_9: "egg",
  objective_10: "fruit"
};

export function getObjectiveCardDefinition(id: string): ObjectiveCardDefinition {
  const card = objectiveCardsById.get(id);
  if (!card) {
    throw new Error(`Unknown objective card definition: ${id}`);
  }

  return card;
}
