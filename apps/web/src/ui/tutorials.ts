import { createInitialGameState } from "@oikos/rules";
import type { ForestCardState, GameState, GridPosition, PublicRoomState, Resource, RoomPlayer, SpeciesId } from "@oikos/shared";
import { isTutorialProgressDone, markTutorialProgressDone } from "../auth/tutorialProgress";
import { localRoomId } from "./gameConstants";

// --- Tutorials --------------------------------------------------------------
// The species tutorials (jaguar, wolf, armadillo, ...) were removed on purpose:
// they are being rebuilt from scratch, one species at a time. The TutorialId
// union keeps the species names so the rest of the app (progress storage, board
// highlighting) stays type-stable until each species tutorial is rebuilt.
export type TutorialId = "initial" | "jaguar" | "wolf" | "armadillo" | "macaw" | "capuchin" | "coati";

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

// A small icon + caption shown under the coach text, used to teach resources
// and scoring visually instead of with a wall of text.
export interface TutorialResourceIcon {
  resource: Resource | "point";
  caption: string;
}

export interface TutorialStepDef {
  title: string;
  body: string;
  gate: TutorialGate;
  autoAdvance: boolean;
  resourceIcons?: TutorialResourceIcon[];
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
const INITIAL_TUTORIAL_PLAYER_ID = "local_basic_tutorial";

// Deterministic 3x3 starting forest (coords -1..1). The river card at (1,0) has
// a single mouth facing east into the empty cell (2,0). The player extends the
// forest at (-2,0) with a non-river card, then continues the river at (2,0),
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

// The basic tutorial uses the real rules engine, but teaches only the universal
// verbs every species shares: setup, playing cards, river rotation, movement and
// final scoring. Species powers are taught later in their own chapters. The flow
// alternates short read-only explanations ("none") with a single hands-on action
// per step, so the player learns each rule by doing it once.
const INITIAL_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Bem-vindo a Oikos",
    body: "Oikos é um jogo sobre construir uma floresta e espalhar a sua espécie por ela. Este primeiro capítulo ensina só as regras que valem para todo mundo: tabuleiro, cartas, meeples, recursos e pontuação. Os poderes de cada espécie ficam para os próximos capítulos. Toque em Próximo para começar.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "A floresta e os habitats",
    body: "A floresta no centro da tela é feita de cartas. Cada carta tem um habitat, e existem três: bosque (mata fechada), campo (área aberta) e rio (água). Olhe o tabuleiro e repare nos três tipos de carta. O habitat importa porque define como cada espécie se movimenta. Você vê isso nos capítulos de espécie.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Os quatro recursos",
    body: "Existem 4 tipos de recursos: carne, ovo, fruta e semente. O desenho na carta mostra qual ela oferece, e você junta recursos ao colocar e mover meeples. Eles também valem pontos no fim da partida: para carne, ovo e fruta, quem tiver a maior quantidade de cada um recebe 1 ponto de vitória. A semente é diferente: a cada 2 sementes você ganha 1 ponto.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [
      { resource: "meat", caption: "Carne: maioria vale 1 ponto" },
      { resource: "egg", caption: "Ovo: maioria vale 1 ponto" },
      { resource: "fruit", caption: "Fruta: maioria vale 1 ponto" },
      { resource: "seed", caption: "Semente: 2 valem 1 ponto" }
    ]
  },
  {
    title: "Seus meeples",
    body: "Meeples são as suas peças na floresta. Cada espécie começa com um número fixo deles. Eles ocupam locais, coletam recursos e disputam território com as outras espécies. No próximo passo você coloca os seus.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Setup: posicione seus meeples",
    body: "Comece colocando seus meeples iniciais. Clique em cartas da floresta para posicioná-los. Você tem dois para colocar. Importante: ao entrar em um local, você coleta na hora o recurso daquele local. Coloque os dois para continuar.",
    gate: "setup",
    autoAdvance: true
  },
  {
    title: "Você já coletou recursos",
    body: "Pronto! Cada meeple que você posicionou rendeu o recurso do local onde entrou. Olhe o seu painel no canto: os recursos coletados já estão somados ali. Essa é a regra de ouro: entrar num local sempre coleta o recurso dele.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "O turno: ações em ordem",
    body: "Agora começa o seu turno. No jogo, cada espécie executa ações em ordem (A, B, C...). A ação A quase sempre é expandir a floresta jogando uma carta da sua mão. Vamos fazer isso agora.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Jogue uma carta de terra",
    body: "Clique na carta destacada da sua mão e depois no espaço destacado do tabuleiro. Cartas de bosque e campo (terra) entram em qualquer espaço vazio que encoste na floresta atual.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: TUTORIAL_NONRIVER_CARD,
    markedSlot: { x: -2, y: 0 }
  },
  {
    title: "Regra da adjacência",
    body: "Repare que a carta só pôde entrar encostada na floresta. A floresta cresce sempre de forma conectada: nenhuma carta fica solta, longe das outras. Isso vale para todas as espécies.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Cartas de rio precisam encaixar",
    body: "Cartas de rio têm água desenhada e seguem uma regra extra: água conecta com água ou sai pela borda do tabuleiro, e nunca pode encostar em mata. Use Q/E (ou os botões de giro) para rotacionar a carta até a água encaixar no espaço destacado, então jogue-a.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: TUTORIAL_RIVER_CARD,
    markedSlot: { x: 2, y: 0 },
    requiresRiver: true
  },
  {
    title: "Rios formam caminhos",
    body: "Você acabou de estender o rio. Conectar a água certa é o que mantém o rio contínuo. Se a rotação estiver errada, o jogo não deixa jogar a carta ali, então gire com calma até encaixar.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Mova um meeple",
    body: "Depois de jogar a carta vem o movimento. Clique em um meeple seu e escolha um destino destacado. Lembre da regra de ouro: ao chegar no destino, você coleta o recurso daquele local.",
    gate: "move",
    autoAdvance: true
  },
  {
    title: "Movimento e coleta",
    body: "Cada espécie se move de um jeito diferente conforme o habitat (adjacente, diagonal, salto reto, salto em curva). Você aprende o padrão de cada uma no capítulo dela. O que vale para todos: mover-se coleta o recurso do local de destino, igual ao setup.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Maioria de recursos",
    body: "No fim da partida, para cada recurso (exceto semente) o jogador com a maior quantidade daquele recurso recebe 1 ponto de vitória. Em caso de empate na maior quantidade, todos os empatados pontuam. Ter a maioria de carne, ovo ou fruta é o caminho mais direto para pontos.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [
      { resource: "meat", caption: "Maioria de carne: 1 ponto" },
      { resource: "egg", caption: "Maioria de ovo: 1 ponto" },
      { resource: "fruit", caption: "Maioria de fruta: 1 ponto" }
    ]
  },
  {
    title: "Pontos de semente",
    body: "A semente não disputa maioria. No fim, você pode gastar 2 sementes para ganhar 1 ponto, quantas vezes conseguir. Por exemplo, 5 sementes valem 2 pontos e sobra 1 semente. Vale a pena acumular sementes mesmo sem ser o líder de nenhum recurso.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "seed", caption: "A cada 2 sementes: 1 ponto" }]
  },
  {
    title: "Você aprendeu o básico!",
    body: "Resumo: monte sua presença no setup, expanda a floresta jogando cartas conectadas (e encaixe os rios), mova meeples para coletar recursos e mire na pontuação final: maioria de carne, ovo e fruta, mais pares de semente. Agora escolha um capítulo de espécie para aprender os poderes dela.",
    gate: "none",
    autoAdvance: false
  }
];

