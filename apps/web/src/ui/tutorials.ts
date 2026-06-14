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
//   hidePiece -> select an Armadillo and confirm hiding it
export type TutorialGate = "none" | "setup" | "placeCard" | "move" | "removeBase" | "score" | "addPiece" | "resolvePair" | "removeCoati" | "hidePiece";

// A small icon + caption shown under the coach text, used to teach resources
// and scoring visually instead of with a wall of text.
export interface TutorialResourceIcon {
  resource: Resource | "point";
  caption: string;
}

// A species-type card shown with the colored population-pyramid icon from the
// "tipos de espécie" page of the rulebook.
export interface TutorialCategoryCard {
  label: string;
  color: string; // hex accent (border + label) tuned for the dark coach panel
  iconAsset: string;
  body: string;
}

// A bolded term plus its definition, used for the "termos importantes" step.
export interface TutorialTerm {
  term: string;
  body: string;
}

export interface TutorialStepDef {
  title: string;
  body: string;
  gate: TutorialGate;
  autoAdvance: boolean;
  resourceIcons?: TutorialResourceIcon[];
  categoryCards?: TutorialCategoryCard[];
  terms?: TutorialTerm[];
  requiredCardId?: string; // the only hand card the player may place this step
  markedSlot?: GridPosition; // the only slot where the card may be placed
  markedMoveTarget?: GridPosition; // the only board destination taught this step
  markedAddPieceTarget?: GridPosition;
  markedPairTarget?: GridPosition; // the only adjacent cell taught for the Coati pair bonus
  markedPieceId?: string;
  highlightMovementGuideSpecies?: SpeciesId;
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

// The basic tutorial follows the rulebook section by section: introdução,
// objetivo, preparação, termos, como jogar, expandir a floresta (the hands-on
// part, where the player plays a land card and a river card) and pontuação. The
// scenario starts already active so the card placement works without a setup
// phase. Texts stay close to the manual and avoid em-dashes.
const INITIAL_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Introdução",
    body: "Em Oikos, você estará no controle da população de uma espécie nativa do Brasil. Neste jogo assimétrico cheio de interações, cada espécie tem seus próprios objetivos para alcançar a vitória, interagindo de formas diferentes com as demais espécies e habitats.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Objetivo",
    body: "O objetivo é ser a espécie com mais pontos de vitória ao final da partida. Como as espécies são diferentes, cada uma conquista pontos de formas alternativas durante as rodadas, e no fim há também uma pontuação baseada nos recursos coletados. Em caso de empate, vence quem tiver mais recursos restantes; se o empate persistir, vence a espécie de maior valor de população.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Preparação",
    body: "Cada jogador escolhe uma espécie para jogar. Cada espécie joga e pontua de uma forma diferente.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Preparação: tipos de espécie",
    body: "As espécies se dividem em quatro tipos, indicados pela pirâmide colorida de cada uma:",
    gate: "none",
    autoAdvance: false,
    categoryCards: [
      {
        label: "Predador (obrigatório)",
        color: "#e06457",
        iconAsset: "/assets/icones/predador.webp",
        body: "Remove peças de outras espécies. Cada partida tem exatamente 1."
      },
      {
        label: "Espécie de base (obrigatória)",
        color: "#5a9bd8",
        iconAsset: "/assets/icones/base.webp",
        body: "Preenche a floresta. Cada partida tem de 1 a 2."
      },
      {
        label: "Espécie de meio",
        color: "#e8c14f",
        iconAsset: "/assets/icones/meio.webp",
        body: "Mecânicas variadas. Completa o número de jogadores depois das obrigatórias."
      },
      {
        label: "Subpredador",
        color: "#e8954e",
        iconAsset: "/assets/icones/subpredador.webp",
        body: "Conta como de meio, mas também remove peças de espécies de base."
      }
    ]
  },
  {
    title: "Termos importantes",
    body: "Antes de jogar, conheça os termos que vão aparecer o tempo todo:",
    gate: "none",
    autoAdvance: false,
    terms: [
      { term: "Peça", body: "Representa seus animais na floresta. Cada espécie tem uma quantidade diferente." },
      { term: "Local", body: "Cada carta na floresta é um local, com até 4 locais adjacentes ou até 8 ao redor (contando as diagonais)." },
      { term: "Recurso", body: "Existem 4 tipos: carne, ovo, fruta e semente." },
      { term: "Floresta", body: "O conjunto de cartas conectadas na mesa. A floresta inicial são 9 cartas, com uma rosa dos ventos ao centro." },
      { term: "Habitat", body: "3 tipos, que também são os naipes das cartas: bosque, campo e rio." }
    ]
  },
  {
    title: "Como jogar",
    body: "A partida dura 5 rodadas. Em cada rodada, todos jogam seu turno realizando as ações em ordem e passam adiante; a rodada termina depois do último jogador. A ordem dos turnos segue o valor de população das espécies, do maior para o menor. No seu turno, você segue as etapas do tabuleiro da sua espécie, sempre na ordem em que aparecem. Espécies suporte agem dentro do turno de quem as controla.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Expandir ou reduzir a floresta",
    body: "Na maioria dos turnos você expande a floresta: pegue uma carta da mão e adicione ao conjunto de cartas na mesa, podendo girá-la de 90 em 90 graus quantas vezes quiser. Também é possível reduzir a floresta, retirando um local da mesa de volta para a mão. Vamos expandir agora, com duas cartas.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Jogue uma carta de terra",
    body: "Clique na carta de terra destacada da sua mão e depois no espaço destacado do tabuleiro. Cartas de bosque e campo entram em qualquer espaço vazio que encoste na floresta atual.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: TUTORIAL_NONRIVER_CARD,
    markedSlot: { x: -2, y: 0 }
  },
  {
    title: "Agora uma carta de rio",
    body: "Cartas de rio têm água desenhada e seguem uma regra extra: a água conecta com água ou sai pela borda, e nunca pode encostar em mata. Use Q/E (ou os botões de giro) para girar a carta até a água encaixar no espaço destacado, então jogue-a.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: TUTORIAL_RIVER_CARD,
    markedSlot: { x: 2, y: 0 },
    requiresRiver: true
  },
  {
    title: "Maioria de recursos",
    body: "No fim da partida, para cada recurso (exceto semente) o jogador com a maior quantidade daquele recurso recebe 1 ponto de vitória; em caso de empate na maior quantidade, todos os empatados pontuam. Por fim, você ainda pode gastar 2 sementes para ganhar 1 ponto, quantas vezes conseguir.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [
      { resource: "meat", caption: "Maioria de carne: 1 ponto" },
      { resource: "egg", caption: "Maioria de ovo: 1 ponto" },
      { resource: "fruit", caption: "Maioria de fruta: 1 ponto" },
      { resource: "seed", caption: "A cada 2 sementes: 1 ponto" }
    ]
  },
  {
    title: "Você aprendeu o básico!",
    body: "Você já conhece o essencial de Oikos: escolher uma espécie, expandir a floresta com cartas conectadas (encaixando os rios) e pontuar no fim pela maioria de recursos e pelas sementes. Agora escolha um capítulo de espécie para aprender os poderes dela e começar a jogar.",
    gate: "none",
    autoAdvance: false
  }
];

