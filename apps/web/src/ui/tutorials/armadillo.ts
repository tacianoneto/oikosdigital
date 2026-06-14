import { createInitialGameState } from "@oikos/rules";
import type { ForestCardState, PublicRoomState, RoomPlayer } from "@oikos/shared";
import { localRoomId } from "../gameConstants";
import { placeTutorialPiece } from "./helpers";
import type { TutorialStepDef } from "./types";

export const ARMADILLO_TUTORIAL_PLAYER_ID = "local_armadillo";
const ARMADILLO_TUTORIAL_JAGUAR_ID = "local_armadillo_jaguar";
const ARMADILLO_TUTORIAL_CAPUCHIN_ID = "local_armadillo_capuchin";
const ARMADILLO_TUTORIAL_COATI_ID = "local_armadillo_coati";
const ARMADILLO_TUTORIAL_MACAW_ID = "local_armadillo_macaw";
const ARMADILLO_TUTORIAL_CARD = "bosque_1_copy";
const ARMADILLO_TUTORIAL_MOVING_PIECE_ID = `${ARMADILLO_TUTORIAL_PLAYER_ID}_piece_2`;
const ARMADILLO_TUTORIAL_HIDING_PIECE_ID = `${ARMADILLO_TUTORIAL_PLAYER_ID}_piece_4`;
const ARMADILLO_TUTORIAL_JAGUAR_PIECE_ID = `${ARMADILLO_TUTORIAL_JAGUAR_ID}_piece_1`;

const ARMADILLO_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "arm_tut_0", definitionId: "bosque_2", x: -1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_1", definitionId: "bosque_4", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_2", definitionId: "campo_4", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_3", definitionId: "campo_3", x: 2, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_4", definitionId: "campo_3_copy", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_5", definitionId: "campo_4_copy", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_6", definitionId: "campo_2", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_7", definitionId: "bosque_1", x: 2, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_8", definitionId: "campo_1", x: -1, y: 1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_9", definitionId: "bosque_2_copy", x: 0, y: 1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_10", definitionId: "bosque_3", x: 1, y: 1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_11", definitionId: "bosque_4_copy", x: 2, y: 1, rotation: 0, isInitial: true }
];

export const ARMADILLO_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Tatu-bola",
    body: "O Tatu-bola é uma espécie de meio com 4 peças. Sua estratégia é espalhar a população pela floresta para compartilhar locais com espécies diferentes. Ele adiciona novos tatus em sementes, move conforme a carta jogada e usa a carapaça para escapar de predadores.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [
      { resource: "seed", caption: "Sementes recebem novos tatus" },
      { resource: "point", caption: "Compartilhar com rivais gera pontos" }
    ]
  },
  {
    title: "Leia a floresta",
    body: "A floresta está maior e você já tem 3 tatus em campo. Um compartilha local com o Macaco-prego, outro está perto do Quati e o terceiro divide local com a Onça-pintada. A Arara-azul está em uma semente, pronta para receber o quarto tatu.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "O plano para 3 pontos",
    body: "Você precisa terminar o turno compartilhando com as quatro espécies rivais. Na ação A, adicionará o último tatu junto da Arara. Na B, moverá outro até o Quati. Na C, esconderá o tatu ameaçado pela Onça. Na D, todas as espécies estarão alcançadas e você marcará o máximo de 3 pontos.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "Quatro rivais alcançados: 3 pontos" }]
  },
  {
    title: "Ação A: expanda a floresta",
    body: "Jogue a carta de bosque destacada no espaço marcado. O Tatu-bola sempre expande antes de adicionar uma peça. Guarde também o habitat da carta: ele define como um tatu poderá se mover na ação B. Bosque significa movimento para um local adjacente.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: ARMADILLO_TUTORIAL_CARD,
    markedSlot: { x: 0, y: 2 },
    highlightMovementGuideSpecies: "armadillo"
  },
  {
    title: "Ação A: complete a população",
    body: "Agora adicione o quarto e último tatu no local de semente destacado, junto da Arara-azul. Ter mais tatus aumenta sua cobertura: cada peça pode manter contato com uma espécie rival em uma parte diferente da floresta.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: 1, y: 1 },
    completeWhenActionIndex: 1
  },
  {
    title: "Ação B: alcance o Quati",
    body: "O segundo tatu ainda não compartilha com ninguém. Selecione a peça destacada e mova-a para o local do Quati. Como você jogou bosque, ela anda para um local adjacente. Ao chegar, também coleta o recurso impresso no destino.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: ARMADILLO_TUTORIAL_MOVING_PIECE_ID,
    markedMoveTarget: { x: 1, y: -1 },
    completeWhenActionIndex: 2,
    highlightMovementGuideSpecies: "armadillo"
  },
  {
    title: "Quatro contatos ativos",
    body: "Confira a distribuição: Macaco-prego à esquerda, Quati acima, Onça-pintada à direita e Arara-azul no local de semente. A pontuação considera espécies diferentes, não a quantidade de peças rivais nem a distância entre seus tatus.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação C: use a carapaça",
    body: "A Onça está a um movimento do local da Arara. Selecione o tatu recém-adicionado e confirme em Esconder Tatu-bola. A peça ficará protegida pela carapaça: predadores podem entrar no local, mas não podem escolher esse tatu para remoção.",
    gate: "hidePiece",
    autoAdvance: true,
    markedPieceId: ARMADILLO_TUTORIAL_HIDING_PIECE_ID,
    completeWhenActionIndex: 3
  },
  {
    title: "Escondido ainda compartilha",
    body: "A carapaça muda apenas a vulnerabilidade da peça. O tatu escondido continua ocupando o local, compartilhando com a Arara e contando para a pontuação. Esconder protege sua rede sem desligar o contato.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "A Arara continua compartilhada" }]
  },
  {
    title: "Ação D: marque 3 pontos",
    body: "A pontuação começa em 3 e perde 1 para cada espécie rival que não compartilha local com nenhum tatu. Macaco, Quati, Onça e Arara estão todos compartilhando. Aguarde a contagem automática: mesmo com quatro rivais, o teto continua sendo 3 pontos.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 3
  },
  {
    title: "A Onça vai atacar",
    body: "Agora começa a vez da Onça-pintada. Ela está ao lado do local onde estão a Arara visível e o tatu escondido. Vamos controlar a Onça por um instante para provar a diferença entre uma peça exposta e uma protegida.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Teste a carapaça",
    body: "Selecione a Onça destacada e mova-a para o local da Arara e do tatu escondido. A Arara está visível e será removida. O tatu não aparece como alvo para a Onça e deve permanecer no mesmo local.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: ARMADILLO_TUTORIAL_JAGUAR_PIECE_ID,
    markedMoveTarget: { x: 1, y: 1 }
  },
  {
    title: "A carapaça funcionou",
    body: "A Onça entrou no local e removeu a Arara visível. O tatu permaneceu na floresta porque estava escondido: peças escondidas não podem ser escolhidas como alvo da Onça. A captura da Arara rendeu 1 carne.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Tutorial do Tatu-bola completo!",
    body: "Você usou os 4 tatus, expandiu a floresta, adicionou em semente, moveu para criar contato, marcou o máximo de 3 pontos e comprovou a proteção contra a Onça. O ciclo ideal é espalhar a população e esconder a peça mais ameaçada sem perder compartilhamentos.",
    gate: "none",
    autoAdvance: false
  }
];

