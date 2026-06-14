import { createInitialGameState } from "@oikos/rules";
import type { ForestCardState, PublicRoomState, RoomPlayer } from "@oikos/shared";
import { localRoomId } from "../gameConstants";
import { placeTutorialPiece } from "./helpers";
import type { TutorialStepDef } from "./types";

export const CAPUCHIN_TUTORIAL_PLAYER_ID = "local_capuchin";
const CAPUCHIN_TUTORIAL_CARD = "campo_2_copy";
const CAPUCHIN_TUTORIAL_MOVING_PIECE_ID = `${CAPUCHIN_TUTORIAL_PLAYER_ID}_piece_1`;

const CAPUCHIN_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "cap_tut_0", definitionId: "initial_5", x: -1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_1", definitionId: "initial_2", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_2", definitionId: "initial_3", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_3", definitionId: "initial_4", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_4", definitionId: "initial_6", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_5", definitionId: "initial_7", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "cap_tut_6", definitionId: "initial_9", x: -1, y: 1, rotation: 90, isInitial: true },
  { instanceId: "cap_tut_7", definitionId: "initial_1", x: 0, y: 1, rotation: 90, isInitial: true },
  { instanceId: "cap_tut_8", definitionId: "initial_8_v", x: 1, y: 1, rotation: 270, isInitial: true }
];

export const CAPUCHIN_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Macaco-prego",
    body: "O Macaco-prego é uma espécie de base com 7 peças. Ele pontua pela variedade de habitats ocupados: bosque, campo e rio. Cada tipo vale 1 ponto quando há macacos em pelo menos 2 cartas diferentes daquele habitat.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "Até 3 habitats podem pontuar por turno" }]
  },
  {
    title: "Cartas diferentes importam",
    body: "Dois macacos na mesma carta formam uma pilha, mas ocupam apenas 1 carta. Para pontuar um habitat, espalhe macacos por 2 ou mais cartas daquele tipo. Pilhas são úteis para colocar mais peças na floresta, porém não substituem a expansão territorial.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "O plano para 3 pontos",
    body: "Você começa com macacos em 3 bosques, 1 campo e 1 rio. Na ação A, criará o segundo campo. Na B, moverá o macaco excedente de um bosque para um segundo rio. Na C, colocará a última peça em uma pilha. Resultado: 2 bosques, 2 campos e 2 rios ocupados.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "Bosque + campo + rio = 3 pontos" }]
  },
  {
    title: "Ação A: crie o segundo campo",
    body: "Jogue a carta de campo destacada no espaço marcado. O habitat da carta jogada também define o movimento da ação B. Para o Macaco-prego, uma carta de campo permite o salto em L mostrado no guia.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: CAPUCHIN_TUTORIAL_CARD,
    markedSlot: { x: 2, y: 0 },
    highlightMovementGuideSpecies: "capuchin"
  },
  {
    title: "Ação A: ocupe a carta jogada",
    body: "A ação A permite adicionar 1 macaco diretamente na carta recém-jogada. Coloque a sexta peça no novo campo. Agora existem macacos em 2 cartas de campo diferentes, garantindo 1 ponto nesse habitat.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: 2, y: 0 },
    completeWhenActionIndex: 1
  },
  {
    title: "Ação B: troque excesso por variedade",
    body: "Há 3 bosques ocupados, mas apenas 2 são necessários para pontuar. Mova o macaco destacado para o rio vazio. O salto em L é permitido pela carta de campo jogada. No destino, ele também coleta a semente da carta.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: CAPUCHIN_TUTORIAL_MOVING_PIECE_ID,
    markedMoveTarget: { x: 1, y: 1 },
    completeWhenActionIndex: 2,
    highlightMovementGuideSpecies: "capuchin"
  },
  {
    title: "Três habitats preparados",
    body: "O movimento manteve 2 bosques ocupados e criou o segundo rio ocupado. Somando os 2 campos, os três tipos de habitat já estão prontos para pontuar. Essa é a ideia central do Macaco-prego: mover peças excedentes para completar habitats incompletos.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "seed", caption: "Movimentos coletam o recurso do destino" }]
  },
  {
    title: "Ação C: forme uma pilha",
    body: "A ação C adiciona 1 macaco em qualquer local que já tenha outro macaco. Coloque a sétima peça junto do macaco que acabou de chegar ao rio. A pilha aumenta sua presença, mas continuará contando como somente 1 carta de rio.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: 1, y: 1 },
    completeWhenActionIndex: 3
  },
  {
    title: "Conte cartas, não peças",
    body: "No rio há 3 macacos, porém eles ocupam 2 cartas: uma peça no rio central e duas empilhadas no rio da direita. Isso basta para 1 ponto. A mesma contagem encontra 2 cartas de bosque e 2 de campo.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "2 cartas por habitat, mesmo com uma pilha" }]
  },
  {
    title: "Ação D: marque 3 pontos",
    body: "A pontuação verifica cada habitat separadamente. Bosque, campo e rio possuem macacos em pelo menos 2 cartas diferentes, então cada tipo vale 1 ponto. Aguarde os seis locais serem destacados e a pontuação automática.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 3
  },
  {
    title: "Tutorial do Macaco-prego completo!",
    body: "Você usou as 7 peças, expandiu para criar um par de campos, moveu um macaco excedente para completar os rios, formou uma pilha e marcou o máximo de 3 pontos por habitats. Priorize completar pares de cartas antes de concentrar muitos macacos no mesmo local.",
    gate: "none",
    autoAdvance: false
  }
];

// --- Quati (coati) chapter --------------------------------------------------
// Four coatis begin as a chain of singletons, leaving four in reserve. Action A
// forms the first exact pair, then three passive additions cascade through the
// chain for 3 points. Action B demonstrates the forest-card straight jump. With
// an empty reserve, action C removes two coatis and restores the reserve.

export function createCapuchinTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: CAPUCHIN_TUTORIAL_PLAYER_ID,
      name: "Tutorial Macaco-prego",
      speciesId: "capuchin",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, CAPUCHIN_TUTORIAL_FOREST, {
    enabledMiniExpansions: []
  });

  const capuchin = game.players.find((player) => player.playerId === CAPUCHIN_TUTORIAL_PLAYER_ID);
  if (capuchin) {
    capuchin.score = 0;
    capuchin.turnsTaken = 1;
    capuchin.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
    capuchin.hand = [CAPUCHIN_TUTORIAL_CARD];
  }

  placeTutorialPiece(game, CAPUCHIN_TUTORIAL_PLAYER_ID, 1, { x: -1, y: 0 });
  placeTutorialPiece(game, CAPUCHIN_TUTORIAL_PLAYER_ID, 2, { x: 0, y: -1 });
  placeTutorialPiece(game, CAPUCHIN_TUTORIAL_PLAYER_ID, 3, { x: 1, y: -1 });
  placeTutorialPiece(game, CAPUCHIN_TUTORIAL_PLAYER_ID, 4, { x: 0, y: 0 });
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
  game.setupOrder = [];
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
    enabledMiniExpansions: game.enabledMiniExpansions,
    game,
    warnings: game.contentWarnings
  };
}
