import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Crown,
  GraduationCap,
  Leaf,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Minus,
  Package,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import {
  getForestCardDefinition,
  habitatLabels,
  movementLabels,
  resourceAssets,
  resourceLabels,
  speciesDefinitions
} from "@oikos/content";
import {
  addArmadilloForCurrentAction,
  addCapuchinForCurrentAction,
  addCoatiForCurrentAction,
  addMacawForCurrentAction,
  addWolfForCurrentAction,
  completeCurrentAction,
  createInitialGameState,
  createPreviewInitialForest,
  getAvailableJaguarPointSpendCount,
  getAvailableWolfPointSpendCount,
  getArmadilloHidePieceIds,
  getArmadilloSharingDetails,
  getArmadilloSeedPlacementPositions,
  getArmadilloShareScore,
  getCapuchinHabitatScore,
  getCapuchinPlacementPositions,
  getCoatiFruitPlacementPositions,
  getCoatiPairBonusTargets,
  getAvailableForestExpansionPositions,
  getAvailableForestExpansionPositionsForCard,
  getMacawActionCTargets,
  getCapuchinScoringHabitats,
  type CapuchinHabitatGroup,
  getMacawEggPlacementPositions,
  getMacawLineScore,
  getMacawScoringLines,
  type MacawScoringLine,
  getMacawRelocatablePieceIds,
  getRequiredCoatiRemovalCount,
  getValidPieceMovementDestinations,
  getWolfMeatPlacementPositions,
  getWolfRemovableBasePieceIds,
  getWolfSpendableResourceTypes,
  movePieceForCurrentAction,
  placeForestCard,
  placeInitialPiece,
  removeBasePieceForWolfAction,
  removePiecesForCurrentAction,
  resolveCoatiPairBonus,
  hideArmadilloForCurrentAction,
  scoreArmadilloSharing,
  scoreCapuchinHabitatPresence,
  scoreMacawLines,
  spendJaguarMeatForPoints,
  spendWolfResourcesForPoints
} from "@oikos/rules";
import type { ForestCardState, GameState, GridPosition, PublicRoomState, Resource, RoomPlayer, SpeciesId } from "@oikos/shared";
import { ForestCanvas, type ForestCanvasHandle } from "./game/ForestCanvas";
import { createSocket, roomApi, type OikosSocket } from "./socket";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import {
  getAudioSettings,
  initAudioOnGesture,
  playClick,
  playLogEvent,
  setAudioSettings,
  type AudioSettings
} from "./ui/audio";
import { getActionDescription } from "./ui/actionDescriptions";
import {
  HABITAT_SCORE_COLORS,
  SPECIES_HEX,
  botTurnDelayStepMs,
  categoryLabels,
  defaultBotTurnDelayMs,
  habitatShortLabel,
  localRoomId,
  maxBotTurnDelayMs,
  maxTurnHistory,
  minBotTurnDelayMs,
  resourceOrder,
  speciesList
} from "./ui/gameConstants";
import type { FloatingGain, TravelEffect } from "./ui/gameEffects";
import { elementCenter, sameGridPosition } from "./ui/geometry";
import {
  clearOnlineSession,
  isMissingRoomError,
  lastOnlineNameStorageKey,
  lastOnlineRoomStorageKey,
  saveOnlineSession
} from "./ui/session";
import { speciesVar } from "./ui/speciesStyle";
import { buildTurnSummaryEntries, type TurnRecapState, type TurnSummary } from "./ui/turnSummary";

// --- Tutorials --------------------------------------------------------------
type TutorialId = "initial" | "jaguar" | "wolf" | "armadillo" | "macaw" | "capuchin" | "coati";

const TUTORIAL_INITIAL_DONE_KEY = "oikos-tutorial-initial";
const TUTORIAL_JAGUAR_DONE_KEY = "oikos-tutorial-jaguar";
const TUTORIAL_WOLF_DONE_KEY = "oikos-tutorial-wolf";
const TUTORIAL_ARMADILLO_DONE_KEY = "oikos-tutorial-armadillo";
const TUTORIAL_MACAW_DONE_KEY = "oikos-tutorial-macaw";
const TUTORIAL_CAPUCHIN_DONE_KEY = "oikos-tutorial-capuchin";
const TUTORIAL_COATI_DONE_KEY = "oikos-tutorial-coati";

// Each scripted step locks the board to a single taught interaction:
//   none      -> read-only, advance with the coach button
//   setup     -> place the starting meeples
//   placeCard -> play a card (and add the piece that action A grants)
//   move      -> move a meeple
//   removeBase -> select a base species piece and confirm removal
//   score      -> use a modal/side action while the board stays read-only
//   addPiece   -> add a species piece to a highlighted card
//   resolvePair -> resolve the Coati pair passive on an adjacent highlighted card
//   removeCoati -> select own Coatis and confirm the action-C removal
type TutorialGate = "none" | "setup" | "placeCard" | "move" | "removeBase" | "score" | "addPiece" | "resolvePair" | "removeCoati";

interface TutorialStepDef {
  title: string;
  body: string;
  gate: TutorialGate;
  autoAdvance: boolean;
  requiredCardId?: string; // the only hand card the player may place this step
  markedSlot?: GridPosition; // the only slot where the card may be placed
  markedMoveTarget?: GridPosition; // the only board destination taught this step
  markedAddPieceTarget?: GridPosition;
  markedPairTarget?: GridPosition; // the only adjacent cell taught for the Coati pair bonus
  markedPieceId?: string;
  highlightMovementGuideSpecies?: SpeciesId;
  jaguarProbeTarget?: GridPosition;
  requiresRiver?: boolean; // the marked slot continues an existing river
  openBoard?: SpeciesId; // open this species board when the step starts
  completeWhenActionIndex?: number;
  completeWhenScoreAtLeast?: number;
  completeWhenRoundAtLeast?: number;
  completeWhenCoatiPairPending?: boolean; // advance once the pair passive is queued
  requiredSpendCount?: number;
}

// Fixed cards dealt to the tutorial hand so the scenario is deterministic.
const TUTORIAL_NONRIVER_CARD = "bosque_1"; // bosque (forest), no river
const TUTORIAL_RIVER_CARD = "rio_3"; // rio bend, must be rotated to connect

// Deterministic 3x3 starting forest (coords -1..1). The river card at (1,0) has
// a single mouth facing east into the empty cell (2,0). The player extends the
// forest at (0,-2) with a non-river card, then continues the river at (2,0),
// which only connects after rotating the river card.
const TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "tut_0", definitionId: "bosque_2", x: -1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "tut_1", definitionId: "campo_1", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "tut_2", definitionId: "bosque_3", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "tut_3", definitionId: "bosque_4", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "tut_4", definitionId: "campo_3", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "tut_5", definitionId: "rio_4", x: 1, y: 0, rotation: 90, isInitial: true }, // end mouth -> east
  { instanceId: "tut_6", definitionId: "campo_2", x: -1, y: 1, rotation: 0, isInitial: true },
  { instanceId: "tut_7", definitionId: "bosque_2_copy", x: 0, y: 1, rotation: 0, isInitial: true },
  { instanceId: "tut_8", definitionId: "campo_4", x: 1, y: 1, rotation: 0, isInitial: true }
];

// The initial tutorial runs a real local game with a single species (Tatu-bola)
// so the base mechanics are taught with the genuine rules engine. We click a
// card and then choose where it goes (there is no drag mechanic here).
const INITIAL_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Bem-vindo a Oikos",
    body: "Esta é a floresta central. Ao longo do jogo ela cresce conforme as cartas são jogadas. Vamos aprender as mecânicas básicas.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Habitats e recursos",
    body: "Toda carta tem um habitat (bosque, campo ou rio) e exatamente um recurso: carne, ovo, fruta ou pinha. Os recursos ficam sempre na carta. No fim, quem tiver a maioria de cada recurso marca 1 ponto extra, exceto a pinha, que marca 1 ponto a cada 2 pinhas.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Posicione seus meeples",
    body: "Cada espécie tem um total de meeples e uma quantidade inicial para o setup. Clique numa carta para posicionar cada meeple inicial e você ganha o recurso daquele local. Atenção: ganhar recurso ao adicionar só acontece no setup.",
    gate: "setup",
    autoAdvance: true
  },
  {
    title: "Adicione uma carta",
    body: "Para expandir a floresta, clique na carta destacada na sua mão e depois clique no espaço destacado no tabuleiro. Vamos começar com uma carta sem rio: ela encaixa em qualquer espaço livre.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: TUTORIAL_NONRIVER_CARD,
    markedSlot: { x: -2, y: 0 }
  },
  {
    title: "Continue o rio",
    body: "Cartas de rio têm margens de água que precisam se conectar com outra água (ou sair pela borda), nunca encostar na mata. O espaço destacado fica ao lado de um rio: gire a carta com Q/E até a água encaixar com o rio vizinho e coloque-a ali.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: TUTORIAL_RIVER_CARD,
    markedSlot: { x: 2, y: 0 },
    requiresRiver: true
  },
  {
    title: "Mova um meeple",
    body: "Clique em um meeple seu e escolha um destino destacado. Cada espécie se move de um jeito para cada habitat. O Tatu se move conforme a carta jogada, veja o tabuleiro dele à direita. Sempre que você move um meeple, ganha o recurso do local de destino.",
    gate: "move",
    autoAdvance: true,
    openBoard: "armadillo"
  },
  {
    title: "Você aprendeu o básico!",
    body: "As ações de cada espécie acontecem em ordem. O jogo dura 5 rodadas e vence quem fizer mais pontos. Você pode aprender a jogar com cada espécie nos tutoriais dela. Bom jogo!",
    gate: "none",
    autoAdvance: false
  }
];

const JAGUAR_TUTORIAL_PLAYER_ID = "local_jaguar";
const JAGUAR_TUTORIAL_COATI_ID = "local_coati";
const JAGUAR_TUTORIAL_CAPUCHIN_ID = "local_capuchin";
const WOLF_TUTORIAL_PLAYER_ID = "local_maned_wolf";
const WOLF_TUTORIAL_COATI_ID = "local_wolf_coati";
const WOLF_TUTORIAL_CAPUCHIN_ID = "local_wolf_capuchin";
const WOLF_TUTORIAL_CARD = "campo_3_copy";
const WOLF_TUTORIAL_FIRST_WOLF_ID = `${WOLF_TUTORIAL_PLAYER_ID}_piece_1`;
const WOLF_TUTORIAL_SECOND_WOLF_ID = `${WOLF_TUTORIAL_PLAYER_ID}_piece_2`;
const WOLF_TUTORIAL_BASE_TARGET_ID = `${WOLF_TUTORIAL_COATI_ID}_piece_1`;
const ARMADILLO_TUTORIAL_PLAYER_ID = "local_armadillo_species";
const ARMADILLO_TUTORIAL_COATI_ID = "local_armadillo_coati";
const ARMADILLO_TUTORIAL_CAPUCHIN_ID = "local_armadillo_capuchin";
const ARMADILLO_TUTORIAL_JAGUAR_ID = "local_armadillo_jaguar";
const ARMADILLO_TUTORIAL_CARD = "bosque_4_copy";
const ARMADILLO_TUTORIAL_MOVE_ID = `${ARMADILLO_TUTORIAL_PLAYER_ID}_piece_1`;
const ARMADILLO_TUTORIAL_HIDE_ID = `${ARMADILLO_TUTORIAL_PLAYER_ID}_piece_2`;
const ARMADILLO_TUTORIAL_JAGUAR_ID_PIECE = `${ARMADILLO_TUTORIAL_JAGUAR_ID}_piece_1`;
const MACAW_TUTORIAL_PLAYER_ID = "local_macaw_species";
const MACAW_TUTORIAL_CARD = "campo_2_copy";
const MACAW_TUTORIAL_MOVE_ID = `${MACAW_TUTORIAL_PLAYER_ID}_piece_1`;
const CAPUCHIN_TUTORIAL_PLAYER_ID = "local_capuchin_species";
const CAPUCHIN_TUTORIAL_CARD = "bosque_4_copy";
const CAPUCHIN_TUTORIAL_MOVE_ID = `${CAPUCHIN_TUTORIAL_PLAYER_ID}_piece_3`;
const COATI_TUTORIAL_PLAYER_ID = "local_coati_species";
const COATI_TUTORIAL_CARD = "campo_2_copy_2";
const COATI_TUTORIAL_MOVE_ID = `${COATI_TUTORIAL_PLAYER_ID}_piece_3`;

const JAGUAR_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "jag_tut_0", definitionId: "bosque_2", x: -2, y: -1, rotation: 0, isInitial: true },
  { instanceId: "jag_tut_1", definitionId: "campo_4", x: -1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "jag_tut_2", definitionId: "bosque_3", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "jag_tut_3", definitionId: "campo_3", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "jag_tut_4", definitionId: "bosque_4", x: -2, y: 0, rotation: 0, isInitial: true },
  { instanceId: "jag_tut_5", definitionId: "bosque_1", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "jag_tut_6", definitionId: "campo_1", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "jag_tut_7", definitionId: "bosque_2_copy", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "jag_tut_8", definitionId: "campo_4_copy", x: -1, y: 1, rotation: 0, isInitial: true },
  { instanceId: "jag_tut_9", definitionId: "bosque_3_copy", x: 0, y: 1, rotation: 0, isInitial: true },
  { instanceId: "jag_tut_10", definitionId: "campo_2", x: 1, y: 1, rotation: 0, isInitial: true }
];

const JAGUAR_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Onça-pintada",
    body: "Vamos aprender a jogar de Onça-pintada! Ela é o predador: 1 meeple, sem cartas na mão, caça e remove peças adversárias para ganhar carne e pontuar. Dica: só captura peças à vista — as escondidas escapam.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Cenário preparado",
    body: "Vamos treinar como se a partida já estivesse no segundo turno: a floresta está montada, há outras espécies em campo e a Onça já está pronta para caçar.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação A: mover adjacente",
    body: "Na ação A, a Onça sempre move 1 casa adjacente. Clique na Onça e depois no local destacado com uma peça de outra espécie. Ao entrar ali, ela remove 1 peça e ganha 1 carne.",
    gate: "move",
    autoAdvance: true,
    markedMoveTarget: { x: 0, y: 0 },
    completeWhenActionIndex: 1
  },
  {
    title: "Primeira caça",
    body: "A peça removida voltou para a reserva do dono e a Onça ganhou 1 carne. Ela também coleta o recurso do local onde terminou o movimento.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação B: mover pelo habitat",
    body: "Na ação B, a Onça usa o movimento indicado pelo habitat onde está. Antes de mover, passe o mouse sobre o ícone de movimento da Onça na lista de jogadores para abrir a imagem de referência. Ela está em campo, então vai mover na diagonal para o local destacado com carne e outra peça.",
    gate: "move",
    autoAdvance: true,
    markedMoveTarget: { x: 1, y: 1 },
    completeWhenActionIndex: 2,
    highlightMovementGuideSpecies: "jaguar"
  },
  {
    title: "Três carnes disponíveis",
    body: "Neste segundo movimento, a Onça removeu outra peça (+1 carne) e caiu em uma carta de carne (+1 carne). Somando com a primeira caça, agora ela tem 3 carnes.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação C: gastar carne",
    body: "Na ação C, a Onça pode gastar de 1 a 3 carnes para marcar a mesma quantidade de pontos. Escolha gastar 3 carnes para marcar 3 pontos.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 3,
    requiredSpendCount: 3
  },
  {
    title: "Turno da Onça completo",
    body: "Resumo: A moveu adjacente e caçou; B moveu pelo habitat, caçou e coletou carne; C gastou 3 carnes para fazer 3 pontos. Esse é o ciclo principal da Onça.",
    gate: "none",
    autoAdvance: false
  }
];

const WOLF_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "wolf_tut_0", definitionId: "bosque_2", x: -2, y: -1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_1", definitionId: "campo_4", x: -1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_2", definitionId: "bosque_3", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_3", definitionId: "campo_3", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_4", definitionId: "bosque_4", x: -2, y: 0, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_5", definitionId: "bosque_1", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_6", definitionId: "campo_1", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_7", definitionId: "bosque_2_copy", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_8", definitionId: "campo_4_copy", x: -1, y: 1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_9", definitionId: "bosque_3_copy", x: 0, y: 1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_10", definitionId: "campo_2", x: 1, y: 1, rotation: 0, isInitial: true }
];

const WOLF_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Lobo-guará",
    body: "Vamos aprender a jogar de Lobo-guará! Subpredador que age em matilha: expande a floresta, remove peças de base sob seus lobos e gasta recursos diferentes para pontuar. Dica: cace espécies de base e acumule recursos variados — quanto mais lobos na floresta, mais recursos você pode gastar por pontos.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Cenário preparado",
    body: "Vamos treinar como se a partida já estivesse no segundo turno: a floresta está pronta, dois lobos já estão em campo, um lobo está na reserva e há espécies de base para interagir.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação A: jogar carta",
    body: "Na ação A, o Lobo expande a floresta com uma carta. Jogue a carta de campo destacada no espaço destacado à direita. O habitat da carta jogada define como todos os lobos pendentes vão se mover.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: WOLF_TUTORIAL_CARD,
    markedSlot: { x: 2, y: -1 }
  },
  {
    title: "Ação A: mover primeiro lobo",
    body: "Campo dá ao Lobo movimento adjacente. Passe o mouse sobre o ícone de movimento do Lobo na lista de jogadores para abrir a imagem de referência. Agora clique no lobo destacado e mova para o Quati destacado; ele coleta o ovo do local.",
    gate: "move",
    autoAdvance: true,
    markedMoveTarget: { x: 1, y: 0 },
    markedPieceId: WOLF_TUTORIAL_FIRST_WOLF_ID,
    highlightMovementGuideSpecies: "maned_wolf"
  },
  {
    title: "Ação A: mover todos os lobos",
    body: "Quando a carta é jogada, cada lobo com movimento legal precisa mover. Clique no segundo lobo destacado e mova para o bosque destacado; ele coleta uma pinha.",
    gate: "move",
    autoAdvance: true,
    markedMoveTarget: { x: 0, y: 1 },
    markedPieceId: WOLF_TUTORIAL_SECOND_WOLF_ID,
    completeWhenActionIndex: 1
  },
  {
    title: "Ação B: remover espécie de base",
    body: "Na ação B, o Lobo pode remover 1 peça de espécie de base que esteja no mesmo local de um lobo. Selecione o Quati destacado e clique em Remover peça. O Lobo e o Quati coletam o recurso desse local.",
    gate: "removeBase",
    autoAdvance: true,
    markedPieceId: WOLF_TUTORIAL_BASE_TARGET_ID,
    completeWhenActionIndex: 2
  },
  {
    title: "Ação C: gastar recursos diferentes",
    body: "Na ação C, para cada lobo na floresta, gaste 1 recurso diferente e marque 1 ponto. Como há 2 lobos em campo, escolha ovo e pinha para marcar 2 pontos.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 2,
    requiredSpendCount: 2
  },
  {
    title: "Ação D: adicionar lobo",
    body: "Na ação D, adicione 1 lobo da reserva em um local com carne. Clique na carta de carne destacada para colocar o terceiro lobo e encerrar o turno.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: -2, y: 0 },
    completeWhenRoundAtLeast: 3
  },
  {
    title: "Turno do Lobo completo",
    body: "Resumo: A joga carta e move todos os lobos; B remove uma espécie de base junto de um lobo; C gasta recursos diferentes para pontuar; D adiciona lobo em carne. Esse é o ciclo principal do Lobo-guará.",
    gate: "none",
    autoAdvance: false
  }
];

const ARMADILLO_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "arm_tut_0", definitionId: "bosque_2", x: -2, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_1", definitionId: "campo_4", x: -1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_2", definitionId: "bosque_3", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_3", definitionId: "campo_3", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_4", definitionId: "bosque_4", x: -2, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_5", definitionId: "bosque_1", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_6", definitionId: "campo_1", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_7", definitionId: "bosque_2_copy", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_8", definitionId: "campo_4_copy", x: -1, y: 1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_9", definitionId: "bosque_3_copy", x: 0, y: 1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_10", definitionId: "campo_2", x: 1, y: 1, rotation: 0, isInitial: true }
];

const ARMADILLO_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Tatu-bola",
    body: "Vamos aprender a jogar de Tatu-bola! Ele cresce perto de pinhas, pode se esconder e pontua dividindo locais com outras espécies. Dica: esconda os tatus para escapar do predador.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Cenário preparado",
    body: "Vamos treinar como se a partida já estivesse no segundo turno: há quatis e macacos na floresta, dois tatus em campo e dois tatus ainda na reserva.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação A: jogar carta",
    body: "Na ação A, o Tatu-bola expande a floresta com uma carta da mão. Jogue a carta de bosque destacada no espaço destacado à direita. O habitat dessa carta vai definir o movimento da ação B.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: ARMADILLO_TUTORIAL_CARD,
    markedSlot: { x: 2, y: 0 }
  },
  {
    title: "Ação A: adicionar em pinha",
    body: "Depois de jogar a carta, o Tatu-bola pode adicionar 1 tatu da reserva em qualquer local com pinha. Clique na carta de pinha destacada para aumentar sua presença.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: 0, y: 1 },
    completeWhenActionIndex: 1
  },
  {
    title: "Ação B: mover pelo habitat jogado",
    body: "A carta jogada foi um bosque. Para o Tatu-bola, bosque permite movimento adjacente. Clique no tatu destacado e mova para o macaco-prego destacado para preparar a pontuação por compartilhamento.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: ARMADILLO_TUTORIAL_MOVE_ID,
    markedMoveTarget: { x: 0, y: -1 },
    highlightMovementGuideSpecies: "armadillo",
    completeWhenActionIndex: 2
  },
  {
    title: "Ação C: esconder",
    body: "Na ação C, o Tatu-bola pode se esconder. Escolha o tatu sozinho destacado, perto da Onça, e clique em Esconder Tatu-bola. Ele continua ocupando o local, mas fica protegido.",
    gate: "score",
    autoAdvance: true,
    markedPieceId: ARMADILLO_TUTORIAL_HIDE_ID,
    completeWhenActionIndex: 3
  },
  {
    title: "Ação D: pontuar compartilhamento",
    body: "Na ação D, o Tatu-bola pontua por ter tatus em locais compartilhados com outras espécies. Aqui ele divide local com Quati e Macaco-prego, então marca 2 pontos automaticamente.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 2
  },
  {
    title: "Turno da Onça: ataque bloqueado",
    body: "Agora é como se fosse o turno da Onça. Ela entrou no local do Tatu-bola escondido, mas não consegue removê-lo. Enquanto estiver escondido, ele continua protegido. Se esse tatu se mover em uma ação futura, ele deixa de ficar escondido.",
    gate: "none",
    autoAdvance: false,
    jaguarProbeTarget: { x: -1, y: 0 }
  },
  {
    title: "Turno do Tatu-bola completo",
    body: "Resumo: A joga carta e adiciona tatu em pinha; B move conforme o habitat da carta; C esconde um tatu; D pontua por compartilhar locais com outras espécies. Depois, a Onça mostrou por que esconder protege.",
    gate: "none",
    autoAdvance: false
  }
];

const MACAW_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "mac_tut_0", definitionId: "bosque_2", x: -2, y: -1, rotation: 0, isInitial: true },
  { instanceId: "mac_tut_1", definitionId: "campo_4", x: -1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "mac_tut_2", definitionId: "bosque_3", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "mac_tut_3", definitionId: "campo_3", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "mac_tut_4", definitionId: "bosque_4", x: -2, y: 0, rotation: 0, isInitial: true },
  { instanceId: "mac_tut_5", definitionId: "bosque_1", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "mac_tut_6", definitionId: "campo_1", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "mac_tut_7", definitionId: "bosque_2_copy", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "mac_tut_8", definitionId: "campo_4_copy", x: -1, y: 1, rotation: 0, isInitial: true },
  { instanceId: "mac_tut_9", definitionId: "bosque_3_copy", x: 0, y: 1, rotation: 0, isInitial: true },
  { instanceId: "mac_tut_10", definitionId: "campo_2", x: 1, y: 1, rotation: 0, isInitial: true }
];

