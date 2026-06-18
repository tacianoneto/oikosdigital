import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { speciesDefinitions } from "@oikos/content";
import type { GameState, PlayerState } from "@oikos/shared";
import { LeftActionDock } from "./LeftActionDock";

const player: PlayerState = {
  playerId: "player-1",
  name: "Jogador",
  speciesId: "maned_wolf",
  score: 2,
  resources: {
    meat: 1,
    fruit: 0,
    egg: 0,
    seed: 0
  },
  hand: [],
  objectiveChoices: [],
  selectedObjectiveCardId: null,
  discardedObjectiveCardId: null,
  reservePieces: ["reserve-1"],
  piecesInForest: ["piece-1"],
  turnsTaken: 0
};

function game(status: GameState["status"]): GameState {
  return {
    gameId: "game-1",
    status,
    enabledMiniExpansions: [],
    round: 1,
    maxRounds: 5,
    activePlayerId: status === "active" ? player.playerId : null,
    activeActionIndex: 1,
    activePlayedForestCardId: null,
    pendingCoatiPairBonus: null,
    pendingMacawMovedPiece: null,
    pendingGaloInterrupt: null,
    pendingWolfMoves: null,
    pendingExtraTurnPlayerId: null,
    extraTurnPlayerId: null,
    resolvedExtraTurnPlayerIds: [],
    pendingSeedSpendObjectivePlayerId: null,
    acceptedSeedSpendObjectivePlayerIds: [],
    resolvedSeedSpendObjectivePlayerIds: [],
    resolvedCoatiPairBonuses: [],
    setupActivePlayerId: status === "setup" ? player.playerId : null,
    turnOrder: [player.playerId],
    setupOrder: [player.playerId],
    players: [player],
    pieces: [],
    forest: { cards: [] },
    deck: { commonCardIds: [], initialCandidateIds: [] },
    log: [],
    contentWarnings: [],
    finalScoreBreakdown: null,
    winnerPlayerIds: [],
    activeScenarioIds: [],
    activeThreatCardId: null,
    threatDeckIds: [],
    threatDiscardIds: [],
    cerradoTriggeredByPlayer: {},
    cerradoPending: null,
    caatingaUsedByPlayer: {},
    caatingaPending: null,
    mataAtlanticaPiles: null,
    mataAtlanticaDiscardByPlayer: {},
    cacaIlegalPending: null
  };
}

const noop = () => undefined;

describe("LeftActionDock", () => {
  it("renders setup progress", () => {
    const markup = renderToStaticMarkup(
      <LeftActionDock
        activeActionId={null}
        activeGamePlayer={null}
        activeSpecies={null}
        armadilloHideablePieceCount={0}
        armadilloShareScore={0}
        canControlActivePlayer={false}
        canPlaceSetupPiece
        canResolveCacaIlegal={false}
        canSkipJaguarMove={false}
        capuchinHabitatScore={0}
        capuchinPlacementTargetCount={0}
        capuchinReserveCount={0}
        cacaIlegalPending={false}
        cacaIlegalRemovalMode={false}
        collapsed={false}
        currentGamePlayer={player}
        game={game("setup")}
        hasPendingCoatiPairBonus={false}
        hasSelectedJaguarDestination={false}
        hasTurnRecap={false}
        isBasicTutorial={false}
        macawEggTargetCount={0}
        macawLineScore={0}
        requiredCoatiRemovalCount={0}
        selectedPieceId={null}
        selectedRemovalPieceIds={[]}
        selectedWolfTargetPieceId={null}
        setupActivePlayer={player}
        setupNeeded={2}
        setupPlaced={1}
        tutorialActive={false}
        wolfMeatTargetCount={0}
        wolfRemovableBasePieceCount={0}
        onCancelCacaIlegalRemoval={noop}
        onCompleteAction={noop}
        onHideArmadillo={noop}
        onRemoveSelectedPieces={noop}
        onRemoveWolfBasePiece={noop}
        onResolveSelectedCacaIlegalPiece={noop}
      />
    );

    expect(markup).toContain("Setup");
    expect(markup).toContain("1/2");
    expect(markup).toContain("Clique em qualquer carta da floresta inicial.");
  });

  it("renders active wolf action controls", () => {
    const markup = renderToStaticMarkup(
      <LeftActionDock
        activeActionId="B"
        activeGamePlayer={player}
        activeSpecies={speciesDefinitions.maned_wolf}
        armadilloHideablePieceCount={0}
        armadilloShareScore={0}
        canControlActivePlayer
        canPlaceSetupPiece={false}
        canResolveCacaIlegal={false}
        canSkipJaguarMove={false}
        capuchinHabitatScore={0}
        capuchinPlacementTargetCount={0}
        capuchinReserveCount={0}
        cacaIlegalPending={false}
        cacaIlegalRemovalMode={false}
        collapsed
        currentGamePlayer={player}
        game={game("active")}
        hasPendingCoatiPairBonus={false}
        hasSelectedJaguarDestination={false}
        hasTurnRecap
        isBasicTutorial={false}
        macawEggTargetCount={0}
        macawLineScore={0}
        requiredCoatiRemovalCount={0}
        selectedPieceId={null}
        selectedRemovalPieceIds={[]}
        selectedWolfTargetPieceId="target-1"
        setupActivePlayer={null}
        setupNeeded={0}
        setupPlaced={0}
        tutorialActive={false}
        wolfMeatTargetCount={0}
        wolfRemovableBasePieceCount={1}
        onCancelCacaIlegalRemoval={noop}
        onCompleteAction={noop}
        onHideArmadillo={noop}
        onRemoveSelectedPieces={noop}
        onRemoveWolfBasePiece={noop}
        onResolveSelectedCacaIlegalPiece={noop}
      />
    );

    expect(markup).toContain("hud-action hud-dock hud-left is-collapsed has-turn-recap");
    expect(markup).toContain("Turno ativo");
    expect(markup).toContain("Alvos válidos");
    expect(markup).toContain("Remover peça");
  });
});
