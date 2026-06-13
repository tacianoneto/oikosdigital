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
// A scripted full turn against three rival species. Each rival ends the turn
// sharing a location with at least one armadillo, which yields the maximum
// three points. The newly added armadillo is hidden in action C to demonstrate
// that protection does not stop it from counting toward sharing in action D.
const ARMADILLO_TUTORIAL_PLAYER_ID = "local_armadillo";
const ARMADILLO_TUTORIAL_CAPUCHIN_ID = "local_armadillo_capuchin";
const ARMADILLO_TUTORIAL_COATI_ID = "local_armadillo_coati";
const ARMADILLO_TUTORIAL_MACAW_ID = "local_armadillo_macaw";
const ARMADILLO_TUTORIAL_CARD = "bosque_1_copy";
const ARMADILLO_TUTORIAL_MOVING_PIECE_ID = `${ARMADILLO_TUTORIAL_PLAYER_ID}_piece_2`;
const ARMADILLO_TUTORIAL_HIDING_PIECE_ID = `${ARMADILLO_TUTORIAL_PLAYER_ID}_piece_3`;

const ARMADILLO_TUTORIAL_FOREST: ForestCardState[] = [
  { instanceId: "arm_tut_0", definitionId: "bosque_2", x: -1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_1", definitionId: "bosque_4", x: 0, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_2", definitionId: "bosque_1", x: 1, y: -1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_3", definitionId: "campo_3", x: -1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_4", definitionId: "campo_4", x: 0, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_5", definitionId: "campo_2", x: 1, y: 0, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_6", definitionId: "campo_4_copy", x: -1, y: 1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_7", definitionId: "bosque_3", x: 0, y: 1, rotation: 0, isInitial: true },
  { instanceId: "arm_tut_8", definitionId: "campo_1", x: 1, y: 1, rotation: 0, isInitial: true }
];

const ARMADILLO_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Tatu-bola",
    body: "O Tatu-bola é uma espécie de meio com 4 peças. Ele começa com 2 tatus, adiciona novos animais em locais de semente, pode se esconder contra predadores e pontua ao compartilhar locais com espécies diferentes.",
    gate: "none",
    autoAdvance: false
  },
  {
    title: "O plano do turno",
    body: "Já existe um tatu dividindo local com o Macaco-prego. Na ação A, você adicionará outro junto da Arara-azul. Na B, moverá um tatu até o Quati. Na C, esconderá o tatu recém-adicionado. Assim, as três espécies compartilharão locais e a ação D renderá 3 pontos, o máximo.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [
      { resource: "seed", caption: "Sementes recebem novos tatus" },
      { resource: "point", caption: "3 espécies compartilhadas: 3 pontos" }
    ]
  },
  {
    title: "Ação A: expanda a floresta",
    body: "Jogue a carta de bosque destacada no espaço marcado. Além de expandir a floresta, o habitat da carta jogada define como um tatu poderá se mover na ação B. Para o Tatu-bola, bosque significa mover 1 local adjacente.",
    gate: "placeCard",
    autoAdvance: true,
    requiredCardId: ARMADILLO_TUTORIAL_CARD,
    markedSlot: { x: 0, y: 2 },
    highlightMovementGuideSpecies: "armadillo"
  },
  {
    title: "Ação A: adicione um tatu",
    body: "Depois de expandir, adicione 1 tatu da reserva em um local de semente. Clique no local destacado, onde está a Arara-azul. Espécies diferentes podem compartilhar o mesmo local.",
    gate: "addPiece",
    autoAdvance: true,
    markedAddPieceTarget: { x: 0, y: 1 },
    completeWhenActionIndex: 1
  },
  {
    title: "Ação B: mova um tatu",
    body: "Selecione o tatu destacado e mova-o ao local do Quati. Como a carta jogada foi de bosque, o movimento é para um local adjacente. O tatu também coleta o recurso do destino.",
    gate: "move",
    autoAdvance: true,
    markedPieceId: ARMADILLO_TUTORIAL_MOVING_PIECE_ID,
    markedMoveTarget: { x: 1, y: -1 },
    completeWhenActionIndex: 2,
    highlightMovementGuideSpecies: "armadillo"
  },
  {
    title: "Ação C: esconda um tatu",
    body: "Selecione o tatu que acabou de entrar junto da Arara-azul e confirme em Esconder Tatu-bola. Um tatu escondido não pode ser removido pela Onça-pintada, mas continua ocupando e compartilhando o local.",
    gate: "hidePiece",
    autoAdvance: true,
    markedPieceId: ARMADILLO_TUTORIAL_HIDING_PIECE_ID,
    completeWhenActionIndex: 3
  },
  {
    title: "Três espécies compartilhadas",
    body: "Agora seus tatus dividem locais com Macaco-prego, Quati e Arara-azul. A pontuação considera espécies diferentes, não o número de peças rivais. O tatu escondido junto da Arara ainda conta normalmente.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "point", caption: "Nenhuma espécie ausente: 3 pontos" }]
  },
  {
    title: "Ação D: marque 3 pontos",
    body: "A pontuação começa em 3 e perde 1 para cada espécie rival que não compartilha local com nenhum tatu. Como todas as três espécies estão compartilhando, aguarde a contagem automática de 3 pontos.",
    gate: "score",
    autoAdvance: true,
    completeWhenScoreAtLeast: 3
  },
  {
    title: "Turno do Tatu-bola completo!",
    body: "Você expandiu a floresta, adicionou um tatu em semente, moveu outro, protegeu uma peça ao escondê-la e marcou o máximo de 3 pontos. O ciclo ideal é espalhar os tatus entre espécies diferentes e usar a carapaça sem perder compartilhamentos.",
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

export function getTutorialSteps(tutorialId: TutorialId | null): TutorialStepDef[] {
  if (tutorialId === "jaguar") return JAGUAR_TUTORIAL_STEPS;
  if (tutorialId === "wolf") return WOLF_TUTORIAL_STEPS;
  if (tutorialId === "armadillo") return ARMADILLO_TUTORIAL_STEPS;
  // Other species chapters are rebuilt later; default to the basic tutorial.
  return INITIAL_TUTORIAL_STEPS;
}

export function getTutorialPlayerId(tutorialId: TutorialId | null, fallback: string | null): string | null {
  if (tutorialId === "initial") return INITIAL_TUTORIAL_PLAYER_ID;
  if (tutorialId === "jaguar") return JAGUAR_TUTORIAL_PLAYER_ID;
  if (tutorialId === "wolf") return WOLF_TUTORIAL_PLAYER_ID;
  if (tutorialId === "armadillo") return ARMADILLO_TUTORIAL_PLAYER_ID;
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
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_CAPUCHIN_ID, 1, { x: -1, y: 0 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_COATI_ID, 1, { x: 1, y: -1 });
  placeTutorialPiece(game, ARMADILLO_TUTORIAL_MACAW_ID, 1, { x: 0, y: 1 });

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
  game.turnOrder = [ARMADILLO_TUTORIAL_PLAYER_ID];
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