// --- Onça-pintada (jaguar) chapter ------------------------------------------
// A scripted second turn where the jaguar makes the most points possible:
// action A hunts an adjacent piece (+1 carne), action B moves by habitat onto a
// meat card with another piece (+1 carne hunt, +1 carne collected), then action
// C spends 3 carne for 3 points. The board is pre-built with two base species to
// hunt. Texts avoid em-dashes.
const JAGUAR_TUTORIAL_PLAYER_ID = "local_jaguar";
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

const JAGUAR_TUTORIAL_STEPS: TutorialStepDef[] = [
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
const WOLF_TUTORIAL_PLAYER_ID = "local_wolf";
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

const WOLF_TUTORIAL_STEPS: TutorialStepDef[] = [
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
const ARMADILLO_TUTORIAL_PLAYER_ID = "local_armadillo";
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

const ARMADILLO_TUTORIAL_STEPS: TutorialStepDef[] = [
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
    body: "A Onça entrou no local e removeu a Arara visível, mas o tatu escondido continuou na floresta. A Onça ganhou carne pela captura da Arara; não ganhou uma segunda carne pelo tatu, pois peças escondidas não podem ser removidas.",
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
const MACAW_TUTORIAL_PLAYER_ID = "local_macaw";
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

const MACAW_TUTORIAL_STEPS: TutorialStepDef[] = [
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
const CAPUCHIN_TUTORIAL_PLAYER_ID = "local_capuchin";
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

const CAPUCHIN_TUTORIAL_STEPS: TutorialStepDef[] = [
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
// Five coatis begin in the forest, leaving three in reserve. Action A adds one
// to a fruit card and forms an exact pair; the passive then adds a seventh
// coati adjacently and scores 1 point. Action B demonstrates the forest-card
// straight jump. With only one coati left in reserve, action C removes two from
// the forest and restores the reserve above the penalty threshold.
const COATI_TUTORIAL_PLAYER_ID = "local_coati";
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

const COATI_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Quati",
    body: "O Quati é uma espécie de base com 8 peças. Ele ocupa a floresta rapidamente, adiciona peças em locais de fruta e transforma duplas exatas em novos quatis e pontos.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [
      { resource: "fruit", caption: "A ação A adiciona em locais de fruta" },
      { resource: "point", caption: "Cada dupla exata pode valer 1 ponto" }
    ]
  },
  {
    title: "A passiva da dupla",
    body: "Sempre que um quati entra em um local e passa a formar uma dupla exata de 2 quatis, você adiciona 1 quati da reserva em um local adjacente e marca 1 ponto. Três ou mais quatis juntos não formam uma nova dupla.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "O plano do turno",
    body: "Você começa com 5 quatis na floresta e 3 na reserva. Na ação A, adicionará um quati para formar uma dupla e ativar a passiva. Na B, fará um salto reto. Restará somente 1 quati na reserva, então a ação C exigirá retirar 2 quatis da floresta.",
    gate: "none",
    autoAdvance: false
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
    body: "Agora adicione 1 quati no local de fruta destacado. Já existe 1 quati ali, então a chegada do segundo forma uma dupla exata e prepara a passiva.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: -1, y: -1 },
    completeWhenCoatiPairPending: true
  },
  {
    title: "Passiva: abrigue o quati bônus",
    body: "A dupla está formada. Coloque 1 quati da reserva no local adjacente destacado. A passiva adiciona essa peça sem coletar o recurso do destino e marca 1 ponto.",
    gate: "resolvePair",
    autoAdvance: true,
    markedPairTarget: { x: 0, y: -1 },
    completeWhenActionIndex: 1
  },
  {
    title: "Dupla resolvida",
    body: "Você ficou com 7 quatis na floresta, 1 na reserva e marcou 1 ponto. A dupla não pontua novamente enquanto continuar igual; será preciso desfazê-la e formar outra dupla exata.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "Dupla exata resolvida: 1 ponto" }]
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
    title: "Reserva baixa",
    body: "Depois da adição e do bônus, restou apenas 1 quati na reserva. A ação C verifica a reserva: com menos de 2 peças, você deve retirar exatamente 2 quatis da floresta.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "Ação C: retire 2 quatis",
    body: "Selecione quaisquer 2 quatis seus na floresta e confirme a retirada. Eles voltam para a reserva, que ficará com 3 peças. Planeje a expansão para aproveitar as duplas sem terminar o turno com a reserva baixa.",
    gate: "removeCoati",
    autoAdvance: true,
    completeWhenRoundAtLeast: 3
  },
  {
    title: "Tutorial do Quati completo!",
    body: "Você expandiu a floresta, adicionou em fruta, formou uma dupla exata, usou a passiva para ganhar peça e ponto, moveu conforme a carta e recuperou a reserva na ação C. O Quati cresce rápido, mas precisa equilibrar floresta e reserva.",
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

export function getTutorialSteps(tutorialId: TutorialId | null): TutorialStepDef[] {
  if (tutorialId === "jaguar") return JAGUAR_TUTORIAL_STEPS;
  if (tutorialId === "wolf") return WOLF_TUTORIAL_STEPS;
  if (tutorialId === "armadillo") return ARMADILLO_TUTORIAL_STEPS;
  if (tutorialId === "macaw") return MACAW_TUTORIAL_STEPS;
  if (tutorialId === "capuchin") return CAPUCHIN_TUTORIAL_STEPS;
  if (tutorialId === "coati") return COATI_TUTORIAL_STEPS;
  // Chapters not rebuilt yet default to the basic tutorial.
  return INITIAL_TUTORIAL_STEPS;
}

export function getTutorialPlayerId(tutorialId: TutorialId | null, fallback: string | null): string | null {
  if (tutorialId === "initial") return INITIAL_TUTORIAL_PLAYER_ID;
  if (tutorialId === "jaguar") return JAGUAR_TUTORIAL_PLAYER_ID;
  if (tutorialId === "wolf") return WOLF_TUTORIAL_PLAYER_ID;
  if (tutorialId === "armadillo") return ARMADILLO_TUTORIAL_PLAYER_ID;
  if (tutorialId === "macaw") return MACAW_TUTORIAL_PLAYER_ID;
  if (tutorialId === "capuchin") return CAPUCHIN_TUTORIAL_PLAYER_ID;
  if (tutorialId === "coati") return COATI_TUTORIAL_PLAYER_ID;
  return fallback;
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

  // Start already active so the player goes straight to expanding the forest
  // (the only hands-on part); the rulebook reading steps come before it. Two of
  // the armadillo's meeples are pre-placed so the board looks like a real game.
  const player = game.players[0];
  if (player) {
    player.hand = [TUTORIAL_NONRIVER_CARD, TUTORIAL_RIVER_CARD];
    player.score = 0;
    player.turnsTaken = 1;
    player.resources = { meat: 0, egg: 0, fruit: 0, seed: 0 };
  }
  placeTutorialPiece(game, INITIAL_TUTORIAL_PLAYER_ID, 1, { x: -1, y: -1 });
  placeTutorialPiece(game, INITIAL_TUTORIAL_PLAYER_ID, 2, { x: -1, y: 1 });

  game.status = "active";
  game.round = 1;
  game.activePlayerId = INITIAL_TUTORIAL_PLAYER_ID;
  game.activeActionIndex = 0;
  game.activePlayedForestCardId = null;
  game.pendingCoatiPairBonus = null;
  game.pendingMacawMovedPiece = null;
  game.pendingWolfMoves = null;
  game.setupActivePlayerId = null;
  game.setupOrder = [];
  game.turnOrder = [INITIAL_TUTORIAL_PLAYER_ID];
  game.log = [
    {
      id: "basic_tutorial_ready",
      message: "Tutorial basico preparado.",
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
  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 3, { x: 0, y: 0 });
  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 4, { x: 1, y: -1 });
  placeTutorialPiece(game, COATI_TUTORIAL_PLAYER_ID, 5, { x: 1, y: 1 });

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
