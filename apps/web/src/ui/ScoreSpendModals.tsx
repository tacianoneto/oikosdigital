import { Check } from "lucide-react";
import { resourceAssets, resourceLabels, speciesDefinitions } from "@oikos/content";
import type { Resource } from "@oikos/shared";
import { ResourceIcon, ResourceText } from "./ResourceText";
import { resourceOrder } from "./gameConstants";
import { speciesVar } from "./speciesStyle";

// Inline "choice-modal" dialogs for the score-spend actions (Onça-pintada · Ação C
// and Lobo-guará · Ação C). Pure presentational; the parent keeps the visibility
// conditions and renders these when the action is available.

interface JaguarScoreModalProps {
  availablePointSpendCount: number;
  completeDisabled: boolean;
  onSpend: (count: number) => void;
  onComplete: () => void;
}

export function JaguarScoreModal({
  availablePointSpendCount,
  completeDisabled,
  onSpend,
  onComplete
}: JaguarScoreModalProps) {
  return (
    <div className="choice-modal-backdrop" role="presentation">
      <div
        className="choice-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Onça-pintada: gastar carne"
        style={speciesVar("jaguar")}
      >
        <header className="choice-modal-head">
          <img src={encodeURI(speciesDefinitions.jaguar.meepleAsset)} alt="" />
          <div>
            <span>Onça-pintada · Ação C</span>
            <h2><ResourceText text="Gastar carne para pontuar" /></h2>
          </div>
        </header>
        <p className="choice-modal-desc">
          Gaste 1 <ResourceIcon resource="meat" /> para marcar 1 ponto, até 3 vezes.{" "}
          <ResourceIcon resource="meat" label="Carnes" /> disponíveis: {availablePointSpendCount}.
        </p>
        <div className="choice-count-grid">
          {[1, 2, 3].map((count) => (
            <button
              key={count}
              className="choice-count-option"
              disabled={count > availablePointSpendCount}
              onClick={() => onSpend(count)}
            >
              <img src={encodeURI(resourceAssets.meat)} alt="" />
              <strong>Gastar {count}</strong>
              <span>+{count} ponto(s)</span>
            </button>
          ))}
        </div>
        <div className="choice-modal-actions">
          <button className="secondary-button" disabled={completeDisabled} onClick={onComplete}>
            Concluir sem gastar
          </button>
        </div>
      </div>
    </div>
  );
}

interface WolfScoreModalProps {
  resources: Partial<Record<Resource, number>>;
  selectedResources: Resource[];
  spendableResources: Resource[];
  availablePointSpendCount: number;
  completeDisabled: boolean;
  onToggleResource: (resource: Resource) => void;
  onSpend: () => void;
  onComplete: () => void;
}

export function WolfScoreModal({
  resources,
  selectedResources,
  spendableResources,
  availablePointSpendCount,
  completeDisabled,
  onToggleResource,
  onSpend,
  onComplete
}: WolfScoreModalProps) {
  return (
    <div className="choice-modal-backdrop" role="presentation">
      <div
        className="choice-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Lobo-guará: gastar recursos"
        style={speciesVar("maned_wolf")}
      >
        <header className="choice-modal-head">
          <img src={encodeURI(speciesDefinitions.maned_wolf.meepleAsset)} alt="" />
          <div>
            <span>Lobo-guará · Ação C</span>
            <h2>Gastar recursos para pontuar</h2>
          </div>
        </header>
        <p className="choice-modal-desc">
          Para cada lobo na floresta, gaste 1 recurso diferente e marque 1 ponto. Limite: 1 por lobo em campo.
        </p>
        <div className="wolf-spend-summary">
          <div>
            <span>Seleção</span>
            <strong>
              {selectedResources.length}/{availablePointSpendCount}
            </strong>
          </div>
          <div>
            <span>Ganho</span>
            <strong>{selectedResources.length} ponto(s)</strong>
          </div>
        </div>
        <div className="wolf-resource-grid">
          {resourceOrder.map((resource) => (
            <button
              className={`wolf-resource-option ${selectedResources.includes(resource) ? "selected" : ""}`}
              data-resource={resource}
              disabled={!spendableResources.includes(resource)}
              key={resource}
              onClick={() => onToggleResource(resource)}
            >
              <img src={resourceAssets[resource]} alt="" />
              <span>{resourceLabels[resource]}</span>
              <strong>{resources[resource] ?? 0}</strong>
            </button>
          ))}
        </div>
        <div className="choice-modal-actions">
          <button
            className="primary-button"
            disabled={selectedResources.length === 0}
            onClick={onSpend}
          >
            <Check aria-hidden="true" />
            Gastar selecionados
          </button>
          <button className="secondary-button" disabled={completeDisabled} onClick={onComplete}>
            Concluir sem gastar
          </button>
        </div>
      </div>
    </div>
  );
}