const MACAW_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Arara-azul",
    body: "Vamos aprender a jogar de Arara-azul! Ela pontua formando linhas retas de 3 araras: horizontal, vertical ou diagonal. Dica: posicione sempre pensando na próxima linha.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Cenário preparado",
    body: "Vamos treinar como se a partida já estivesse no segundo turno: três araras estão na floresta e outras estão na reserva. O objetivo é completar uma linha horizontal de 3.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação A: jogar carta",
    body: "Na ação A, a Arara expande a floresta com uma carta. Jogue a carta de campo destacada no espaço à direita. O habitat da carta jogada define o movimento da ação B.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: MACAW_TUTORIAL_CARD,
    markedSlot: { x: 2, y: 0 }
  },
  {
    title: "Ação A: adicionar em ovo",
    body: "Depois de jogar a carta, a Arara pode adicionar 1 peça da reserva em qualquer local com ovo. Clique na carta de ovo destacada. Essa adição não depende da carta jogada.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: 1, y: 0 },
    completeWhenActionIndex: 1
  },
  {
    title: "Ação B: mover pela carta jogada",
    body: "A carta jogada foi de campo. Para a Arara, campo permite movimento adjacente. Mova a arara destacada para o espaço destacado; ao mover, ela coleta o recurso do destino.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: MACAW_TUTORIAL_MOVE_ID,
    markedMoveTarget: { x: 0, y: -1 },
    highlightMovementGuideSpecies: "macaw",
    completeWhenActionIndex: 2
  },
  {
    title: "Ação C: reforçar ao redor",
    body: "Na ação C, você pode adicionar 1 arara da reserva ao redor da arara que acabou de mover, ou realocar outra arara para um desses espaços. A ação C não coleta recurso. Aqui vamos adicionar para completar a linha.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: 1, y: -1 },
    completeWhenActionIndex: 3
  },
  {
    title: "Ação D: pontuar linhas",
    body: "Na ação D, a Arara marca 1 ponto por cada linha reta de 3 araras: horizontal, vertical ou diagonal. A linha destacada vale 1 ponto e será pontuada automaticamente.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 1
  },
  {
    title: "Turno da Arara completo",
    body: "Resumo: A joga carta e pode adicionar em ovo; B move conforme o habitat da carta e coleta recurso; C adiciona ou realoca ao redor da arara movida sem coletar; D pontua linhas retas de 3.",
    gate: "none",
    autoAdvance: false
  }
];

// 3x3 com 2 rios (margens viradas para a borda do grid), bosques e campos.
// Macacos pre-posicionados em 2 rios + 2 bosques + 1 campo; a carta jogada
// entra em (2,0). A acao B salta um macaco de bosque para o campo em (1,0),
// fechando duplas em rio, bosque e campo = 3 pontos.
const CAPUCHIN_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "cap_tut_0", definitionId: "rio_4", x: -1, y: -1, rotation: 0, isInitial: true }, // boca norte -> borda
  { instanceId: "cap_tut_1", definitionId: "bosque_2", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_2", definitionId: "campo_1", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_3", definitionId: "bosque_3", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_4", definitionId: "bosque_1", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_5", definitionId: "campo_2", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_6", definitionId: "rio_7", x: -1, y: 1, rotation: 180, isInitial: true }, // boca sul -> borda
  { instanceId: "cap_tut_7", definitionId: "campo_3", x: 0, y: 1, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_8", definitionId: "bosque_4", x: 1, y: 1, rotation: 0, isInitial: true }
];

const CAPUCHIN_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Macaco-prego",
    body: "Vamos aprender a jogar de Macaco-prego! Ele pontua cada habitat (rio, bosque, campo) onde tiver 2 ou mais macacos em cartas diferentes. Dica: espalhe pares por habitats variados em vez de amontoar num só.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Jogue a carta",
    body: "Arraste a carta de bosque destacada para o espaço à direita.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: CAPUCHIN_TUTORIAL_CARD,
    markedSlot: { x: 2, y: 0 }
  },
  {
    title: "Adicione um macaco",
    body: "Clique na carta que acabou de jogar para pôr 1 macaco nela.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: 2, y: 0 },
    completeWhenActionIndex: 1
  },
  {
    title: "Salte para o campo",
    body: "Bosque = salto reto. Mova o macaco destacado para o campo destacado.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: CAPUCHIN_TUTORIAL_MOVE_ID,
    markedMoveTarget: { x: 1, y: 0 },
    highlightMovementGuideSpecies: "capuchin",
    completeWhenActionIndex: 2
  },
  {
    title: "Reforce",
    body: "Clique no local destacado para empilhar mais 1 macaco.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: 2, y: 0 },
    completeWhenActionIndex: 3
  },
  {
    title: "+3 pontos!",
    body: "2 rios, 2 bosques e 2 campos: 3 habitats com par, 3 pontos.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 3
  },
  {
    title: "Pegou a ideia",
    body: "Cada habitat com 2+ macacos em cartas diferentes = 1 ponto. Espalhe em mais habitats para pontuar mais.",
    gate: "none",
    autoAdvance: false
  }
];

// 3x3. Macacos... digo, quatis pre-posicionados em F=(-1,0) e L1=(-1,-1) para a
// cadeia da acao A; mover em (1,1) e par-alvo em (0,0) para a acao B. A carta de
// campo entra em (2,0). A cadeia de pares marca 3 pontos e esvazia a reserva,
// forcando a remocao de 2 quatis na acao C.
const COATI_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "coa_tut_0", definitionId: "bosque_2", x: -1, y: -1, rotation: 0, isInitial: true }, // L1 (Q_b)
  { instanceId: "coa_tut_1", definitionId: "bosque_3", x: 0, y: -1, rotation: 0, isInitial: true }, // L2 (resolve2)
  { instanceId: "coa_tut_2", definitionId: "campo_4", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "coa_tut_3", definitionId: "campo_3", x: -1, y: 0, rotation: 0, isInitial: true }, // F fruta (Q_a)
  { instanceId: "coa_tut_4", definitionId: "bosque_4", x: 0, y: 0, rotation: 0, isInitial: true }, // M (Q_d)
  { instanceId: "coa_tut_5", definitionId: "campo_1", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "coa_tut_6", definitionId: "campo_2", x: -1, y: 1, rotation: 0, isInitial: true },
  { instanceId: "coa_tut_7", definitionId: "bosque_2_copy", x: 0, y: 1, rotation: 0, isInitial: true }, // L3 (resolve3)
  { instanceId: "coa_tut_8", definitionId: "campo_4_copy", x: 1, y: 1, rotation: 0, isInitial: true } // mover (Q_c)
];

const COATI_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Quati",
    body: "Vamos aprender a jogar de Quati! Quando ele forma um par exato de 2 quatis, adiciona 1 quati da reserva num local vizinho e só então marca 1 ponto. Ou seja: formar o par não basta — sem adicionar o quati (sem reserva ou sem espaço), não há ponto. Dica: encadeie pares para fazer combos.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "O plano",
    body: "Você vai disparar uma cadeia de pares e marcar 3 pontos neste turno. No fim, sua reserva esvazia e a ação C te obriga a remover 2 quatis. Bora jogar.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Jogue a carta",
    body: "Ação A: arraste a carta de campo destacada para o espaço à direita.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: COATI_TUTORIAL_CARD,
    markedSlot: { x: 2, y: 0 }
  },
  {
    title: "Forme o primeiro par",
    body: "Adicione 1 quati na carta de fruta destacada, onde já há um quati seu. Isso forma um par e dispara a passiva.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: -1, y: 0 },
    completeWhenCoatiPairPending: true
  },
  {
    title: "Resolva o par (+1)",
    body: "Clique no local vizinho destacado para adicionar 1 quati e marcar 1 ponto. Ele cai ao lado de outro quati e forma um novo par!",
    gate: "resolvePair",
    autoAdvance: true,
    markedPairTarget: { x: -1, y: -1 },
    completeWhenScoreAtLeast: 1
  },
  {
    title: "Combo! (+1)",
    body: "O par encadeou. Clique no vizinho destacado para resolver de novo e marcar mais 1 ponto. Já são 2.",
    gate: "resolvePair",
    autoAdvance: true,
    markedPairTarget: { x: 0, y: -1 },
    completeWhenScoreAtLeast: 2
  },
  {
    title: "Mova e forme outro par",
    body: "Ação B: campo = movimento diagonal. Mova o quati destacado para o local destacado, onde já há um quati. Forma mais um par.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: COATI_TUTORIAL_MOVE_ID,
    markedMoveTarget: { x: 0, y: 0 },
    highlightMovementGuideSpecies: "coati",
    completeWhenCoatiPairPending: true
  },
  {
    title: "Terceiro ponto (+1)",
    body: "Clique no vizinho destacado para resolver o par. 3 pontos no turno!",
    gate: "resolvePair",
    autoAdvance: true,
    markedPairTarget: { x: 0, y: 1 },
    completeWhenScoreAtLeast: 3
  },
  {
    title: "Ação C: remova 2 quatis",
    body: "Sua reserva ficou abaixo de 2, então a ação C obriga remover 2 quatis da floresta. Clique em 2 quatis seus e confirme a remoção.",
    gate: "removeCoati",
    autoAdvance: true,
    completeWhenRoundAtLeast: 3
  },
  {
    title: "Turno do Quati completo",
    body: "Pares geram combos: cada par fecha com 1 quati adicionado e 1 ponto. Sem reserva, a ação C cobra o preço de 2 quatis. Equilibre crescer e gastar.",
    gate: "none",
    autoAdvance: false
  }
];

function getTutorialDoneKey(tutorialId: TutorialId): string {
  if (tutorialId === "jaguar") return TUTORIAL_JAGUAR_DONE_KEY;
  if (tutorialId === "wolf") return TUTORIAL_WOLF_DONE_KEY;
  if (tutorialId === "armadillo") return TUTORIAL_ARMADILLO_DONE_KEY;
  if (tutorialId === "macaw") return TUTORIAL_MACAW_DONE_KEY;
  if (tutorialId === "capuchin") return TUTORIAL_CAPUCHIN_DONE_KEY;
  if (tutorialId === "coati") return TUTORIAL_COATI_DONE_KEY;
  return TUTORIAL_INITIAL_DONE_KEY;
}

function isTutorialDone(tutorialId: TutorialId): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getTutorialDoneKey(tutorialId)) === "1";
  } catch {
    return false;
  }
}

function markTutorialDone(tutorialId: TutorialId): void {
  try {
    window.localStorage.setItem(getTutorialDoneKey(tutorialId), "1");
  } catch {
    // ignore
  }
}

function isTutorialInitialDone(): boolean {
  return isTutorialDone("initial");
}

function isTutorialJaguarDone(): boolean {
  return isTutorialDone("jaguar");
}

function isTutorialWolfDone(): boolean {
  return isTutorialDone("wolf");
}

function isTutorialArmadilloDone(): boolean {
  return isTutorialDone("armadillo");
}

function isTutorialMacawDone(): boolean {
  return isTutorialDone("macaw");
}

function isTutorialCapuchinDone(): boolean {
  return isTutorialDone("capuchin");
}

function isTutorialCoatiDone(): boolean {
  return isTutorialDone("coati");
}

function placeTutorialPiece(game: GameState, playerId: string, pieceNumber: number, location: GridPosition): void {
  const player = game.players.find((candidate) => candidate.playerId === playerId);
  const pieceId = `${playerId}_piece_${pieceNumber}`;
  const piece = game.pieces.find((candidate) => candidate.pieceId === pieceId);
  if (!player || !piece) {
    return;
  }

  piece.location = { ...location, siteId: "main" };
  player.reservePieces = player.reservePieces.filter((candidate) => candidate !== pieceId);
  if (!player.piecesInForest.includes(pieceId)) {
    player.piecesInForest = [...player.piecesInForest, pieceId];
  }
}

function createJaguarTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: JAGUAR_TUTORIAL_PLAYER_ID,
      name: "Tutorial Onça",
      speciesId: "jaguar",
      ready: true,
      connected: true
    },
    {
      playerId: JAGUAR_TUTORIAL_COATI_ID,
      name: "Quati de treino",
      speciesId: "coati",
      ready: true,
      connected: true
    },
    {
      playerId: JAGUAR_TUTORIAL_CAPUCHIN_ID,
      name: "Macaco de treino",
      speciesId: "capuchin",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, JAGUAR_TUTORIAL_FOREST);

  for (const player of game.players) {
    player.score = 0;
    player.turnsTaken = player.playerId === JAGUAR_TUTORIAL_PLAYER_ID ? 1 : 0;
    player.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
  }

  placeTutorialPiece(game, JAGUAR_TUTORIAL_PLAYER_ID, 1, { x: -1, y: 0 });
  placeTutorialPiece(game, JAGUAR_TUTORIAL_COATI_ID, 1, { x: 0, y: 0 });
  placeTutorialPiece(game, JAGUAR_TUTORIAL_COATI_ID, 2, { x: 1, y: 0 });
  placeTutorialPiece(game, JAGUAR_TUTORIAL_CAPUCHIN_ID, 1, { x: 1, y: 1 });
  placeTutorialPiece(game, JAGUAR_TUTORIAL_CAPUCHIN_ID, 2, { x: -2, y: -1 });

  game.status = "active";
  game.round = 2;
  game.activePlayerId = JAGUAR_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.turnOrder = [JAGUAR_TUTORIAL_PLAYER_ID];
  game.log = [
    {
      id: "jaguar_tutorial_ready",
      message: "Tutorial da Onça preparado no segundo turno.",
      createdAt: Date.now()
    }
  ];

  return {
    roomId: localRoomId,
    status: "active",
    hostPlayerId: "local_host",
    players: tutorialPlayers,
    game,
    warnings: game.contentWarnings
  };
}

function createWolfTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: WOLF_TUTORIAL_PLAYER_ID,
      name: "Tutorial Lobo",
      speciesId: "maned_wolf",
      ready: true,
      connected: true
    },
    {
      playerId: WOLF_TUTORIAL_COATI_ID,
      name: "Quati de treino",
      speciesId: "coati",
      ready: true,
      connected: true
    },
    {
      playerId: WOLF_TUTORIAL_CAPUCHIN_ID,
      name: "Macaco de treino",
      speciesId: "capuchin",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, WOLF_TUTORIAL_FOREST);

  for (const player of game.players) {
    player.score = 0;
    player.turnsTaken = player.playerId === WOLF_TUTORIAL_PLAYER_ID ? 1 : 0;
    player.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
    if (player.playerId === WOLF_TUTORIAL_PLAYER_ID) {
      player.hand = [WOLF_TUTORIAL_CARD];
    }
  }

  placeTutorialPiece(game, WOLF_TUTORIAL_PLAYER_ID, 1, { x: 0, y: 0 });
  placeTutorialPiece(game, WOLF_TUTORIAL_PLAYER_ID, 2, { x: -1, y: 1 });
  placeTutorialPiece(game, WOLF_TUTORIAL_COATI_ID, 1, { x: 1, y: 0 });
  placeTutorialPiece(game, WOLF_TUTORIAL_COATI_ID, 2, { x: 1, y: 1 });
  placeTutorialPiece(game, WOLF_TUTORIAL_CAPUCHIN_ID, 1, { x: -2, y: -1 });

  game.status = "active";
  game.round = 2;
  game.activePlayerId = WOLF_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.turnOrder = [WOLF_TUTORIAL_PLAYER_ID];
  game.log = [
    {
      id: "wolf_tutorial_ready",
      message: "Tutorial do Lobo-guará preparado no segundo turno.",
      createdAt: Date.now()
    }
  ];

  return {
    roomId: localRoomId,
    status: "active",
    hostPlayerId: "local_host",
    players: tutorialPlayers,
    game,
    warnings: game.contentWarnings
  };
}

function createArmadilloTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: ARMADILLO_TUTORIAL_PLAYER_ID,
      name: "Tutorial Tatu",
      speciesId: "armadillo",
      ready: true,
      connected: true
    },
    {
      playerId: ARMADILLO_TUTORIAL_COATI_ID,
      name: "Quati de treino",
      speciesId: "coati",
      ready: true,
      connected: true
    },
    {
      playerId: ARMADILLO_TUTORIAL_CAPUCHIN_ID,
      name: "Macaco de treino",
      speciesId: "capuchin",
      ready: true,
      connected: true
    },
    {
      playerId: ARMADILLO_TUTORIAL_JAGUAR_ID,
      name: "Onça de treino",
      speciesId: "jaguar",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, ARMADILLO_TUTORIAL_FOREST);

  for (const player of game.players) {
    player.score = 0;
    player.turnsTaken = player.playerId === ARMADILLO_TUTORIAL_PLAYER_ID ? 1 : 0;
    player.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
    if (player.playerId === ARMADILLO_TUTORIAL_PLAYER_ID) {
      player.hand = [ARMADILLO_TUTORIAL_CARD];
    }
  }

  placeTutorialPiece(game, ARMADILLO_TUTORIAL_PLAYER_ID, 1, { x: 0, y: 0 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_PLAYER_ID, 2, { x: -1, y: 0 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_COATI_ID, 1, { x: 0, y: 1 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_COATI_ID, 2, { x: 1, y: 0 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_CAPUCHIN_ID, 1, { x: 0, y: -1 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_CAPUCHIN_ID, 2, { x: 1, y: -1 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_JAGUAR_ID, 1, { x: -2, y: 0 });

  game.status = "active";
  game.round = 2;
  game.activePlayerId = ARMADILLO_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.turnOrder = [ARMADILLO_TUTORIAL_PLAYER_ID, ARMADILLO_TUTORIAL_JAGUAR_ID];
  game.log = [
    {
      id: "armadillo_tutorial_ready",
      message: "Tutorial do Tatu-bola preparado no segundo turno.",
      createdAt: Date.now()
    }
  ];

  return {
    roomId: localRoomId,
    status: "active",
    hostPlayerId: "local_host",
    players: tutorialPlayers,
    game,
    warnings: game.contentWarnings
  };
}

function moveArmadilloTutorialJaguarProbe(game: GameState, target: GridPosition): GameState {
  const jaguar = game.pieces.find((piece) => piece.pieceId === ARMADILLO_TUTORIAL_JAGUAR_ID_PIECE);
  if (!jaguar || (jaguar.location?.x === target.x && jaguar.location.y === target.y)) {
    return game;
  }

  return {
    ...game,
    pieces: game.pieces.map((piece) =>
      piece.pieceId === ARMADILLO_TUTORIAL_JAGUAR_ID_PIECE
        ? { ...piece, location: { ...target, siteId: "main" } }
        : piece
    ),
    log: game.log.some((entry) => entry.id === "armadillo_tutorial_jaguar_probe")
      ? game.log
      : [
          ...game.log,
          {
            id: "armadillo_tutorial_jaguar_probe",
            message: "A Onça entrou no local do Tatu-bola escondido, mas não conseguiu removê-lo.",
            createdAt: Date.now(),
            payload: {
              kind: "move_piece",
              actorPlayerId: ARMADILLO_TUTORIAL_JAGUAR_ID,
              location: target,
              pieceIds: [ARMADILLO_TUTORIAL_JAGUAR_ID_PIECE]
            }
          }
        ]
  };
}

function createMacawTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: MACAW_TUTORIAL_PLAYER_ID,
      name: "Tutorial Arara",
      speciesId: "macaw",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, MACAW_TUTORIAL_FOREST);

  const player = game.players.find((candidate) => candidate.playerId === MACAW_TUTORIAL_PLAYER_ID);
  if (player) {
    player.score = 0;
    player.turnsTaken = 1;
    player.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
    player.hand = [MACAW_TUTORIAL_CARD];
  }

  placeTutorialPiece(game, MACAW_TUTORIAL_PLAYER_ID, 1, { x: 0, y: 0 });
  placeTutorialPiece(game, MACAW_TUTORIAL_PLAYER_ID, 2, { x: -1, y: -1 });
  placeTutorialPiece(game, MACAW_TUTORIAL_PLAYER_ID, 3, { x: -2, y: 0 });

  game.status = "active";
  game.round = 2;
  game.activePlayerId = MACAW_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.turnOrder = [MACAW_TUTORIAL_PLAYER_ID];
  game.log = [
    {
      id: "macaw_tutorial_ready",
      message: "Tutorial da Arara-azul preparado no segundo turno.",
      createdAt: Date.now()
    }
  ];

  return {
    roomId: localRoomId,
    status: "active",
    hostPlayerId: "local_host",
    players: tutorialPlayers,
    game,
    warnings: game.contentWarnings
  };
}

function createCapuchinTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: CAPUCHIN_TUTORIAL_PLAYER_ID,
      name: "Tutorial Macaco",
      speciesId: "capuchin",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, CAPUCHIN_TUTORIAL_FOREST);

  const player = game.players.find((candidate) => candidate.playerId === CAPUCHIN_TUTORIAL_PLAYER_ID);
  if (player) {
    player.score = 0;
    player.turnsTaken = 1;
    player.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
    player.hand = [CAPUCHIN_TUTORIAL_CARD];
  }

  // 2 macacos em rios (-1,-1) e (-1,1); 2 em bosques (0,-1) e (-1,0); 1 em campo (0,1).
  // O macaco em (-1,0) (piece_3) e o que salta para o campo na acao B.
  placeTutorialPiece(game, CAPUCHIN_TUTORIAL_PLAYER_ID, 1, { x: -1, y: -1 });
  placeTutorialPiece(game, CAPUCHIN_TUTORIAL_PLAYER_ID, 2, { x: -1, y: 1 });
  placeTutorialPiece(game, CAPUCHIN_TUTORIAL_PLAYER_ID, 3, { x: -1, y: 0 });
  placeTutorialPiece(game, CAPUCHIN_TUTORIAL_PLAYER_ID, 4, { x: 0, y: -1 });
  placeTutorialPiece(game, CAPUCHIN_TUTORIAL_PLAYER_ID, 5, { x: 0, y: 1 });

  game.status = "active";
  game.round = 2;
  game.activePlayerId = CAPUCHIN_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.turnOrder = [CAPUCHIN_TUTORIAL_PLAYER_ID];
  game.log = [
    {
      id: "capuchin_tutorial_ready",
      message: "Tutorial do Macaco-prego preparado no segundo turno.",
      createdAt: Date.now()
    }
  ];

  return {
    roomId: localRoomId,
    status: "active",
    hostPlayerId: "local_host",
    players: tutorialPlayers,
    game,
    warnings: game.contentWarnings
  };
}

function createCoatiTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: COATI_TUTORIAL_PLAYER_ID,
      name: "Tutorial Quati",
      speciesId: "coati",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, COATI_TUTORIAL_FOREST);

  const player = game.players.find((candidate) => candidate.playerId === COATI_TUTORIAL_PLAYER_ID);
  if (player) {
    player.score = 0;
    player.turnsTaken = 1;
    player.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
    player.hand = [COATI_TUTORIAL_CARD];
  }

  // Q_a em F=(-1,0) fruta; Q_b em L1=(-1,-1); Q_c (mover) em (1,1); Q_d em M=(0,0).
  // 4 na floresta + 4 na reserva: a cadeia de 3 pares consome 4 da reserva
  // (add da acao A + 3 bonus), zerando a reserva para forcar a remocao na acao C.
  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 1, { x: -1, y: 0 });
  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 2, { x: -1, y: -1 });
  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 3, { x: 1, y: 1 });
  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 4, { x: 0, y: 0 });

  game.status = "active";
  game.round = 2;
  game.activePlayerId = COATI_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.turnOrder = [COATI_TUTORIAL_PLAYER_ID];
  game.log = [
    {
      id: "coati_tutorial_ready",
      message: "Tutorial do Quati preparado no segundo turno.",
      createdAt: Date.now()
    }
  ];

  return {
    roomId: localRoomId,
    status: "active",
    hostPlayerId: "local_host",
    players: tutorialPlayers,
    game,
    warnings: game.contentWarnings
  };
}

// Phones/small tablets: start with the side docks and hand collapsed so the
// board owns the screen; the edge tabs reopen each panel on demand.
function isSmallScreen(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 820;
}

