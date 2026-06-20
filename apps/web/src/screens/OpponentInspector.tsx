import type { CSSProperties } from "react";
import { ChevronDown, X } from "lucide-react";
import { habitatLabels, resourceAssets, resourceLabels } from "@oikos/content";
import type { Resource } from "@oikos/shared";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { getActionDescription, getPassiveDescription } from "../ui/actionDescriptions";
import { resourceOrder } from "../ui/gameConstants";
import { movementArtPath } from "../ui/movementArt";
import { ResourceText } from "../ui/ResourceText";
import { speciesVar } from "../ui/speciesStyle";
import type { PlayerInspectorEntry } from "../hooks/playerHudState";
import { getOpenPortraitAsset, movementKindLabels } from "./OikosApp.helpers";

interface OpponentInspectorProps {
  entries: PlayerInspectorEntry[];
  selectedEntry: PlayerInspectorEntry | null;
  selectedPlayerId: string | null;
  selectedRailIndex: number;
  resourceLeaders: Partial<Record<Resource, Set<string>>>;
  setEffectTarget: (key: string, element: HTMLElement | null) => void;
  onSelectPlayer: (playerId: string | null) => void;
}

// Opponent rail plus the expandable popover summarizing the selected rival's
// resources, score, majorities and movement patterns per habitat.
export function OpponentInspector({
  entries,
  selectedEntry,
  selectedPlayerId,
  selectedRailIndex,
  resourceLeaders,
  setEffectTarget,
  onSelectPlayer
}: OpponentInspectorProps) {
  const selectedPassiveDescription = getPassiveDescription(selectedEntry?.species?.speciesId);

  return (
    <aside className="opponent-inspector" aria-label="Consultar outros jogadores">
      <div className="opponent-rail" role="list">
        {entries.map(({ player, gamePlayer, species, displayIndex, isActivePlayer }) => (
          <button
            type="button"
            role="listitem"
            ref={(node) => setEffectTarget(`portrait:${player.playerId}`, node)}
            className={`opponent-portrait-btn ${selectedPlayerId === player.playerId ? "is-selected" : ""} ${
              isActivePlayer ? "is-active-turn" : ""
            }`}
            key={player.playerId}
            style={speciesVar(player.speciesId)}
            data-species={player.speciesId ?? undefined}
            title={species ? `Ver ${species.displayName}` : player.name}
            aria-label={species ? `Ver informações de ${species.displayName}` : `Ver informações de ${player.name}`}
            aria-pressed={selectedPlayerId === player.playerId}
            onClick={() => onSelectPlayer(selectedPlayerId === player.playerId ? null : player.playerId)}
          >
            {species ? (
              <span
                className="opponent-portrait-image"
                style={{
                  backgroundImage: `url("${encodeURI(getOpenPortraitAsset(species.portraitAsset))}")`
                }}
                aria-hidden="true"
              />
            ) : (
              <span>{displayIndex + 1}</span>
            )}
            {isActivePlayer && <i aria-hidden="true" />}
            {gamePlayer && (
              <em aria-label={`${gamePlayer.score} pontos`}>
                <img src={encodeURI(resourceAssets.point)} alt="" />
                {gamePlayer.score}
              </em>
            )}
            {gamePlayer && (
              <span className="opponent-portrait-leaders" aria-hidden="true">
                {(["meat", "egg", "fruit"] as const)
                  .filter((resource) => resourceLeaders[resource]?.has(gamePlayer.playerId))
                  .map((resource) => (
                    <span
                      key={resource}
                      className="opponent-portrait-leader"
                      data-resource={resource}
                      title={`Maioria de ${resourceLabels[resource]}: ${gamePlayer.resources[resource]}`}
                    >
                      <img src={encodeURI(resourceAssets[resource])} alt="" />
                      <b>{gamePlayer.resources[resource]}</b>
                    </span>
                  ))}
              </span>
            )}
          </button>
        ))}
      </div>

      {selectedEntry?.gamePlayer && selectedEntry.species && (
        <section
          className="opponent-popover"
          data-species={selectedEntry.gamePlayer.speciesId}
          style={
            {
              ...speciesVar(selectedEntry.gamePlayer.speciesId),
              "--opponent-arrow-index": selectedRailIndex
            } as CSSProperties
          }
          aria-label={`Resumo de ${selectedEntry.species.displayName}`}
        >
          <button
            type="button"
            className="opponent-close opponent-close-floating"
            aria-label="Fechar resumo"
            onClick={() => onSelectPlayer(null)}
          >
            <X aria-hidden="true" />
          </button>

          <div className="opponent-resource-grid">
            {resourceOrder.map((resource) => {
              const isLeader = resourceLeaders[resource]?.has(selectedEntry.gamePlayer!.playerId) ?? false;
              return (
                <span
                  className={`opponent-resource ${isLeader ? "is-leader" : ""}`}
                  data-resource={resource}
                  key={resource}
                  title={isLeader ? `${resourceLabels[resource]} · maioria` : resourceLabels[resource]}
                  ref={(node) => setEffectTarget(`${selectedEntry.gamePlayer!.playerId}:${resource}`, node)}
                >
                  <img src={encodeURI(resourceAssets[resource])} alt="" />
                  <small>{resourceLabels[resource]}</small>
                  <strong><AnimatedNumber value={selectedEntry.gamePlayer!.resources[resource] ?? 0} /></strong>
                </span>
              );
            })}
          </div>

          <div className="opponent-movement-grid" role="list" aria-label="Movimentos por habitat">
            {(["forest", "field", "river"] as const).map((habitat) => {
              const kind = selectedEntry.species!.movementPatternsByHabitat[habitat];
              return (
                <span
                  key={habitat}
                  role="listitem"
                  className={`opponent-movement is-${habitat}`}
                  title={`${habitatLabels[habitat]} · ${movementKindLabels[kind]}`}
                >
                  <img
                    src={movementArtPath(habitat, kind)}
                    alt={`${habitatLabels[habitat]}: ${movementKindLabels[kind]}`}
                    className="opponent-movement-art"
                    draggable={false}
                  />
                </span>
              );
            })}
          </div>

          <details className="opponent-actions-accordion">
            <summary>
              <span>Ações da espécie</span>
              <ChevronDown aria-hidden="true" />
            </summary>
            <div className="opponent-actions-list">
              {selectedEntry.species.actions.map((actionId) => (
                <article className="opponent-action-step" key={actionId}>
                  <strong>{actionId}</strong>
                  <p>
                    <ResourceText
                      text={getActionDescription(selectedEntry.species!.speciesId, actionId)}
                    />
                  </p>
                </article>
              ))}
              {selectedPassiveDescription && (
                <article className="opponent-action-step opponent-action-step--passive">
                  <strong>*</strong>
                  <p>
                    <ResourceText text={selectedPassiveDescription} />
                  </p>
                </article>
              )}
            </div>
          </details>
        </section>
      )}
    </aside>
  );
}