function getTutorialDoneKey(tutorialId: TutorialId): string {
  return `oikos-tutorial-${tutorialId}`;
}

export function isTutorialDone(tutorialId: TutorialId): boolean {
  if (isTutorialProgressDone(tutorialId)) return true;
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
  void markTutorialProgressDone(tutorialId);
}

export function isTutorialInitialDone(): boolean {
  return isTutorialDone("initial");
}

export function getTutorialSteps(_tutorialId: TutorialId | null): TutorialStepDef[] {
  // Only the basic tutorial exists right now; species chapters are rebuilt later.
  return INITIAL_TUTORIAL_STEPS;
}

export function getTutorialPlayerId(tutorialId: TutorialId | null, fallback: string | null): string | null {
  if (tutorialId === "initial") return INITIAL_TUTORIAL_PLAYER_ID;
  return fallback;
}

export function createInitialTutorialRoom(): PublicRoomState {
  const tutorialPlayers: RoomPlayer[] = [
    {
      playerId: INITIAL_TUTORIAL_PLAYER_ID,
      name: "Tutorial basico",
      speciesId: "armadillo",
      ready: true,
      connected: true
    }
  ];
  const game = createInitialGameState(localRoomId, tutorialPlayers, Math.random, TUTORIAL_FOREST, {
    enabledMiniExpansions: []
  });
  if (game.players[0]) {
    game.players[0].hand = [TUTORIAL_NONRIVER_CARD, TUTORIAL_RIVER_CARD];
  }

  return {
    roomId: localRoomId,
    status: "setup",
    hostPlayerId: "local_host",
    players: tutorialPlayers,
    enabledMiniExpansions: game.enabledMiniExpansions,
    game,
    warnings: game.contentWarnings
  };
}

// Kept exported for the (rebuilt) armadillo chapter; currently unused.
export function moveArmadilloTutorialJaguarProbe(game: GameState, _target: GridPosition): GameState {
  return game;
}