export function App() {
  const [socket, setSocket] = useState<OikosSocket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [name, setName] = useState("Jogador");
  const [joinCode, setJoinCode] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesId | "">("");
  const [localSpeciesIds, setLocalSpeciesIds] = useState<SpeciesId[]>(["maned_wolf", "coati"]);
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedCardRotation, setSelectedCardRotation] = useState<0 | 90 | 180 | 270>(0);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [selectedJaguarDestination, setSelectedJaguarDestination] = useState<{ x: number; y: number } | null>(null);
  const [selectedJaguarTargetPieceId, setSelectedJaguarTargetPieceId] = useState<string | null>(null);
  const [selectedWolfTargetPieceId, setSelectedWolfTargetPieceId] = useState<string | null>(null);
  const [selectedWolfResources, setSelectedWolfResources] = useState<Resource[]>([]);
  const [selectedRemovalPieceIds, setSelectedRemovalPieceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handCollapsed, setHandCollapsed] = useState(isSmallScreen);
  const [boardSpecies, setBoardSpecies] = useState<SpeciesId | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [audioSettings, setAudioSettingsState] = useState<AudioSettings>(() => getAudioSettings());
  const seenLogIdRef = useRef<Set<string>>(new Set());
  const logInitializedRef = useRef(false);
  const endgameConfetti = useMemo<CSSProperties[]>(() => {
    const colors = ["#f2c14e", "#5fd08a", "#3a7fc4", "#e06a5a", "#b6815f", "#ffd773"];
    return Array.from({ length: 80 }, () => ({
      left: `${Math.random() * 100}%`,
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      animationDelay: `${Math.random() * 2.5}s`,
      animationDuration: `${2.6 + Math.random() * 2.2}s`,
      transform: `rotate(${Math.random() * 360}deg)`,
      width: `${6 + Math.random() * 6}px`,
      height: `${9 + Math.random() * 8}px`
    }) as CSSProperties);
  }, []);
  const [hudLeftCollapsed, setHudLeftCollapsed] = useState(isSmallScreen);
  const [hudRightCollapsed, setHudRightCollapsed] = useState(isSmallScreen);
  // Mobile-only: the species panel can collapse to its header. Desktop keeps it
  // open (toggle is hidden and the collapse CSS lives only in the phone query).
  const [hudSpeciesCollapsed, setHudSpeciesCollapsed] = useState(isSmallScreen);
  const [movementPreview, setMovementPreview] = useState<{ speciesId: SpeciesId; left: number; top: number } | null>(null);
  const [landingMode, setLandingMode] = useState<"idle" | "join" | "local" | "tutorials">("idle");
  const [tutorialId, setTutorialId] = useState<TutorialId | null>(null);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  // Log length captured when the move step begins, to detect the taught move.
  const tutorialMoveLogLenRef = useRef<number | null>(null);
  const [macawScoreAnim, setMacawScoreAnim] = useState<{
    lines: Array<{ positions: [GridPosition, GridPosition, GridPosition] }>;
    points: number;
    playerName: string;
  } | null>(null);
  const [capuchinScoreAnim, setCapuchinScoreAnim] = useState<{
    groups: CapuchinHabitatGroup[];
    points: number;
    playerName: string;
  } | null>(null);
  const [turnBanner, setTurnBanner] = useState<{ key: number; label: string; speciesId: SpeciesId | null } | null>(null);
  const [floatingGains, setFloatingGains] = useState<FloatingGain[]>([]);
  const [travelEffects, setTravelEffects] = useState<TravelEffect[]>([]);
  const [cardDrag, setCardDrag] = useState<{
    cardId: string;
    src: string;
    size: number;
    x: number;
    y: number;
    target: { x: number; y: number; rotation: 0 | 90 | 180 | 270 } | null;
  } | null>(null);
  const dragJustHandledRef = useRef(false);
  const pendingDragRef = useRef<
    | {
        cardId: string;
        src: string;
        size: number;
        startX: number;
        startY: number;
      }
    | null
  >(null);
  // Last pointer position during a drag, read by the live drag handlers so
  // rotating mid-drag recomputes targets without a stale closure.
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  // Chosen-but-unconfirmed card placement: shows a preview with confirm/cancel
  // over the slot to guard against misclicks.
  const [pendingPlacement, setPendingPlacement] = useState<{
    position: { x: number; y: number };
    rotation: 0 | 90 | 180 | 270;
  } | null>(null);
  const [turnRecap, setTurnRecap] = useState<TurnRecapState>({ history: [], index: -1, visible: false });
  const [hoveredSummaryCardIds, setHoveredSummaryCardIds] = useState<string[]>([]);
  const [recapCollapsed, setRecapCollapsed] = useState(true);
  const turnSummary =
    turnRecap.visible && turnRecap.index >= 0 ? turnRecap.history[turnRecap.index] ?? null : null;

  useEffect(() => {
    if (recapCollapsed || !turnSummary) {
      setHoveredSummaryCardIds([]);
    }
  }, [recapCollapsed, turnSummary?.key]);

  useEffect(() => {
    if (room?.game?.status === "active") {
      return;
    }

    setHoveredSummaryCardIds([]);
    setRecapCollapsed(true);
    setTurnRecap((current) =>
      current.history.length > 0 || current.visible ? { history: [], index: -1, visible: false } : current
    );
  }, [room?.game?.gameId, room?.game?.status]);
  const [showJaguarScoreModal, setShowJaguarScoreModal] = useState(false);
  const prevTurnRef = useRef<string | null>(null);
  const prevSnapshotRef = useRef<{ playerId: string; score: number; resources: Record<string, number> } | null>(null);
  const prevGameRef = useRef<GameState | null>(null);
  const turnSnapshotRef = useRef<{ playerId: string; score: number; logLength: number; name: string; speciesId: SpeciesId | null } | null>(null);
  const forestCanvasRef = useRef<ForestCanvasHandle | null>(null);
  const travelSeqRef = useRef(0);
  const effectTargetRefs = useRef(new Map<string, HTMLElement>());
  const gainSeqRef = useRef(0);
  const autoScoredRef = useRef<string | null>(null);
  const lastOnlineRoomSnapshotRef = useRef("");
  const onlineActionInFlightRef = useRef(false);

  const showMovementPreview = useCallback((speciesId: SpeciesId, rect: DOMRect) => {
    const previewWidth = 220;
    const previewHeight = 300;
    const gap = 12;
    const safeMargin = 12;
    const left = Math.max(
      safeMargin,
      Math.min(window.innerWidth - previewWidth - safeMargin, rect.left - previewWidth - gap)
    );
    const top = Math.max(
      safeMargin,
      Math.min(window.innerHeight - previewHeight - safeMargin, rect.top - 8)
    );
    setMovementPreview({ speciesId, left, top });
  }, []);

  const applyOnlineRoomState = useCallback((nextRoom: PublicRoomState) => {
    const snapshot = JSON.stringify(nextRoom);
    if (lastOnlineRoomSnapshotRef.current === snapshot) {
      return false;
    }

    lastOnlineRoomSnapshotRef.current = snapshot;
    setRoom(nextRoom);
    return true;
  }, []);

  const clearRoomState = useCallback(() => {
    lastOnlineRoomSnapshotRef.current = "";
    setRoom(null);
  }, []);

  useEffect(() => {
    const nextSocket = createSocket();
    setSocket(nextSocket);

    nextSocket.on("connected", (payload: { playerId: string }) => {
      setPlayerId(payload.playerId);
      const savedRoomId = window.localStorage.getItem(lastOnlineRoomStorageKey);
      const savedName = window.localStorage.getItem(lastOnlineNameStorageKey) ?? name;

      if (savedRoomId) {
        setName(savedName);
        void roomApi
          .join(nextSocket, savedRoomId, savedName)
          .then((nextRoom) => {
            applyOnlineRoomState(nextRoom);
            setNotice("Reconectado a sala.");
          })
          .catch((err) => {
            clearOnlineSession();
            clearRoomState();
            setNotice(
              isMissingRoomError(err)
                ? "A sala anterior expirou no servidor gratuito. Crie uma nova sala para continuar."
                : "Não foi possível reconectar a sala anterior."
            );
          });
      }
    });

    nextSocket.on("room:update", (nextRoom: PublicRoomState) => {
      applyOnlineRoomState(nextRoom);
    });

    nextSocket.on("connect_error", () => {
      setError("Servidor indisponível. Inicie o servidor para testar lobby multiplayer.");
    });

    return () => {
      nextSocket.disconnect();
    };
  }, [applyOnlineRoomState]);

  useEffect(() => {
    if (!socket || !room || room.roomId === localRoomId) {
      return;
    }

    const roomId = room.roomId;
    const ping = () => {
      roomApi.ping(socket, roomId).catch(() => {
        // Connection errors are handled by Socket.IO reconnection and normal action feedback.
      });
    };

    ping();
    const interval = window.setInterval(ping, 30000);
    return () => window.clearInterval(interval);
  }, [room?.roomId, socket]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 4500);
    return () => window.clearTimeout(id);
  }, [error]);

  const isLocalRoom = room?.roomId === localRoomId;
  const controlledPlayerId = isLocalRoom ? room?.game?.setupActivePlayerId ?? room?.game?.activePlayerId ?? null : playerId;
  const currentPlayer = room?.players.find((player) => player.playerId === controlledPlayerId) ?? null;
  const currentGamePlayer = room?.game?.players.find((player) => player.playerId === controlledPlayerId) ?? null;
  const setupActivePlayer = room?.game?.players.find((player) => player.playerId === room.game?.setupActivePlayerId) ?? null;
  const activeGamePlayer = room?.game?.players.find((player) => player.playerId === room.game?.activePlayerId) ?? null;
  const activeSpecies = activeGamePlayer?.speciesId ? speciesDefinitions[activeGamePlayer.speciesId] : null;
  const activeActionId = activeSpecies && room?.game ? activeSpecies.actions[room.game.activeActionIndex] ?? null : null;
  const canControlActivePlayer = Boolean(room?.game?.activePlayerId && currentGamePlayer?.playerId === room.game.activePlayerId);
  const hasPendingCoatiPairBonus = Boolean(room?.game?.pendingCoatiPairBonus);
  const hasStartedGame = Boolean(room?.game);
  const gameLog = room?.game?.log;

  // Tutorial state derived from the current step.
  const tutorialSteps =
    tutorialId === "jaguar"
      ? JAGUAR_TUTORIAL_STEPS
      : tutorialId === "wolf"
        ? WOLF_TUTORIAL_STEPS
      : tutorialId === "armadillo"
        ? ARMADILLO_TUTORIAL_STEPS
        : tutorialId === "macaw"
          ? MACAW_TUTORIAL_STEPS
        : tutorialId === "capuchin"
          ? CAPUCHIN_TUTORIAL_STEPS
        : tutorialId === "coati"
          ? COATI_TUTORIAL_STEPS
          : INITIAL_TUTORIAL_STEPS;
  const tutorialActive = tutorialId !== null && tutorialStep !== null;
  const tutorialDef = tutorialActive ? tutorialSteps[tutorialStep] ?? null : null;
  const tutorialGate: TutorialGate | null = tutorialDef?.gate ?? null;
  const highlightedMovementGuideSpecies =
    tutorialActive ? tutorialDef?.highlightMovementGuideSpecies ?? null : null;
  const tutorialRequiredCardId =
    tutorialActive && tutorialDef?.gate === "placeCard" ? tutorialDef.requiredCardId ?? null : null;
  // True when the tutorial forbids a given board interaction for the current step.
  const tutorialBlocks = useCallback(
    (action: "setupPlace" | "placeCard" | "move") => {
      if (!tutorialActive) return false;
      if (tutorialGate === "setup") return action !== "setupPlace";
      if (tutorialGate === "placeCard") return action !== "placeCard";
      if (tutorialGate === "move") return action !== "move";
      return true; // "none" steps block all board actions
    },
    [tutorialActive, tutorialGate]
  );

  // Unlock the audio context on the first user gesture (browser autoplay policy)
  // and play a soft click on every button press.
  useEffect(() => {
    const onFirstGesture = () => initAudioOnGesture();
    const onPointerDown = (event: PointerEvent) => {
      initAudioOnGesture();
      const target = event.target as HTMLElement | null;
      if (target?.closest("button")) {
        playClick();
      }
    };
    window.addEventListener("keydown", onFirstGesture);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onFirstGesture);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  // Play sound effects for new game-log entries (covers local, server, and bots).
  useEffect(() => {
    if (!gameLog) {
      seenLogIdRef.current = new Set();
      logInitializedRef.current = false;
      return;
    }
    const seen = seenLogIdRef.current;
    if (!logInitializedRef.current) {
      // First time we see this game: mark everything as already heard so a
      // reconnect or page reload does not replay the whole history.
      for (const entry of gameLog) seen.add(entry.id);
      logInitializedRef.current = true;
      return;
    }
    for (const entry of gameLog) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      playLogEvent(entry.payload?.kind);
    }
  }, [gameLog]);

  const updateAudio = useCallback((partial: Partial<AudioSettings>) => {
    setAudioSettingsState(setAudioSettings(partial));
  }, []);

  // Orchestrate the scripted tutorial: detect when the taught action is done and
  // craft the next state. Card placements are detected by the card appearing in
  // the forest (so we are not bound to the species action pipeline).
  const tutorialGameStatus = room?.game?.status;
  useEffect(() => {
    if (tutorialStep === null || !room?.game) return;
    const def = tutorialSteps[tutorialStep];
    if (!def?.autoAdvance) return;
    const game = room.game;
    const forestHas = (cardId: string) => game.forest.cards.some((card) => card.definitionId === cardId);
    const tutorialPlayerId =
      tutorialId === "jaguar"
        ? JAGUAR_TUTORIAL_PLAYER_ID
        : tutorialId === "wolf"
          ? WOLF_TUTORIAL_PLAYER_ID
          : tutorialId === "armadillo"
            ? ARMADILLO_TUTORIAL_PLAYER_ID
            : tutorialId === "macaw"
              ? MACAW_TUTORIAL_PLAYER_ID
            : tutorialId === "capuchin"
              ? CAPUCHIN_TUTORIAL_PLAYER_ID
            : tutorialId === "coati"
              ? COATI_TUTORIAL_PLAYER_ID
              : game.activePlayerId;

    if (def.gate === "setup") {
      if (game.status === "active") setTutorialStep((step) => (step === null ? step : step + 1));
      return;
    }

    if (def.gate === "placeCard" && def.requiredCardId && forestHas(def.requiredCardId)) {
      if (tutorialId === "initial") {
        const isRiverStep = Boolean(def.requiresRiver);
        setRoom((current) => {
          if (!current?.game) return current;
          const nextGame = { ...current.game };
          if (isRiverStep) {
            // Set up action B (move) with a forest card as the played card so the
            // Tatu has the simplest movement (adjacent).
            nextGame.activeActionIndex = 1;
            nextGame.activePlayedForestCardId = TUTORIAL_NONRIVER_CARD;
          } else {
            // Allow placing the next card in the same action A.
            nextGame.activePlayedForestCardId = null;
          }
          return { ...current, game: nextGame };
        });
      }
      setSelectedHandCardId(null);
      setSelectedCardRotation(0);
      tutorialMoveLogLenRef.current = null;
      setTutorialStep((step) => (step === null ? step : step + 1));
      return;
    }

    if (def.completeWhenCoatiPairPending) {
      if (game.activePlayerId === tutorialPlayerId && game.pendingCoatiPairBonus?.playerId === tutorialPlayerId) {
        tutorialMoveLogLenRef.current = null;
        setTutorialStep((step) => (step === null ? step : step + 1));
      }
      return;
    }

    if (typeof def.completeWhenActionIndex === "number") {
      if (game.activePlayerId === tutorialPlayerId && game.activeActionIndex >= def.completeWhenActionIndex) {
        tutorialMoveLogLenRef.current = null;
        setTutorialStep((step) => (step === null ? step : step + 1));
      }
      return;
    }

    if (typeof def.completeWhenScoreAtLeast === "number") {
      const player = game.players.find((candidate) => candidate.playerId === tutorialPlayerId);
      if (player && player.score >= def.completeWhenScoreAtLeast) {
        tutorialMoveLogLenRef.current = null;
        setTutorialStep((step) => (step === null ? step : step + 1));
      }
      return;
    }

    if (typeof def.completeWhenRoundAtLeast === "number") {
      if (game.round >= def.completeWhenRoundAtLeast) {
        tutorialMoveLogLenRef.current = null;
        setTutorialStep((step) => (step === null ? step : step + 1));
      }
      return;
    }

    if (def.gate === "move") {
      if (tutorialMoveLogLenRef.current === null) {
        tutorialMoveLogLenRef.current = game.log.length;
        return;
      }
      const moved = game.log
        .slice(tutorialMoveLogLenRef.current)
        .some((entry) => entry.payload?.kind === "move_piece");
      if (moved) setTutorialStep((step) => (step === null ? step : step + 1));
    }
  }, [tutorialId, tutorialStep, tutorialSteps, tutorialGameStatus, room?.game]);

  // When a tutorial step starts: pre-select the required card and open the board
  // it asks to show, so the player only has to act, not hunt for the right card.
  useEffect(() => {
    if (tutorialStep === null) {
      return;
    }
    // Reset any board selection so a read-only step never inherits a clickable
    // piece/target from the previous step.
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedRemovalPieceIds([]);
    const def = tutorialSteps[tutorialStep];
    if (def?.gate === "placeCard" && def.requiredCardId) {
      setSelectedHandCardId(def.requiredCardId);
      setSelectedCardRotation(0);
      setPendingPlacement(null);
    }
    if (def?.openBoard) {
      setBoardSpecies(def.openBoard);
    } else {
      setBoardSpecies(null);
    }
    if (tutorialId === "armadillo" && def?.jaguarProbeTarget) {
      setRoom((current) =>
        current?.game
          ? { ...current, game: moveArmadilloTutorialJaguarProbe(current.game, def.jaguarProbeTarget!) }
          : current
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialId, tutorialStep, tutorialSteps]);

  const hudGamePlayer = currentGamePlayer ?? activeGamePlayer ?? setupActivePlayer ?? null;
  const hudSpecies = hudGamePlayer?.speciesId ? speciesDefinitions[hudGamePlayer.speciesId] : null;
  const isHost = Boolean(room && !isLocalRoom && playerId === room.hostPlayerId);
  const roomHasBots = Boolean(room?.players.some((player) => player.isBot));
  const botTurnDelayMs = room?.botTurnDelayMs ?? defaultBotTurnDelayMs;
  const setEffectTarget = useCallback((key: string, element: HTMLElement | null) => {
    if (element) {
      effectTargetRefs.current.set(key, element);
    } else {
      effectTargetRefs.current.delete(key);
    }
  }, []);
  const forestCards = room?.game?.forest.cards ?? createPreviewInitialForest();
  const pieces = room?.game?.pieces ?? [];
  const canPlaceSetupPiece = Boolean(room?.game?.status === "setup" && (isLocalRoom || room.game.setupActivePlayerId === playerId));
  const canPlaceSelectedForestCard = Boolean(
    room?.game?.status === "active" &&
      selectedHandCardId &&
      !hasPendingCoatiPairBonus &&
      !room.game.activePlayedForestCardId &&
      canControlActivePlayer &&
      (activeSpecies?.speciesId === "coati" ||
        activeSpecies?.speciesId === "capuchin" ||
        activeSpecies?.speciesId === "macaw" ||
        activeSpecies?.speciesId === "armadillo" ||
        activeSpecies?.speciesId === "maned_wolf") &&
      activeActionId === "A" &&
      currentGamePlayer?.hand.includes(selectedHandCardId)
  );
  const handPlayableThisAction = Boolean(
    room?.game?.status === "active" &&
      !hasPendingCoatiPairBonus &&
      !room.game.activePlayedForestCardId &&
      canControlActivePlayer &&
      activeActionId === "A" &&
      (activeSpecies?.speciesId === "coati" ||
        activeSpecies?.speciesId === "capuchin" ||
        activeSpecies?.speciesId === "macaw" ||
        activeSpecies?.speciesId === "armadillo" ||
        activeSpecies?.speciesId === "maned_wolf")
  );
  const rotateSelectedCard = useCallback((dir: 1 | -1) => {
    setSelectedCardRotation((r) => (((r + (dir === 1 ? 90 : 270)) % 360) as 0 | 90 | 180 | 270));
  }, []);

  useEffect(() => {
    // No rotation while a placement is awaiting confirmation: the preview is at a
    // fixed orientation; the player confirms or cancels first.
    if (!selectedHandCardId || !canPlaceSelectedForestCard || pendingPlacement) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "q") {
        event.preventDefault();
        rotateSelectedCard(-1);
      } else if (key === "e" || key === "r") {
        event.preventDefault();
        rotateSelectedCard(1);
      }
    };

    // Right-click rotates while a placeable card is selected (e.g. mid-drag).
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      rotateSelectedCard(1);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [canPlaceSelectedForestCard, rotateSelectedCard, selectedHandCardId, pendingPlacement]);

  // Drop the staged placement if the card can no longer be played (turn change,
  // card left the hand, etc.).
  useEffect(() => {
    if (pendingPlacement && !canPlaceSelectedForestCard) {
      setPendingPlacement(null);
    }
  }, [canPlaceSelectedForestCard, pendingPlacement]);

  const expansionTargets = useMemo(
    () =>
      canPlaceSelectedForestCard && room?.game && selectedHandCardId && !pendingPlacement
        ? getAvailableForestExpansionPositionsForCard(room.game, selectedHandCardId, selectedCardRotation)
        : [],
    [canPlaceSelectedForestCard, room?.game, selectedCardRotation, selectedHandCardId, pendingPlacement]
  );
  // River cards that only fit after rotating: positions invalid at the current
  // rotation but valid at another, plus the rotation that connects there.
  const rotateFitTargets = useMemo(() => {
    if (!canPlaceSelectedForestCard || !room?.game || !selectedHandCardId || pendingPlacement) return [];
    const game = room.game;
    const currentKeys = new Set(expansionTargets.map((p) => `${p.x}:${p.y}`));
    const seen = new Set<string>();
    const result: { position: { x: number; y: number }; rotation: 0 | 90 | 180 | 270 }[] = [];
    for (const rotation of [0, 90, 180, 270] as const) {
      if (rotation === selectedCardRotation) continue;
      for (const p of getAvailableForestExpansionPositionsForCard(game, selectedHandCardId, rotation)) {
        const k = `${p.x}:${p.y}`;
        if (currentKeys.has(k) || seen.has(k)) continue;
        seen.add(k);
        result.push({ position: { x: p.x, y: p.y }, rotation });
      }
    }
    return result;
  }, [canPlaceSelectedForestCard, room?.game, selectedHandCardId, selectedCardRotation, expansionTargets, pendingPlacement]);

  // During a tutorial placeCard step, restrict placement to a single marked slot.
  const tutorialPlaceStep = tutorialActive && tutorialGate === "placeCard" && Boolean(tutorialDef?.requiredCardId);
  const tutorialMarkedSlot = useMemo<GridPosition | null>(() => {
    if (!tutorialPlaceStep) return null;
    return tutorialDef?.markedSlot ?? null;
  }, [tutorialPlaceStep, tutorialDef?.markedSlot]);

  const displayExpansionTargets = useMemo(() => {
    if (!tutorialPlaceStep || !tutorialMarkedSlot) return expansionTargets;
    return expansionTargets.filter((p) => p.x === tutorialMarkedSlot.x && p.y === tutorialMarkedSlot.y);
  }, [tutorialPlaceStep, tutorialMarkedSlot, expansionTargets]);

  const displayRotateFitTargets = useMemo(() => {
    if (!tutorialPlaceStep || !tutorialMarkedSlot) return rotateFitTargets;
    return rotateFitTargets.filter(
      (t) => t.position.x === tutorialMarkedSlot.x && t.position.y === tutorialMarkedSlot.y
    );
  }, [tutorialPlaceStep, tutorialMarkedSlot, rotateFitTargets]);

  // Keep a ref of the current drop targets so async drag handlers always see the
  // set for the latest rotation (the pointermove closure is captured once).
  // Each target carries the rotation to apply when dropped there.
  type DropTarget = { x: number; y: number; rotation: 0 | 90 | 180 | 270 };
  const dropTargetsRef = useRef<DropTarget[]>([]);
  dropTargetsRef.current = [
    ...displayExpansionTargets.map((p) => ({ x: p.x, y: p.y, rotation: selectedCardRotation })),
    ...displayRotateFitTargets.map((t) => ({ x: t.position.x, y: t.position.y, rotation: t.rotation }))
  ];

  // Nearest valid slot to a screen point, or null if none within snap range.
  const computeNearestTarget = useCallback((x: number, y: number): DropTarget | null => {
    const targets = dropTargetsRef.current;
    const canvas = forestCanvasRef.current;
    if (!canvas || targets.length === 0) return null;
    let nearest: DropTarget | null = null;
    let nearestDist = 110 * 110;
    for (const t of targets) {
      const center = canvas.getCardCenter(t);
      if (!center) continue;
      const ddx = center.x - x;
      const ddy = center.y - y;
      const d = ddx * ddx + ddy * ddy;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = t;
      }
    }
    return nearest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotating mid-drag (without moving the pointer) must re-magnetize: the valid
  // slots changed, so recompute the target from the last known pointer position.
  useEffect(() => {
    if (!cardDrag) return;
    const p = dragPointerRef.current;
    if (!p) return;
    const target = computeNearestTarget(p.x, p.y);
    setCardDrag((current) => (current ? { ...current, target } : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardRotation]);
  const spotlightInstanceIds = useMemo(() => {
    if (!room?.game || room.game.status !== "active" || recapCollapsed || !turnSummary || hoveredSummaryCardIds.length === 0) return [];
    const alive = new Set(room.game.forest.cards.map((card) => card.instanceId));
    return hoveredSummaryCardIds.filter((id) => alive.has(id));
  }, [hoveredSummaryCardIds, recapCollapsed, room?.game, turnSummary?.key]);
  const selectablePieceIds = useMemo(() => {
    if (!room?.game || hasPendingCoatiPairBonus || !canControlActivePlayer) {
      return [];
    }

    if (activeSpecies?.speciesId === "jaguar" && (activeActionId === "A" || activeActionId === "B")) {
      return room.game.pieces
        .filter((piece) => piece.ownerId === room.game?.activePlayerId && piece.speciesId === "jaguar" && piece.location)
        .map((piece) => piece.pieceId);
    }

    if (activeSpecies?.speciesId === "macaw" && activeActionId === "C" && room.game.activePlayerId) {
      return getMacawRelocatablePieceIds(room.game, room.game.activePlayerId);
    }

    if (activeSpecies?.speciesId === "armadillo" && activeActionId === "C" && room.game.activePlayerId) {
      return getArmadilloHidePieceIds(room.game, room.game.activePlayerId);
    }

    if (activeSpecies?.speciesId === "maned_wolf" && activeActionId === "A" && room.game.pendingWolfMoves?.playerId === room.game.activePlayerId) {
      return room.game.pendingWolfMoves.pieceIds;
    }

    if (activeSpecies?.speciesId === "maned_wolf" && activeActionId === "B" && room.game.activePlayerId) {
      return getWolfRemovableBasePieceIds(room.game, room.game.activePlayerId);
    }

    if (
      activeSpecies?.speciesId !== "coati" &&
      activeSpecies?.speciesId !== "capuchin" &&
      activeSpecies?.speciesId !== "macaw" &&
      activeSpecies?.speciesId !== "armadillo"
    ) {
      return [];
    }

    if (activeActionId === "C" && getRequiredCoatiRemovalCount(room.game, room.game.activePlayerId ?? "") > 0) {
      return room.game.pieces
        .filter((piece) => piece.ownerId === room.game?.activePlayerId && piece.speciesId === "coati" && piece.location)
        .map((piece) => piece.pieceId);
    }

    if (activeActionId !== "B") {
      return [];
    }

    return room.game.pieces
      .filter((piece) => piece.ownerId === room.game?.activePlayerId && piece.speciesId === activeSpecies.speciesId && piece.location)
      .map((piece) => piece.pieceId);
  }, [activeActionId, activeSpecies?.speciesId, canControlActivePlayer, hasPendingCoatiPairBonus, room?.game]);
  const requiredCoatiRemovalCount =
    room?.game && room.game.activePlayerId ? getRequiredCoatiRemovalCount(room.game, room.game.activePlayerId) : 0;
  const availableJaguarPointSpendCount =
    room?.game && room.game.activePlayerId ? getAvailableJaguarPointSpendCount(room.game, room.game.activePlayerId) : 0;
  const shouldShowJaguarScoreModal = Boolean(
    hasStartedGame &&
      !hasPendingCoatiPairBonus &&
      room?.game?.status === "active" &&
      activeGamePlayer &&
      activeSpecies?.speciesId === "jaguar" &&
      activeActionId === "C" &&
      canControlActivePlayer &&
      (!tutorialActive || tutorialId !== "jaguar" || tutorialGate === "score")
  );
  const movementTargets = useMemo(() => {
    if (!room?.game || hasPendingCoatiPairBonus || !room.game.activePlayerId || !selectedPieceId) {
      return [];
    }

    return getValidPieceMovementDestinations(room.game, room.game.activePlayerId, selectedPieceId);
  }, [hasPendingCoatiPairBonus, room?.game, selectedPieceId]);
  const displayMovementTargets = useMemo(() => {
    if (!tutorialActive || tutorialGate !== "move" || !tutorialDef?.markedMoveTarget) {
      return movementTargets;
    }

    return movementTargets.filter((position) => sameGridPosition(position, tutorialDef.markedMoveTarget));
  }, [movementTargets, tutorialActive, tutorialDef?.markedMoveTarget, tutorialGate]);
  const canSkipJaguarMove =
    useMemo(() => {
      if (
        !room?.game ||
        !canControlActivePlayer ||
        hasPendingCoatiPairBonus ||
        activeSpecies?.speciesId !== "jaguar" ||
        (activeActionId !== "A" && activeActionId !== "B") ||
        !room.game.activePlayerId
      ) {
        return false;
      }

      const jaguarPieceId = room.game.pieces.find(
        (piece) => piece.ownerId === room.game?.activePlayerId && piece.speciesId === "jaguar" && piece.location
      )?.pieceId;

      return Boolean(
        jaguarPieceId &&
          getValidPieceMovementDestinations(room.game, room.game.activePlayerId, jaguarPieceId).length === 0
      );
    }, [activeActionId, activeSpecies?.speciesId, canControlActivePlayer, hasPendingCoatiPairBonus, room?.game]);
  const jaguarTargetPieceIds = useMemo(() => {
    if (
      !room?.game ||
      activeSpecies?.speciesId !== "jaguar" ||
      !selectedPieceId ||
      !selectedJaguarDestination ||
      movementTargets.length === 0
    ) {
      return [];
    }

    return room.game.pieces
      .filter(
        (piece) =>
          piece.ownerId !== room.game?.activePlayerId &&
          piece.location &&
          !piece.state.hidden &&
          piece.location.x === selectedJaguarDestination.x &&
          piece.location.y === selectedJaguarDestination.y
      )
      .map((piece) => piece.pieceId);
  }, [activeSpecies?.speciesId, movementTargets.length, room?.game, selectedJaguarDestination, selectedPieceId]);
  const boardSelectablePieceIds = useMemo(() => {
    const ids = [...new Set([...selectablePieceIds, ...jaguarTargetPieceIds])];
    if (!tutorialActive) {
      return ids;
    }
    // Lock the board during a tutorial: only the exact piece the step asks for is
    // clickable. A marked piece restricts to it; an unmarked move step (e.g. the
    // Onça's single meeple) keeps the engine's selectable set; every other gate
    // (none/placeCard/score/addPiece/resolvePair) locks selection entirely.
    if (tutorialDef?.markedPieceId) {
      return ids.filter((pieceId) => pieceId === tutorialDef.markedPieceId);
    }
    if (tutorialGate === "move" || tutorialGate === "removeCoati") {
      return ids;
    }
    return [];
  }, [jaguarTargetPieceIds, selectablePieceIds, tutorialActive, tutorialDef?.markedPieceId, tutorialGate]);
  const highlightedPieceIds = useMemo(
    () => [
      ...(tutorialActive && tutorialDef?.markedPieceId ? [tutorialDef.markedPieceId] : []),
      ...selectedRemovalPieceIds,
      ...(selectedJaguarTargetPieceId ? [selectedJaguarTargetPieceId] : []),
      ...(selectedWolfTargetPieceId ? [selectedWolfTargetPieceId] : [])
    ],
    [selectedJaguarTargetPieceId, selectedRemovalPieceIds, selectedWolfTargetPieceId, tutorialActive, tutorialDef?.markedPieceId]
  );
  const coatiFruitTargets = useMemo(() => {
    if (!room?.game || hasPendingCoatiPairBonus || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getCoatiFruitPlacementPositions(room.game, room.game.activePlayerId);
  }, [canControlActivePlayer, hasPendingCoatiPairBonus, room?.game]);
  const coatiPairBonusTargets = useMemo(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getCoatiPairBonusTargets(room.game, room.game.activePlayerId);
  }, [canControlActivePlayer, room?.game]);
  const displayCoatiPairBonusTargets = useMemo(() => {
    if (!tutorialActive || tutorialGate !== "resolvePair" || !tutorialDef?.markedPairTarget) {
      return coatiPairBonusTargets;
    }

    return coatiPairBonusTargets.filter((position) => sameGridPosition(position, tutorialDef.markedPairTarget));
  }, [coatiPairBonusTargets, tutorialActive, tutorialDef?.markedPairTarget, tutorialGate]);
  const capuchinPlacementTargets = useMemo(() => {
    if (!room?.game || activeSpecies?.speciesId !== "capuchin" || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getCapuchinPlacementPositions(room.game, room.game.activePlayerId);
  }, [activeSpecies?.speciesId, canControlActivePlayer, room?.game]);
  const capuchinReserveCount = activeSpecies?.speciesId === "capuchin" ? activeGamePlayer?.reservePieces.length ?? 0 : 0;
  const macawEggTargets = useMemo(() => {
    if (!room?.game || activeSpecies?.speciesId !== "macaw" || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getMacawEggPlacementPositions(room.game, room.game.activePlayerId);
  }, [activeSpecies?.speciesId, canControlActivePlayer, room?.game]);
  const macawActionCTargets = useMemo(() => {
    if (!room?.game || activeSpecies?.speciesId !== "macaw" || !room.game.activePlayerId || !canControlActivePlayer || selectedPieceId) {
      return [];
    }

    return getMacawActionCTargets(room.game, room.game.activePlayerId);
  }, [activeSpecies?.speciesId, canControlActivePlayer, room?.game, selectedPieceId]);
  const macawAddTargets = useMemo(
    () => (activeActionId === "A" ? macawEggTargets : activeActionId === "C" ? macawActionCTargets : []),
    [activeActionId, macawActionCTargets, macawEggTargets]
  );
  const armadilloSeedTargets = useMemo(() => {
    if (!room?.game || activeSpecies?.speciesId !== "armadillo" || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getArmadilloSeedPlacementPositions(room.game, room.game.activePlayerId);
  }, [activeSpecies?.speciesId, canControlActivePlayer, room?.game]);
  const wolfMeatTargets = useMemo(() => {
    if (!room?.game || activeSpecies?.speciesId !== "maned_wolf" || !room.game.activePlayerId || !canControlActivePlayer) {
      return [];
    }

    return getWolfMeatPlacementPositions(room.game, room.game.activePlayerId);
  }, [activeSpecies?.speciesId, canControlActivePlayer, room?.game]);
  const addPieceTargets = useMemo(
    () =>
      activeSpecies?.speciesId === "capuchin"
        ? capuchinPlacementTargets
        : activeSpecies?.speciesId === "macaw"
          ? macawAddTargets
          : activeSpecies?.speciesId === "armadillo"
            ? armadilloSeedTargets
            : activeSpecies?.speciesId === "maned_wolf"
              ? wolfMeatTargets
          : coatiFruitTargets,
    [activeSpecies?.speciesId, armadilloSeedTargets, capuchinPlacementTargets, coatiFruitTargets, macawAddTargets, wolfMeatTargets]
  );
  const displayAddPieceTargets = useMemo(() => {
    if (!tutorialActive || tutorialGate !== "addPiece" || !tutorialDef?.markedAddPieceTarget) {
      return addPieceTargets;
    }

    return addPieceTargets.filter((position) => sameGridPosition(position, tutorialDef.markedAddPieceTarget));
  }, [addPieceTargets, tutorialActive, tutorialDef?.markedAddPieceTarget, tutorialGate]);
  const capuchinHabitatScore = room?.game && room.game.activePlayerId ? getCapuchinHabitatScore(room.game, room.game.activePlayerId) : 0;
  const macawLineScore = room?.game && room.game.activePlayerId ? getMacawLineScore(room.game, room.game.activePlayerId) : 0;
  const armadilloShareScore = room?.game && room.game.activePlayerId ? getArmadilloShareScore(room.game, room.game.activePlayerId) : 0;
  const scoringPreview = useMemo(() => {
    if (!room?.game || room.game.status !== "active" || !room.game.activePlayerId || activeActionId !== "D") {
      return {
        cardHighlights: [],
        lineHighlights: [],
        lines: 0,
        habitats: [] as ReturnType<typeof getCapuchinScoringHabitats>,
        armadillo: null as ReturnType<typeof getArmadilloSharingDetails> | null
      };
    }

    if (activeSpecies?.speciesId === "macaw") {
      const lines = getMacawScoringLines(room.game, room.game.activePlayerId);
      return {
        cardHighlights: [],
        lineHighlights: lines.map((line) => ({ positions: line.positions, label: "+1", color: 0x3a7fc4 })),
        lines: lines.length,
        habitats: [] as ReturnType<typeof getCapuchinScoringHabitats>,
        armadillo: null as ReturnType<typeof getArmadilloSharingDetails> | null
      };
    }

    if (activeSpecies?.speciesId === "capuchin") {
      const habitats = getCapuchinScoringHabitats(room.game, room.game.activePlayerId);
      return {
        cardHighlights: habitats.flatMap((group) =>
          group.positions.map((position) => ({
            position,
            label: `${habitatShortLabel[group.habitat as keyof typeof habitatShortLabel]} +1`,
            color: HABITAT_SCORE_COLORS[group.habitat as keyof typeof HABITAT_SCORE_COLORS]
          }))
        ),
        lineHighlights: [],
        lines: 0,
        habitats,
        armadillo: null as ReturnType<typeof getArmadilloSharingDetails> | null
      };
    }

    if (activeSpecies?.speciesId === "armadillo") {
      const armadillo = getArmadilloSharingDetails(room.game, room.game.activePlayerId);
      return {
        cardHighlights: armadillo.sharedPositions.map((position) => ({
          position,
          label: "compartilha",
          color: 0xf2c14e
        })),
        lineHighlights: [],
        lines: 0,
        habitats: [] as ReturnType<typeof getCapuchinScoringHabitats>,
        armadillo
      };
    }

    return {
      cardHighlights: [],
      lineHighlights: [],
      lines: 0,
      habitats: [] as ReturnType<typeof getCapuchinScoringHabitats>,
      armadillo: null as ReturnType<typeof getArmadilloSharingDetails> | null
    };
  }, [activeActionId, activeSpecies?.speciesId, room?.game]);
  const wolfRemovableBasePieceIds =
    room?.game && room.game.activePlayerId ? getWolfRemovableBasePieceIds(room.game, room.game.activePlayerId) : [];
  const wolfSpendableResources =
    room?.game && room.game.activePlayerId ? getWolfSpendableResourceTypes(room.game, room.game.activePlayerId) : [];
  const availableWolfPointSpendCount =
    room?.game && room.game.activePlayerId ? getAvailableWolfPointSpendCount(room.game, room.game.activePlayerId) : 0;
  const handCards = useMemo(
    () => (currentGamePlayer?.hand ?? []).map((cardId) => getForestCardDefinition(cardId)),
    [currentGamePlayer?.hand]
  );
  const showHandDuringGame = Boolean(hasStartedGame && currentGamePlayer && (room?.game?.status === "setup" || room?.game?.status === "active"));
  const canSelectHandCards = Boolean(room?.game?.status === "active");
  const roomWarnings = useMemo(() => {
    const warnings = [...(room?.warnings ?? []), ...(room?.game?.contentWarnings ?? [])];
    return [...new Set(warnings)];
  }, [room]);

  function appendTurnSummary(summary: TurnSummary): void {
    setTurnRecap((current) => {
      const history = [...current.history, summary].slice(-maxTurnHistory);
      return { history, index: history.length - 1, visible: true };
    });
    setRecapCollapsed(true);
    setHoveredSummaryCardIds([]);
  }

  function closeTurnRecap(): void {
    setTurnRecap((current) => ({ ...current, visible: false }));
    setHoveredSummaryCardIds([]);
  }

  function moveTurnRecapHistory(delta: -1 | 1): void {
    setTurnRecap((current) => {
      if (current.history.length === 0) {
        return current;
      }

      const nextIndex = Math.max(0, Math.min(current.history.length - 1, current.index + delta));
      return { ...current, index: nextIndex, visible: true };
    });
    setHoveredSummaryCardIds([]);
  }

  useEffect(() => {
    if (selectedHandCardId && !handCards.some((card) => card.id === selectedHandCardId)) {
      setSelectedHandCardId(null);
      setSelectedCardRotation(0);
    }
  }, [handCards, selectedHandCardId]);

  useEffect(() => {
    if (selectedPieceId && !selectablePieceIds.includes(selectedPieceId)) {
      setSelectedPieceId(null);
    }
  }, [selectablePieceIds, selectedPieceId]);

  useEffect(() => {
    if (selectedJaguarTargetPieceId && !jaguarTargetPieceIds.includes(selectedJaguarTargetPieceId)) {
      setSelectedJaguarTargetPieceId(null);
    }
  }, [jaguarTargetPieceIds, selectedJaguarTargetPieceId]);

  useEffect(() => {
    if (selectedWolfTargetPieceId && !selectablePieceIds.includes(selectedWolfTargetPieceId)) {
      setSelectedWolfTargetPieceId(null);
    }
  }, [selectablePieceIds, selectedWolfTargetPieceId]);

  useEffect(() => {
    const nextSelected = selectedWolfResources.filter((resource) =>
      room?.game?.activePlayerId ? getWolfSpendableResourceTypes(room.game, room.game.activePlayerId).includes(resource) : false
    );
    if (nextSelected.length !== selectedWolfResources.length) {
      setSelectedWolfResources(nextSelected);
    }
  }, [room?.game, selectedWolfResources]);

  useEffect(() => {
    const nextSelected = selectedRemovalPieceIds.filter((pieceId) => selectablePieceIds.includes(pieceId));
    if (nextSelected.length !== selectedRemovalPieceIds.length) {
      setSelectedRemovalPieceIds(nextSelected);
    }
  }, [selectablePieceIds, selectedRemovalPieceIds]);

  useEffect(() => {
    if (!shouldShowJaguarScoreModal) {
      setShowJaguarScoreModal(false);
      return;
    }

    setShowJaguarScoreModal(false);
    const timer = window.setTimeout(() => setShowJaguarScoreModal(true), 900);
    return () => window.clearTimeout(timer);
  }, [room?.game?.activePlayerId, room?.game?.activeActionIndex, shouldShowJaguarScoreModal]);

  useEffect(() => {
    if (room?.game?.status !== "active") {
      prevTurnRef.current = null;
      return;
    }
    const activeId = room.game.activePlayerId ?? null;
    if (!activeId || prevTurnRef.current === activeId) {
      return;
    }
    const first = prevTurnRef.current === null;
    prevTurnRef.current = activeId;
    if (first) {
      return;
    }
    const player = room.game.players.find((candidate) => candidate.playerId === activeId);
    const sp = player?.speciesId ? speciesDefinitions[player.speciesId] : null;
    setTurnBanner({
      key: Date.now(),
      label: sp?.displayName ?? player?.name ?? "Próximo jogador",
      speciesId: player?.speciesId ?? null
    });
  }, [room?.game?.activePlayerId, room?.game?.status, room?.game?.players]);

  useEffect(() => {
    if (!turnBanner) {
      return;
    }
    const timer = window.setTimeout(() => setTurnBanner(null), 2200);
    return () => window.clearTimeout(timer);
  }, [turnBanner]);

  useEffect(() => {
    if (!hudGamePlayer) {
      prevSnapshotRef.current = null;
      return;
    }
    const snap = {
      playerId: hudGamePlayer.playerId,
      score: hudGamePlayer.score,
      resources: { ...hudGamePlayer.resources } as Record<string, number>
    };
    const prev = prevSnapshotRef.current;
    prevSnapshotRef.current = snap;
    if (!prev || prev.playerId !== snap.playerId) {
      return;
    }
    const gains: FloatingGain[] = [];
    const scoreDelta = snap.score - prev.score;
    if (scoreDelta > 0) {
      gains.push({ id: ++gainSeqRef.current, resource: "point", amount: scoreDelta });
    }
    for (const resource of resourceOrder) {
      const delta = (snap.resources[resource] ?? 0) - (prev.resources[resource] ?? 0);
      if (delta > 0) {
        gains.push({ id: ++gainSeqRef.current, resource, amount: delta });
      }
    }
    if (gains.length === 0) {
      return;
    }
    setFloatingGains((current) => [...current, ...gains]);
    const ids = new Set(gains.map((gain) => gain.id));
    const timer = window.setTimeout(() => {
      setFloatingGains((current) => current.filter((gain) => !ids.has(gain.id)));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [hudGamePlayer]);

  useEffect(() => {
    const game = room?.game;
    if (!game) {
      prevGameRef.current = null;
      turnSnapshotRef.current = null;
      return;
    }

    const prevGame = prevGameRef.current;
    const activePlayerId = game.status === "active" ? game.activePlayerId : null;

    if (!activePlayerId) {
      turnSnapshotRef.current = null;
    } else if (!turnSnapshotRef.current) {
      const activePlayer = game.players.find((candidate) => candidate.playerId === activePlayerId);
      if (activePlayer) {
        turnSnapshotRef.current = {
          playerId: activePlayer.playerId,
          score: activePlayer.score,
          logLength: game.log.length,
          name: activePlayer.name,
          speciesId: activePlayer.speciesId
        };
      }
    } else if (turnSnapshotRef.current.playerId !== activePlayerId) {
      const finishedSnapshot = turnSnapshotRef.current;
      const finishedPlayer = game.players.find((candidate) => candidate.playerId === finishedSnapshot.playerId);
      if (finishedPlayer) {
        const scoreDelta = Math.max(0, finishedPlayer.score - finishedSnapshot.score);
        const turnLog = game.log.slice(finishedSnapshot.logLength).filter((entry) => {
          const payload = entry.payload;
          if (payload?.actorPlayerId) {
            return payload.actorPlayerId === finishedPlayer.playerId;
          }
          return entry.message?.startsWith(finishedPlayer.name) ?? false;
        });
        appendTurnSummary({
          key: Date.now(),
          playerName: finishedPlayer.name,
          speciesId: finishedPlayer.speciesId,
          scoreDelta,
          entries: buildTurnSummaryEntries(turnLog, finishedPlayer.speciesId, scoreDelta, game.pieces)
        });
      }

      const nextPlayer = game.players.find((candidate) => candidate.playerId === activePlayerId);
      turnSnapshotRef.current = nextPlayer
        ? {
            playerId: nextPlayer.playerId,
            score: nextPlayer.score,
            logLength: game.log.length,
            name: nextPlayer.name,
            speciesId: nextPlayer.speciesId
          }
        : null;
    }

    if (prevGame) {
      const prevPieces = new Map(prevGame.pieces.map((piece) => [piece.pieceId, piece]));
      const currentPieces = new Map(game.pieces.map((piece) => [piece.pieceId, piece]));
      const sourcesByOwner = new Map<string, GridPosition[]>();
      const removedPieces: Array<{ ownerId: string; speciesId: SpeciesId; location: GridPosition }> = [];

      for (const piece of game.pieces) {
        const previous = prevPieces.get(piece.pieceId);
        if (piece.location && (!previous?.location || !sameGridPosition(previous.location, piece.location))) {
          const sources = sourcesByOwner.get(piece.ownerId) ?? [];
          sources.push(piece.location);
          sourcesByOwner.set(piece.ownerId, sources);
        }
      }

      for (const previous of prevGame.pieces) {
        const current = currentPieces.get(previous.pieceId);
        if (previous.location && !current?.location) {
          removedPieces.push({
            ownerId: previous.ownerId,
            speciesId: previous.speciesId,
            location: previous.location
          });
        }
      }

      const nextEffects: TravelEffect[] = [];
      const sourceFallbacks = [
        ...Array.from(sourcesByOwner.values()).flat(),
        ...removedPieces.map((piece) => piece.location)
      ];

      for (const player of game.players) {
        const prevPlayer = prevGame.players.find((candidate) => candidate.playerId === player.playerId);
        if (!prevPlayer) {
          continue;
        }

        for (const resource of resourceOrder) {
          const delta = (player.resources[resource] ?? 0) - (prevPlayer.resources[resource] ?? 0);
          if (delta <= 0) {
            continue;
          }

          const source =
            sourcesByOwner.get(player.playerId)?.[0] ??
            removedPieces.find((piece) => piece.ownerId === player.playerId)?.location ??
            sourceFallbacks[0];
          const from = source ? forestCanvasRef.current?.getCardCenter(source) : null;
          const target =
            (hudGamePlayer?.playerId === player.playerId ? effectTargetRefs.current.get(`hud:${resource}`) : null) ??
            effectTargetRefs.current.get(`${player.playerId}:${resource}`);
          const to = elementCenter(target);
          if (from && to) {
            nextEffects.push({
              id: ++travelSeqRef.current,
              kind: "resource",
              resource,
              from,
              to
            });
          }
        }
      }

      for (const removed of removedPieces) {
        const from = forestCanvasRef.current?.getCardCenter(removed.location);
        const target =
          (hudGamePlayer?.playerId === removed.ownerId ? effectTargetRefs.current.get("hud:reserve") : null) ??
          effectTargetRefs.current.get(`${removed.ownerId}:reserve`);
        const to = elementCenter(target);
        if (from && to) {
          nextEffects.push({
            id: ++travelSeqRef.current,
            kind: "piece",
            speciesId: removed.speciesId,
            from,
            to
          });
        }
      }

      if (nextEffects.length > 0) {
        setTravelEffects((current) => [...current, ...nextEffects]);
        const ids = new Set(nextEffects.map((effect) => effect.id));
        window.setTimeout(() => {
          setTravelEffects((current) => current.filter((effect) => !ids.has(effect.id)));
        }, 920);
      }
    }

    prevGameRef.current = game;
  }, [hudGamePlayer?.playerId, room?.game]);

  async function run(action: () => Promise<PublicRoomState>, success?: string) {
    if (onlineActionInFlightRef.current) {
      return;
    }

    onlineActionInFlightRef.current = true;
    setError(null);
    setNotice(null);

    try {
      const nextRoom = await action();
      applyOnlineRoomState(nextRoom);
      saveOnlineSession(nextRoom, name);
      if (success) {
        setNotice(success);
      }
    } catch (err) {
      if (isMissingRoomError(err)) {
        clearOnlineSession();
        clearRoomState();
        setJoinCode("");
        setNotice("Essa sala não existe mais no servidor gratuito. Crie uma nova sala para continuar.");
        return;
      }

      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      onlineActionInFlightRef.current = false;
    }
  }

  function requireSocket(): OikosSocket {
    if (!socket) {
      throw new Error("Conexão com o servidor ainda não foi aberta.");
    }

    return socket;
  }

  function requireRoom(): PublicRoomState {
    if (!room) {
      throw new Error("Crie ou entre em uma sala primeiro.");
    }

    return room;
  }

  function formatBotDelay(delayMs: number): string {
    return delayMs >= 1000 ? `${(delayMs / 1000).toFixed(delayMs % 1000 === 0 ? 0 : 1)}s` : `${delayMs}ms`;
  }

  function adjustBotSpeed(deltaMs: number) {
    if (!room || !isHost) {
      return;
    }

    const nextDelay = Math.max(minBotTurnDelayMs, Math.min(maxBotTurnDelayMs, botTurnDelayMs + deltaMs));
    void run(() => roomApi.setBotSpeed(requireSocket(), room.roomId, nextDelay));
  }

  const handleCardClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room || !canPlaceSetupPiece) {
        return;
      }
      if (tutorialBlocks("setupPlace")) return;

      if (isLocalRoom && room.game?.setupActivePlayerId) {
        const nextGame = placeInitialPiece(room.game, room.game.setupActivePlayerId, position);
        setRoom({
          ...room,
          status: nextGame.status === "active" ? "active" : "setup",
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        return;
      }

      void run(() => roomApi.placeSetupPiece(requireSocket(), room.roomId, position.x, position.y));
    },
    [canPlaceSetupPiece, isLocalRoom, room, socket, tutorialBlocks]
  );

  const placeCard = useCallback(
    (position: { x: number; y: number }, rotation: 0 | 90 | 180 | 270) => {
      if (!room?.game || !selectedHandCardId || !canPlaceSelectedForestCard || !room.game.activePlayerId) {
        return;
      }
      if (tutorialBlocks("placeCard")) return;
      // Tutorial: enforce the marked card and the marked slot.
      if (tutorialActive) {
        const def = tutorialStep !== null ? tutorialSteps[tutorialStep] : null;
        if (def?.requiredCardId && selectedHandCardId !== def.requiredCardId) return;
        if (tutorialMarkedSlot && (position.x !== tutorialMarkedSlot.x || position.y !== tutorialMarkedSlot.y)) return;
      }

      if (isLocalRoom) {
        const game = room.game;
        const activePlayerId = game.activePlayerId;
        if (!activePlayerId) {
          return;
        }
        const cardId = selectedHandCardId;
        const nextGame = placeForestCard(game, activePlayerId, cardId, position, rotation);
        setRoom((current) => current ? {
          ...current,
          status: "active",
          game: nextGame,
          warnings: nextGame.contentWarnings
        } : current);
        setSelectedHandCardId(null);
        setSelectedCardRotation(0);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setPendingPlacement(null);
        setNotice("Carta colocada na floresta.");
        return;
      }

      void run(() =>
        roomApi.placeForestCard(requireSocket(), room.roomId, selectedHandCardId, position.x, position.y, rotation)
      ).then(() => {
        setSelectedHandCardId(null);
        setSelectedCardRotation(0);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setPendingPlacement(null);
      });
    },
    [
      canPlaceSelectedForestCard,
      isLocalRoom,
      room,
      selectedHandCardId,
      socket,
      tutorialBlocks,
      tutorialActive,
      tutorialStep,
      tutorialSteps,
      tutorialMarkedSlot
    ]
  );

  // Selecting a slot does not place immediately: it stages a preview the player
  // then confirms or cancels, avoiding accidental placements from a misclick.
  const handleExpansionTargetClick = useCallback(
    (position: { x: number; y: number }) =>
      setPendingPlacement({ position, rotation: selectedCardRotation }),
    [selectedCardRotation]
  );

  // Choosing a rotate-to-fit ghost stages the placement at the rotation that
  // connects there.
  const handleRotateFitTargetClick = useCallback(
    (position: { x: number; y: number }, rotation: number) =>
      setPendingPlacement({ position, rotation: (rotation % 360) as 0 | 90 | 180 | 270 }),
    []
  );

  const handleConfirmPlacement = useCallback(() => {
    if (!pendingPlacement) return;
    placeCard(pendingPlacement.position, pendingPlacement.rotation);
    setPendingPlacement(null);
  }, [pendingPlacement, placeCard]);

  // Cancel returns the card to the hand (still selected) so the player can place
  // the same or another card anywhere valid.
  const handleCancelPlacement = useCallback(() => {
    setPendingPlacement(null);
  }, []);

  // Enter confirms / Escape cancels the staged placement.
  useEffect(() => {
    if (!pendingPlacement) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleConfirmPlacement();
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleCancelPlacement();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingPlacement, handleConfirmPlacement, handleCancelPlacement]);

  const executeSelectedPieceMove = useCallback(
    (position: { x: number; y: number }, targetPieceId?: string) => {
      if (!room?.game || !room.game.activePlayerId || !selectedPieceId) {
        return;
      }
      if (tutorialBlocks("move")) return;
      if (tutorialActive && tutorialGate === "move" && tutorialDef?.markedMoveTarget) {
        if (!sameGridPosition(position, tutorialDef.markedMoveTarget)) {
          return;
        }
      }

      const currentGame = room.game;
      const movingPieceId = selectedPieceId!;
      const activePlayerId = currentGame.activePlayerId!;

      if (isLocalRoom) {
        const nextGame = movePieceForCurrentAction(currentGame, activePlayerId, movingPieceId, position, targetPieceId);
        setRoom({
          ...room,
          status: nextGame.status === "active" ? "active" : room.status,
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setSelectedPieceId(null);
        setSelectedJaguarDestination(null);
        setSelectedJaguarTargetPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice(
          activeSpecies?.speciesId === "jaguar"
            ? "Onça movida."
            : activeSpecies?.speciesId === "capuchin"
              ? "Macaco-prego movido."
              : activeSpecies?.speciesId === "macaw"
              ? activeActionId === "C"
                ? "Arara realocada."
                : "Arara movida."
              : activeSpecies?.speciesId === "armadillo"
                ? "Tatu-bola movido."
                : activeSpecies?.speciesId === "maned_wolf"
                  ? "Lobo-guará movido."
                : "Quati movido."
        );
        return;
      }

      void run(() => roomApi.movePiece(requireSocket(), room.roomId, movingPieceId, position.x, position.y, targetPieceId)).then(() => {
        setSelectedPieceId(null);
        setSelectedJaguarDestination(null);
        setSelectedJaguarTargetPieceId(null);
      });
    },
    [
      activeActionId,
      activeSpecies?.speciesId,
      isLocalRoom,
      room,
      selectedPieceId,
      socket,
      tutorialActive,
      tutorialBlocks,
      tutorialDef?.markedMoveTarget,
      tutorialGate
    ]
  );

  const handlePieceClick = useCallback(
    (pieceId: string) => {
      if (!boardSelectablePieceIds.includes(pieceId)) {
        return;
      }

      if (jaguarTargetPieceIds.includes(pieceId)) {
        if (selectedJaguarDestination) {
          executeSelectedPieceMove(selectedJaguarDestination, pieceId);
        } else {
          setSelectedJaguarTargetPieceId((current) => (current === pieceId ? null : pieceId));
        }
        return;
      }

      if (activeSpecies?.speciesId === "maned_wolf" && activeActionId === "B") {
        setSelectedWolfTargetPieceId((current) => (current === pieceId ? null : pieceId));
        return;
      }

      if (activeSpecies?.speciesId === "coati" && activeActionId === "C") {
        setSelectedRemovalPieceIds((current) => {
          if (current.includes(pieceId)) {
            return current.filter((candidate) => candidate !== pieceId);
          }

          if (current.length >= requiredCoatiRemovalCount) {
            return [...current.slice(1), pieceId];
          }

          return [...current, pieceId];
        });
        return;
      }

      setSelectedPieceId((current) => {
        const next = current === pieceId ? null : pieceId;
        setSelectedJaguarDestination(null);
        setSelectedJaguarTargetPieceId(null);
        return next;
      });
    },
    [
      activeActionId,
      activeSpecies?.speciesId,
      boardSelectablePieceIds,
      executeSelectedPieceMove,
      jaguarTargetPieceIds,
      requiredCoatiRemovalCount,
      selectedJaguarDestination
    ]
  );

  const handleMovementTargetClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room?.game || !room.game.activePlayerId || !selectedPieceId || movementTargets.length === 0) {
        return;
      }

      const currentGame = room.game;

      if (activeSpecies?.speciesId === "jaguar") {
        const removablePieces = currentGame.pieces.filter(
          (piece) =>
            piece.ownerId !== currentGame.activePlayerId &&
            !piece.state.hidden &&
            piece.location?.x === position.x &&
            piece.location.y === position.y
        );

        if (removablePieces.length > 1) {
          setSelectedJaguarDestination(position);
          setSelectedJaguarTargetPieceId(null);
          setNotice("Escolha qual meeple a Onça deve remover neste local.");
          return;
        }

        executeSelectedPieceMove(position);
        return;
      }

      executeSelectedPieceMove(position);
    },
    [activeSpecies?.speciesId, executeSelectedPieceMove, movementTargets.length, room, selectedPieceId]
  );

  const handleAddPieceTargetClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room?.game || !room.game.activePlayerId || addPieceTargets.length === 0) {
        return;
      }
      // Some tutorials teach adding as part of action A; Lobo teaches it in D.
      if (tutorialActive && tutorialGate !== "placeCard" && tutorialGate !== "addPiece") return;
      if (
        tutorialActive &&
        tutorialGate === "addPiece" &&
        tutorialDef?.markedAddPieceTarget &&
        !sameGridPosition(position, tutorialDef.markedAddPieceTarget)
      ) {
        return;
      }

      if (isLocalRoom) {
        const nextGame =
          activeSpecies?.speciesId === "capuchin"
            ? addCapuchinForCurrentAction(room.game, room.game.activePlayerId, position)
            : activeSpecies?.speciesId === "macaw"
              ? addMacawForCurrentAction(room.game, room.game.activePlayerId, position)
              : activeSpecies?.speciesId === "armadillo"
                ? addArmadilloForCurrentAction(room.game, room.game.activePlayerId, position)
                : activeSpecies?.speciesId === "maned_wolf"
                  ? addWolfForCurrentAction(room.game, room.game.activePlayerId, position)
            : addCoatiForCurrentAction(room.game, room.game.activePlayerId, position);
        setRoom({
          ...room,
          status: nextGame.status === "active" ? "active" : room.status,
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice(
          activeSpecies?.speciesId === "capuchin"
            ? "Macaco-prego adicionado."
            : activeSpecies?.speciesId === "macaw"
              ? "Arara adicionada."
              : activeSpecies?.speciesId === "armadillo"
                ? "Tatu-bola adicionado."
                : activeSpecies?.speciesId === "maned_wolf"
                  ? "Lobo-guará adicionado."
              : "Quati adicionado em local de fruta."
        );
        return;
      }

      void run(() =>
        activeSpecies?.speciesId === "capuchin"
          ? roomApi.addCapuchin(requireSocket(), room.roomId, position.x, position.y)
          : activeSpecies?.speciesId === "macaw"
            ? roomApi.addMacaw(requireSocket(), room.roomId, position.x, position.y)
            : activeSpecies?.speciesId === "armadillo"
              ? roomApi.addArmadillo(requireSocket(), room.roomId, position.x, position.y)
              : activeSpecies?.speciesId === "maned_wolf"
                ? roomApi.addWolf(requireSocket(), room.roomId, position.x, position.y)
          : roomApi.addCoati(requireSocket(), room.roomId, position.x, position.y)
      ).then(() => {
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
    },
    [
      activeSpecies?.speciesId,
      addPieceTargets.length,
      isLocalRoom,
      room,
      socket,
      tutorialActive,
      tutorialDef?.markedAddPieceTarget,
      tutorialGate
    ]
  );

  const handleCoatiPairBonusTargetClick = useCallback(
    (position: { x: number; y: number }) => {
      if (!room?.game || !room.game.activePlayerId || coatiPairBonusTargets.length === 0) {
        return;
      }
      if (
        tutorialActive &&
        tutorialGate === "resolvePair" &&
        tutorialDef?.markedPairTarget &&
        !sameGridPosition(position, tutorialDef.markedPairTarget)
      ) {
        return;
      }

      if (isLocalRoom) {
        const nextGame = resolveCoatiPairBonus(room.game, room.game.activePlayerId, position);
        setRoom({
          ...room,
          status: nextGame.status === "active" ? "active" : room.status,
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice("Bonus da dupla de quatis resolvido.");
        return;
      }

      void run(() => roomApi.resolveCoatiPair(requireSocket(), room.roomId, position.x, position.y)).then(() => {
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
    },
    [coatiPairBonusTargets.length, isLocalRoom, room, socket, tutorialActive, tutorialDef?.markedPairTarget, tutorialGate]
  );

  const handleRemoveSelectedPieces = useCallback(() => {
    if (
      !room?.game ||
      !room.game.activePlayerId ||
      !canControlActivePlayer ||
      selectedRemovalPieceIds.length !== requiredCoatiRemovalCount
    ) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = removePiecesForCurrentAction(room.game, room.game.activePlayerId, selectedRemovalPieceIds);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
      setNotice("Quatis removidos da floresta.");
      return;
    }

    void run(() => roomApi.removePieces(requireSocket(), room.roomId, selectedRemovalPieceIds)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, requiredCoatiRemovalCount, room, selectedRemovalPieceIds, socket]);

  const handleSpendJaguarMeat = useCallback(
    (count: number) => {
      if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
        return;
      }
      if (tutorialActive && tutorialDef?.requiredSpendCount && count !== tutorialDef.requiredSpendCount) {
        setNotice(`Neste tutorial, gaste ${tutorialDef.requiredSpendCount} carnes para ver a pontuação completa.`);
        return;
      }

      if (isLocalRoom) {
        const nextGame = spendJaguarMeatForPoints(room.game, room.game.activePlayerId, count);
        setRoom({
          ...room,
          status: nextGame.status === "active" ? "active" : room.status,
          game: nextGame,
          warnings: nextGame.contentWarnings
        });
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice("Carne gasta e pontos marcados.");
        return;
      }

      void run(() => roomApi.spendJaguarMeat(requireSocket(), room.roomId, count)).then(() => {
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
    },
    [canControlActivePlayer, isLocalRoom, room, socket, tutorialActive, tutorialDef?.requiredSpendCount]
  );

  const handleScoreCapuchin = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    const activeId = room.game.activePlayerId;
    const groups = getCapuchinScoringHabitats(room.game, activeId);
    const playerName = room.game.players.find((p) => p.playerId === activeId)?.name ?? "Macaco-prego";

    const finalize = () => {
      if (isLocalRoom) {
        const currentGame = room.game;
        if (!currentGame) return;
        const nextGame = scoreCapuchinHabitatPresence(currentGame, activeId);
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                status: nextGame.status === "active" ? "active" : prev.status,
                game: nextGame,
                warnings: nextGame.contentWarnings
              }
            : prev
        );
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice("Macaco-prego pontuado.");
        return;
      }

      void run(() => roomApi.scoreCapuchin(requireSocket(), room.roomId)).then(() => {
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
    };

    if (groups.length === 0) {
      finalize();
      return;
    }

    setCapuchinScoreAnim({ groups, points: groups.length, playerName });

    window.setTimeout(() => {
      setCapuchinScoreAnim(null);
      finalize();
    }, 2400);
  }, [canControlActivePlayer, isLocalRoom, room, socket]);

  const handleScoreMacaw = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    const activeId = room.game.activePlayerId;
    const lines: MacawScoringLine[] = getMacawScoringLines(room.game, activeId);
    const playerName = room.game.players.find((p) => p.playerId === activeId)?.name ?? "Arara-azul";

    const finalize = () => {
      if (isLocalRoom) {
        const currentGame = room.game;
        if (!currentGame) return;
        const nextGame = scoreMacawLines(currentGame, activeId);
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                status: nextGame.status === "active" ? "active" : prev.status,
                game: nextGame,
                warnings: nextGame.contentWarnings
              }
            : prev
        );
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
        setNotice("Arara-azul pontuada.");
        return;
      }

      void run(() => roomApi.scoreMacaw(requireSocket(), room.roomId)).then(() => {
        setSelectedHandCardId(null);
        setSelectedPieceId(null);
        setSelectedRemovalPieceIds([]);
      });
    };

    if (lines.length === 0) {
      finalize();
      return;
    }

    setMacawScoreAnim({
      lines: lines.map((line) => ({ positions: line.positions })),
      points: lines.length,
      playerName
    });

    window.setTimeout(() => {
      setMacawScoreAnim(null);
      finalize();
    }, 2400);
  }, [canControlActivePlayer, isLocalRoom, room, socket]);

  const handleHideArmadillo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || !selectedPieceId) {
      return;
    }
    if (tutorialActive && tutorialDef?.markedPieceId && selectedPieceId !== tutorialDef.markedPieceId) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = hideArmadilloForCurrentAction(room.game, room.game.activePlayerId, selectedPieceId);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
      setNotice("Tatu-bola escondido.");
      return;
    }

    void run(() => roomApi.hideArmadillo(requireSocket(), room.roomId, selectedPieceId)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, room, selectedPieceId, socket, tutorialActive, tutorialDef?.markedPieceId]);

  const handleScoreArmadillo = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = scoreArmadilloSharing(room.game, room.game.activePlayerId);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
      setNotice("Tatu-bola pontuado.");
      return;
    }

    void run(() => roomApi.scoreArmadillo(requireSocket(), room.roomId)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, room, socket]);

  const handleRemoveWolfBasePiece = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || !selectedWolfTargetPieceId) {
      return;
    }
    if (tutorialActive && tutorialDef?.markedPieceId && selectedWolfTargetPieceId !== tutorialDef.markedPieceId) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = removeBasePieceForWolfAction(room.game, room.game.activePlayerId, selectedWolfTargetPieceId);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
      setNotice("Lobo-guará removeu peça de base.");
      return;
    }

    void run(() => roomApi.removeWolfBasePiece(requireSocket(), room.roomId, selectedWolfTargetPieceId)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
    });
  }, [
    canControlActivePlayer,
    isLocalRoom,
    room,
    selectedWolfTargetPieceId,
    socket,
    tutorialActive,
    tutorialDef?.markedPieceId
  ]);

  const handleSpendWolfResources = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer || selectedWolfResources.length === 0) {
      return;
    }
    if (
      tutorialActive &&
      tutorialDef?.requiredSpendCount &&
      selectedWolfResources.length !== tutorialDef.requiredSpendCount
    ) {
      setNotice(`Neste tutorial, gaste ${tutorialDef.requiredSpendCount} recursos diferentes para ver a pontuação completa.`);
      return;
    }

    if (isLocalRoom) {
      const nextGame = spendWolfResourcesForPoints(room.game, room.game.activePlayerId, selectedWolfResources);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
      setNotice("Lobo-guará gastou recursos e marcou pontos.");
      return;
    }

    void run(() => roomApi.spendWolfResources(requireSocket(), room.roomId, selectedWolfResources)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedWolfTargetPieceId(null);
      setSelectedWolfResources([]);
      setSelectedRemovalPieceIds([]);
    });
  }, [
    canControlActivePlayer,
    isLocalRoom,
    room,
    selectedWolfResources,
    socket,
    tutorialActive,
    tutorialDef?.requiredSpendCount
  ]);

  const handleCompleteAction = useCallback(() => {
    if (!room?.game || !room.game.activePlayerId || !canControlActivePlayer) {
      return;
    }
    if (tutorialActive) {
      return;
    }

    if (isLocalRoom) {
      const nextGame = completeCurrentAction(room.game, room.game.activePlayerId);
      setRoom({
        ...room,
        status: nextGame.status === "active" ? "active" : room.status,
        game: nextGame,
        warnings: nextGame.contentWarnings
      });
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
      setNotice("Ação concluída.");
      return;
    }

    void run(() => roomApi.completeAction(requireSocket(), room.roomId)).then(() => {
      setSelectedHandCardId(null);
      setSelectedPieceId(null);
      setSelectedRemovalPieceIds([]);
    });
  }, [canControlActivePlayer, isLocalRoom, room, socket, tutorialActive]);

  function toggleLocalSpecies(speciesId: SpeciesId) {
    setLocalSpeciesIds((current) =>
      current.includes(speciesId) ? current.filter((candidate) => candidate !== speciesId) : [...current, speciesId]
    );
  }

  function startLocalTest() {
    setError(null);
    setNotice(null);

    if (localSpeciesIds.length < 2) {
      setError("Escolha pelo menos 2 espécies para o teste local.");
      return;
    }

    const localPlayers: RoomPlayer[] = localSpeciesIds.map((speciesId) => ({
      playerId: `local_${speciesId}`,
      name: speciesDefinitions[speciesId].displayName,
      speciesId,
      ready: true,
      connected: true
    }));
    const game = createInitialGameState(localRoomId, localPlayers);

    lastOnlineRoomSnapshotRef.current = "";
    setRoom({
      roomId: localRoomId,
      status: "setup",
      hostPlayerId: "local_host",
      players: localPlayers,
      game,
      warnings: game.contentWarnings
    });
    setNotice("Teste local iniciado.");
  }

  function stopLocalTest() {
    clearRoomState();
    setNotice("Teste local encerrado.");
  }

  // Rematch for a local test: rebuild a fresh game with the same species.
  function playAgainLocal() {
    startLocalTest();
  }

  // Launch the scripted initial tutorial on a real local game with one species.
  function startInitialTutorial() {
    setError(null);
    setNotice(null);
    const tutorialPlayers: RoomPlayer[] = [
      {
        playerId: "local_armadillo",
        name: "Tutorial",
        speciesId: "armadillo",
        ready: true,
        connected: true
      }
    ];
    const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, TUTORIAL_FOREST);
    // Deterministic hand: one non-river card then one river card to teach both.
    if (game.players[0]) {
      game.players[0].hand = [TUTORIAL_NONRIVER_CARD, TUTORIAL_RIVER_CARD];
    }
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setRoom({
      roomId: localRoomId,
      status: "setup",
      hostPlayerId: "local_host",
      players: tutorialPlayers,
      game,
      warnings: game.contentWarnings
    });
    setTutorialStep(0);
    setTutorialId("initial");
  }

  function startJaguarTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setPendingPlacement(null);
    setRoom(createJaguarTutorialRoom());
    setTutorialStep(0);
    setTutorialId("jaguar");
  }

  function startWolfTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setPendingPlacement(null);
    setRoom(createWolfTutorialRoom());
    setTutorialStep(0);
    setTutorialId("wolf");
  }

  function startArmadilloTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setSelectedRemovalPieceIds([]);
    setPendingPlacement(null);
    setRoom(createArmadilloTutorialRoom());
    setTutorialStep(0);
    setTutorialId("armadillo");
  }

  function startMacawTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setSelectedRemovalPieceIds([]);
    setPendingPlacement(null);
    setRoom(createMacawTutorialRoom());
    setTutorialStep(0);
    setTutorialId("macaw");
  }

  function startCapuchinTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setSelectedRemovalPieceIds([]);
    setPendingPlacement(null);
    setRoom(createCapuchinTutorialRoom());
    setTutorialStep(0);
    setTutorialId("capuchin");
  }

  function startCoatiTutorial() {
    setError(null);
    setNotice(null);
    lastOnlineRoomSnapshotRef.current = "";
    tutorialMoveLogLenRef.current = null;
    autoScoredRef.current = null;
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setSelectedPieceId(null);
    setSelectedJaguarDestination(null);
    setSelectedJaguarTargetPieceId(null);
    setSelectedWolfTargetPieceId(null);
    setSelectedWolfResources([]);
    setSelectedRemovalPieceIds([]);
    setPendingPlacement(null);
    setRoom(createCoatiTutorialRoom());
    setTutorialStep(0);
    setTutorialId("coati");
  }

  function exitTutorial(completed: boolean) {
    if (completed && tutorialId) markTutorialDone(tutorialId);
    autoScoredRef.current = null;
    setTutorialId(null);
    setTutorialStep(null);
    setBoardSpecies(null);
    setSelectedHandCardId(null);
    setSelectedCardRotation(0);
    setPendingPlacement(null);
    clearRoomState();
    setLandingMode("tutorials");
    setNotice(completed ? "Tutorial concluído!" : "Tutorial encerrado.");
  }

  function leaveTable() {
    if (room?.roomId !== localRoomId) {
      clearOnlineSession();
    }
    setTutorialId(null);
    setTutorialStep(null);
    autoScoredRef.current = null;
    clearRoomState();
    setError(null);
    setNotice(isLocalRoom ? "Teste local encerrado." : "Voce saiu da mesa.");
  }

  useEffect(() => {
    if (
      room?.game?.status !== "active" ||
      hasPendingCoatiPairBonus ||
      !canControlActivePlayer ||
      activeActionId !== "D" ||
      !room.game.activePlayerId ||
      (tutorialActive && typeof tutorialDef?.completeWhenScoreAtLeast !== "number")
    ) {
      return;
    }
    const species = activeSpecies?.speciesId;
    if (species !== "capuchin" && species !== "macaw" && species !== "armadillo") {
      return;
    }
    const key = `${room.game.activePlayerId}:${room.game.round}:${species}:D`;
    if (autoScoredRef.current === key) {
      return;
    }
    autoScoredRef.current = key;
    const timer = window.setTimeout(() => {
      if (species === "capuchin") {
        handleScoreCapuchin();
      } else if (species === "macaw") {
        handleScoreMacaw();
      } else {
        handleScoreArmadillo();
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    activeActionId,
    activeSpecies?.speciesId,
    canControlActivePlayer,
    handleScoreArmadillo,
    handleScoreCapuchin,
    handleScoreMacaw,
    hasPendingCoatiPairBonus,
    room?.game?.activePlayerId,
    room?.game?.round,
    room?.game?.status,
    tutorialActive,
    tutorialDef?.completeWhenScoreAtLeast
  ]);

  const setupSpecies = currentGamePlayer?.speciesId ? speciesDefinitions[currentGamePlayer.speciesId] : null;
  const setupPlaced = currentGamePlayer?.piecesInForest.length ?? 0;
  const setupNeeded = setupSpecies?.initialPieces ?? 0;

  return (
    <main className={`app-shell ${hasStartedGame ? "game-active" : "menu-active"}`}>
      {cardDrag && (
        <div className="card-drag-layer" aria-hidden="true">
          <span
            className={`card-drag-ghost ${cardDrag.target ? "locked" : ""}`}
            style={
              {
                "--ghost-x": `${cardDrag.x}px`,
                "--ghost-y": `${cardDrag.y}px`,
                "--ghost-size": `${cardDrag.size}px`
              } as CSSProperties
            }
          >
            <img
              src={cardDrag.src}
              alt=""
              style={{ transform: `rotate(${selectedCardRotation}deg)` }}
            />
          </span>
        </div>
      )}
      {travelEffects.length > 0 && (
        <div className="travel-effect-layer" aria-hidden="true">
          {travelEffects.map((effect) => {
            const src =
              effect.kind === "resource" && effect.resource
                ? resourceAssets[effect.resource]
                : effect.speciesId
                  ? speciesDefinitions[effect.speciesId].meepleAsset
                  : resourceAssets.point;

            return (
              <span
                className={`travel-effect ${effect.kind}`}
                key={effect.id}
                style={
                  {
                    "--from-x": `${effect.from.x}px`,
                    "--from-y": `${effect.from.y}px`,
                    "--to-x": `${effect.to.x}px`,
                    "--to-y": `${effect.to.y}px`
                  } as CSSProperties
                }
              >
                <img src={encodeURI(src)} alt="" />
              </span>
            );
          })}
        </div>
      )}
      {macawScoreAnim && (
        // The scoring lines themselves are drawn on the board by the Phaser scene
        // (scoringLineHighlights); this panel just narrates the result.
        <div className="macaw-score-panel" role="status">
          <div className="macaw-score-panel-icon">
            <img src={encodeURI(speciesDefinitions.macaw.meepleAsset)} alt="" />
          </div>
          <div className="macaw-score-panel-text">
            <small>{macawScoreAnim.playerName}</small>
            <strong>
              {macawScoreAnim.points} linha{macawScoreAnim.points > 1 ? "s" : ""} de 3 araras
            </strong>
            <span className="macaw-score-panel-total">
              = <em>+{macawScoreAnim.points}</em> ponto{macawScoreAnim.points > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
      {capuchinScoreAnim && (
        // The scored habitat cards are highlighted on the board by the Phaser
        // scene (scoringCardHighlights); this panel narrates the result.
        <div className="capuchin-score-panel" role="status">
          <div className="capuchin-score-panel-icon">
            <img src={encodeURI(speciesDefinitions.capuchin.meepleAsset)} alt="" />
          </div>
          <div className="capuchin-score-panel-text">
            <small>{capuchinScoreAnim.playerName}</small>
            <strong>
              {capuchinScoreAnim.points} habitat{capuchinScoreAnim.points > 1 ? "s" : ""} com 2+ macacos
            </strong>
            <span className="capuchin-score-panel-total">
              = <em>+{capuchinScoreAnim.points}</em> ponto{capuchinScoreAnim.points > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
      {hasStartedGame && (
        <button
          type="button"
          className={`hud-collapse-tab hud-collapse-left ${hudLeftCollapsed ? "is-collapsed" : ""}`}
          title={hudLeftCollapsed ? "Mostrar painel" : "Ocultar painel"}
          aria-label={hudLeftCollapsed ? "Mostrar painel" : "Ocultar painel"}
          onClick={() => setHudLeftCollapsed((value) => !value)}
        >
          {hudLeftCollapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
        </button>
      )}
      {hasStartedGame && (
        <button
          type="button"
          className={`hud-collapse-tab hud-collapse-right ${hudRightCollapsed ? "is-collapsed" : ""}`}
          title={hudRightCollapsed ? "Mostrar jogadores" : "Ocultar jogadores"}
          aria-label={hudRightCollapsed ? "Mostrar jogadores" : "Ocultar jogadores"}
          onClick={() => setHudRightCollapsed((value) => !value)}
        >
          {hudRightCollapsed ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </button>
      )}
      {!hasStartedGame && !room && landingMode === "idle" && (
        <div className="landing-screen" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-2" />
            <span className="orb orb-3" />
          </div>

          <header className="landing-header landing-header-minimal">
            <span aria-hidden="true" />
            <span className="landing-version">v0.1 · beta</span>
          </header>

          <div className="landing-hero landing-hero-logo">
            <img className="brand-logo-hero" src="/oikos-logo.png" alt="Oikos Digital" />
          </div>

          <div className="landing-panel">
            <label className="landing-name-field">
              <Users aria-hidden="true" />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={24}
                placeholder="Seu nome"
                aria-label="Seu nome"
              />
            </label>

            <div className="landing-actions">
              <button
                type="button"
                className="landing-action landing-action-primary"
                onClick={() => run(() => roomApi.create(requireSocket(), name), "Sala criada.")}
              >
                <span className="landing-action-icon">
                  <Play aria-hidden="true" />
                </span>
                <span className="landing-action-text">
                  <strong>Criar Sala</strong>
                  <small>Hospede uma partida online</small>
                </span>
              </button>

              <button
                type="button"
                className="landing-action landing-action-secondary"
                onClick={() => setLandingMode("join")}
              >
                <span className="landing-action-icon">
                  <LogIn aria-hidden="true" />
                </span>
                <span className="landing-action-text">
                  <strong>Entrar com Código</strong>
                  <small>Junte-se a uma sala existente</small>
                </span>
              </button>

              <button
                type="button"
                className="landing-action landing-action-secondary"
                onClick={() => setLandingMode("local")}
              >
                <span className="landing-action-icon">
                  <MapPin aria-hidden="true" />
                </span>
                <span className="landing-action-text">
                  <strong>Teste Local</strong>
                  <small>Controle 2-6 espécies nesta tela</small>
                </span>
              </button>

              <button
                type="button"
                className="landing-action landing-action-secondary"
                onClick={() => setLandingMode("tutorials")}
              >
                <span className="landing-action-icon">
                  <GraduationCap aria-hidden="true" />
                </span>
                <span className="landing-action-text">
                  <strong>Tutoriais</strong>
                  <small>Aprenda a jogar passo a passo</small>
                </span>
              </button>
            </div>
          </div>

          <div className="landing-species-rail" aria-hidden="true">
            {speciesList.map((species) => (
              <div
                key={species.speciesId}
                className="landing-species-card"
                style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
              >
                <img src={encodeURI(species.meepleAsset)} alt="" />
                <span>{species.displayName}</span>
              </div>
            ))}
          </div>

          <footer className="landing-footer">
            <span>Oikos Digital</span>
            <span className="landing-footer-sep">·</span>
            <span>Servidor autoritativo · Socket.IO</span>
          </footer>
        </div>
      )}

      {!hasStartedGame && !room && landingMode === "join" && (
        <div className="flow-screen flow-screen-join" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-2" />
          </div>

          <header className="flow-header">
            <button
              type="button"
              className="flow-back"
              onClick={() => setLandingMode("idle")}
              aria-label="Voltar"
            >
              <ChevronLeft aria-hidden="true" />
              <span>Voltar</span>
            </button>
            <div className="landing-logo flow-logo">
              <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.png" alt="Oikos" />
            </div>
            <span className="flow-spacer" aria-hidden="true" />
          </header>

          <div className="flow-body">
            <div className="flow-icon-large">
              <LogIn aria-hidden="true" />
            </div>
            <h2 className="flow-title">Entrar em Sala</h2>
            <p className="flow-subtitle">
              Digite o código de 5 caracteres compartilhado pelo anfitrião.
            </p>

            <form
              className="flow-card flow-card-join"
              onSubmit={(event) => {
                event.preventDefault();
                if (joinCode.length >= 4) {
                  void run(() => roomApi.join(requireSocket(), joinCode, name), "Entrada confirmada.");
                }
              }}
            >
              <label className="landing-name-field flow-name">
                <Users aria-hidden="true" />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={24}
                  placeholder="Seu nome"
                />
              </label>

              <div className="flow-code-field">
                <span className="flow-code-label">Código da sala</span>
                <input
                  className="landing-code-input flow-code-input"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ABCDE"
                  maxLength={5}
                  autoFocus
                />
              </div>

              <button type="submit" className="flow-submit" disabled={joinCode.length < 4}>
                <LogIn aria-hidden="true" />
                Entrar na Sala
              </button>
            </form>
          </div>
        </div>
      )}

      {!hasStartedGame && !room && landingMode === "local" && (
        <div className="flow-screen flow-screen-local" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-3" />
          </div>

          <header className="flow-header">
            <button
              type="button"
              className="flow-back"
              onClick={() => setLandingMode("idle")}
              aria-label="Voltar"
            >
              <ChevronLeft aria-hidden="true" />
              <span>Voltar</span>
            </button>
            <div className="landing-logo flow-logo">
              <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.png" alt="Oikos" />
            </div>
            <span className="flow-spacer" aria-hidden="true" />
          </header>

          <div className="flow-body flow-body-wide">
            <div className="flow-icon-large flow-icon-amber">
              <MapPin aria-hidden="true" />
            </div>
            <h2 className="flow-title">Teste Local</h2>
            <p className="flow-subtitle">
              Controle de 2 a 6 espécies nesta mesma tela. Ideal para aprender as regras e testar estratégias.
            </p>

            <div className="flow-card flow-card-local">
              <div className="flow-card-header">
                <span>Escolha as espécies</span>
                <span className="flow-counter">
                  {localSpeciesIds.length}/6
                </span>
              </div>
              <div className="flow-species-grid">
                {speciesList.map((species) => {
                  const selected = localSpeciesIds.includes(species.speciesId);
                  return (
                    <button
                      key={species.speciesId}
                      type="button"
                      className={`flow-species-card ${selected ? "selected" : ""}`}
                      onClick={() => toggleLocalSpecies(species.speciesId)}
                      style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
                    >
                      <div className="flow-species-thumb">
                        <img src={encodeURI(species.meepleAsset)} alt="" />
                      </div>
                      <div className="flow-species-text">
                        <strong>{species.displayName}</strong>
                        <small>{categoryLabels[species.category]}</small>
                      </div>
                      {selected && (
                        <span className="flow-species-check" aria-hidden="true">
                          <Check />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="flow-submit"
                onClick={startLocalTest}
                disabled={localSpeciesIds.length < 2}
              >
                <Play aria-hidden="true" />
                Iniciar Partida ({localSpeciesIds.length} espécies)
              </button>
              {localSpeciesIds.length < 2 && (
                <small className="flow-hint">Mínimo 2 espécies para iniciar.</small>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasStartedGame && !room && landingMode === "tutorials" && (
        <div className="flow-screen" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-2" />
            <span className="orb orb-3" />
          </div>

          <header className="flow-header">
            <button
              type="button"
              className="flow-back"
              onClick={() => setLandingMode("idle")}
              aria-label="Voltar"
            >
              <ChevronLeft aria-hidden="true" />
              <span>Voltar</span>
            </button>
            <div className="landing-logo flow-logo">
              <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.png" alt="Oikos" />
            </div>
            <span className="flow-spacer" aria-hidden="true" />
          </header>

          <div className="flow-body">
            <h2 className="flow-title">Tutoriais</h2>
            <p className="flow-subtitle">Escolha um capítulo. Comece pelo tutorial inicial.</p>

            <div className="tutorial-chapters">
              <button
                type="button"
                className={`tutorial-chapter ${isTutorialInitialDone() ? "is-done" : "is-available"}`}
                onClick={startInitialTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <GraduationCap aria-hidden="true" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>Tutorial inicial</strong>
                  <small>Mecânicas básicas: cartas, movimento, recursos e turno.</small>
                </span>
                {isTutorialInitialDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialJaguarDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.jaguar } as CSSProperties}
                onClick={startJaguarTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.jaguar.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.jaguar.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialJaguarDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialWolfDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.maned_wolf } as CSSProperties}
                onClick={startWolfTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.maned_wolf.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.maned_wolf.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialWolfDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialArmadilloDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.armadillo } as CSSProperties}
                onClick={startArmadilloTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.armadillo.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.armadillo.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialArmadilloDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialMacawDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.macaw } as CSSProperties}
                onClick={startMacawTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.macaw.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.macaw.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialMacawDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialCapuchinDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.capuchin } as CSSProperties}
                onClick={startCapuchinTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.capuchin.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.capuchin.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialCapuchinDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`tutorial-chapter ${isTutorialCoatiDone() ? "is-done" : "is-available"}`}
                style={{ "--species-color": SPECIES_HEX.coati } as CSSProperties}
                onClick={startCoatiTutorial}
              >
                <span className="tutorial-chapter-icon">
                  <img className="is-portrait" src={encodeURI(speciesDefinitions.coati.portraitAsset)} alt="" />
                </span>
                <span className="tutorial-chapter-text">
                  <strong>{speciesDefinitions.coati.displayName}</strong>
                  <small>Aprenda a jogar com esta espécie.</small>
                </span>
                {isTutorialCoatiDone() ? (
                  <span className="tutorial-chapter-badge done">
                    <Check aria-hidden="true" /> Concluído
                  </span>
                ) : (
                  <span className="tutorial-chapter-badge play">
                    <Play aria-hidden="true" /> Começar
                  </span>
                )}
              </button>

              {speciesList.filter((species) => species.speciesId !== "jaguar" && species.speciesId !== "maned_wolf" && species.speciesId !== "armadillo" && species.speciesId !== "macaw" && species.speciesId !== "capuchin" && species.speciesId !== "coati").map((species) => (
                <div
                  key={species.speciesId}
                  className="tutorial-chapter is-locked"
                  style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
                  aria-disabled="true"
                >
                  <span className="tutorial-chapter-icon">
                    <img className="is-portrait" src={encodeURI(species.portraitAsset)} alt="" />
                  </span>
                  <span className="tutorial-chapter-text">
                    <strong>{species.displayName}</strong>
                    <small>Aprenda a jogar com esta espécie.</small>
                  </span>
                  <span className="tutorial-chapter-badge locked">
                    <Lock aria-hidden="true" /> Em breve
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!hasStartedGame && room && (
        <div className="flow-screen flow-screen-lobby" role="main">
          <div className="landing-bg-orbs" aria-hidden="true">
            <span className="orb orb-1" />
            <span className="orb orb-2" />
            <span className="orb orb-3" />
          </div>

          <header className="flow-header">
            <button
              type="button"
              className="flow-back"
              onClick={() => {
                if (isLocalRoom) {
                  stopLocalTest();
                } else {
                  leaveTable();
                }
                setLandingMode("idle");
              }}
              aria-label="Sair da sala"
            >
              <LogOut aria-hidden="true" />
              <span>Sair</span>
            </button>
            <div className="landing-logo flow-logo">
              <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.png" alt="Oikos" />
            </div>
            <span className="flow-spacer" aria-hidden="true" />
          </header>

          <div className="flow-body flow-body-lobby">
            <div className="lobby-hero">
              <span className="lobby-badge">{isLocalRoom ? "Teste Local" : "Sala Online"}</span>
              <h2 className="flow-title lobby-title">
                {isLocalRoom ? "Mesa Local" : "Sala de Espera"}
              </h2>
              {!isLocalRoom && (
                <div className="lobby-code-card">
                  <span className="lobby-code-label">Código da Sala</span>
                  <div className="lobby-code-display">
                    <span className="lobby-code-value">{room.roomId}</span>
                    <button
                      type="button"
                      className="lobby-code-copy"
                      title="Copiar código"
                      onClick={() => {
                        void navigator.clipboard?.writeText(room.roomId);
                        setNotice("Código copiado.");
                      }}
                    >
                      <Copy aria-hidden="true" />
                    </button>
                  </div>
                  <small>Compartilhe com seus amigos para entrarem.</small>
                </div>
              )}
            </div>

            <div className="lobby-columns">
              <section className="lobby-card lobby-players">
                <header className="lobby-card-header">
                  <Users aria-hidden="true" />
                  <h3>Jogadores</h3>
                  <span className="lobby-count">{room.players.length}</span>
                </header>
                <ul className="lobby-player-list">
                  {room.players.map((player) => {
                    const species = player.speciesId ? speciesDefinitions[player.speciesId] : null;
                    const isYou = player.playerId === playerId;
                    const isThisHost = player.playerId === room.hostPlayerId;
                    return (
                      <li
                        key={player.playerId}
                        className={`lobby-player ${player.ready ? "ready" : ""} ${isYou ? "you" : ""}`}
                        style={
                          species
                            ? ({ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties)
                            : undefined
                        }
                      >
                        <div className="lobby-player-avatar">
                          {species ? (
                            <img className="is-portrait" src={encodeURI(species.portraitAsset)} alt="" />
                          ) : (
                            <Users aria-hidden="true" />
                          )}
                        </div>
                        <div className="lobby-player-text">
                          <strong>
                            {player.name || "Jogador"}
                            {isYou && <span className="lobby-tag lobby-tag-you">Você</span>}
                            {isThisHost && !isLocalRoom && <span className="lobby-tag lobby-tag-host">Host</span>}
                            {player.isBot && <span className="lobby-tag lobby-tag-bot">Bot</span>}
                          </strong>
                          <small>
                            {species ? species.displayName : "Sem espécie"}
                            {player.ready && " · Pronto"}
                          </small>
                        </div>
                        {player.ready && (
                          <span className="lobby-player-check" aria-hidden="true">
                            <Check />
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {isHost && !isLocalRoom && (
                  <div className="lobby-host-controls">
                    <p className="lobby-hint">
                      <Bot aria-hidden="true" />
                      <span>Clique no botão de bot em cada espécie para adicionar/remover bots.</span>
                    </p>
                    {roomHasBots && (
                      <button
                        type="button"
                        className="lobby-mini-button"
                        onClick={() => run(() => roomApi.removeBots(requireSocket(), room.roomId), "Bots removidos.")}
                      >
                        <X aria-hidden="true" />
                        Remover todos os bots
                      </button>
                    )}
                    <div className="lobby-bot-speed">
                      <button
                        type="button"
                        className="icon-button compact"
                        title="Bots mais rápidos"
                        onClick={() => adjustBotSpeed(-botTurnDelayStepMs)}
                      >
                        <Minus aria-hidden="true" />
                      </button>
                      <span>Velocidade: {formatBotDelay(botTurnDelayMs)}</span>
                      <button
                        type="button"
                        className="icon-button compact"
                        title="Bots mais lentos"
                        onClick={() => adjustBotSpeed(botTurnDelayStepMs)}
                      >
                        <Plus aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="lobby-card lobby-species">
                <header className="lobby-card-header">
                  <ShieldCheck aria-hidden="true" />
                  <h3>Escolha sua Espécie</h3>
                </header>
                <div className="lobby-species-grid">
                  {speciesList.map((species) => {
                    const takenBy = room.players.find((player) => player.speciesId === species.speciesId);
                    const selected =
                      currentPlayer?.speciesId === species.speciesId || selectedSpecies === species.speciesId;
                    const takenByOther = Boolean(takenBy && takenBy.playerId !== controlledPlayerId);
                    const isBotSlot = Boolean(takenBy?.isBot);
                    const isHumanSlot = Boolean(takenBy && !takenBy.isBot);
                    const disabled = takenByOther || room.status !== "lobby";
                    const canToggleBot = isHost && !isLocalRoom && room.status === "lobby" && !isHumanSlot;
                    return (
                      <div
                        key={species.speciesId}
                        className={`lobby-species-card-wrap ${isBotSlot ? "is-bot" : ""}`}
                        style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
                      >
                        <button
                          type="button"
                          className={`lobby-species-card ${selected ? "selected" : ""}`}
                          disabled={disabled}
                          onClick={() => {
                            setSelectedSpecies(species.speciesId);
                            void run(() => roomApi.selectSpecies(requireSocket(), room.roomId, species.speciesId));
                          }}
                        >
                          <div className="lobby-species-thumb">
                            <img className="is-portrait" src={encodeURI(species.portraitAsset)} alt="" />
                          </div>
                          <div className="lobby-species-text">
                            <strong>{species.displayName}</strong>
                            <small>{categoryLabels[species.category]}</small>
                          </div>
                          {isBotSlot && (
                            <span className="lobby-species-taken lobby-species-bot-tag">
                              <Bot aria-hidden="true" />
                              Bot
                            </span>
                          )}
                          {isHumanSlot && takenBy?.playerId !== controlledPlayerId && (
                            <span className="lobby-species-taken">{takenBy?.name || "Em uso"}</span>
                          )}
                        </button>
                        {canToggleBot && (
                          <button
                            type="button"
                            className={`lobby-species-bot-btn ${isBotSlot ? "active" : ""}`}
                            title={isBotSlot ? "Remover bot" : "Adicionar bot"}
                            aria-label={isBotSlot ? "Remover bot" : "Adicionar bot"}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (isBotSlot) {
                                void run(
                                  () => roomApi.removeBotSpecies(requireSocket(), room.roomId, species.speciesId),
                                  "Bot removido."
                                );
                              } else {
                                void run(
                                  () => roomApi.addBotSpecies(requireSocket(), room.roomId, species.speciesId),
                                  "Bot adicionado."
                                );
                              }
                            }}
                          >
                            {isBotSlot ? <X aria-hidden="true" /> : <Bot aria-hidden="true" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="lobby-footer-actions">
              {!isLocalRoom && (
                <button
                  type="button"
                  className={`lobby-ready-btn ${currentPlayer?.ready ? "is-ready" : ""}`}
                  onClick={() =>
                    run(() => roomApi.ready(requireSocket(), requireRoom().roomId, !currentPlayer?.ready))
                  }
                  disabled={!currentPlayer?.speciesId}
                >
                  <Check aria-hidden="true" />
                  {currentPlayer?.ready ? "Pronto!" : "Marcar Pronto"}
                </button>
              )}
              {isHost && !isLocalRoom && (
                <button
                  type="button"
                  className="flow-submit lobby-start-btn"
                  onClick={() => run(() => roomApi.start(requireSocket(), room.roomId))}
                >
                  <Play aria-hidden="true" />
                  Iniciar Partida
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {hasStartedGame && (
        <button
          type="button"
          className="hud-config-btn"
          title="Mesa e configurações"
          aria-label="Mesa e configurações"
          onClick={() => setConfigOpen(true)}
        >
          <Settings aria-hidden="true" />
        </button>
      )}

      {tutorialActive && hasStartedGame && tutorialDef && (
        <div className="tutorial-coach" role="dialog" aria-live="polite">
          <div className="tutorial-coach-progress" aria-hidden="true">
            {tutorialSteps.map((_, i) => (
              <span
                key={i}
                className={`tutorial-dot ${
                  i === tutorialStep ? "active" : i < (tutorialStep ?? 0) ? "done" : ""
                }`}
              />
            ))}
          </div>
          <div className="tutorial-coach-body">
            <span className="tutorial-coach-step">
              Passo {(tutorialStep ?? 0) + 1}/{tutorialSteps.length}
            </span>
            <h3>{tutorialDef.title}</h3>
            <p>{tutorialDef.body}</p>
          </div>
          <div className="tutorial-coach-actions">
            <button type="button" className="tutorial-coach-exit" onClick={() => exitTutorial(false)}>
              Sair
            </button>
            {!tutorialDef.autoAdvance &&
              (tutorialStep === tutorialSteps.length - 1 ? (
                <button type="button" className="primary-button" onClick={() => exitTutorial(true)}>
                  Concluir
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setTutorialStep((step) => (step === null ? step : step + 1))}
                >
                  Próximo
                </button>
              ))}
          </div>
        </div>
      )}

      {hasStartedGame && configOpen && (
        <div className="config-modal-backdrop" role="presentation" onClick={() => setConfigOpen(false)}>
          <div
            className="config-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Mesa"
            onClick={(event) => event.stopPropagation()}
          >
          <section className="panel-block session-card">
            <div className="section-title">
              <Users aria-hidden="true" />
              <h2>Mesa</h2>
            </div>
            <div className="session-row">
              <div>
                <span>{isLocalRoom ? "Teste local" : "Sala online"}</span>
                <strong>{room?.roomId ?? "Mesa"}</strong>
              </div>
              {!isLocalRoom && room && (
                <button
                  className="icon-button compact"
                  title="Copiar codigo da sala"
                  onClick={() => {
                    void navigator.clipboard?.writeText(room.roomId);
                    setNotice("Codigo copiado.");
                  }}
                >
                  <Copy aria-hidden="true" />
                </button>
              )}
            </div>
            {!isLocalRoom && isHost && (
              <div className="bot-speed-control" aria-label="Velocidade dos bots">
                <button
                  type="button"
                  className="icon-button compact"
                  title="Bots mais rápidos"
                  aria-label="Bots mais rápidos"
                  onClick={() => adjustBotSpeed(-botTurnDelayStepMs)}
                >
                  <Minus aria-hidden="true" />
                </button>
                <span>Bots {formatBotDelay(botTurnDelayMs)}</span>
                <button
                  type="button"
                  className="icon-button compact"
                  title="Bots mais lentos"
                  aria-label="Bots mais lentos"
                  onClick={() => adjustBotSpeed(botTurnDelayStepMs)}
                >
                  <Plus aria-hidden="true" />
                </button>
              </div>
            )}
            <button className="secondary-button exit-button" onClick={leaveTable}>
              <LogOut aria-hidden="true" />
              Sair
            </button>
            <button type="button" className="secondary-button" onClick={() => setConfigOpen(false)}>
              <X aria-hidden="true" />
              Fechar
            </button>
          </section>

          <section className="panel-block audio-card">
            <div className="section-title">
              {audioSettings.muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              <h2>Áudio</h2>
            </div>
            <button
              type="button"
              className={`secondary-button ${audioSettings.muted ? "" : "is-active"}`}
              onClick={() => updateAudio({ muted: !audioSettings.muted })}
            >
              {audioSettings.muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              {audioSettings.muted ? "Som desligado" : "Som ligado"}
            </button>
            <label className="audio-slider">
              <span>Efeitos</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(audioSettings.sfxVolume * 100)}
                disabled={audioSettings.muted}
                onChange={(event) => updateAudio({ sfxVolume: Number(event.target.value) / 100 })}
              />
              <small>{Math.round(audioSettings.sfxVolume * 100)}%</small>
            </label>
          </section>
          </div>
        </div>
      )}

      {hasStartedGame && hudGamePlayer && hudSpecies && (
        <section
          className={`hud-species panel-block species-hud ${hudSpeciesCollapsed ? "is-collapsed" : ""}`}
          style={speciesVar(hudGamePlayer.speciesId)}
        >
            <div className="species-hud-header">
              <img className="player-portrait" src={encodeURI(hudSpecies.portraitAsset)} alt="" />
              <div>
                <span>{currentGamePlayer ? "Controlando" : "Vez atual"}</span>
                <h2>{hudSpecies.displayName}</h2>
                <p>{hudGamePlayer.name}</p>
              </div>
              <button
                type="button"
                className="species-hud-toggle"
                onClick={() => setHudSpeciesCollapsed((value) => !value)}
                aria-label={hudSpeciesCollapsed ? "Expandir painel da espécie" : "Recolher painel da espécie"}
                title={hudSpeciesCollapsed ? "Expandir" : "Recolher"}
              >
                {hudSpeciesCollapsed ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
              </button>
            </div>

            <div className="hud-stat-grid">
              <div className="hud-stat-card">
                <Trophy aria-hidden="true" />
                <span>Pontos</span>
                <strong><AnimatedNumber value={hudGamePlayer.score} /></strong>
              </div>
              <div className="hud-stat-card" ref={(node) => setEffectTarget("hud:reserve", node)}>
                <Package aria-hidden="true" />
                <span>Reserva</span>
                <strong>{hudGamePlayer.reservePieces.length}</strong>
              </div>
              <div className="hud-stat-card">
                <img src={encodeURI(hudSpecies.meepleAsset)} alt="" />
                <span>Na floresta</span>
                <strong>{hudGamePlayer.piecesInForest.length}</strong>
              </div>
            </div>

            <div className="resource-bank">
              {resourceOrder.map((resource) => (
                <div className="resource-chip" key={resource} ref={(node) => setEffectTarget(`hud:${resource}`, node)}>
                  <img src={encodeURI(resourceAssets[resource])} alt="" />
                  <span>{resourceLabels[resource]}</span>
                  <strong><AnimatedNumber value={hudGamePlayer.resources[resource] ?? 0} /></strong>
                </div>
              ))}
              {floatingGains.length > 0 && (
                <div className="floating-gains" aria-hidden="true">
                  {floatingGains.map((gain) => (
                    <span className="floating-gain" key={gain.id}>
                      <img src={encodeURI(resourceAssets[gain.resource])} alt="" />
                      +{gain.amount} {gain.resource === "point" ? "ponto" : resourceLabels[gain.resource]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {(error || notice) && (
          <div className={`status-message hud-toast ${error ? "error" : "notice"}`}>
            {error ? <AlertTriangle aria-hidden="true" /> : <Check aria-hidden="true" />}
            <span>{error ?? notice}</span>
          </div>
        )}

        {hasStartedGame && (
        <div className={`hud-action hud-dock hud-left ${hudLeftCollapsed ? "is-collapsed" : ""} ${turnSummary ? "has-turn-recap" : ""}`}>
        {room?.game?.status === "setup" && (
          <section className="panel-block setup-block">
            <div className="section-title">
              <MapPin aria-hidden="true" />
              <h2>Setup</h2>
            </div>
            <p>
              Vez de <strong>{setupActivePlayer?.name ?? "jogador"}</strong> posicionar peças iniciais.
            </p>
            {currentGamePlayer && (
              <div className="setup-meter">
                <span>Suas peças iniciais</span>
                <strong>
                  {setupPlaced}/{setupNeeded}
                </strong>
              </div>
            )}
            {canPlaceSetupPiece && <p className="action-hint">Clique em qualquer carta da floresta inicial.</p>}
          </section>
        )}

        {room?.game?.status === "active" && activeGamePlayer && (
          <section className="panel-block active-turn-block" style={speciesVar(activeGamePlayer.speciesId)}>
            <div className="section-title">
              <Play aria-hidden="true" />
              <h2>Turno ativo</h2>
            </div>
            <div className="active-turn-card">
              {activeSpecies && <img src={encodeURI(activeSpecies.meepleAsset)} alt="" />}
              <div>
                <span>Jogador atual</span>
                <strong>{activeSpecies?.displayName ?? activeGamePlayer.name}</strong>
                <small>Rodada {room.game.round}/{room.game.maxRounds}</small>
              </div>
            </div>
            {activeSpecies && (
              <div className="action-list">
                {activeSpecies.actions.map((action) => (
                  <span className={action === activeActionId ? "current" : ""} key={action}>{action}</span>
                ))}
              </div>
            )}
            {activeSpecies && activeActionId && (
              <div className="current-action-card">
                <span>Ação atual</span>
                <strong>{activeActionId}</strong>
                <p>{getActionDescription(activeSpecies.speciesId, activeActionId)}</p>
                {activeSpecies.speciesId === "coati" && hasPendingCoatiPairBonus && canControlActivePlayer && (
                  <small>Dupla de quatis formada: escolha uma carta adjacente para adicionar 1 quati e marcar 1 ponto.</small>
                )}
                {activeSpecies.speciesId === "coati" && !hasPendingCoatiPairBonus && activeActionId === "A" && canControlActivePlayer && (
                  <>
                    <small>
                      {room.game.activePlayedForestCardId
                        ? "Escolha uma carta com fruta para adicionar 1 quati, ou conclua sem adicionar."
                        : "Selecione uma carta na mão e coloque em um espaço vazio destacado."}
                    </small>
                    {room.game.activePlayedForestCardId && !tutorialActive && (
                      <button className="secondary-button" onClick={handleCompleteAction}>
                        Concluir sem adicionar
                      </button>
                    )}
                  </>
                )}
                {activeSpecies.speciesId === "coati" && !hasPendingCoatiPairBonus && activeActionId === "B" && canControlActivePlayer && (
                  <small>Selecione um meeple do Quati no tabuleiro e clique em um destino destacado.</small>
                )}
                {activeSpecies.speciesId === "coati" &&
                  !hasPendingCoatiPairBonus &&
                  activeActionId === "C" &&
                  canControlActivePlayer &&
                  !tutorialActive &&
                  requiredCoatiRemovalCount === 0 && (
                  <button className="secondary-button" onClick={handleCompleteAction}>
                    Concluir ação {activeActionId}
                  </button>
                )}
                {activeSpecies.speciesId === "coati" &&
                  !hasPendingCoatiPairBonus &&
                  activeActionId === "C" &&
                  canControlActivePlayer &&
                  requiredCoatiRemovalCount > 0 && (
                    <>
                      <small>
                        Selecione {requiredCoatiRemovalCount} quatis da floresta. Selecionados:{" "}
                        {selectedRemovalPieceIds.length}/{requiredCoatiRemovalCount}.
                      </small>
                      <button
                        className="secondary-button"
                        disabled={selectedRemovalPieceIds.length !== requiredCoatiRemovalCount}
                        onClick={handleRemoveSelectedPieces}
                      >
                        Remover quatis
                      </button>
                    </>
                  )}
                {activeSpecies.speciesId === "jaguar" &&
                  (activeActionId === "A" || activeActionId === "B") &&
                  canControlActivePlayer && (
                    <>
                      <small>
                        {canSkipJaguarMove
                          ? "Não há destino válido para mover nesta ação."
                          : selectedJaguarDestination
                            ? "Escolha qual meeple a Onça deve remover no destino selecionado."
                            : "Selecione a Onça e clique em um destino destacado. Com 1 meeple no destino, a remoção é automática; com mais de 1, escolha qual remover depois."}
                      </small>
                      {canSkipJaguarMove && (
                        <button className="secondary-button" onClick={handleCompleteAction}>
                          Concluir sem movimento
                        </button>
                      )}
                    </>
                  )}
                {activeSpecies.speciesId === "jaguar" &&
                  activeActionId === "C" &&
                  canControlActivePlayer && (
                    <small>Escolha quantas carnes gastar na janela central.</small>
                  )}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "A" && canControlActivePlayer && (() => {
                  const canSkipAdd = Boolean(room.game.activePlayedForestCardId);
                  return (
                    <>
                      <small>
                        {!room.game.activePlayedForestCardId
                          ? "Selecione uma carta na mão e coloque em um espaço vazio destacado."
                          : capuchinReserveCount === 0 || capuchinPlacementTargets.length === 0
                            ? "Sem macacos na reserva. Conclua a ação para seguir."
                            : `Clique na carta jogada destacada para adicionar 1 macaco, ou conclua sem adicionar. Reserva: ${capuchinReserveCount}.`}
                      </small>
                      {canSkipAdd && (
                        <button className="secondary-button" onClick={handleCompleteAction}>
                          Concluir sem adicionar
                        </button>
                      )}
                    </>
                  );
                })()}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "B" && canControlActivePlayer && (
                  <small>Selecione um meeple do Macaco-prego e clique em um destino destacado conforme a carta jogada.</small>
                )}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "C" && canControlActivePlayer && (() => {
                  return (
                    <>
                      <small>
                        {capuchinReserveCount === 0 || capuchinPlacementTargets.length === 0
                          ? "Sem macaco na reserva ou sem local válido. Conclua a ação para pontuar."
                          : `Clique em um local destacado que já tenha outro Macaco-prego, ou conclua sem adicionar. Reserva: ${capuchinReserveCount}.`}
                      </small>
                      <button className="secondary-button" onClick={handleCompleteAction}>
                        Concluir sem adicionar
                      </button>
                    </>
                  );
                })()}
                {activeSpecies.speciesId === "capuchin" && activeActionId === "D" && canControlActivePlayer && (
                  <small>Pontuação automática: +{capuchinHabitatScore} ponto(s) por habitat com macacos.</small>
                )}
                {activeSpecies.speciesId === "macaw" && activeActionId === "A" && canControlActivePlayer && (() => {
                  const reserveCount = activeGamePlayer?.reservePieces.length ?? 0;
                  const noReserve = reserveCount === 0;
                  const noEggTargets = room.game.activePlayedForestCardId && macawEggTargets.length === 0;
                  return (
                    <>
                      <small>
                        {!room.game.activePlayedForestCardId
                          ? "Selecione uma carta na mão e coloque em um espaço vazio destacado."
                          : noReserve
                            ? "Sem araras na reserva. Conclua a ação para seguir."
                            : noEggTargets
                              ? "Nenhuma carta com ovo disponível. Conclua a ação para seguir."
                              : `Clique em uma carta com ovo destacada para adicionar 1 arara, ou conclua sem adicionar. Reserva: ${reserveCount}.`}
                      </small>
                      {room.game.activePlayedForestCardId && (
                        <button className="secondary-button" onClick={handleCompleteAction}>
                          Concluir sem adicionar
                        </button>
                      )}
                    </>
                  );
                })()}
                {activeSpecies.speciesId === "macaw" && activeActionId === "B" && canControlActivePlayer && (
                  <small>Selecione uma Arara-azul e clique em um destino destacado conforme a carta jogada.</small>
                )}
                {activeSpecies.speciesId === "macaw" && activeActionId === "C" && canControlActivePlayer && (
                  <>
                    <small>
                      Adicione uma arara da reserva ou selecione outra arara para realocar ao redor da arara movida.
                    </small>
                    <button className="secondary-button" onClick={handleCompleteAction}>
                      Concluir sem adicionar/realocar
                    </button>
                  </>
                )}
                {activeSpecies.speciesId === "macaw" && activeActionId === "D" && canControlActivePlayer && (
                  <small>Pontuação automática: +{macawLineScore} ponto(s) por linha de 3 araras.</small>
                )}
                {activeSpecies.speciesId === "armadillo" && activeActionId === "A" && canControlActivePlayer && (
                  <>
                    <small>
                      {room.game.activePlayedForestCardId
                        ? "Clique em uma carta com pinha destacada para adicionar 1 tatu, ou conclua sem adicionar."
                        : "Selecione uma carta na mão e coloque em um espaço vazio destacado."}
                    </small>
                    {room.game.activePlayedForestCardId && (
                      <button className="secondary-button" onClick={handleCompleteAction}>
                        Concluir sem adicionar
                      </button>
                    )}
                  </>
                )}
                {activeSpecies.speciesId === "armadillo" && activeActionId === "B" && canControlActivePlayer && (
                  <small>Selecione um Tatu-bola e clique em um destino destacado conforme a carta jogada.</small>
                )}
                {activeSpecies.speciesId === "armadillo" && activeActionId === "C" && canControlActivePlayer && (
                  <>
                    <small>Selecione um Tatu-bola visível próprio para esconder.</small>
                    {selectedPieceId ? (
                      <button className="secondary-button" onClick={handleHideArmadillo}>
                        Esconder Tatu-bola
                      </button>
                    ) : getArmadilloHidePieceIds(room.game, room.game.activePlayerId ?? "").length === 0 ? (
                      <button className="secondary-button" onClick={handleCompleteAction}>
                        Concluir ação {activeActionId}
                      </button>
                    ) : null}
                  </>
                )}
                {activeSpecies.speciesId === "armadillo" && activeActionId === "D" && canControlActivePlayer && (
                  <small>Pontuação automática: +{armadilloShareScore} ponto(s) por compartilhamento.</small>
                )}
                {activeSpecies.speciesId === "maned_wolf" && activeActionId === "A" && canControlActivePlayer && (
                  <small>
                    {room.game.activePlayedForestCardId
                      ? `Mova os lobos destacados. Pendentes: ${room.game.pendingWolfMoves?.pieceIds.length ?? 0}.`
                      : "Selecione uma carta na mão e coloque em um espaço vazio destacado."}
                  </small>
                )}
                {activeSpecies.speciesId === "maned_wolf" && activeActionId === "B" && canControlActivePlayer && (
                  <div className="wolf-base-panel">
                    <div className="wolf-base-summary">
                      <span>Alvos válidos</span>
                      <strong>{wolfRemovableBasePieceIds.length}</strong>
                    </div>
                    <small>
                      {wolfRemovableBasePieceIds.length > 0
                        ? selectedWolfTargetPieceId
                          ? "Peça de base selecionada. Remova ou cancele a ação."
                          : "Clique em uma peça de base que esteja no mesmo local de um lobo."
                        : "Nenhuma peça de base divide local com lobo."}
                    </small>
                    <div className="wolf-base-actions">
                      <button
                        className="wolf-remove-button"
                        disabled={!selectedWolfTargetPieceId}
                        onClick={handleRemoveWolfBasePiece}
                      >
                        <X aria-hidden="true" />
                        Remover peça
                      </button>
                      <button className="wolf-skip-button" disabled={tutorialActive} onClick={handleCompleteAction}>
                        <Check aria-hidden="true" />
                        Concluir
                      </button>
                    </div>
                  </div>
                )}
                {activeSpecies.speciesId === "maned_wolf" && activeActionId === "C" && canControlActivePlayer && (
                  <small>Escolha os recursos na janela central para pontuar.</small>
                )}
                {activeSpecies.speciesId === "maned_wolf" && activeActionId === "D" && canControlActivePlayer && (
                  <>
                    <small>
                      Clique em uma carta com carne para adicionar 1 lobo, ou conclua sem adicionar. Locais válidos: {wolfMeatTargets.length}.
                    </small>
                    <button className="secondary-button" disabled={tutorialActive} onClick={handleCompleteAction}>
                      Concluir sem adicionar
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        )}
        </div>
        )}

      <section className="playfield-panel stage-layer">
        <div className="tabletop-stage">
          {turnBanner && (
            <div
              className="turn-banner"
              key={turnBanner.key}
              style={speciesVar(turnBanner.speciesId)}
              role="status"
            >
              {turnBanner.speciesId && (
                <img src={encodeURI(speciesDefinitions[turnBanner.speciesId].meepleAsset)} alt="" />
              )}
              <span className="turn-banner-label">Vez:</span>
              <strong>{turnBanner.label}</strong>
            </div>
          )}
          <ForestCanvas
            ref={forestCanvasRef}
            cards={forestCards}
            pieces={pieces}
            canPlaceSetupPiece={canPlaceSetupPiece}
            expansionTargets={displayExpansionTargets}
            rotateFitTargets={displayRotateFitTargets}
            rotateFitCardId={canPlaceSelectedForestCard ? selectedHandCardId : null}
            placementPreview={
              pendingPlacement && selectedHandCardId
                ? {
                    position: pendingPlacement.position,
                    rotation: pendingPlacement.rotation,
                    cardId: selectedHandCardId
                  }
                : null
            }
            movementTargets={displayMovementTargets}
            addPieceTargets={displayAddPieceTargets}
            addPieceLabel={
              activeSpecies?.speciesId === "capuchin"
                ? "Adicionar macaco"
                : activeSpecies?.speciesId === "macaw"
                  ? "Adicionar arara"
                  : activeSpecies?.speciesId === "armadillo"
                    ? "Adicionar tatu"
                    : activeSpecies?.speciesId === "maned_wolf"
                      ? "Adicionar lobo"
                  : "Adicionar quati"
            }
            addPieceHint={
              activeSpecies?.speciesId === "capuchin"
                ? "Clique em uma carta destacada para adicionar 1 macaco"
                : activeSpecies?.speciesId === "macaw"
                  ? "Clique em uma carta destacada para adicionar 1 arara"
                  : activeSpecies?.speciesId === "armadillo"
                    ? "Clique em uma carta com pinha para adicionar 1 tatu"
                    : activeSpecies?.speciesId === "maned_wolf"
                      ? "Clique em uma carta com carne para adicionar 1 lobo"
                  : "Clique em uma carta com fruta para adicionar 1 quati"
            }
            bonusTargets={displayCoatiPairBonusTargets}
            spotlightInstanceIds={spotlightInstanceIds}
            scoringCardHighlights={scoringPreview.cardHighlights}
            scoringLineHighlights={scoringPreview.lineHighlights}
            selectedHandCardId={selectedHandCardId}
            selectedPieceId={selectedPieceId}
            selectedPieceIds={highlightedPieceIds}
            selectablePieceIds={boardSelectablePieceIds}
            onCardClick={handleCardClick}
            onExpansionTargetClick={handleExpansionTargetClick}
            onRotateFitTargetClick={handleRotateFitTargetClick}
            onConfirmPlacement={handleConfirmPlacement}
            onCancelPlacement={handleCancelPlacement}
            onAddPieceTargetClick={handleAddPieceTargetClick}
            onBonusTargetClick={handleCoatiPairBonusTargetClick}
            onPieceClick={handlePieceClick}
            onMovementTargetClick={handleMovementTargetClick}
          />
        </div>

        {showHandDuringGame && currentGamePlayer && (
          <section className={`table-hand ${handCollapsed ? "collapsed" : ""}`} aria-label="Mão de cartas">
            <div className="hand-header">
              <div>
                <span>Mão · {handCards.length} cartas</span>
                <strong>{currentGamePlayer.speciesId ? speciesDefinitions[currentGamePlayer.speciesId].displayName : "Espécie"}</strong>
              </div>
              <div className="hand-header-side">
                <button
                  type="button"
                  className="hand-toggle"
                  title={handCollapsed ? "Expandir" : "Recolher"}
                  aria-label={handCollapsed ? "Expandir mão de cartas" : "Recolher mão de cartas"}
                  onClick={() => setHandCollapsed((value) => !value)}
                >
                  {handCollapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                </button>
              </div>
            </div>
            {!handCollapsed &&
              (handCards.length > 0 ? (
                <div
                  className={`hand-rail ${selectedHandCardId ? "has-selection" : ""} ${
                    handPlayableThisAction ? "hand-playable" : "hand-idle"
                  }`}
                  style={{ ["--hand-count" as string]: handCards.length }}
                >
                  {handCards.map((card, handIndex) => {
                    const isSelected = selectedHandCardId === card.id;
                    const showRotate = isSelected && canPlaceSelectedForestCard;

                    return (
                      <div
                        key={card.id}
                        role="button"
                        tabIndex={canSelectHandCards ? 0 : -1}
                        data-card-id={card.id}
                        className={`hand-card ${isSelected ? "selected" : ""} ${
                          handPlayableThisAction ? "playable" : "not-playable"
                        } ${cardDrag?.cardId === card.id ? "dragging" : ""} ${
                          tutorialRequiredCardId === card.id ? "tutorial-marked" : ""
                        }`}
                        style={{ ["--hand-index" as string]: handIndex }}
                        onPointerDown={(event) => {
                          if (!canSelectHandCards || event.button !== 0) {
                            return;
                          }
                          // Allow grabbing any playable card directly: no need to
                          // pre-select with a click. Selection happens on drag
                          // activation below, which unlocks the valid slots.
                          if (!handPlayableThisAction || pendingPlacement) {
                            return;
                          }
                          const target = event.currentTarget as HTMLDivElement;
                          const rect = target.getBoundingClientRect();
                          const startX = event.clientX;
                          const startY = event.clientY;
                          pendingDragRef.current = {
                            cardId: card.id,
                            src: encodeURI(card.imagePath),
                            size: rect.width,
                            startX,
                            startY
                          };
                          let activated = false;
                          const handleMove = (e: PointerEvent) => {
                            const pending = pendingDragRef.current;
                            if (!pending) return;
                            const x = e.clientX;
                            const y = e.clientY;
                            if (!activated) {
                              const dx = x - pending.startX;
                              const dy = y - pending.startY;
                              if (dx * dx + dy * dy < 36) return;
                              activated = true;
                              if (selectedHandCardId !== pending.cardId) {
                                setSelectedHandCardId(pending.cardId);
                                setSelectedCardRotation(0);
                              }
                            }
                            dragPointerRef.current = { x, y };
                            const nearest = computeNearestTarget(x, y);
                            setCardDrag({
                              cardId: pending.cardId,
                              src: pending.src,
                              size: pending.size,
                              x,
                              y,
                              target: nearest
                            });
                          };
                          const handleUp = () => {
                            document.removeEventListener("pointermove", handleMove);
                            document.removeEventListener("pointerup", handleUp);
                            document.removeEventListener("pointercancel", handleUp);
                            const pending = pendingDragRef.current;
                            pendingDragRef.current = null;
                            dragPointerRef.current = null;
                            if (!activated || !pending) {
                              setCardDrag(null);
                              return;
                            }
                            dragJustHandledRef.current = true;
                            setCardDrag((current) => {
                              if (current?.target) {
                                const t = current.target;
                                setPendingPlacement({
                                  position: { x: t.x, y: t.y },
                                  rotation: t.rotation
                                });
                              }
                              return null;
                            });
                          };
                          document.addEventListener("pointermove", handleMove);
                          document.addEventListener("pointerup", handleUp);
                          document.addEventListener("pointercancel", handleUp);
                        }}
                        onClick={() => {
                          if (dragJustHandledRef.current) {
                            dragJustHandledRef.current = false;
                            return;
                          }
                          if (!canSelectHandCards) {
                            return;
                          }
                          setSelectedHandCardId((current) => {
                            const next = current === card.id ? null : card.id;
                            if (next !== current) {
                              setSelectedCardRotation(0);
                            }
                            return next;
                          });
                        }}
                        onKeyDown={(event) => {
                          if (!canSelectHandCards) {
                            return;
                          }
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedHandCardId((current) => {
                              const next = current === card.id ? null : card.id;
                              if (next !== current) {
                                setSelectedCardRotation(0);
                              }
                              return next;
                            });
                          }
                        }}
                      >
                        <img
                          src={encodeURI(card.imagePath)}
                          alt={card.label}
                          style={isSelected ? { transform: `rotate(${selectedCardRotation}deg)` } : undefined}
                        />
                        {showRotate && (
                          <div className="card-rotate" onClick={(event) => event.stopPropagation()}>
                            <button
                              type="button"
                              title="Girar à esquerda (Q)"
                              aria-label="Girar à esquerda"
                              onClick={() => rotateSelectedCard(-1)}
                            >
                              <RotateCcw aria-hidden="true" />
                              <kbd>Q</kbd>
                            </button>
                            <span>{selectedCardRotation}°</span>
                            <button
                              type="button"
                              title="Girar à direita (E)"
                              aria-label="Girar à direita"
                              onClick={() => rotateSelectedCard(1)}
                            >
                              <RotateCw aria-hidden="true" />
                              <kbd>E</kbd>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state">
                  {currentGamePlayer.speciesId === "jaguar"
                    ? "Esta espécie não usa cartas de floresta na mão."
                    : "Sem cartas de floresta na mão."}
                </p>
              ))}
          </section>
        )}
      </section>

      <aside className={`right-panel hud-dock hud-right ${hudRightCollapsed ? "is-collapsed" : ""}`}>
        <section className="panel-block">
          <h2>Jogadores</h2>
          <div className="player-list" onScroll={() => setMovementPreview(null)}>
            {(() => {
              const players = room?.players ?? [];
              if (!room?.game) return players;
              const order =
                room.game.status === "setup" ? room.game.setupOrder : room.game.turnOrder;
              const indexBy = new Map(order.map((id, i) => [id, i]));
              return [...players].sort((a, b) => {
                const ai = indexBy.get(a.playerId);
                const bi = indexBy.get(b.playerId);
                if (ai === undefined && bi === undefined) return 0;
                if (ai === undefined) return 1;
                if (bi === undefined) return -1;
                return ai - bi;
              });
            })().map((player, displayIndex) => {
              const gamePlayer = room?.game?.players.find((candidate) => candidate.playerId === player.playerId);
              const species = player.speciesId ? speciesDefinitions[player.speciesId] : null;
              const isActivePlayer = player.playerId === room?.game?.activePlayerId || player.playerId === room?.game?.setupActivePlayerId;

              return (
              <div
                className={`player-row ${isActivePlayer ? "active" : ""}`}
                key={player.playerId}
                style={speciesVar(player.speciesId)}
              >
                <button
                  type="button"
                  className={`player-summary-head ${species ? "clickable" : ""}`}
                  disabled={!species}
                  title={species ? `Ver tabuleiro de ${species.displayName}` : undefined}
                  onClick={() => player.speciesId && setBoardSpecies(player.speciesId)}
                >
                  {room?.game && species ? (
                    <span
                      className={`turn-order-badge movement-guide ${
                        highlightedMovementGuideSpecies === player.speciesId ? "is-tutorial-highlight" : ""
                      }`}
                      aria-label={`Movimentos de ${species.displayName}`}
                      title={`Movimentos de ${species.displayName}`}
                      onMouseEnter={(event) => showMovementPreview(species.speciesId, event.currentTarget.getBoundingClientRect())}
                      onMouseLeave={() => setMovementPreview(null)}
                    >
                      <MapPin aria-hidden="true" />
                    </span>
                  ) : room?.game ? (
                    <span className="turn-order-badge" aria-hidden="true">{displayIndex + 1}</span>
                  ) : null}
                  {species && <img className="player-portrait" src={encodeURI(species.portraitAsset)} alt="" />}
                  <div>
                    <strong>{species?.displayName ?? "Sem espécie"}</strong>
                    {!player.isBot && player.name && player.name !== species?.displayName && (
                      <span>{player.name}</span>
                    )}
                  </div>
                  <small>{isActivePlayer ? "Vez" : player.isBot ? "Bot" : player.ready ? "Pronto" : "Aguardando"}</small>
                </button>
                {gamePlayer && (
                  <>
                    <div className="player-summary-stats">
                      <span className="stat-score">
                        <img src={encodeURI(resourceAssets.point)} alt="" />
                        <b><AnimatedNumber value={gamePlayer.score} /></b>
                      </span>
                      {species && (
                        <div
                          className="player-piece-track"
                          ref={(node) => setEffectTarget(`${gamePlayer.playerId}:reserve`, node)}
                          title={`${gamePlayer.reservePieces.length} na reserva · ${gamePlayer.piecesInForest.length} na floresta`}
                        >
                          {Array.from({ length: species.totalPieces }, (_, pieceIndex) => {
                            const isInForest = pieceIndex >= gamePlayer.reservePieces.length;
                            return (
                              <img
                                key={`${gamePlayer.playerId}_piece_track_${pieceIndex}`}
                                src={encodeURI(species.meepleAsset)}
                                alt=""
                                className={isInForest ? "is-in-forest" : "is-in-reserve"}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="player-summary-resources">
                      {resourceOrder.map((resource) => (
                        <span
                          className="mini-resource"
                          title={resourceLabels[resource]}
                          key={resource}
                          ref={(node) => setEffectTarget(`${gamePlayer.playerId}:${resource}`, node)}
                        >
                          <img src={encodeURI(resourceAssets[resource])} alt="" />
                          <b>{gamePlayer.resources[resource] ?? 0}</b>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              );
            })}
            {!room && <p className="empty-state">Crie ou entre em uma sala para ver jogadores.</p>}
          </div>
        </section>

      </aside>

      {movementPreview && typeof document !== "undefined" && createPortal(
        (() => {
          const species = speciesDefinitions[movementPreview.speciesId];
          return (
            <div
              className="movement-guide-floating"
              role="tooltip"
              style={
                {
                  ...speciesVar(movementPreview.speciesId),
                  left: movementPreview.left,
                  top: movementPreview.top
                } as CSSProperties
              }
            >
              <strong>{species.displayName}</strong>
              <img src={encodeURI(species.movementAsset)} alt={`Movimentos de ${species.displayName}`} />
            </div>
          );
        })(),
        document.body
      )}

      {shouldShowJaguarScoreModal && showJaguarScoreModal && (
          <div className="choice-modal-backdrop" role="presentation">
            <div
              className="choice-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Onça-pintada — gastar carne"
              style={speciesVar("jaguar")}
            >
              <header className="choice-modal-head">
                <img src={encodeURI(speciesDefinitions.jaguar.meepleAsset)} alt="" />
                <div>
                  <span>Onça-pintada · Ação C</span>
                  <h2>Gastar carne para pontuar</h2>
                </div>
              </header>
              <p className="choice-modal-desc">
                Gaste 1 carne para marcar 1 ponto, até 3 vezes. Carnes disponíveis: {availableJaguarPointSpendCount}.
              </p>
              <div className="choice-count-grid">
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    className="choice-count-option"
                    disabled={count > availableJaguarPointSpendCount}
                    onClick={() => handleSpendJaguarMeat(count)}
                  >
                    <img src={encodeURI(resourceAssets.meat)} alt="" />
                    <strong>Gastar {count}</strong>
                    <span>+{count} ponto(s)</span>
                  </button>
                ))}
              </div>
              <div className="choice-modal-actions">
                <button className="secondary-button" disabled={tutorialActive} onClick={handleCompleteAction}>
                  Concluir sem gastar
                </button>
              </div>
            </div>
          </div>
        )}

      {room?.game?.status === "finished" && room.game.finalScoreBreakdown && (() => {
        const breakdown = room.game.finalScoreBreakdown;
        const winnerIds = room.game.winnerPlayerIds;
        const ranked = [...breakdown.entries].sort(
          (a, b) =>
            b.totalScore - a.totalScore ||
            b.remainingResources - a.remainingResources ||
            b.populationValue - a.populationValue
        );
        const top = ranked.slice(0, 3).map((entry, index) => ({ entry, rank: index + 1 }));
        // Visual order so 1st sits in the middle, taller.
        const podiumOrder =
          top.length === 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top;
        const winnerText =
          winnerIds.length === 0
            ? "Sem vencedor"
            : winnerIds.length === 1
              ? `${ranked.find((e) => e.playerId === winnerIds[0])?.name ?? "Jogador"} venceu!`
              : `Empate: ${ranked
                  .filter((e) => winnerIds.includes(e.playerId))
                  .map((e) => e.name)
                  .join(", ")}`;

        return (
          <div className="choice-modal-backdrop endgame-backdrop" role="presentation">
            {winnerIds.length > 0 && (
              <div className="endgame-confetti" aria-hidden="true">
                {endgameConfetti.map((piece, i) => (
                  <span key={i} className="confetti-piece" style={piece} />
                ))}
              </div>
            )}
            <div className="endgame-modal" role="dialog" aria-modal="true" aria-label="Fim de jogo">
              <header className="endgame-head">
                <span className="endgame-eyebrow">
                  <Trophy aria-hidden="true" /> Fim de jogo
                </span>
                <h2 className="endgame-title">{winnerText}</h2>
              </header>

              <div className={`endgame-podium count-${podiumOrder.length}`}>
                {podiumOrder.map(({ entry, rank }) => {
                  const species = entry.speciesId ? speciesDefinitions[entry.speciesId] : null;
                  return (
                    <div
                      key={entry.playerId}
                      className={`podium-slot rank-${rank}`}
                      style={speciesVar(entry.speciesId)}
                    >
                      <div className="podium-figure">
                        {rank === 1 && <Crown className="podium-crown" aria-hidden="true" />}
                        <div className="podium-portrait">
                          {species ? (
                            <img src={encodeURI(species.portraitAsset)} alt="" />
                          ) : (
                            <Users aria-hidden="true" />
                          )}
                        </div>
                        <strong className="podium-name">{entry.name}</strong>
                        {species && <small className="podium-species">{species.displayName}</small>}
                        <div className="podium-score">
                          <AnimatedNumber value={entry.totalScore} />
                          <span>pts</span>
                        </div>
                      </div>
                      <div className="podium-stand">
                        <span>{rank}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <details className="endgame-details">
                <summary>Ver detalhamento de pontos</summary>
                <p className="endgame-note">
                  Total = pontos da partida + maioria de carne/ovo/fruta (+1 cada, gasta o recurso) + 1 ponto por 2
                  sementes. Limite {breakdown.pointCap} pts. Desempate: recursos restantes, depois maior população.
                </p>
                <table className="final-score-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Jogador</th>
                      <th>Partida</th>
                      <th>Maioria</th>
                      <th>Sementes</th>
                      <th>Total</th>
                      <th>Recursos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((entry, index) => (
                      <tr
                        key={entry.playerId}
                        className={winnerIds.includes(entry.playerId) ? "winner" : ""}
                        style={speciesVar(entry.speciesId)}
                      >
                        <td>{index + 1}</td>
                        <td>
                          <strong>{entry.name}</strong>
                          {entry.speciesId && <small> · {speciesDefinitions[entry.speciesId].displayName}</small>}
                        </td>
                        <td>{entry.baseScore}</td>
                        <td>+{entry.resourceMajorityPoints}</td>
                        <td>+{entry.seedPoints}</td>
                        <td>
                          <strong>{entry.totalScore}</strong>
                        </td>
                        <td>{entry.remainingResources}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>

              <div className="endgame-actions">
                {isLocalRoom ? (
                  <>
                    <button className="primary-button" onClick={playAgainLocal}>
                      <Play aria-hidden="true" />
                      Jogar de novo
                    </button>
                    <button className="secondary-button" onClick={leaveTable}>
                      <LogOut aria-hidden="true" />
                      Sair
                    </button>
                  </>
                ) : (
                  <button className="primary-button" onClick={leaveTable}>
                    <LogOut aria-hidden="true" />
                    Voltar ao lobby
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {hasStartedGame &&
        !hasPendingCoatiPairBonus &&
        room?.game?.status === "active" &&
        activeGamePlayer &&
        activeSpecies?.speciesId === "maned_wolf" &&
        activeActionId === "C" &&
        canControlActivePlayer &&
        (!tutorialActive || tutorialId !== "wolf" || tutorialGate === "score") && (
          <div className="choice-modal-backdrop" role="presentation">
            <div
              className="choice-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Lobo-guará — gastar recursos"
              style={speciesVar("maned_wolf")}
            >
              <header className="choice-modal-head">
                <img src={encodeURI(speciesDefinitions.maned_wolf.meepleAsset)} alt="" />
                <div>
                  <span>Lobo-guará · Ação C</span>
                  <h2>Gastar recursos para pontuar</h2>
                </div>
              </header>
              <p className="choice-modal-desc">
                Para cada lobo na floresta, gaste 1 recurso diferente e marque 1 ponto. Limite: 1 por lobo em campo.
              </p>
              <div className="wolf-spend-summary">
                <div>
                  <span>Seleção</span>
                  <strong>
                    {selectedWolfResources.length}/{availableWolfPointSpendCount}
                  </strong>
                </div>
                <div>
                  <span>Ganho</span>
                  <strong>{selectedWolfResources.length} ponto(s)</strong>
                </div>
              </div>
              <div className="wolf-resource-grid">
                {resourceOrder.map((resource) => (
                  <button
                    className={`wolf-resource-option ${selectedWolfResources.includes(resource) ? "selected" : ""}`}
                    disabled={!wolfSpendableResources.includes(resource)}
                    key={resource}
                    onClick={() =>
                      setSelectedWolfResources((current) =>
                        current.includes(resource)
                          ? current.filter((candidate) => candidate !== resource)
                          : current.length < availableWolfPointSpendCount
                            ? [...current, resource]
                            : current
                      )
                    }
                  >
                    <img src={resourceAssets[resource]} alt="" />
                    <span>{resourceLabels[resource]}</span>
                    <strong>{activeGamePlayer.resources[resource] ?? 0}</strong>
                  </button>
                ))}
              </div>
              <div className="choice-modal-actions">
                <button
                  className="primary-button"
                  disabled={selectedWolfResources.length === 0}
                  onClick={handleSpendWolfResources}
                >
                  <Check aria-hidden="true" />
                  Gastar selecionados
                </button>
                <button className="secondary-button" disabled={tutorialActive} onClick={handleCompleteAction}>
                  Concluir sem gastar
                </button>
              </div>
            </div>
          </div>
        )}

      {turnSummary && room?.game?.status === "active" && (
        <aside
          className={`turn-recap ${recapCollapsed ? "is-collapsed" : ""}`}
          role="status"
          aria-live="polite"
          aria-label="Resumo do turno anterior"
          style={speciesVar(turnSummary.speciesId)}
        >
          <header className="turn-recap-head">
            {turnSummary.speciesId && (
              <img src={encodeURI(speciesDefinitions[turnSummary.speciesId].meepleAsset)} alt="" />
            )}
            <div className="turn-recap-title">
              <span>Turno anterior</span>
              <h3>{turnSummary.playerName}</h3>
            </div>
            <div className="turn-recap-history" aria-label="Historico de turnos">
              <button
                type="button"
                className="turn-recap-history-btn"
                onClick={() => moveTurnRecapHistory(-1)}
                disabled={turnRecap.index <= 0}
                aria-label="Ver turno mais antigo"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <span>{turnRecap.index + 1}/{turnRecap.history.length}</span>
              <button
                type="button"
                className="turn-recap-history-btn"
                onClick={() => moveTurnRecapHistory(1)}
                disabled={turnRecap.index >= turnRecap.history.length - 1}
                aria-label="Ver turno mais recente"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
            <div className="turn-recap-score" title="Pontos no turno">
              <span>+{turnSummary.scoreDelta}</span>
              <small>pts</small>
            </div>
            <button
              type="button"
              className="turn-recap-toggle"
              onClick={() => setRecapCollapsed((value) => !value)}
              aria-label={recapCollapsed ? "Expandir resumo" : "Recolher resumo"}
              aria-expanded={!recapCollapsed}
            >
              {recapCollapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="turn-recap-close"
              onClick={closeTurnRecap}
              aria-label="Fechar resumo"
            >
              <X aria-hidden="true" />
            </button>
          </header>
          {!recapCollapsed && (
            <ul className="turn-recap-list">
              {turnSummary.entries.map((entry) => (
                <li
                  key={`${turnSummary.key}_${entry.id}`}
                  className={`turn-recap-item ${entry.cardInstanceIds.length > 0 ? "is-hoverable" : ""}`}
                  onMouseEnter={() => entry.cardInstanceIds.length > 0 && setHoveredSummaryCardIds(entry.cardInstanceIds)}
                  onMouseLeave={() => setHoveredSummaryCardIds([])}
                  onFocus={() => entry.cardInstanceIds.length > 0 && setHoveredSummaryCardIds(entry.cardInstanceIds)}
                  onBlur={() => setHoveredSummaryCardIds([])}
                  tabIndex={entry.cardInstanceIds.length > 0 ? 0 : -1}
                >
                  <span className={`turn-recap-icon turn-recap-icon-${entry.icon}`} aria-hidden="true" />
                  <span className="turn-recap-text">{entry.text}</span>
                  {typeof entry.points === "number" && entry.points > 0 && (
                    <span className="turn-recap-points">+{entry.points}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      {boardSpecies && (
        <div
          className="board-modal-backdrop"
          role="presentation"
          onClick={() => setBoardSpecies(null)}
        >
          <div
            className="board-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Tabuleiro de ${speciesDefinitions[boardSpecies].displayName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="board-modal-head">
              <img src={encodeURI(speciesDefinitions[boardSpecies].meepleAsset)} alt="" />
              <div>
                <h2>{speciesDefinitions[boardSpecies].displayName}</h2>
                <span>{speciesDefinitions[boardSpecies].scientificName}</span>
              </div>
              <button
                type="button"
                className="board-modal-close"
                aria-label="Fechar"
                onClick={() => setBoardSpecies(null)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="board-modal-body">
              <img
                src={encodeURI(speciesDefinitions[boardSpecies].boardAsset)}
                alt={`Tabuleiro de ${speciesDefinitions[boardSpecies].displayName}`}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
