import type { ActionId, GameState, GridPosition, Habitat, MovementKind, PlayerState, Resource } from "@oikos/shared";

type EffectSource = "threat" | "scenario" | "species";

interface MovementContext {
  speciesId: string;
  playerId: string;
  origin: GridPosition;
  actionId?: ActionId | null;
  habitat?: Habitat | null;
}

interface CollectionContext {
  playerId: string;
  resource: Resource;
  habitat: Habitat | null;
}

interface EndTurnContext {
  game: GameState;
  player: PlayerState;
}

interface RuleEffect {
  id: string;
  source: EffectSource;
  active: (game: GameState) => boolean;
  movementOverride?: (game: GameState, context: MovementContext) => MovementKind | null;
  collectionBlockReason?: (game: GameState, context: CollectionContext) => string | null;
  onEndTurn?: (context: EndTurnContext) => { paused: boolean } | void;
}

const allResources: Resource[] = ["meat", "egg", "fruit", "seed"];

const ruleEffects: RuleEffect[] = [
  {
    id: "threat_1_seca",
    source: "threat",
    active: (game) => game.activeThreatCardId === "threat_1",
    collectionBlockReason: (_game, context) =>
      context.habitat === "river" ? "Seca bloqueia coletas em rio" : null
  },
  {
    id: "threat_3_queimada",
    source: "threat",
    active: (game) => game.activeThreatCardId === "threat_3",
    collectionBlockReason: (_game, context) =>
      context.resource === "egg" ? "Queimada bloqueia ovos" : null
  },
  {
    id: "threat_4_caca_ilegal",
    source: "threat",
    active: (game) => game.activeThreatCardId === "threat_4",
    onEndTurn: ({ game, player }) => {
      const hasPieces = player.speciesId !== "jaguar" && player.piecesInForest.length > 0;
      const totalResources = allResources.reduce((sum, resource) => sum + (player.resources[resource] ?? 0), 0);
      if (!hasPieces && totalResources === 0) return { paused: false };

      game.cacaIlegalPending = { playerId: player.playerId };
      game.log = [
        ...game.log,
        {
          id: `caca_ilegal_pending_${player.playerId}_${player.turnsTaken}`,
          message: `${player.name} precisa resolver Caca ilegal: remover 1 peca propria ou gastar o recurso que mais possui.`,
          createdAt: Date.now()
        }
      ];
      return { paused: true };
    }
  },
  {
    id: "threat_5_poluicao",
    source: "threat",
    active: (game) => game.activeThreatCardId === "threat_5",
    collectionBlockReason: (_game, context) =>
      context.resource === "seed" ? "Poluicao bloqueia pinhas" : null
  },
  {
    id: "threat_6_enchente",
    source: "threat",
    active: (game) => game.activeThreatCardId === "threat_6",
    movementOverride: () => "adjacent"
  },
  {
    id: "threat_7_erosao",
    source: "threat",
    active: (game) => game.activeThreatCardId === "threat_7",
    collectionBlockReason: (_game, context) =>
      context.resource === "fruit" ? "Erosao bloqueia frutas" : null
  },
  {
    id: "threat_8_infestacao",
    source: "threat",
    active: (game) => game.activeThreatCardId === "threat_8",
    onEndTurn: ({ game, player }) => {
      const previousScore = player.score;
      player.score = Math.max(0, player.score - 1);
      game.log = [
        ...game.log,
        {
          id: `threat_infestacao_${player.playerId}_${player.turnsTaken}`,
          message:
            previousScore > player.score
              ? `${player.name} perdeu 1 ponto por Infestacao.`
              : `${player.name} nao tinha pontos para perder por Infestacao.`,
          createdAt: Date.now()
        }
      ];
      return { paused: false };
    }
  }
];

function activeRuleEffects(game: GameState): RuleEffect[] {
  return ruleEffects.filter((effect) => effect.active(game));
}

export function getMovementKindOverride(game: GameState, context: MovementContext): MovementKind | null {
  for (const effect of activeRuleEffects(game)) {
    const override = effect.movementOverride?.(game, context);
    if (override) return override;
  }
  return null;
}

export function getCollectionBlockReason(game: GameState, context: CollectionContext): string | null {
  for (const effect of activeRuleEffects(game)) {
    const reason = effect.collectionBlockReason?.(game, context);
    if (reason) return reason;
  }
  return null;
}

export function applyEndTurnRuleEffects(game: GameState, player: PlayerState): { paused: boolean } {
  for (const effect of activeRuleEffects(game)) {
    const result = effect.onEndTurn?.({ game, player });
    if (result?.paused) return { paused: true };
  }
  return { paused: false };
}
