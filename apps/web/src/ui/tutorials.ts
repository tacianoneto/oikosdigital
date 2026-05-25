import { createInitialGameState } from "@oikos/rules";
import type { ForestCardState, GameState, GridPosition, PublicRoomState, RoomPlayer, SpeciesId } from "@oikos/shared";
import { localRoomId } from "./gameConstants";

// --- Tutorials --------------------------------------------------------------
export type TutorialId = "initial" | "jaguar" | "wolf" | "armadillo" | "macaw" | "capuchin" | "coati";

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
export type TutorialGate = "none" | "setup" | "placeCard" | "move" | "removeBase" | "score" | "addPiece" | "resolvePair" | "removeCoati";

export interface TutorialStepDef {
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
export const TUTORIAL_NONRIVER_CARD = "bosque_1"; // bosque (forest), no river
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

export function isTutorialDone(tutorialId: TutorialId): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getTutorialDoneKey(tutorialId)) === "1";
  } catch {
    return false;
  }
}

export function markTutorialDone(tutorialId: TutorialId): void {
  try {
    window.localStorage.setItem(getTutorialDoneKey(tutorialId), "1");
  } catch {
    // ignore
  }
}

export function isTutorialInitialDone(): boolean {
  return isTutorialDone("initial");
}

export function isTutorialJaguarDone(): boolean {
  return isTutorialDone("jaguar");
}

export function isTutorialWolfDone(): boolean {
  return isTutorialDone("wolf");
}

export function isTutorialArmadilloDone(): boolean {
  return isTutorialDone("armadillo");
}

export function isTutorialMacawDone(): boolean {
  return isTutorialDone("macaw");
}

export function isTutorialCapuchinDone(): boolean {
  return isTutorialDone("capuchin");
}

export function isTutorialCoatiDone(): boolean {
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

export function createWolfTutorialRoom(): PublicRoomState {
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

export function createArmadilloTutorialRoom(): PublicRoomState {
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

export function moveArmadilloTutorialJaguarProbe(game: GameState, target: GridPosition): GameState {
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

export function createMacawTutorialRoom(): PublicRoomState {
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

export function createCapuchinTutorialRoom(): PublicRoomState {
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

export function getTutorialSteps(tutorialId: TutorialId | null): TutorialStepDef[] {
  if (tutorialId === "jaguar") return JAGUAR_TUTORIAL_STEPS;
  if (tutorialId === "wolf") return WOLF_TUTORIAL_STEPS;
  if (tutorialId === "armadillo") return ARMADILLO_TUTORIAL_STEPS;
  if (tutorialId === "macaw") return MACAW_TUTORIAL_STEPS;
  if (tutorialId === "capuchin") return CAPUCHIN_TUTORIAL_STEPS;
  if (tutorialId === "coati") return COATI_TUTORIAL_STEPS;
  return INITIAL_TUTORIAL_STEPS;
}

export function getTutorialPlayerId(tutorialId: TutorialId | null, fallback: string | null): string | null {
  if (tutorialId === "jaguar") return JAGUAR_TUTORIAL_PLAYER_ID;
  if (tutorialId === "wolf") return WOLF_TUTORIAL_PLAYER_ID;
  if (tutorialId === "armadillo") return ARMADILLO_TUTORIAL_PLAYER_ID;
  if (tutorialId === "macaw") return MACAW_TUTORIAL_PLAYER_ID;
  if (tutorialId === "capuchin") return CAPUCHIN_TUTORIAL_PLAYER_ID;
  if (tutorialId === "coati") return COATI_TUTORIAL_PLAYER_ID;
  return fallback;
}

export function createInitialTutorialRoom(): PublicRoomState {
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
  if (game.players[0]) {
    game.players[0].hand = [TUTORIAL_NONRIVER_CARD, TUTORIAL_RIVER_CARD];
  }

  return {
    roomId: localRoomId,
    status: "setup",
    hostPlayerId: "local_host",
    players: tutorialPlayers,
    game,
    warnings: game.contentWarnings
  };
}
