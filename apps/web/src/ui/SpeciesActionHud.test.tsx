import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  ActionId,
  GameState,
  PlayerState,
  Resource,
  SpeciesId
} from "@oikos/shared";
import { SpeciesActionHud } from "./SpeciesActionHud";

const resourceMajority: Record<Resource, boolean> = {
  meat: false,
  fruit: false,
  egg: false,
  seed: false
};

function createPlayer(speciesId: SpeciesId): PlayerState {
  return {
    playerId: "player-1",
    name: "Jogador",
    speciesId,
    score: 0,
    resources: { meat: 1, fruit: 1, egg: 1, seed: 1 },
    hand: [],
    objectiveChoices: [],
    selectedObjectiveCardId: null,
    discardedObjectiveCardId: null,
    reservePieces: [],
    piecesInForest: [],
    turnsTaken: 0
  };
}

function createGame(activePlayerId = "player-1"): GameState {
  return {
    status: "active",
    activePlayerId,
    activePlayedForestCardId: null,
    pendingWolfMoves: null,
    pendingGaloInterrupt: null
  } as unknown as GameState;
}

function renderHud(speciesId: SpeciesId, activeActionId: ActionId, activePlayerId = "player-1") {
  const player = createPlayer(speciesId);
  return renderToStaticMarkup(
    <SpeciesActionHud
      game={createGame(activePlayerId)}
      player={player}
      activeActionId={activeActionId}
      resourceMajority={resourceMajority}
      showObjective={false}
      objectiveCompleted={false}
      objectiveDiscarded={false}
      showScenarios={false}
      showThreat={false}
      setEffectTarget={() => undefined}
      onExpansionToggle={() => undefined}
      tutorialActive={false}
      canSkipJaguarMove={false}
      selectedJaguarDestination={null}
      selectedPieceId={null}
      selectedWolfTargetPieceId={null}
      selectedRemovalPieceIds={[]}
      wolfRemovableBasePieceCount={0}
      wolfMeatTargetCount={2}
      armadilloHideablePieceCount={0}
      armadilloSharing={null}
      macawActionCTargetCount={0}
      macawLineScore={2}
      galoScore={1}
      capuchinReserveCount={2}
      capuchinPlacementTargetCount={1}
      capuchinHabitatScore={3}
      requiredCoatiRemovalCount={0}
      hasPendingCoatiPairBonus={false}
      onCompleteAction={() => undefined}
      onHideArmadillo={() => undefined}
      onRemoveWolfBasePiece={() => undefined}
      onRemoveSelectedPieces={() => undefined}
    />
  );
}

describe("SpeciesActionHud", () => {
  it.each([
    ["jaguar", "C", "Defina quantas"],
    ["maned_wolf", "D", "Locais válidos"],
    ["armadillo", "B", "Selecione um Tatu-bola"],
    ["macaw", "D", "formações lineares"],
    ["galo_de_campina", "D", "3 pontos menos"],
    ["capuchin", "D", "habitats dominados"],
    ["coati", "B", "Selecione um quati"]
  ] as const)("renders %s action content", (speciesId, actionId, expectedText) => {
    expect(renderHud(speciesId, actionId)).toContain(expectedText);
  });

  it("keeps species action content hidden for inactive players", () => {
    const markup = renderHud("macaw", "D", "player-2");

    expect(markup).toContain("hud-overlay-macaw");
    expect(markup).not.toContain("formações lineares");
  });
});
