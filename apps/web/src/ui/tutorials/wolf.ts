import { createInitialGameState } from "@oikos/rules";
import type { ForestCardState, PublicRoomState, RoomPlayer } from "@oikos/shared";
import { localRoomId } from "../gameConstants";
import { placeTutorialPiece } from "./helpers";
import type { TutorialStepDef } from "./types";

export const WOLF_TUTORIAL_PLAYER_ID = "local_wolf";
const WOLF_TUTORIAL_CAPUCHIN_ID = "local_wolf_capuchin";
const WOLF_TUTORIAL_CARD = "campo_1_copy";
const WOLF_TUTORIAL_FIRST_PIECE_ID = `${WOLF_TUTORIAL_PLAYER_ID}_piece_1`;
const WOLF_TUTORIAL_SECOND_PIECE_ID = `${WOLF_TUTORIAL_PLAYER_ID}_piece_2`;
const WOLF_TUTORIAL_BASE_TARGET_ID = `${WOLF_TUTORIAL_CAPUCHIN_ID}_piece_1`;

const WOLF_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "wolf_tut_0", definitionId: "bosque_1", x: -1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_1", definitionId: "bosque_3", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_2", definitionId: "bosque_2", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_3", definitionId: "campo_1", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_4", definitionId: "campo_3", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_5", definitionId: "campo_4", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_6", definitionId: "campo_2", x: -1, y: 1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_7", definitionId: "bosque_3_copy", x: 0, y: 1, rotation: 0, isInitial: true },
  { instanceId: "wolf_tut_8", definitionId: "bosque_4", x: 1, y: 1, rotation: 0, isInitial: true }
];

export const WOLF_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Lobo-guará",
    body: "O Lobo-guará é um subpredador com 3 peças. Ele começa com 2 lobos, usa cartas para mover a alcateia, remove apenas espécies de base e transforma recursos diferentes em pontos. Vamos jogar um turno completo com as quatro ações.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "O plano do turno",
    body: "Na ação A, os dois lobos vão coletar fruta e ovo. Na B, um deles remove um Macaco-prego e coleta mais fruta. Na C, você gasta dois tipos de recurso para fazer 2 pontos, o máximo com 2 lobos. Na D, adiciona o terceiro lobo para poder fazer até 3 pontos em turnos futuros.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [
      { resource: "fruit", caption: "Primeiro recurso para pontuar" },
      { resource: "egg", caption: "Segundo recurso para pontuar" },
      { resource: "point", caption: "2 lobos permitem até 2 pontos" }
    ]
  },
  {
    title: "Ação A: expanda a floresta",
    body: "Jogue a carta de campo destacada no espaço marcado. O habitat da carta jogada define o movimento de todos os lobos nesta ação. Para o Lobo-guará, campo significa mover 1 local adjacente.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: WOLF_TUTORIAL_CARD,
    markedSlot: { x: 0, y: 2 },
    highlightMovementGuideSpecies: "maned_wolf"
  },
  {
    title: "Ação A: mova o primeiro lobo",
    body: "Todos os lobos que possuem movimento válido devem se mover. Selecione o lobo destacado e leve-o ao local de fruta. O Macaco-prego pode compartilhar o local por enquanto; a remoção acontece somente na ação B.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: WOLF_TUTORIAL_FIRST_PIECE_ID,
    markedMoveTarget: { x: -1, y: -1 },
    highlightMovementGuideSpecies: "maned_wolf"
  },
  {
    title: "Ação A: mova o segundo lobo",
    body: "Agora selecione o outro lobo destacado e mova-o ao local de ovo. Quando todos os lobos possíveis terminam o movimento, a ação A acaba automaticamente.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: WOLF_TUTORIAL_SECOND_PIECE_ID,
    markedMoveTarget: { x: 1, y: -1 },
    completeWhenActionIndex: 1,
    highlightMovementGuideSpecies: "maned_wolf"
  },
  {
    title: "Ação B: remova uma espécie de base",
    body: "O Lobo-guará remove 1 peça de espécie de base que esteja no mesmo local de algum lobo. Clique no Macaco-prego destacado e confirme em Remover peça. O Lobo-guará e o dono da peça removida coletam o recurso daquele local.",
    gate: "removeBase",
    autoAdvance: true,
    markedPieceId: WOLF_TUTORIAL_BASE_TARGET_ID,
    completeWhenActionIndex: 2
  },
  {
    title: "Ação C: recursos viram pontos",
    body: "Você tem 2 lobos na floresta, então pode gastar até 2 recursos de tipos diferentes. Selecione fruta e ovo na janela central e confirme. Isso marca 2 pontos, o máximo possível neste turno.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 2,
    requiredSpendCount: 2
  },
  {
    title: "Dois pontos garantidos",
    body: "A alcateia converteu fruta e ovo em 2 pontos. A quantidade de lobos na floresta limita quantos recursos diferentes podem ser gastos: 2 lobos, até 2 pontos; 3 lobos, até 3 pontos.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [
      { resource: "fruit", caption: "1 fruta gasta" },
      { resource: "egg", caption: "1 ovo gasto" },
      { resource: "point", caption: "2 pontos marcados" }
    ]
  },
  {
    title: "Ação D: complete a alcateia",
    body: "Adicione o último lobo da reserva no local de carne destacado. No próximo turno, três lobos e três recursos diferentes permitem marcar o teto de 3 pontos na ação C.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: -1, y: 1 },
    completeWhenRoundAtLeast: 3
  },
  {
    title: "Turno do Lobo-guará completo!",
    body: "Você expandiu a floresta, moveu toda a alcateia, removeu uma espécie de base, marcou 2 pontos e adicionou o terceiro lobo. O ciclo ideal é espalhar os lobos para coletar recursos diferentes e manter os três em campo para buscar 3 pontos por turno.",
    gate: "none",
    autoAdvance: false
  }
];

