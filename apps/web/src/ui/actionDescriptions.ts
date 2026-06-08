import type { ActionId, SpeciesId } from "@oikos/shared";

// Action descriptions transcribed verbatim from the printed species boards in
// `/boards/*.png`. Do not paraphrase — these texts come straight from the
// physical board layout and must match the GDD wording.

const coatiActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Adicione 1 quati em um local de fruta.",
  B: "Mova 1 quati conforme a carta jogada.",
  C: "Se você tiver menos de 2 quatis em sua reserva, remova 2 quatis da floresta."
};

const jaguarActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Mova a onça para um local adjacente. Remova 1 peça no local que entrou.",
  B: "Mova a onça conforme o local onde ela está. Remova 1 peça no local que entrou.",
  C: "Gaste 1 carne para marcar 1 ponto (até 3 vezes)."
};

const capuchinActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Adicione 1 macaco na carta jogada.",
  B: "Mova 1 macaco conforme a carta jogada.",
  C: "Adicione 1 macaco em um local com outro macaco.",
  D: "Marque 1 ponto por cada tipo de habitat com macacos em 2 ou mais cartas diferentes."
};

const macawActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Adicione 1 arara em um local de ovo.",
  B: "Mova 1 arara conforme a carta jogada.",
  C: "Adicione ou realoque outra arara para um local ao redor daquela que foi movida.",
  D: "Marque 1 ponto por linha reta de 3 ou + araras na floresta (ortogonal ou diagonal)."
};

const galoActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Adicione 1 galo-de-campina em um local de campo.",
  B: "Mova 1 galo-de-campina conforme a carta jogada.",
  C: "Pode gastar 1 pinha para mover outro galo-de-campina conforme a carta jogada e adicionar 1 galo-de-campina em um local adjacente ao galo movido.",
  D: "Marque 1 ponto se estiver presente em ao menos 3 campinas e 1 ponto se estiver presente em ao menos 3 locais de pinha."
};

export function getPassiveDescription(speciesId: SpeciesId | null | undefined): string | null {
  if (speciesId === "galo_de_campina") {
    return "Sempre que se move para um local de pinha, coleta 1 pinha extra.";
  }

  return null;
}

const armadilloActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Adicione 1 tatu em um local de pinha.",
  B: "Mova 1 tatu conforme a carta jogada.",
  C: "Esconda qualquer um de seus tatus na floresta.",
  D: "Marque 3 pontos, -1 ponto por espécie que não divide local com nenhum tatu. (Mínimo 1 ponto.)"
};

const wolfActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Mova cada lobo conforme a carta jogada.",
  B: "Remova 1 peça de base com algum lobo. Ambos coletam o recurso do local.",
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

  if (speciesId === "galo_de_campina") {
    return galoActionDescriptions[actionId] ?? "Ação do Galo-de-campina pendente de implementação.";
  }

  if (speciesId === "armadillo") {
    return armadilloActionDescriptions[actionId] ?? "Ação do Tatu-bola pendente de implementação.";
  }

  if (speciesId === "maned_wolf") {
    return wolfActionDescriptions[actionId] ?? "Ação do Lobo-guará pendente de implementação.";
  }

  return "Ações desta espécie ainda pendentes de implementação.";
}

export function getActionTitle(speciesId: SpeciesId | null | undefined, actionId: ActionId | null): string {
  if (!speciesId || !actionId) {
    return "Ação atual";
  }
  return `Ação ${actionId}`;
}
