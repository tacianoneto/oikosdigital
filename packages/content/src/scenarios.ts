import type { ScenarioCardDefinition, ScenarioCardId } from "@oikos/shared";

const scenarioBasePath = "/assets/scenario-cards";
export const scenarioCardBackPath = `${scenarioBasePath}/Verso das cartas CEN.webp`;

export const scenarioCards: ScenarioCardDefinition[] = [
  {
    id: "amazonia",
    label: "AmazÃ´nia",
    imagePath: `${scenarioBasePath}/Cen1.webp`,
    description:
      "Ao final da partida, cada maioria de recursos vale 2 pontos ao invÃ©s de 1. Em caso de empate, cada jogador empatado recebe apenas 1 ponto."
  },
  {
    id: "caatinga",
    label: "Caatinga",
    imagePath: `${scenarioBasePath}/Cen2.webp`,
    description:
      "Uma vez durante o turno de cada jogador, ao adicionar ou remover alguma peÃ§a na floresta ele pode receber ou perder o recurso do local onde adicionou ou removeu tal peÃ§a."
  },
  {
    id: "cerrado",
    label: "Cerrado",
    imagePath: `${scenarioBasePath}/Cen3.webp`,
    description:
      "Uma vez por rodada. Quando algum jogador mover para um local de algum recurso que nÃ£o possui, ele recebe 2 recursos daquele local ao invÃ©s de 1."
  },
  {
    id: "mata_atlantica",
    label: "Mata AtlÃ¢ntica",
    imagePath: `${scenarioBasePath}/Cen4.webp`,
    description:
      "No inÃ­cio da partida, monte uma pilha de cartas de floresta e divida em 3 pilhas de 6 cartas. Nenhum jogador comeÃ§arÃ¡ com cartas na mÃ£o, ao invÃ©s disso, deverÃ¡ escolher 1 das pilhas para usar em seu turno, em seguida repor a carta escolhida pela carta do topo da pilha. EspÃ©cies que nÃ£o usam cartas devem descartar 1 aberta em sua vez de jogar."
  },
  {
    id: "pampa",
    label: "Pampa",
    imagePath: `${scenarioBasePath}/Cen5.webp`,
    description:
      "No turno de cada jogador, ao fazer seu movimento baseado no naipe de uma carta, o jogador DEVE escolher o movimento de um naipe diferente da carta ativada."
  },
  {
    id: "pantanal",
    label: "Pantanal",
    imagePath: `${scenarioBasePath}/Cen6.webp`,
    description:
      "Ao final da Ãºltima rodada (antes da contagem de pontos e maiorias), a carta que sobrar na mÃ£o de cada jogador deve ser revelada e 2 unidades do recurso dela adicionadas ao estoque desse jogador. Qualquer jogador que por alguma razÃ£o nÃ£o tiver cartas na mÃ£o neste momento recebe 1 [seed]."
  }
];

export const scenarioCardsById = new Map<ScenarioCardId, ScenarioCardDefinition>(
  scenarioCards.map((card) => [card.id, card])
);

export function getScenarioCardDefinition(id: ScenarioCardId): ScenarioCardDefinition {
  const card = scenarioCardsById.get(id);
  if (!card) {
    throw new Error(`Unknown scenario card definition: ${id}`);
  }
  return card;
}
