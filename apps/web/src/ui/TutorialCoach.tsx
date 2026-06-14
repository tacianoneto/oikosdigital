import type { CSSProperties } from "react";
import { resourceAssets } from "@oikos/content";
import { ResourceText } from "./ResourceText";
import type { TutorialStepDef } from "./tutorials";

interface TutorialCoachProps {
  currentStep: number;
  steps: TutorialStepDef[];
  onComplete: () => void;
  onExit: () => void;
  onNext: () => void;
}

export function TutorialCoach({
  currentStep,
  steps,
  onComplete,
  onExit,
  onNext
}: TutorialCoachProps) {
  const step = steps[currentStep];
  if (!step) return null;

  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="tutorial-coach" role="dialog" aria-live="polite">
      <div className="tutorial-coach-progress" aria-hidden="true">
        {steps.map((_, index) => (
          <span
            key={index}
            className={`tutorial-dot ${
              index === currentStep ? "active" : index < currentStep ? "done" : ""
            }`}
          />
        ))}
      </div>
      <div className="tutorial-coach-body">
        <span className="tutorial-coach-step">
          Passo {currentStep + 1}/{steps.length}
        </span>
        <h3>
          <ResourceText text={step.title} />
        </h3>
        <p>
          <ResourceText text={step.body} />
        </p>
        {step.resourceIcons && step.resourceIcons.length > 0 && (
          <ul className="tutorial-coach-resources">
            {step.resourceIcons.map((icon) => (
              <li key={`${icon.resource}-${icon.caption}`}>
                <img src={encodeURI(resourceAssets[icon.resource])} alt="" />
                <span>{icon.caption}</span>
              </li>
            ))}
          </ul>
        )}
        {step.categoryCards && step.categoryCards.length > 0 && (
          <ul className="tutorial-coach-categories">
            {step.categoryCards.map((card) => (
              <li key={card.label} style={{ "--cat-color": card.color } as CSSProperties}>
                <img src={encodeURI(card.iconAsset)} alt="" />
                <span className="tutorial-coach-category-text">
                  <strong>{card.label}</strong>
                  <small>
                    <ResourceText text={card.body} />
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}
        {step.terms && step.terms.length > 0 && (
          <dl className="tutorial-coach-terms">
            {step.terms.map((entry) => (
              <div key={entry.term}>
                <dt>{entry.term}</dt>
                <dd>
                  <ResourceText text={entry.body} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="tutorial-coach-actions">
        <button type="button" className="tutorial-coach-exit" onClick={onExit}>
          Sair
        </button>
        {!step.autoAdvance &&
          (isLastStep ? (
            <button type="button" className="primary-button" onClick={onComplete}>
              Concluir
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={onNext}>
              Próximo
            </button>
          ))}
      </div>
    </div>
  );
}
