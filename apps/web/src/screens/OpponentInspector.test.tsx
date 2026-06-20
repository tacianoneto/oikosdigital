import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { speciesDefinitions } from "@oikos/content";
import type { PlayerState, RoomPlayer } from "@oikos/shared";
import { OpponentInspector } from "./OpponentInspector";
import type { PlayerInspectorEntry } from "../hooks/playerHudState";

function makeEntry(): PlayerInspectorEntry {
  const player = {
    playerId: "p2",
    name: "Rival",
    speciesId: "jaguar"
  } as RoomPlayer;
  const gamePlayer = {
    playerId: "p2",
    speciesId: "jaguar",
    score: 5,
    resources: { meat: 2, egg: 1, fruit: 0, seed: 3, point: 5 }
  } as unknown as PlayerState;

  return {
    displayIndex: 1,
    gamePlayer,
    isActivePlayer: true,
    player,
    species: speciesDefinitions.jaguar
  };
}

describe("OpponentInspector", () => {
  it("renders the opponent rail with score", () => {
    const entry = makeEntry();
    const markup = renderToStaticMarkup(
      <OpponentInspector
        entries={[entry]}
        selectedEntry={null}
        selectedPlayerId={null}
        selectedRailIndex={0}
        resourceLeaders={{}}
        setEffectTarget={() => undefined}
        onSelectPlayer={() => undefined}
      />
    );

    expect(markup).toContain("opponent-inspector");
    expect(markup).toContain("opponent-portrait-btn");
    expect(markup).toContain("5 pontos");
  });

  it("renders the popover for the selected opponent", () => {
    const entry = makeEntry();
    const markup = renderToStaticMarkup(
      <OpponentInspector
        entries={[entry]}
        selectedEntry={entry}
        selectedPlayerId="p2"
        selectedRailIndex={0}
        resourceLeaders={{}}
        setEffectTarget={() => undefined}
        onSelectPlayer={() => undefined}
      />
    );

    expect(markup).toContain("opponent-popover");
    expect(markup).toContain("opponent-resource-grid");
    expect(markup).toContain("opponent-movement-grid");
    expect(markup).toContain("opponent-actions-accordion");
    expect(markup).toContain("Ações da espécie");
    expect(markup).toContain("Gaste 1");
    expect(markup).toContain("para marcar 1 ponto");
  });
});
