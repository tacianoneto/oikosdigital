import { createInitialGameState } from "@oikos/rules";
import type { ForestCardState, PublicRoomState, RoomPlayer } from "@oikos/shared";
import { localRoomId } from "../gameConstants";
import { placeTutorialPiece } from "./helpers";
import type { TutorialStepDef } from "./types";

export const COATI_TUTORIAL_PLAYER_ID = "local_coati";
const COATI_TUTORIAL_CARD = "bosque_1_copy";
const COATI_TUTORIAL_MOVING_PIECE_ID = `${COATI_TUTORIAL_PLAYER_ID}_piece_2`;

const COATI_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "coa_tut_0", definitionId: "initial_5", x: -1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "coa_tut_1", definitionId: "initial_2", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "coa_tut_2", definitionId: "initial_3", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "coa_tut_3", definitionId: "initial_4", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "coa_tut_4", definitionId: "initial_6", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "coa_tut_5", definitionId: "initial_7", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "coa_tut_6", definitionId: "initial_9", x: -1, y: 1, rotation: 90, isInitial: true },
  { instanceId: "coa_tut_7", definitionId: "initial_1", x: 0, y: 1, rotation: 90, isInitial: true },
  { instanceId: "coa_tut_8", definitionId: "initial_8_v", x: 1, y: 1, rotation: 270, isInitial: true }
];

export const COATI_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Quati",
    body: "O Quati é uma espécie de base com 8 peças. Ele ocupa a floresta rapidamente, adiciona peças em locais de fruta e usa duplas exatas para adicionar novos quatis. Cada quati adicionado por essa passiva marca 1 ponto. Neste tutorial, você fará 3 pontos.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [
      { resource: "fruit", caption: "A ação A adiciona em locais de fruta" },
      { resource: "point", caption: "Quati adicionado pela passiva: 1 ponto" }
    ]
  },
  {
    title: "A passiva da dupla",
    body: "Quando um quati entra em um local e forma uma dupla exata de 2, você pode adicionar 1 quati da reserva em um local adjacente. Essa nova peça adicionada marca 1 ponto. Sem quati na reserva, a passiva não é ativada e nenhum ponto é marcado. Três ou mais quatis juntos também não ativam a passiva.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "O plano para 3 pontos",
    body: "Você começa com 4 quatis na floresta e 4 na reserva. Na ação A, formará uma dupla. O quati adicionado pela passiva formará outra dupla, repetindo o efeito até você adicionar 3 quatis e marcar 3 pontos. Depois, fará um salto reto na ação B e recuperará 2 peças na ação C.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "3 quatis adicionados pela passiva: 3 pontos" }]
  },
  {
    title: "Ação A: expanda a floresta",
    body: "Jogue a carta de bosque destacada no espaço marcado. O habitat da carta jogada também define o movimento da ação B. Para o Quati, bosque significa saltar 2 locais em linha reta.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: COATI_TUTORIAL_CARD,
    markedSlot: { x: 2, y: 0 },
    highlightMovementGuideSpecies: "coati"
  },
  {
    title: "Ação A: forme uma dupla",
    body: "Agora adicione 1 quati no local de fruta destacado. Já existe 1 quati ali, então a chegada do segundo forma uma dupla exata. Como ainda há quatis na reserva, a passiva será ativada.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: -1, y: -1 },
    completeWhenCoatiPairPending: true
  },
  {
    title: "Primeiro quati da passiva",
    body: "A dupla ativou a passiva. Coloque 1 quati da reserva no local adjacente destacado. Essa adição marca o primeiro ponto e forma uma nova dupla, ativando a passiva novamente.",
    gate: "resolvePair",
    autoAdvance: true,
    markedPairTarget: { x: 0, y: -1 },
    completeWhenScoreAtLeast: 1
  },
  {
    title: "Segundo quati da passiva",
    body: "Você marcou 1 ponto e a nova dupla manteve a passiva ativa. Adicione outro quati da reserva no próximo local destacado. Essa segunda adição marca o segundo ponto e forma a terceira dupla.",
    gate: "resolvePair",
    autoAdvance: true,
    markedPairTarget: { x: 1, y: -1 },
    completeWhenScoreAtLeast: 2
  },
  {
    title: "Terceiro quati da passiva",
    body: "Adicione o último quati da reserva no local destacado. Essa terceira adição marca o terceiro ponto. Como a reserva ficará vazia, nenhuma nova passiva poderá ser ativada.",
    gate: "resolvePair",
    autoAdvance: true,
    markedPairTarget: { x: 1, y: 0 },
    completeWhenScoreAtLeast: 3
  },
  {
    title: "Três pontos marcados",
    body: "Você adicionou 3 quatis pela passiva e marcou 3 pontos. As duplas foram os gatilhos; cada ponto veio de uma nova peça adicionada da reserva. Agora todos os 8 quatis estão na floresta.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "3 adições da passiva: 3 pontos" }]
  },
  {
    title: "Ação B: salto reto",
    body: "Selecione o quati destacado e mova-o para o local marcado. Como você jogou bosque, ele salta 2 locais em linha reta. Ao chegar, coleta a carne impressa no destino.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: COATI_TUTORIAL_MOVING_PIECE_ID,
    markedMoveTarget: { x: 1, y: 0 },
    completeWhenActionIndex: 2,
    highlightMovementGuideSpecies: "coati"
  },
  {
    title: "Reserva vazia",
    body: "Depois das três adições da passiva, não restou nenhum quati na reserva. A ação C verifica a reserva: com menos de 2 peças, você deve retirar exatamente 2 quatis da floresta.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação C: retire 2 quatis",
    body: "Selecione quaisquer 2 quatis seus na floresta e confirme a retirada. Eles voltam para a reserva, que ficará com 2 peças. Planeje as duplas para pontuar sem deixar a reserva vazia por muito tempo.",
    gate: "removeCoati",
    autoAdvance: true,
    completeWhenRoundAtLeast: 3
  },
  {
    title: "Tutorial do Quati completo!",
    body: "Você expandiu a floresta, adicionou em fruta e encadeou três ativações da passiva para adicionar 3 quatis e marcar 3 pontos. Depois, moveu conforme a carta e recuperou 2 peças na ação C. Sem peça na reserva, uma dupla não gera adição nem ponto.",
    gate: "none",
    autoAdvance: false
  }
];

export function createCoatiTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: COATI_TUTORIAL_PLAYER_ID,
      name: "Tutorial Quati",
      speciesId: "coati",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, COATI_TUTORIAL_FOREST, {
    enabledMiniExpansions: []
  });

  const coati = game.players.find((player) => player.playerId === COATI_TUTORIAL_PLAYER_ID);
  if (coati) {
    coati.score = 0;
    coati.turnsTaken = 1;
    coati.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
    coati.hand = [COATI_TUTORIAL_CARD];
  }

  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 1, { x: -1, y: -1 });
  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 2, { x: -1, y: 0 });
  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 3, { x: 0, y: -1 });
  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 4, { x: 1, y: -1 });

  game.status = "active";
  game.round = 2;
  game.activePlayerId = COATI_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.setupOrder = [];
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
    enabledMiniExpansions: game.enabledMiniExpansions,
    game,
    warnings: game.contentWarnings
  };
}
