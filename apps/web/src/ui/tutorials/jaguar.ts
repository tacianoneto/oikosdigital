import { createInitialGameState } from "@oikos/rules";
import type { ForestCardState, PublicRoomState, RoomPlayer } from "@oikos/shared";
import { localRoomId } from "../gameConstants";
import { placeTutorialPiece } from "./helpers";
import type { TutorialStepDef } from "./types";

export const JAGUAR_TUTORIAL_PLAYER_ID = "local_jaguar";
const JAGUAR_TUTORIAL_COATI_ID = "local_jaguar_coati";
const JAGUAR_TUTORIAL_CAPUCHIN_ID = "local_jaguar_capuchin";

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

export const JAGUAR_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Onça-pintada",
    body: "Hora de jogar de Onça-pintada, o predador. Ela tem 1 só peça, não usa cartas e pontua caçando: cada vez que remove uma peça da floresta, ganha 1 carne. Importante: a Onça só captura peças à vista; as escondidas escapam. Vamos fazer um turno valendo o máximo de pontos.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "O cenário",
    body: "A partida já está no segundo turno: a floresta está montada e há um Quati e um Macaco-prego ao alcance. Seu plano: caçar nas ações A e B para juntar 3 carnes e gastar tudo na ação C, fazendo 3 pontos.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação A: mover adjacente",
    body: "Na ação A, a Onça move 1 casa adjacente. Clique na Onça e depois no local destacado, onde há uma peça de outra espécie. Ao entrar ali, ela remove a peça e ganha 1 carne.",
    gate: "move",
    autoAdvance: true,
    markedMoveTarget: { x: 0, y: 0 },
    completeWhenActionIndex: 1
  },
  {
    title: "Primeira caça",
    body: "A peça caçada voltou para a reserva do dono e a Onça ganhou 1 carne pela passiva. Repare que ela também ocupa agora o local onde terminou o movimento.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação B: mover pelo habitat",
    body: "Na ação B, a Onça se move conforme o habitat onde está. Ela está no campo, então o movimento é na diagonal (veja o guia de movimentos no HUD). Mova para o local destacado: ele tem carne e outra peça para caçar.",
    gate: "move",
    autoAdvance: true,
    markedMoveTarget: { x: 1, y: 1 },
    completeWhenActionIndex: 2,
    highlightMovementGuideSpecies: "jaguar"
  },
  {
    title: "Mais duas carnes",
    body: "Neste movimento a Onça caçou outra peça (+1 carne pela passiva) e ainda coletou a carne do local de destino (+1 carne). Somando com a primeira caça, agora você tem 3 carnes.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação C: gastar carne por pontos",
    body: "Na ação C, a Onça gasta de 1 a 3 carnes para marcar a mesma quantidade de pontos. Gaste as 3 carnes para marcar 3 pontos, o máximo do turno.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 3,
    requiredSpendCount: 3
  },
  {
    title: "Turno da Onça completo!",
    body: "Você fez 3 pontos em um turno: A caçou adjacente, B moveu pelo habitat caçando e coletando carne, e C trocou 3 carnes por 3 pontos. Esse é o ciclo da Onça: caçar para acumular carne e gastar carne por pontos.",
    gate: "none",
    autoAdvance: false
  }
];

// --- Lobo-guará (maned wolf) chapter ---------------------------------------
// A scripted full turn with the two starting wolves. A field card makes both
// wolves move adjacently: one reaches fruit and shares the location with a base
// species, while the other reaches egg. Action B removes the base piece and
// grants the local resource to both players. Action C then spends two different
// resources for the maximum two points available with two wolves. Action D adds
// the third wolf, preparing the three-point ceiling for later turns.

export function createJaguarTutorialRoom(): PublicRoomState {
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
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, JAGUAR_TUTORIAL_FOREST, {
    enabledMiniExpansions: []
  });

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
  game.setupOrder = [];
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
    enabledMiniExpansions: game.enabledMiniExpansions,
    game,
    warnings: game.contentWarnings
  };
}
