import { createInitialGameState } from "@oikos/rules";
import type { ForestCardState, PublicRoomState, RoomPlayer } from "@oikos/shared";
import { localRoomId } from "../gameConstants";
import { placeTutorialPiece } from "./helpers";
import type { TutorialStepDef } from "./types";

export const TUTORIAL_NONRIVER_CARD = "bosque_1"; // bosque (forest), no river
const TUTORIAL_RIVER_CARD = "rio_3"; // rio bend, must be rotated to connect
export const INITIAL_TUTORIAL_PLAYER_ID = "local_basic_tutorial";

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
export const INITIAL_TUTORIAL_STEPS: TutorialStepDef[] = [
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
