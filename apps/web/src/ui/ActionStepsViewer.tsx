import { useEffect, useState, type CSSProperties } from "react";
import type { ActionId, SpeciesId } from "@oikos/shared";
import { speciesDefinitions } from "@oikos/content";
import { getActionDescription, getPassiveDescription } from "./actionDescriptions";
import { ResourceText } from "./ResourceText";

// Special step tab that is not a regular A/B/C/D action: "*" is the species
// passive (for the galo, it also covers the between-turns reaction).
type StepTab = ActionId | "*";

interface ActionStepsViewerProps {
  speciesId: SpeciesId;
  activeActionId: ActionId | null;
  accent?: string;
  variant?: "hud" | "card";
  // When true, the passive (*) step is the active reaction for this player
  // (the galo owner must move a galo during another player's turn).
  betweenTurnsActive?: boolean;
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
  variant = "hud",
  betweenTurnsActive = false
}: ActionStepsViewerProps) {
  const species = speciesDefinitions[speciesId];
  const actions = species.actions;
  const passiveDescription = getPassiveDescription(speciesId);
  const tabs: StepTab[] = passiveDescription ? ["*", ...actions] : [...actions];
  const fallback: StepTab = activeActionId ?? actions[0] ?? "A";
  const [selected, setSelected] = useState<StepTab>(fallback);

  // Sync the preview to the active step whenever the turn advances or species
  // changes, so the panel snaps back to "what you must do now" by default. The
  // between-turns reaction takes priority: when it is the player's pending step
  // the panel jumps to the passive (*) tab.
  useEffect(() => {
    if (betweenTurnsActive && passiveDescription) {
      setSelected("*");
    } else if (activeActionId) {
      setSelected(activeActionId);
    } else if (actions.length > 0) {
      setSelected(actions[0]);
    }
  }, [activeActionId, betweenTurnsActive, passiveDescription, speciesId, actions]);

  const style = accent ? ({ "--action-accent": accent } as CSSProperties) : undefined;

  const tabTitle = (id: StepTab, isActive: boolean) => {
    if (id === "*") return isActive ? "Entre turnos: mova 1 galo" : "Consultar passiva";
    return isActive ? `Ação em andamento: ${id}` : `Consultar ação ${id}`;
  };

  return (
    <div className={`action-steps action-steps--${variant}`} style={style}>
      <div className="action-steps-tabs" role="tablist" aria-label="Ações da espécie">
        {tabs.map((id) => {
          const isActive = id === "*" ? betweenTurnsActive : id === activeActionId && !betweenTurnsActive;
          const isSelected = id === selected;
          const classes = [
            "action-steps-tab",
            id === "*" && "action-steps-tab--passive",
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
              title={tabTitle(id, isActive)}
            >
              <span className="action-steps-tab-letter">{id}</span>
              {isActive && <span className="action-steps-tab-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="action-steps-body">
        <span className="action-steps-eyebrow">
          {selected === "*" ? "Passiva" : `Ação ${selected}`}
          {(selected === "*" ? betweenTurnsActive : selected === activeActionId && !betweenTurnsActive)
            ? " · em andamento"
            : " · consulta"}
        </span>
        <p className="action-steps-desc">
          <ResourceText
            text={selected === "*" ? passiveDescription ?? "" : getActionDescription(speciesId, selected)}
          />
        </p>
      </div>
    </div>
  );
}
