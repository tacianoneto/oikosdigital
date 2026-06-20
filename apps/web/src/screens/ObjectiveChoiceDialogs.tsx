import { Check, Eye, Leaf, Trophy, X } from "lucide-react";
import { getObjectiveCardDefinition } from "@oikos/content";
import type { ObjectiveCardDefinition } from "@oikos/shared";

interface ObjectiveChoiceDialogsProps {
  showChoice: boolean;
  objectiveChoices: ObjectiveCardDefinition[];
  pendingObjectiveCardId: string | null;
  expandedObjectiveCardId: string | null;
  canDiscardSelectedObjective: boolean;
  selectedObjectiveCardId: string | null | undefined;
  onSelectObjective: (cardId: string) => void;
  onExpand: (cardId: string | null) => void;
  onDiscardObjective: () => void;
}

// Objective-card flow: the pick-one-of-two choice modal plus the expandable
// full-card preview (with optional discard-for-resources action).
export function ObjectiveChoiceDialogs({
  showChoice,
  objectiveChoices,
  pendingObjectiveCardId,
  expandedObjectiveCardId,
  canDiscardSelectedObjective,
  selectedObjectiveCardId,
  onSelectObjective,
  onExpand,
  onDiscardObjective
}: ObjectiveChoiceDialogsProps) {
  return (
    <>
      {showChoice && (
        <div className="choice-modal-backdrop objective-choice-backdrop" role="presentation">
          <div className="choice-modal objective-choice-modal" role="dialog" aria-modal="true" aria-label="Escolha objetivo">
            <header className="objective-choice-header">
              <span className="objective-choice-eyebrow">
                <Trophy aria-hidden="true" /> Carta de objetivo
              </span>
              <h2>Escolha seu objetivo</h2>
              <p>Fique com 1 carta. A outra será descartada.</p>
            </header>
            <div className="objective-choice-grid">
              {objectiveChoices.map((card, index) => {
                const isPending = pendingObjectiveCardId === card.id;
                return (
                  <div
                    className={`objective-choice-card ${isPending ? "is-pending" : ""} ${
                      pendingObjectiveCardId && !isPending ? "is-dimmed" : ""
                    }`}
                    key={card.id}
                  >
                    <button
                      type="button"
                      className="objective-choice-pick"
                      disabled={Boolean(pendingObjectiveCardId)}
                      onClick={() => onSelectObjective(card.id)}
                    >
                      <span className="objective-choice-badge">{index + 1}</span>
                      <span className="objective-choice-art">
                        <img src={encodeURI(card.imagePath)} alt={card.label} />
                      </span>
                      <span className="objective-choice-cta">
                        {isPending ? (
                          <>
                            <Check aria-hidden="true" /> Objetivo escolhido
                          </>
                        ) : (
                          "Escolher este objetivo"
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="objective-choice-zoom"
                      aria-label="Ampliar carta"
                      title="Ampliar"
                      onClick={() => onExpand(card.id)}
                    >
                      <Eye aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
              <span className="objective-choice-or" aria-hidden="true">ou</span>
            </div>
          </div>
        </div>
      )}

      {expandedObjectiveCardId && (
        <div className="choice-modal-backdrop objective-preview-backdrop" role="presentation" onClick={() => onExpand(null)}>
          <div className="objective-preview-modal" role="dialog" aria-modal="true" aria-label="Carta de objetivo" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="board-modal-close objective-preview-close"
              aria-label="Fechar objetivo"
              onClick={() => onExpand(null)}
            >
              <X aria-hidden="true" />
            </button>
            <img
              src={encodeURI(getObjectiveCardDefinition(expandedObjectiveCardId).imagePath)}
              alt={getObjectiveCardDefinition(expandedObjectiveCardId).label}
            />
            {canDiscardSelectedObjective && expandedObjectiveCardId === selectedObjectiveCardId && (
              <button
                type="button"
                className="objective-discard-btn objective-preview-discard-btn"
                onClick={onDiscardObjective}
              >
                <Leaf aria-hidden="true" />
                <span className="objective-discard-text">
                  <strong>Descartar</strong>
                  <small>Ganhe 1 de cada recurso</small>
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
