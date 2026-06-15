import { ChevronDown, ChevronUp } from "lucide-react";
import { resourceAssets, resourceLabels } from "@oikos/content";
import type { PlayerState, Resource, SpeciesDefinition } from "@oikos/shared";
import type { FloatingGain } from "./gameEffects";
import { AnimatedNumber } from "./AnimatedNumber";
import { resourceOrder } from "./gameConstants";
import { renderReserveMeeples } from "./meeples";
import { speciesVar } from "./speciesStyle";

interface SpeciesStatusHudProps {
  collapsed: boolean;
  floatingGains: FloatingGain[];
  isBasicTutorial: boolean;
  isControlledPlayer: boolean;
  player: PlayerState;
  resourceLeaders: Partial<Record<Resource, Set<string>>>;
  species: SpeciesDefinition;
  setEffectTarget: (key: string, element: HTMLElement | null) => void;
  onToggleCollapsed: () => void;
}

export function SpeciesStatusHud({
  collapsed,
  floatingGains,
  isBasicTutorial,
  isControlledPlayer,
  player,
  resourceLeaders,
  species,
  setEffectTarget,
  onToggleCollapsed
}: SpeciesStatusHudProps) {
  return (
    <section
      className={`hud-species panel-block species-hud ${collapsed ? "is-collapsed" : ""}`}
      data-species={player.speciesId}
      style={speciesVar(player.speciesId)}
    >
      <div className="species-hud-header">
        <img
          className="player-portrait"
          src={encodeURI(isBasicTutorial ? resourceAssets.point : species.portraitAsset)}
          alt=""
        />
        <div>
          <span>{isControlledPlayer ? "Controlando" : "Vez atual"}</span>
          <h2>{isBasicTutorial ? "Meeples" : species.displayName}</h2>
          <p>{isBasicTutorial ? "Tutorial basico" : player.name}</p>
        </div>
        <button
          type="button"
          className="species-hud-toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expandir painel da espécie" : "Recolher painel da espécie"}
          title={collapsed ? "Expandir" : "Recolher"}
        >
          {collapsed ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        </button>
      </div>

      <div className="hud-player-strip">
        <div className="hud-score-chip" title="Pontos" aria-label={`Pontos: ${player.score}`}>
          <img src={encodeURI(resourceAssets.point)} alt="" />
          <strong><AnimatedNumber value={player.score} /></strong>
        </div>
        <div
          className="hud-piece-track"
          ref={(node) => setEffectTarget("hud:reserve", node)}
          title={`${player.reservePieces.length} na reserva`}
          aria-label={`${player.reservePieces.length} peças na reserva`}
        >
          {renderReserveMeeples(player, species.meepleAsset)}
        </div>
      </div>

      <div className="resource-bank">
        {resourceOrder.map((resource) => {
          const hasMajority = resourceLeaders[resource]?.has(player.playerId) ?? false;
          return (
            <div
              className={`resource-chip${hasMajority ? " is-majority" : ""}`}
              key={resource}
              data-resource={resource}
              ref={(node) => setEffectTarget(`hud:${resource}`, node)}
              title={hasMajority ? `${resourceLabels[resource]}: maioria` : resourceLabels[resource]}
              aria-label={`${resourceLabels[resource]}: ${player.resources[resource] ?? 0}${hasMajority ? " (maioria)" : ""}`}
            >
              <img src={encodeURI(resourceAssets[resource])} alt="" />
              <span>{resourceLabels[resource]}</span>
              <strong><AnimatedNumber value={player.resources[resource] ?? 0} /></strong>
            </div>
          );
        })}
        {floatingGains.length > 0 && (
          <div className="floating-gains" aria-hidden="true">
            {floatingGains.map((gain) => (
              <span className="floating-gain" key={gain.id}>
                <img src={encodeURI(resourceAssets[gain.resource])} alt="" />
                +{gain.amount} {gain.resource === "point" ? "ponto" : resourceLabels[gain.resource]}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
