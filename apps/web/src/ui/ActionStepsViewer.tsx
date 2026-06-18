import { useEffect, useState, type CSSProperties } from "react";
import type { ActionId, SpeciesId } from "@oikos/shared";
import { speciesDefinitions } from "@oikos/content";
import { getActionDescription, getBetweenTurnsDescription, getPassiveDescription } from "./actionDescriptions";
import { ResourceText } from "./ResourceText";

// Special step tabs that are not regular A/B/C/D actions: "*" is the species
// passive, "ET" is the between-turns reaction (shown as ↺).
type StepTab = ActionId | "*" | "ET";
const BETWEEN_TURNS_GLYPH = "↺";

interface ActionStepsViewerProps {
  speciesId: SpeciesId;
  activeActionId: ActionId | null;
  accent?: string;
  variant?: "hud" | "card";
  // When true, the between-turns (ET) tab is the active step for this player
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
  const betweenTurnsDescription = getBetweenTurnsDescription(speciesId);
  const tabs: StepTab[] = [
    ...(passiveDescription ? (["*"] as StepTab[]) : []),
    ...actions,
    ...(betweenTurnsDescription ? (["ET"] as StepTab[]) : [])
  ];
  const fallback: StepTab = activeActionId ?? actions[0] ?? "A";
  const [selected, setSelected] = useState<StepTab>(fallback);

  // Sync the preview to the active step whenever the turn advances or species
  // changes, so the panel snaps back to "what you must do now" by default. The
  // between-turns reaction takes priority: when it is the player's pending step
  // the panel jumps to the ET tab.
  useEffect(() => {
    if (betweenTurnsActive && betweenTurnsDescription) {
      setSelected("ET");
    } else if (activeActionId) {
      setSelected(activeActionId);
    } else if (actions.length > 0) {
      setSelected(actions[0]);
    }
  }, [activeActionId, betweenTurnsActive, betweenTurnsDescription, speciesId, actions]);

  const style = accent ? ({ "--action-accent": accent } as CSSProperties) : undefined;

  const tabLabel = (id: StepTab) => (id === "*" ? "*" : id === "ET" ? BETWEEN_TURNS_GLYPH : id);
  const tabTitle = (id: StepTab, isActive: boolean) => {
    if (id === "*") return "Consultar passiva";
    if (id === "ET") return isActive ? "Entre turnos: mova 1 galo" : "Consultar entre turnos";
    return isActive ? `Ação em andamento: ${id}` : `Consultar ação ${id}`;
  };

  return (
    <div className={`action-steps action-steps--${variant}`} style={style}>
      <div className="action-steps-tabs" role="tablist" aria-label="Ações da espécie">
        {tabs.map((id) => {
          const isActive = id === "ET" ? betweenTurnsActive : id === activeActionId && !betweenTurnsActive;
          const isSelected = id === selected;
          const classes = [
            "action-steps-tab",
            id === "*" && "action-steps-tab--passive",
            id === "ET" && "action-steps-tab--between-turns",
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
              <span className="action-steps-tab-letter">{tabLabel(id)}</span>
              {isActive && <span className="action-steps-tab-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="action-steps-body">
        <span className="action-steps-eyebrow">
          {selected === "*" ? "Passiva" : selected === "ET" ? "Entre turnos" : `Ação ${selected}`}
          {(selected === "ET" ? betweenTurnsActive : selected === activeActionId && !betweenTurnsActive)
            ? " · em andamento"
            : " · consulta"}
        </span>
        <p className="action-steps-desc">
          <ResourceText
            text={
              selected === "*"
                ? passiveDescription ?? ""
                : selected === "ET"
                  ? betweenTurnsDescription ?? ""
                  : getActionDescription(speciesId, selected)
            }
          />
        </p>
      </div>
    </div>
  );
}
