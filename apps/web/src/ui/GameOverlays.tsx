import type { CSSProperties } from "react";
import { AlertTriangle, Leaf, X } from "lucide-react";
import type {
  ObjectiveCardDefinition,
  ScenarioCardDefinition,
  ThreatCardDefinition
} from "@oikos/shared";
import { resourceAssets } from "@oikos/content";
import { ResourceText } from "./ResourceText";

export type ExpansionPreviewKind = "objective" | "scenarios" | "threat";

interface ExpansionPreviewOverlayProps {
  kind: ExpansionPreviewKind;
  origin: { x: number; y: number } | null;
  objective: ObjectiveCardDefinition | null;
  objectiveDiscarded: boolean;
  objectiveScoresPoints: boolean;
  objectiveProgress: number;
  canDiscardObjective: boolean;
  scenarios: ScenarioCardDefinition[];
  threat: ThreatCardDefinition | null;
  onClose: () => void;
  onDiscardObjective: () => void;
}

export function ExpansionPreviewOverlay({
  kind,
  origin,
  objective,
  objectiveDiscarded,
  objectiveScoresPoints,
  objectiveProgress,
  canDiscardObjective,
  scenarios,
  threat,
  onClose,
  onDiscardObjective
}: ExpansionPreviewOverlayProps) {
  const originStyle =
    origin && typeof window !== "undefined"
      ? ({
          "--from-x": `${origin.x - window.innerWidth / 2}px`,
          "--from-y": `${origin.y - window.innerHeight / 2}px`
        } as CSSProperties)
      : undefined;

  return (
    <div className="expansion-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`expansion-preview is-${kind}`}
        role="dialog"
        aria-modal="true"
        aria-label="Carta da partida"
        onClick={(event) => event.stopPropagation()}
        style={originStyle}
      >
        <button
          type="button"
          className="expansion-preview-close"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>

        {kind === "objective" && objective && (
          <>
            <img
              src={encodeURI(objective.imagePath)}
              alt={objective.label}
              draggable={false}
            />
            {objectiveDiscarded && (
              <div className="objective-progress is-discarded" role="status">
                <X aria-hidden="true" />
                <span>Objetivo descartado</span>
              </div>
            )}
            {objectiveScoresPoints && (
              <div
                className={`objective-progress ${objectiveProgress > 0 ? "is-scoring" : "is-pending"}`}
                role="status"
              >
                <img src={encodeURI(resourceAssets.point)} alt="" />
                {objectiveProgress > 0 ? (
                  <span>
                    Fazendo <strong>{objectiveProgress}</strong> ponto
                    {objectiveProgress > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span>Ainda sem pontos</span>
                )}
              </div>
            )}
            {canDiscardObjective && (
              <button
                type="button"
                className="objective-discard-btn"
                onClick={onDiscardObjective}
              >
                <Leaf aria-hidden="true" />
                <span className="objective-discard-text">
                  <strong>Descartar</strong>
                  <small>Ganhe 1 de cada recurso</small>
                </span>
              </button>
            )}
          </>
        )}

        {kind === "scenarios" && (
          <div className="expansion-preview-stack">
            {scenarios.map((scenario) => (
              <img
                key={scenario.id}
                src={encodeURI(scenario.imagePath)}
                alt={scenario.label}
                draggable={false}
              />
            ))}
          </div>
        )}

        {kind === "threat" && threat?.imagePath && (
          <img
            src={encodeURI(threat.imagePath)}
            alt={threat.label}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}

export function ThreatRevealOverlay({
  threat,
  onClose
}: {
  threat: ThreatCardDefinition;
  onClose: () => void;
}) {
  return (
    <div className="threat-reveal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="threat-reveal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Nova ameaca: ${threat.label}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="expansion-preview-close threat-reveal-close"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
        <div className="threat-reveal-badge">
          <AlertTriangle aria-hidden="true" />
          <span>Nova ameaca</span>
        </div>
        {threat.imagePath ? (
          <img
            src={encodeURI(threat.imagePath)}
            alt={threat.label}
            draggable={false}
          />
        ) : (
          <div className="threat-reveal-icon">
            <AlertTriangle aria-hidden="true" />
          </div>
        )}
        <strong className="threat-reveal-name">{threat.label}</strong>
        <p className="threat-reveal-desc">
          <ResourceText text={threat.description} />
        </p>
        <span className="threat-reveal-progress" aria-hidden="true" />
      </div>
    </div>
  );
}
