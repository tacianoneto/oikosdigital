import type { ThreatCardDefinition, ThreatCardId } from "@oikos/shared";

const threatBasePath = "/assets/threat-cards";
export const threatCardBackPath = `${threatBasePath}/Verso das cartas INF.png`;

export const threatCards: ThreatCardDefinition[] = [
  {
    id: "threat_1",
    label: "Seca",
    imagePath: `${threatBasePath}/INF 1.png`,
    description: "Durante este turno, ninguem pode coletar em locais de rio."
  },
  {
    id: "threat_2",
    label: "Desmatamento",
    imagePath: `${threatBasePath}/INF 2.png`,
    description: "Qualquer carta adicionada neste turno deve ser posicionada sobre outra carta presente na floresta."
  },
  {
    id: "threat_3",
    label: "Queimada",
    imagePath: `${threatBasePath}/INF 3.png`,
    description: "Nenhuma especie pode coletar ovo ate este turno terminar."
  },
  {
    id: "threat_4",
    label: "Caca ilegal",
    imagePath: `${threatBasePath}/INF 4.png`,
    description: "Ao final do turno, o jogador escolhe remover 1 peca sua sem efeito ou gastar o recurso que mais possuir."
  },
  {
    id: "threat_5",
    label: "Poluicao",
    imagePath: `${threatBasePath}/INF 5.png`,
    description: "Nenhuma especie pode coletar pinha ate este turno terminar."
  },
  {
    id: "threat_6",
    label: "Enchente",
    imagePath: `${threatBasePath}/INF 6.png`,
    description: "Neste turno, todos os movimentos sao transformados em movimento ortogonal."
  },
  {
    id: "threat_7",
    label: "Erosao",
    imagePath: `${threatBasePath}/INF 7.png`,
    description: "Nenhuma especie pode coletar fruta ate este turno terminar."
  },
  {
    id: "threat_8",
    label: "Infestacao",
    imagePath: `${threatBasePath}/INF 8.png`,
    description: "Durante este turno, cada jogador perde 1 ponto ao final de seu turno."
  }
];

export const threatCardsById = new Map<ThreatCardId, ThreatCardDefinition>(
  threatCards.map((card) => [card.id, card])
);

export function getThreatCardDefinition(id: ThreatCardId): ThreatCardDefinition {
  const card = threatCardsById.get(id);
  if (!card) {
    throw new Error(`Unknown threat card definition: ${id}`);
  }
  return card;
}
