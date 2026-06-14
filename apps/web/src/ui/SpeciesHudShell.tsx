import type { CSSProperties, MouseEvent, ReactNode } from "react";
import {
  objectiveCardBackPath,
  scenarioCardBackPath,
  speciesDefinitions,
  threatCardBackPath
} from "@oikos/content";
import type { ActionId, PlayerState, Resource, SpeciesId } from "@oikos/shared";
import { ActionStepsViewer } from "./ActionStepsViewer";
import { SPECIES_HEX } from "./gameConstants";
import { renderReserveMeeples } from "./meeples";
import { ObjectiveStatusBadge } from "./ObjectiveStatusBadge";

type ExpansionKind = "objective" | "scenarios" | "threat";
type HudVisualKey = "jaguar" | "wolf" | "tatu" | "macaw" | "galo" | "capuchin" | "coati";

interface SpeciesHudShellProps {
  speciesId: SpeciesId;
  player: PlayerState;
  activeActionId: ActionId | null;
  resourceMajority: Record<Resource, boolean>;
  showObjective: boolean;
  objectiveCompleted: boolean;
  objectiveDiscarded: boolean;
  showScenarios: boolean;
  showThreat: boolean;
  setEffectTarget: (key: string, element: HTMLElement | null) => void;
  onExpansionToggle: (kind: ExpansionKind, event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}

const HUD_RESOURCE_ORDER: Resource[] = ["meat", "fruit", "egg", "seed"];
const HUD_VISUALS: Record<
  SpeciesId,
  { visualKey: HudVisualKey; topAsset: string; bottomAsset: string; movementAsset: string }
> = {
  jaguar: {
    visualKey: "jaguar",
    topAsset: "/assets/interface/onça/UI_oncaTOP.webp",
    bottomAsset: "/assets/interface/onça/UI_oncaDOWN.webp",
    movementAsset: "/assets/interface/onça/Movimentos_onca.webp"
  },
  maned_wolf: {
    visualKey: "wolf",
    topAsset: "/assets/interface/lobo/UI_loboTOP.webp",
    bottomAsset: "/assets/interface/lobo/UI_lobo.webp",
    movementAsset: "/assets/interface/lobo/Movimentos_lobo.webp"
  },
  armadillo: {
    visualKey: "tatu",
    topAsset: "/assets/interface/tatu/UI_tatuTOP.webp",
    bottomAsset: "/assets/interface/tatu/UI_tatu.webp",
    movementAsset: "/assets/interface/tatu/Movimentos_tatu.webp"
  },
  macaw: {
    visualKey: "macaw",
    topAsset: "/assets/interface/arara/UI_araraTOP.webp",
    bottomAsset: "/assets/interface/arara/UI_arara.webp",
    movementAsset: "/assets/interface/arara/Movimentos_arara.webp"
  },
  galo_de_campina: {
    visualKey: "galo",
    topAsset: "/assets/interface/galo/UI_galodecampinaTOP.webp",
    bottomAsset: "/assets/interface/galo/UI_galodecampina.webp",
    movementAsset: "/assets/interface/galo/Movimentos_galodecampina.webp"
  },
  capuchin: {
    visualKey: "capuchin",
    topAsset: "/assets/interface/macaco/UI_macacoTOP.webp",
    bottomAsset: "/assets/interface/macaco/UI_macaco.webp",
    movementAsset: "/assets/interface/macaco/Movimentos_macaco.webp"
  },
  coati: {
    visualKey: "coati",
    topAsset: "/assets/interface/quati/UI_quatiTOP.webp",
    bottomAsset: "/assets/interface/quati/UI_quati.webp",
    movementAsset: "/assets/interface/quati/Movimentos_quati.webp"
  }
};

export function SpeciesHudShell({
  speciesId,
  player,
  activeActionId,
  resourceMajority,
  showObjective,
  objectiveCompleted,
  objectiveDiscarded,
  showScenarios,
  showThreat,
  setEffectTarget,
  onExpansionToggle,
  children
}: SpeciesHudShellProps) {
  const species = speciesDefinitions[speciesId];
  const { visualKey, topAsset, bottomAsset, movementAsset } = HUD_VISUALS[speciesId];
  const prefix = `hud-bottom-${visualKey}`;

  return (
    <div className={`hud-overlay-${visualKey}`}>
      <div className={`hud-top-${visualKey}`}>
        <img src={topAsset} alt="" className={`hud-top-${visualKey}-bg`} />
        <div className={`hud-top-${visualKey}-score`}>{player.score ?? 0}</div>
        <div
          className={`hud-top-${visualKey}-meeples`}
          ref={(node) => setEffectTarget("hudbar:reserve", node)}
        >
          {renderReserveMeeples(player, species.meepleAsset)}
        </div>
      </div>

      <div className={prefix}>
        <img src={bottomAsset} alt="" className={`${prefix}-bg`} />
        <div className={`${prefix}-action-text`}>
          <div
            className="action-box"
            style={{ "--action-accent": SPECIES_HEX[speciesId] } as CSSProperties}
          >
            <ActionStepsViewer
              speciesId={speciesId}
              activeActionId={activeActionId}
              accent={SPECIES_HEX[speciesId]}
            />
            {children}
          </div>
        </div>

        <div className={`${prefix}-resources`}>
          {HUD_RESOURCE_ORDER.map((resource) => {
            const hasMajority = resourceMajority[resource];
            return (
              <div
                key={resource}
                className={`${prefix}-resource-item res-${resource}${hasMajority ? " is-majority" : ""}`}
                data-resource={resource}
                data-majority={hasMajority ? "true" : "false"}
                ref={(node) => setEffectTarget(`hudbar:${resource}`, node)}
              >
                <span className="hud-resource-value">{player.resources[resource] ?? 0}</span>
              </div>
            );
          })}
        </div>

        <div className={`${prefix}-movements`}>
          <img src={movementAsset} alt="Movimentos" />
        </div>

        <div className={`${prefix}-expansions`}>
          {showObjective && (
            <button
              type="button"
              className={`${prefix}-expansion-btn`}
              onClick={(event) => onExpansionToggle("objective", event)}
              title="Ver Objetivo"
            >
              <img src={encodeURI(objectiveCardBackPath)} alt="Objetivos" />
              <ObjectiveStatusBadge completed={objectiveCompleted} discarded={objectiveDiscarded} />
            </button>
          )}
          {showScenarios && (
            <button
              type="button"
              className={`${prefix}-expansion-btn`}
              onClick={(event) => onExpansionToggle("scenarios", event)}
              title="Ver Cenários"
            >
              <img src={encodeURI(scenarioCardBackPath)} alt="Cenários" />
            </button>
          )}
          {showThreat && (
            <button
              type="button"
              className={`${prefix}-expansion-btn`}
              onClick={(event) => onExpansionToggle("threat", event)}
              title="Ver Ameaça"
            >
              <img src={encodeURI(threatCardBackPath)} alt="Ameaças" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
