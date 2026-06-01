import type { ActionId, SpeciesId } from "@oikos/shared";

const coatiActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Adicione 1 quati em um local de fruta.",
  B: "Mova 1 quati conforme a carta jogada. Colete o recurso da carta destino.",
  C: "Se houver menos de 2 quatis na reserva, remova 2 quatis da floresta."
};

const jaguarActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Mova a Onça para um local adjacente. Colete o recurso da carta destino. Se houver peça no local, remova 1 e colete 1 carne.",
  B: "Mova a Onça conforme o local onde ela está. Colete o recurso da carta destino. Se houver peça no local, remova 1 e colete 1 carne.",
  C: "Gaste 1 carne para marcar 1 ponto, até 3 vezes."
};

const capuchinActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta e adicione 1 macaco na carta jogada.",
  B: "Mova 1 macaco conforme a carta jogada. Colete o recurso da carta destino.",
  C: "Adicione 1 macaco em local com outro macaco.",
  D: "Marque 1 ponto por tipo de habitat com macacos em 2 ou mais cartas diferentes."
};

const macawActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta e adicione 1 arara em local de ovo.",
  B: "Mova 1 arara conforme a carta jogada. Colete o recurso da carta destino.",
  C: "Adicione ou realoque outra arara ao redor da arara movida. Se realocar, colete o recurso da carta destino.",
  D: "Marque 1 ponto por linha reta de 3 araras."
};

const armadilloActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta e adicione 1 tatu em local de pinha.",
  B: "Mova 1 tatu conforme a carta jogada. Colete o recurso da carta destino.",
  C: "Esconda qualquer tatu próprio.",
  D: "Marque 3 pontos menos 1 por espécie adversária que não compartilhe local com tatu, mínimo 1."
};

const wolfActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Mova cada lobo conforme o habitat da carta jogada. Cada lobo movido coleta recurso da carta destino.",
  B: "Pode remover 1 peça de espécie de base em um local com lobo. Ambos coletam o recurso do local.",
  C: "Para cada lobo na floresta, gaste 1 recurso diferente e marque 1 ponto.",
  D: "Adicione 1 lobo em um local de carne."
};

export function getActionDescription(speciesId: SpeciesId | null | undefined, actionId: ActionId | null): string {
  if (!speciesId || !actionId) {
    return "Use a mão de cartas e os destaques da mesa para executar a ação atual.";
  }

  if (speciesId === "coati") {
    return coatiActionDescriptions[actionId] ?? "Ação do Quati pendente de implementação.";
  }

  if (speciesId === "jaguar") {
    return jaguarActionDescriptions[actionId] ?? "Ação da Onça pendente de implementação.";
  }

  if (speciesId === "capuchin") {
    return capuchinActionDescriptions[actionId] ?? "Ação do Macaco-prego pendente de implementação.";
  }

  if (speciesId === "macaw") {
    return macawActionDescriptions[actionId] ?? "Ação da Arara-azul pendente de implementação.";
  }

  if (speciesId === "armadillo") {
    return armadilloActionDescriptions[actionId] ?? "Ação do Tatu-bola pendente de implementação.";
  }

  if (speciesId === "maned_wolf") {
    return wolfActionDescriptions[actionId] ?? "Ação do Lobo-guará pendente de implementação.";
  }

  return "Ações desta espécie ainda pendentes de implementação.";
}
