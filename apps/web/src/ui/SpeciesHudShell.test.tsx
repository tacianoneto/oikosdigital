import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlayerState, Resource } from "@oikos/shared";
import { SpeciesHudShell } from "./SpeciesHudShell";

const player: PlayerState = {
  playerId: "player-1",
  name: "Jogador",
  speciesId: "armadillo",
  score: 3,
  resources: {
    meat: 1,
    fruit: 2,
    egg: 3,
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

const resourceMajority: Record<Resource, boolean> = {
  meat: true,
  fruit: false,
  egg: false,
  seed: false
};

describe("SpeciesHudShell", () => {
  const variants = [
    ["jaguar", "jaguar"],
    ["wolf", "maned_wolf"],
    ["tatu", "armadillo"],
    ["macaw", "macaw"],
    ["galo", "galo_de_campina"],
    ["capuchin", "capuchin"],
    ["coati", "coati"]
  ] as const;

  function renderShell(visualKey: (typeof variants)[number][0], speciesId: (typeof variants)[number][1]) {
    return renderToStaticMarkup(
      <SpeciesHudShell
        speciesId={speciesId}
        player={{ ...player, speciesId }}
        activeActionId="B"
        resourceMajority={resourceMajority}
        showObjective
        objectiveCompleted
        objectiveDiscarded={false}
        showScenarios
        showThreat={false}
        setEffectTarget={() => undefined}
        onExpansionToggle={() => undefined}
      >
        <div className="species-action-content">Conteúdo específico</div>
      </SpeciesHudShell>
    );
  }

  it.each(variants)("preserves the %s visual alias for %s", (visualKey, speciesId) => {
    const markup = renderShell(visualKey, speciesId);

    expect(markup).toContain(`class="hud-overlay-${visualKey}"`);
    expect(markup).toContain(`class="hud-top-${visualKey}"`);
    expect(markup).toContain(`class="hud-bottom-${visualKey}"`);
    expect(markup).toContain(`class="hud-bottom-${visualKey}-action-text"`);
    expect(markup).toContain(`class="hud-top-${visualKey}-bg"`);
    expect(markup).toContain(`class="hud-bottom-${visualKey}-bg"`);
    expect(markup).toContain(`class="hud-bottom-${visualKey}-movements"`);
  });

  it("preserves resource order and expansion visibility", () => {
    const markup = renderShell("tatu", "armadillo");

    expect(markup).toContain('class="hud-bottom-tatu-resource-item res-meat is-majority"');
    expect(markup).toContain('class="species-action-content"');
    expect(markup).toContain('title="Ver Objetivo"');
    expect(markup).toContain('title="Ver Cenários"');
    expect(markup).not.toContain('title="Ver Ameaça"');

    const resources = [...markup.matchAll(/data-resource="(meat|fruit|egg|seed)"/g)].map(
      (match) => match[1]
    );
    expect(resources).toEqual(["meat", "fruit", "egg", "seed"]);
  });
});
