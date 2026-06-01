import { useEffect, useState, type CSSProperties } from "react";
import type { ActionId, SpeciesId } from "@oikos/shared";
import { speciesDefinitions } from "@oikos/content";
import { getActionDescription } from "./actionDescriptions";

interface ActionStepsViewerProps {
  speciesId: SpeciesId;
  activeActionId: ActionId | null;
  accent?: string;
  variant?: "hud" | "card";
}

/**
 * Lists every action of a species so the player can preview any step's text
 * without changing game state. The active step is visually emphasized; clicking
 * a tab only swaps the preview pane and never advances the turn.
 */
export function ActionStepsViewer({
  speciesId,
  activeActionId,
  accent,
  variant = "hud"
}: ActionStepsViewerProps) {
  const species = speciesDefinitions[speciesId];
  const actions = species.actions;
  const fallback: ActionId = activeActionId ?? actions[0] ?? "A";
  const [selected, setSelected] = useState<ActionId>(fallback);

  // Sync the preview to the active step whenever the turn advances or species
  // changes, so the panel snaps back to "what you must do now" by default.
  useEffect(() => {
    if (activeActionId) {
      setSelected(activeActionId);
    } else if (actions.length > 0) {
      setSelected(actions[0]);
    }
  }, [activeActionId, speciesId, actions]);

  const style = accent ? ({ "--action-accent": accent } as CSSProperties) : undefined;

  return (
    <div className={`action-steps action-steps--${variant}`} style={style}>
      <div className="action-steps-tabs" role="tablist" aria-label="Ações da espécie">
        {actions.map((id) => {
          const isActive = id === activeActionId;
          const isSelected = id === selected;
          const classes = [
            "action-steps-tab",
            isActive && "is-active",
            isSelected && "is-selected"
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={classes}
              onClick={() => setSelected(id)}
              title={isActive ? `Ação em andamento: ${id}` : `Consultar ação ${id}`}
            >
              <span className="action-steps-tab-letter">{id}</span>
              {isActive && <span className="action-steps-tab-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="action-steps-body">
        <span className="action-steps-eyebrow">
          Ação {selected}
          {selected === activeActionId ? " · em andamento" : " · consulta"}
        </span>
        <p className="action-steps-desc">{getActionDescription(speciesId, selected)}</p>
      </div>
    </div>
  );
}
