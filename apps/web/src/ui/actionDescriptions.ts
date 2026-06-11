import type { ActionId, SpeciesId } from "@oikos/shared";

// Action descriptions transcribed verbatim from the printed species boards in
// `/boards/*.webp`. Do not paraphrase â€” these texts come straight from the
// physical board layout and must match the GDD wording.

const coatiActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Adicione 1 quati em um local de fruta.",
  B: "Mova 1 quati conforme a carta jogada.",
  C: "Se vocÃª tiver menos de 2 quatis em sua reserva, remova 2 quatis da floresta."
};

const jaguarActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Mova a onÃ§a para um local adjacente. Remova 1 peÃ§a no local que entrou.",
  B: "Mova a onÃ§a conforme o local onde ela estÃ¡. Remova 1 peÃ§a no local que entrou.",
  C: "Gaste 1 carne para marcar 1 ponto (atÃ© 3 vezes)."
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
  C: "Pode gastar 1 semente para mover outro galo-de-campina conforme a carta jogada e adicionar 1 galo-de-campina em um local adjacente ao galo movido.",
  D: "Marque 1 ponto se estiver presente em ao menos 3 campinas e 1 ponto se estiver presente em ao menos 3 locais de semente."
};

export function getPassiveDescription(speciesId: SpeciesId | null | undefined): string | null {
  if (speciesId === "galo_de_campina") {
    return "Sempre que se move para um local de semente, coleta 1 semente extra.";
  }

  return null;
}

const armadilloActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Adicione 1 tatu em um local de semente.",
  B: "Mova 1 tatu conforme a carta jogada.",
  C: "Esconda qualquer um de seus tatus na floresta.",
  D: "Marque 3 pontos, -1 ponto por espÃ©cie que nÃ£o divide local com nenhum tatu. (MÃ­nimo 1 ponto.)"
};

const wolfActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Expanda a floresta. Mova cada lobo conforme a carta jogada.",
  B: "Remova 1 peÃ§a de base com algum lobo. Ambos coletam o recurso do local.",
  C: "Para cada lobo na floresta, gaste 1 recurso diferente e marque 1 ponto.",
  D: "Adicione 1 lobo em um local de carne."
};

export function getActionDescription(speciesId: SpeciesId | null | undefined, actionId: ActionId | null): string {
  if (!speciesId || !actionId) {
    return "Use a mÃ£o de cartas e os destaques da mesa para executar a aÃ§Ã£o atual.";
  }

  if (speciesId === "coati") {
    return coatiActionDescriptions[actionId] ?? "AÃ§Ã£o do Quati pendente de implementaÃ§Ã£o.";
  }

  if (speciesId === "jaguar") {
    return jaguarActionDescriptions[actionId] ?? "AÃ§Ã£o da OnÃ§a pendente de implementaÃ§Ã£o.";
  }

  if (speciesId === "capuchin") {
    return capuchinActionDescriptions[actionId] ?? "AÃ§Ã£o do Macaco-prego pendente de implementaÃ§Ã£o.";
  }

  if (speciesId === "macaw") {
    return macawActionDescriptions[actionId] ?? "AÃ§Ã£o da Arara-azul pendente de implementaÃ§Ã£o.";
  }

  if (speciesId === "galo_de_campina") {
    return galoActionDescriptions[actionId] ?? "AÃ§Ã£o do Galo-de-campina pendente de implementaÃ§Ã£o.";
  }

  if (speciesId === "armadillo") {
    return armadilloActionDescriptions[actionId] ?? "AÃ§Ã£o do Tatu-bola pendente de implementaÃ§Ã£o.";
  }

  if (speciesId === "maned_wolf") {
    return wolfActionDescriptions[actionId] ?? "AÃ§Ã£o do Lobo-guarÃ¡ pendente de implementaÃ§Ã£o.";
  }

  return "AÃ§Ãµes desta espÃ©cie ainda pendentes de implementaÃ§Ã£o.";
}

export function getActionTitle(speciesId: SpeciesId | null | undefined, actionId: ActionId | null): string {
  if (!speciesId || !actionId) {
    return "AÃ§Ã£o atual";
  }
  return `AÃ§Ã£o ${actionId}`;
}
