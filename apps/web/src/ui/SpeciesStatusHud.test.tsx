import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { speciesDefinitions } from "@oikos/content";
import type { PlayerState } from "@oikos/shared";
import { SpeciesStatusHud } from "./SpeciesStatusHud";

const player: PlayerState = {
  playerId: "player-1",
  name: "Jogador",
  speciesId: "maned_wolf",
  score: 3,
  resources: {
    meat: 2,
    fruit: 1,
    egg: 0,
    seed: 4
  },
  hand: [],
  objectiveChoices: [],
  selectedObjectiveCardId: null,
  discardedObjectiveCardId: null,
  reservePieces: ["piece-1"],
  piecesInForest: [],
  turnsTaken: 0
};

describe("SpeciesStatusHud", () => {
  it("renders the player status and resource majority", () => {
    const markup = renderToStaticMarkup(
      <SpeciesStatusHud
        collapsed={false}
        floatingGains={[{ id: 1, resource: "meat", amount: 1 }]}
        isBasicTutorial={false}
        isControlledPlayer
        player={player}
        resourceLeaders={{ meat: new Set([player.playerId]) }}
        species={speciesDefinitions.maned_wolf}
        setEffectTarget={() => undefined}
        onToggleCollapsed={() => undefined}
      />
    );

    expect(markup).toContain('data-species="maned_wolf"');
    expect(markup).toContain("Controlando");
    expect(markup).toContain("Lobo-guará");
    expect(markup).toContain("Jogador");
    expect(markup).toContain('class="resource-chip is-majority"');
    expect(markup).toContain("+1 Carne");
  });

  it("preserves the collapsed state and spectator label", () => {
    const markup = renderToStaticMarkup(
      <SpeciesStatusHud
        collapsed
        floatingGains={[]}
        isBasicTutorial={false}
        isControlledPlayer={false}
        player={player}
        resourceLeaders={{}}
        species={speciesDefinitions.maned_wolf}
        setEffectTarget={() => undefined}
        onToggleCollapsed={() => undefined}
      />
    );

    expect(markup).toContain("hud-species panel-block species-hud is-collapsed");
    expect(markup).toContain("Vez atual");
    expect(markup).toContain('aria-label="Expandir painel da espécie"');
  });
});