// --- Tatu-bola (armadillo) chapter -----------------------------------------
// A scripted full turn on a larger forest against four rival species. The
// armadillo reaches all four pieces, scores the maximum three points, then the
// player controls the Jaguar in a short attack demonstration. The Jaguar
// removes a visible Macaw but cannot remove the hidden armadillo beside it.

export function createWolfTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: WOLF_TUTORIAL_PLAYER_ID,
      name: "Tutorial Lobo-guará",
      speciesId: "maned_wolf",
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
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, WOLF_TUTORIAL_FOREST, {
    enabledMiniExpansions: []
  });

  for (const player of game.players) {
    player.score = 0;
    player.turnsTaken = player.playerId === WOLF_TUTORIAL_PLAYER_ID ? 1 : 0;
    player.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
  }

  const wolf = game.players.find((player) => player.playerId === WOLF_TUTORIAL_PLAYER_ID);
  if (wolf) {
    wolf.hand = [WOLF_TUTORIAL_CARD];
  }

  placeTutorialPiece(game, WOLF_TUTORIAL_PLAYER_ID, 1, { x: -1, y: 0 });
  placeTutorialPiece(game, WOLF_TUTORIAL_PLAYER_ID, 2, { x: 1, y: 0 });
  placeTutorialPiece(game, WOLF_TUTORIAL_CAPUCHIN_ID, 1, { x: -1, y: -1 });
  placeTutorialPiece(game, WOLF_TUTORIAL_CAPUCHIN_ID, 2, { x: 0, y: 0 });
  placeTutorialPiece(game, WOLF_TUTORIAL_CAPUCHIN_ID, 3, { x: 1, y: 1 });

  game.status = "active";
  game.round = 2;
  game.activePlayerId = WOLF_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.setupOrder = [];
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
    enabledMiniExpansions: game.enabledMiniExpansions,
    game,
    warnings: game.contentWarnings
  };
}
