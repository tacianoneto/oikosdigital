import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { objectiveCards, scenarioCards, threatCards } from "@oikos/content";
import { ExpansionPreviewOverlay, ThreatRevealOverlay } from "./GameOverlays";

type TestElement = ReactElement<Record<string, unknown>>;

function collectElements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) return node.flatMap(collectElements);
  if (!isValidElement(node)) return [];

  const element = node as TestElement;
  return [element, ...collectElements(element.props.children as ReactNode)];
}

const objective = objectiveCards[0];
const scenario = scenarioCards[0];
const threat = threatCards[0];

describe("ExpansionPreviewOverlay", () => {
  it("renders objective progress and forwards discard and close actions", () => {
    const onClose = vi.fn();
    const onDiscardObjective = vi.fn();
    const tree = ExpansionPreviewOverlay({
      kind: "objective",
      origin: null,
      objective,
      objectiveDiscarded: false,
      objectiveScoresPoints: true,
      objectiveProgress: 2,
      canDiscardObjective: true,
      scenarios: [],
      threat: null,
      onClose,
      onDiscardObjective
    });
    const markup = renderToStaticMarkup(tree);
    const elements = collectElements(tree);
    const backdrop = elements.find(
      (element) => element.props.className === "expansion-modal-backdrop"
    );
    const closeButton = elements.find(
      (element) => element.props.className === "expansion-preview-close"
    );
    const discardButton = elements.find(
      (element) => element.props.className === "objective-discard-btn"
    );

    (backdrop?.props.onClick as () => void)();
    (closeButton?.props.onClick as () => void)();
    (discardButton?.props.onClick as () => void)();

    expect(markup).toContain(objective.label);
    expect(markup).toContain("Fazendo <strong>2</strong> pontos");
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onDiscardObjective).toHaveBeenCalledOnce();
  });

  it("renders scenario cards", () => {
    const markup = renderToStaticMarkup(
      <ExpansionPreviewOverlay
        kind="scenarios"
        origin={null}
        objective={null}
        objectiveDiscarded={false}
        objectiveScoresPoints={false}
        objectiveProgress={0}
        canDiscardObjective={false}
        scenarios={[scenario]}
        threat={null}
        onClose={() => undefined}
        onDiscardObjective={() => undefined}
      />
    );

    expect(markup).toContain(scenario.label);
    expect(markup).toContain(encodeURI(scenario.imagePath));
  });
});

describe("ThreatRevealOverlay", () => {
  it("renders threat details and forwards close", () => {
    const onClose = vi.fn();
    const tree = ThreatRevealOverlay({ threat, onClose });
    const markup = renderToStaticMarkup(tree);
    const closeButton = collectElements(tree).find(
      (element) =>
        element.type === "button" &&
        element.props.className === "expansion-preview-close threat-reveal-close"
    );

    (closeButton?.props.onClick as () => void)();

    expect(markup).toContain(threat.label);
    expect(markup).toContain("Durante este turno");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
