import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TurnRecapPanel } from "./TurnRecapPanel";
import type { TurnRecapState, TurnSummary } from "./turnSummary";

function makeSummary(): TurnSummary {
  return {
    key: 1,
    playerName: "Taciano",
    speciesId: "jaguar",
    scoreDelta: 3,
    entries: [
      { id: "e1", icon: "score", text: "Marcou pontos", points: 3, cardInstanceIds: [] },
      { id: "e2", icon: "move", text: "Moveu peça", cardInstanceIds: ["c1"] }
    ]
  };
}

describe("TurnRecapPanel", () => {
  it("renders the previous turn with player, score and entries", () => {
    const summary = makeSummary();
    const recap: TurnRecapState = { history: [summary], index: 0, visible: true };

    const markup = renderToStaticMarkup(
      <TurnRecapPanel
        turnSummary={summary}
        turnRecap={recap}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        onMoveHistory={() => undefined}
        onClose={() => undefined}
        onHoverEntry={() => undefined}
      />
    );

    expect(markup).toContain("Taciano");
    expect(markup).toContain("+3");
    expect(markup).toContain("Marcou pontos");
    expect(markup).toContain("Moveu peça");
    expect(markup).toContain("1/1");
  });

  it("hides the entry list when collapsed", () => {
    const summary = makeSummary();
    const recap: TurnRecapState = { history: [summary], index: 0, visible: true };

    const markup = renderToStaticMarkup(
      <TurnRecapPanel
        turnSummary={summary}
        turnRecap={recap}
        collapsed
        onToggleCollapsed={() => undefined}
        onMoveHistory={() => undefined}
        onClose={() => undefined}
        onHoverEntry={() => undefined}
      />
    );

    expect(markup).not.toContain("turn-recap-list");
  });
});
