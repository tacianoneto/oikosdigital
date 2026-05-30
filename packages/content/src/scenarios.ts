import type { ScenarioCardDefinition, ScenarioCardId } from "@oikos/shared";

const scenarioBasePath = "/assets/scenario-cards";
export const scenarioCardBackPath = `${scenarioBasePath}/Verso das cartas CEN.png`;

export const scenarioCards: ScenarioCardDefinition[] = [
  {
    id: "amazonia",
    label: "Amazônia",
    imagePath: `${scenarioBasePath}/Cen1.png`,
    description:
      "Ao final da partida, cada maioria de recursos vale 2 pontos ao invés de 1. Em caso de empate, cada jogador empatado recebe apenas 1 ponto."
  },
  {
    id: "caatinga",
    label: "Caatinga",
    imagePath: `${scenarioBasePath}/Cen2.png`,
    description:
      "Uma vez durante o turno de cada jogador, ao adicionar ou remover alguma peça na floresta ele pode receber ou perder o recurso do local onde adicionou ou removeu tal peça."
  },
  {
    id: "cerrado",
    label: "Cerrado",
    imagePath: `${scenarioBasePath}/Cen3.png`,
    description:
      "Uma vez por rodada. Quando algum jogador mover para um local de algum recurso que não possui, ele recebe 2 recursos daquele local ao invés de 1."
  },
  {
    id: "mata_atlantica",
    label: "Mata Atlântica",
    imagePath: `${scenarioBasePath}/Cen4.png`,
    description:
      "No início da partida, monte uma pilha de cartas de floresta e divida em 3 pilhas de 6 cartas. Nenhum jogador começará com cartas na mão, ao invés disso, deverá escolher 1 das pilhas para usar em seu turno, em seguida repor a carta escolhida pela carta do topo da pilha. Espécies que não usam cartas devem descartar 1 aberta em sua vez de jogar."
  },
  {
    id: "pampa",
    label: "Pampa",
    imagePath: `${scenarioBasePath}/Cen5.png`,
    description:
      "No turno de cada jogador, ao fazer seu movimento baseado no naipe de uma carta, o jogador DEVE escolher o movimento de um naipe diferente da carta ativada."
  },
  {
    id: "pantanal",
    label: "Pantanal",
    imagePath: `${scenarioBasePath}/Cen6.png`,
    description:
      "Ao final da última rodada (antes da contagem de pontos e maiorias), a carta que sobrar na mão de cada jogador deve ser revelada e 2 unidades do recurso dela adicionadas ao estoque desse jogador. Qualquer jogador que por alguma razão não tiver cartas na mão neste momento recebe 1."
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
