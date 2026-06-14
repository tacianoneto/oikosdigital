import { createInitialGameState } from "@oikos/rules";
import type { ForestCardState, PublicRoomState, RoomPlayer } from "@oikos/shared";
import { localRoomId } from "../gameConstants";
import { placeTutorialPiece } from "./helpers";
import type { TutorialStepDef } from "./types";

export const MACAW_TUTORIAL_PLAYER_ID = "local_macaw";
const MACAW_TUTORIAL_CARD = "campo_2_copy";
const MACAW_TUTORIAL_MOVING_PIECE_ID = `${MACAW_TUTORIAL_PLAYER_ID}_piece_1`;

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

export const MACAW_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Arara-azul",
    body: "A Arara-azul é uma espécie de meio com 6 peças. Sua estratégia é organizar araras em linhas retas. Cada linha horizontal, vertical ou diagonal com pelo menos 3 araras vale 1 ponto na ação D.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [
      { resource: "egg", caption: "Ovos recebem novas araras na ação A" },
      { resource: "point", caption: "Cada linha reta vale 1 ponto" }
    ]
  },
  {
    title: "Como formar linhas",
    body: "Uma linha precisa de araras em 3 ou mais cartas consecutivas. Linhas podem se cruzar e compartilhar a mesma arara. Esse cruzamento é a chave para pontuar muito: uma peça central pode participar de várias linhas ao mesmo tempo.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "O plano para 3 pontos",
    body: "Você começa com 4 araras na floresta. Na ação A, adicionará a quinta em um ovo. Na B, moverá uma arara para o centro. Na C, adicionará a sexta abaixo dela. A formação final terá uma linha horizontal, uma vertical e uma diagonal: 3 pontos em um turno.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "3 linhas simultâneas: 3 pontos" }]
  },
  {
    title: "Ação A: expanda a floresta",
    body: "Jogue a carta de campo destacada no espaço marcado. Como nas demais espécies que usam cartas, o habitat jogado também define o movimento da ação B. Para a Arara, campo permite o movimento indicado no guia do HUD.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: MACAW_TUTORIAL_CARD,
    markedSlot: { x: 2, y: 0 },
    highlightMovementGuideSpecies: "macaw"
  },
  {
    title: "Ação A: adicione no ovo",
    body: "Após expandir, adicione 1 arara da reserva em qualquer local de ovo. Use o local destacado no canto superior esquerdo. Essa quinta arara completará a linha horizontal superior no fim do turno.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: -1, y: -1 },
    completeWhenActionIndex: 1
  },
  {
    title: "Ação B: crie o centro",
    body: "Selecione a arara destacada e mova-a para o centro da formação. O movimento segue a carta de campo jogada. Essa peça central será especial: participará da linha vertical e da diagonal ao mesmo tempo.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: MACAW_TUTORIAL_MOVING_PIECE_ID,
    markedMoveTarget: { x: 0, y: 0 },
    completeWhenActionIndex: 2,
    highlightMovementGuideSpecies: "macaw"
  },
  {
    title: "Ação C: adicione ou realoque",
    body: "Depois de mover uma arara na ação B, a ação C permite adicionar uma arara da reserva ou realocar outra arara já presente para qualquer carta ao redor da peça movida. Realocação não coleta o recurso do destino. Como ainda há uma peça na reserva, vamos adicionar.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação C: feche as linhas",
    body: "Adicione a sexta arara no local destacado, logo abaixo da arara central. Ela precisa ficar ao redor da peça movida na ação B. Esse posicionamento completa a linha vertical sem desmontar a horizontal nem a diagonal.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: 0, y: 1 },
    completeWhenActionIndex: 3
  },
  {
    title: "Três linhas prontas",
    body: "Observe o desenho final. Linha horizontal: três araras no topo. Linha vertical: três araras no centro. Linha diagonal: canto superior esquerdo, centro e canto inferior direito. A arara central participa de duas linhas; a do topo central participa de outras duas.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "Horizontal + vertical + diagonal" }]
  },
  {
    title: "Ação D: marque 3 pontos",
    body: "A pontuação verifica todas as linhas retas de 3 ou mais araras. Linhas maiores continuam valendo 1 ponto cada, por isso cruzar linhas costuma ser melhor que apenas alongar uma. Aguarde a animação das três linhas e a pontuação automática.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 3
  },
  {
    title: "Tutorial da Arara-azul completo!",
    body: "Você expandiu a floresta, adicionou uma arara em ovo, moveu outra conforme a carta, usou a ação C ao redor da peça movida e formou 3 linhas para marcar 3 pontos. Procure posições centrais que permitam cruzar linhas usando poucas araras.",
    gate: "none",
    autoAdvance: false
  }
];

// --- Macaco-prego (capuchin) chapter --------------------------------------
// Five monkeys begin on distinct cards: three forests, one field and one
// river. Action A creates the second field, action B moves the extra forest
// monkey to a second river, and action C stacks the seventh monkey. The final
// layout scores all three habitat types while teaching that stacks still count
// as only one occupied card.

export function createMacawTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: MACAW_TUTORIAL_PLAYER_ID,
      name: "Tutorial Arara-azul",
      speciesId: "macaw",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, MACAW_TUTORIAL_FOREST, {
    enabledMiniExpansions: []
  });

  const macaw = game.players.find((player) => player.playerId === MACAW_TUTORIAL_PLAYER_ID);
  if (macaw) {
    macaw.score = 0;
    macaw.turnsTaken = 1;
    macaw.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
    macaw.hand = [MACAW_TUTORIAL_CARD];
  }

  placeTutorialPiece(game, MACAW_TUTORIAL_PLAYER_ID, 1, { x: -1, y: 0 });
  placeTutorialPiece(game, MACAW_TUTORIAL_PLAYER_ID, 2, { x: 0, y: -1 });
  placeTutorialPiece(game, MACAW_TUTORIAL_PLAYER_ID, 3, { x: 1, y: -1 });
  placeTutorialPiece(game, MACAW_TUTORIAL_PLAYER_ID, 4, { x: 1, y: 1 });

  game.status = "active";
  game.round = 2;
  game.activePlayerId = MACAW_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.setupOrder = [];
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
    enabledMiniExpansions: game.enabledMiniExpansions,
    game,
    warnings: game.contentWarnings
  };
}
