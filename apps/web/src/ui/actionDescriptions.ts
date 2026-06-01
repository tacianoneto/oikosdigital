import type { ActionId, SpeciesId } from "@oikos/shared";

const coatiActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Revele uma carta da floresta e instale um quati em local de fruta.",
  B: "Mova um quati pelo padrão da carta jogada e colete o recurso do destino.",
  C: "Se restarem menos de dois quatis na reserva, recolha dois da floresta."
};

const coatiActionTitles: Partial<Record<ActionId, string>> = {
  A: "Surgimento",
  B: "Investigação",
  C: "Retirada"
};

const jaguarActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Avance a Onça para um local adjacente e colete o recurso. Ao alcançar presa, remova uma peça e leve 1 carne.",
  B: "Avance a Onça pelo padrão do habitat atual e colete o recurso. Ao alcançar presa, remova uma peça e leve 1 carne.",
  C: "Converta 1 carne em 1 ponto. Pode repetir até três vezes."
};

const jaguarActionTitles: Partial<Record<ActionId, string>> = {
  A: "Investida",
  B: "Caçada",
  C: "Troféu"
};

const capuchinActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Revele uma carta da floresta e instale um macaco no local descoberto.",
  B: "Mova um macaco pelo padrão da carta jogada e colete o recurso do destino.",
  C: "Reforce o bando: posicione um macaco em local onde já houver outro.",
  D: "Marque 1 ponto por habitat que abrigue macacos em duas ou mais cartas distintas."
};

const capuchinActionTitles: Partial<Record<ActionId, string>> = {
  A: "Descoberta",
  B: "Travessia",
  C: "Bando",
  D: "Domínio"
};

const macawActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Revele uma carta da floresta e instale uma arara em local de ovo.",
  B: "Mova uma arara pelo padrão da carta jogada e colete o recurso do destino.",
  C: "Adicione ou realoque outra arara ao redor da que acabou de se mover. Se realocar, colete o recurso do novo destino.",
  D: "Marque 1 ponto por linha reta formada por três araras."
};

const macawActionTitles: Partial<Record<ActionId, string>> = {
  A: "Ninho",
  B: "Voo",
  C: "Bando",
  D: "Formação"
};

const armadilloActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Revele uma carta da floresta e instale um tatu em local de pinha.",
  B: "Mova um tatu pelo padrão da carta jogada e colete o recurso do destino.",
  C: "Recolha um tatu próprio em sua carapaça, escondendo-o dos demais.",
  D: "Marque 3 pontos, menos 1 por espécie adversária ausente do local de um tatu. Mínimo 1."
};

const armadilloActionTitles: Partial<Record<ActionId, string>> = {
  A: "Toca",
  B: "Travessia",
  C: "Esconderijo",
  D: "Defesa"
};

const wolfActionDescriptions: Partial<Record<ActionId, string>> = {
  A: "Revele uma carta e mova cada lobo pelo padrão do habitat exposto. Cada lobo movido colhe o recurso do seu destino.",
  B: "Em local partilhado com um lobo, capture uma peça de espécie de base. Lobo e presa colhem o recurso do local.",
  C: "Para cada lobo na floresta, gaste 1 recurso distinto e marque 1 ponto.",
  D: "Posicione um novo lobo em local de carne."
};

const wolfActionTitles: Partial<Record<ActionId, string>> = {
  A: "Matilha",
  B: "Emboscada",
  C: "Festim",
  D: "Reforço"
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

export function getActionTitle(speciesId: SpeciesId | null | undefined, actionId: ActionId | null): string {
  if (!speciesId || !actionId) {
    return "Ação Atual";
  }

  const map: Partial<Record<SpeciesId, Partial<Record<ActionId, string>>>> = {
    coati: coatiActionTitles,
    jaguar: jaguarActionTitles,
    capuchin: capuchinActionTitles,
    macaw: macawActionTitles,
    armadillo: armadilloActionTitles,
    maned_wolf: wolfActionTitles
  };

  return map[speciesId]?.[actionId] ?? `Ação ${actionId}`;
}