// --- Arara-azul (macaw) chapter -------------------------------------------
// Four macaws start in position. Action A adds a fifth on an egg location,
// action B moves one macaw to the center, and action C adds the sixth around
// that moved piece. The final formation creates three simultaneous lines.

export function createArmadilloTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: ARMADILLO_TUTORIAL_PLAYER_ID,
      name: "Tutorial Tatu-bola",
      speciesId: "armadillo",
      ready: true,
      connected: true
    },
    {
      playerId: ARMADILLO_TUTORIAL_JAGUAR_ID,
      name: "Onça de treino",
      speciesId: "jaguar",
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
      playerId: ARMADILLO_TUTORIAL_COATI_ID,
      name: "Quati de treino",
      speciesId: "coati",
      ready: true,
      connected: true
    },
    {
      playerId: ARMADILLO_TUTORIAL_MACAW_ID,
      name: "Arara de treino",
      speciesId: "macaw",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, ARMADILLO_TUTORIAL_FOREST, {
    enabledMiniExpansions: []
  });

  for (const player of game.players) {
    player.score = 0;
    player.turnsTaken = player.playerId === ARMADILLO_TUTORIAL_PLAYER_ID ? 1 : 0;
    player.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
  }

  const armadillo = game.players.find((player) => player.playerId === ARMADILLO_TUTORIAL_PLAYER_ID);
  if (armadillo) {
    armadillo.hand = [ARMADILLO_TUTORIAL_CARD];
  }

  placeTutorialPiece(game, ARMADILLO_TUTORIAL_PLAYER_ID, 1, { x: -1, y: 0 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_PLAYER_ID, 2, { x: 1, y: 0 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_PLAYER_ID, 3, { x: 2, y: 1 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_JAGUAR_ID, 1, { x: 2, y: 1 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_CAPUCHIN_ID, 1, { x: -1, y: 0 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_COATI_ID, 1, { x: 1, y: -1 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_MACAW_ID, 1, { x: 1, y: 1 });

  game.status = "active";
  game.round = 2;
  game.activePlayerId = ARMADILLO_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.setupOrder = [];
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
    enabledMiniExpansions: game.enabledMiniExpansions,
    game,
    warnings: game.contentWarnings
  };
}
