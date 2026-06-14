import {
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  TutorialChapterSelect,
  type TutorialCompletionState
} from "./TutorialChapterSelect";
import { TutorialCoach } from "./TutorialCoach";
import type { TutorialStepDef } from "./tutorials";

type TestElement = ReactElement<Record<string, unknown>>;

function collectElements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) {
    return node.flatMap(collectElements);
  }
  if (!isValidElement(node)) return [];

  const element = node as TestElement;
  const children = element.props.children as ReactNode;
  return [element, ...collectElements(children)];
}

const completed: TutorialCompletionState = {
  initial: false,
  jaguar: true,
  wolf: false,
  armadillo: false,
  macaw: false,
  capuchin: false,
  coati: false
};

const steps: TutorialStepDef[] = [
  {
    title: "Primeiro passo",
    body: "Aprenda recursos.",
    gate: "none",
    autoAdvance: false,
    resourceIcons: [{ resource: "fruit", caption: "Fruta" }],
    categoryCards: [
      {
        label: "Especialista",
        color: "#ffffff",
        iconAsset: "/category.webp",
        body: "Descrição da categoria."
      }
    ],
    terms: [{ term: "Reserva", body: "Peças fora da floresta." }]
  },
  {
    title: "Último passo",
    body: "Finalize o capítulo.",
    gate: "none",
    autoAdvance: false
  }
];

describe("TutorialChapterSelect", () => {
  it("renders available, completed and locked chapters", () => {
    const markup = renderToStaticMarkup(
      <TutorialChapterSelect completed={completed} onBack={() => undefined} onStart={() => undefined} />
    );

    expect(markup).toContain("Tutorial básico");
    expect(markup).toContain("Onça-pintada");
    expect(markup).toContain('class="tutorial-chapter is-done"');
    expect(markup).toContain('class="tutorial-chapter is-locked"');
    expect(markup).toContain("Concluído");
    expect(markup).toContain("Em breve");
  });

  it("forwards back and chapter selection callbacks", () => {
    const onBack = vi.fn();
    const onStart = vi.fn();
    const tree = TutorialChapterSelect({ completed, onBack, onStart });
    const elements = collectElements(tree);

    const backButton = elements.find((element) => element.props.className === "flow-back");
    const chapterButtons = elements.filter(
      (element) =>
        element.type === "button" &&
        typeof element.props.className === "string" &&
        element.props.className.startsWith("tutorial-chapter ")
    );

    (backButton?.props.onClick as () => void)();
    (chapterButtons[0]?.props.onClick as () => void)();
    (chapterButtons[1]?.props.onClick as () => void)();

    expect(onBack).toHaveBeenCalledOnce();
    expect(onStart.mock.calls).toEqual([["initial"], ["jaguar"]]);
  });
});

describe("TutorialCoach", () => {
  it("renders progress and optional teaching content", () => {
    const markup = renderToStaticMarkup(
      <TutorialCoach
        currentStep={0}
        steps={steps}
        onComplete={() => undefined}
        onExit={() => undefined}
        onNext={() => undefined}
      />
    );

    expect(markup).toContain("Passo 1/2");
    expect(markup).toContain('class="tutorial-dot active"');
    expect(markup).toContain("Fruta");
    expect(markup).toContain("Especialista");
    expect(markup).toContain("Reserva");
    expect(markup).toContain("Próximo");
    expect(markup).not.toContain("Concluir");
  });

  it("forwards exit, next and complete callbacks", () => {
    const onExit = vi.fn();
    const onNext = vi.fn();
    const onComplete = vi.fn();

    const firstStepElements = collectElements(
      TutorialCoach({ currentStep: 0, steps, onExit, onNext, onComplete })
    );
    const firstStepButtons = firstStepElements.filter((element) => element.type === "button");
    (firstStepButtons.find((element) => element.props.className === "tutorial-coach-exit")?.props
      .onClick as () => void)();
    (firstStepButtons.find((element) => element.props.className === "primary-button")?.props
      .onClick as () => void)();

    const lastStepElements = collectElements(
      TutorialCoach({ currentStep: 1, steps, onExit, onNext, onComplete })
    );
    (lastStepElements.find((element) => element.props.className === "primary-button")?.props
      .onClick as () => void)();

    expect(onExit).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("hides manual advancement for auto-advance steps", () => {
    const markup = renderToStaticMarkup(
      <TutorialCoach
        currentStep={0}
        steps={[{ ...steps[0], autoAdvance: true }]}
        onComplete={() => undefined}
        onExit={() => undefined}
        onNext={() => undefined}
      />
    );

    expect(markup).toContain("Sair");
    expect(markup).not.toContain("Próximo");
    expect(markup).not.toContain("Concluir");
  });
});
