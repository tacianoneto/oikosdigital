import {
  objectiveCardBackPath,
  scenarioCardBackPath,
  threatCardBackPath
} from "@oikos/content";
import type { MiniExpansionId } from "@oikos/shared";

export interface MiniExpansionOption {
  id: MiniExpansionId;
  label: string;
  description: string;
  iconPath: string;
}

export const miniExpansionOptions: MiniExpansionOption[] = [
  {
    id: "objectives",
    label: "Cartas de objetivo",
    description: "Cada jogador escolhe 1 de 2 objetivos e pode ganhar ponto extra no fim do turno.",
    iconPath: objectiveCardBackPath
  },
  {
    id: "scenarios",
    label: "Cartas de cenário",
    description:
      "Antes da partida, jogadores votam em 1 ou 2 cenarios (bioma do Brasil) que alteram regras durante todo o jogo.",
    iconPath: scenarioCardBackPath
  },
  {
    id: "threats",
    label: "Cartas de ameaca",
    description: "Revela 1 ameaca aleatoria no inicio de cada turno, sem repetir cartas na partida.",
    iconPath: threatCardBackPath
  }
];
