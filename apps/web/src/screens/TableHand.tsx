import {
  ChevronDown,
  ChevronUp,
  ListFilter,
  RotateCcw,
  RotateCw,
  X
} from "lucide-react";
import { speciesDefinitions } from "@oikos/content";
import type { GameState, PlayerState } from "@oikos/shared";
import type { SortedHandCard } from "../hooks/playerCardState";

interface TableHandProps {
  player: PlayerState;
  game: GameState | null | undefined;
  handCards: { id: string }[];
  sortedHandCards: SortedHandCard[];
  handCollapsed: boolean;
  handSortLabel: string;
  nextHandSortLabel: string;
  isBasicTutorial: boolean;
  selectedHandCardId: string | null;
  selectedCardRotation: number;
  canPlaceSelectedForestCard: boolean;
  canSelectHandCards: boolean;
  handPlayableThisAction: boolean;
  tutorialRequiredCardId: string | null;
  mataAtlanticaPileIndexByCardId: Map<string, number>;
  onToggleCollapsed: () => void;
  onCycleSort: () => void;
  onToggleCard: (cardId: string) => void;
  onRotateCard: (dir: 1 | -1) => void;
  onMataDiscard: (cardId: string) => void;
}

// The player's forest-card hand: sort/collapse controls plus the card rail with
// selection, rotation and the Mata Atlântica discard affordance.
export function TableHand({
  player,
  game,
  handCards,
  sortedHandCards,
  handCollapsed,
  handSortLabel,
  nextHandSortLabel,
  isBasicTutorial,
  selectedHandCardId,
  selectedCardRotation,
  canPlaceSelectedForestCard,
  canSelectHandCards,
  handPlayableThisAction,
  tutorialRequiredCardId,
  mataAtlanticaPileIndexByCardId,
  onToggleCollapsed,
  onCycleSort,
  onToggleCard,
  onRotateCard,
  onMataDiscard
}: TableHandProps) {
  return (
    <section className={`table-hand ${handCollapsed ? "collapsed" : ""}`} aria-label="Mão de cartas">
      {handCards.length > 0 && (
        <button
          type="button"
          className="hand-sort-toggle"
          title={`Organizar por ${nextHandSortLabel}`}
          aria-label={`Mão organizada por ${handSortLabel}. Clique para organizar por ${nextHandSortLabel}.`}
          onClick={onCycleSort}
        >
          <ListFilter aria-hidden="true" />
          <span>Organizar</span>
          <strong>{handSortLabel}</strong>
        </button>
      )}
      <div className="hand-header">
        <div>
          <span>Mão · {handCards.length} cartas</span>
          <strong>
            {isBasicTutorial
              ? "Cartas do tutorial"
              : player.speciesId
                ? speciesDefinitions[player.speciesId].displayName
                : "Espécie"}
          </strong>
        </div>
        <div className="hand-header-side">
          <button
            type="button"
            className="hand-toggle"
            title={handCollapsed ? "Expandir" : "Recolher"}
            aria-label={handCollapsed ? "Expandir mão de cartas" : "Recolher mão de cartas"}
            onClick={onToggleCollapsed}
          >
            {handCollapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
        </div>
      </div>
      {(!handCollapsed ||
        (!isBasicTutorial &&
          (player.speciesId === "maned_wolf" || player.speciesId === "armadillo"))) &&
        (handCards.length > 0 ? (
          <div
            className={`hand-rail ${selectedHandCardId ? "has-selection" : ""} ${
              handPlayableThisAction ? "hand-playable" : "hand-idle"
            }`}
            style={{ ["--hand-count" as string]: sortedHandCards.length }}
          >
            {sortedHandCards.map(({ card }, handIndex) => {
              const isSelected = selectedHandCardId === card.id;
              const showRotate = isSelected && canPlaceSelectedForestCard;

              return (
                <div
                  key={card.id}
                  role="button"
                  tabIndex={canSelectHandCards ? 0 : -1}
                  data-card-id={card.id}
                  className={`hand-card ${isSelected ? "selected" : ""} ${
                    handPlayableThisAction ? "playable" : "not-playable"
                  } ${
                    tutorialRequiredCardId === card.id ? "tutorial-marked" : ""
                  }`}
                  style={{ ["--hand-index" as string]: handIndex }}
                  onClick={() => {
                    if (!canSelectHandCards) {
                      return;
                    }
                    onToggleCard(card.id);
                  }}
                  onKeyDown={(event) => {
                    if (!canSelectHandCards) {
                      return;
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onToggleCard(card.id);
                    }
                  }}
                >
                  <img
                    src={encodeURI(card.imagePath)}
                    alt={card.label}
                    style={isSelected ? { transform: `rotate(${selectedCardRotation}deg)` } : undefined}
                  />
                  {mataAtlanticaPileIndexByCardId.has(card.id) && (
                    <span className="pile-badge" aria-label={`Topo da pilha ${(mataAtlanticaPileIndexByCardId.get(card.id) ?? 0) + 1}`}>
                      P{(mataAtlanticaPileIndexByCardId.get(card.id) ?? 0) + 1}
                    </span>
                  )}
                  {showRotate && (
                    <div className="card-rotate" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        title="Girar à esquerda (Q)"
                        aria-label="Girar à esquerda"
                        onClick={() => onRotateCard(-1)}
                      >
                        <RotateCcw aria-hidden="true" />
                        <kbd>Q</kbd>
                      </button>
                      <span>{selectedCardRotation}°</span>
                      <button
                        type="button"
                        title="Girar à direita (E)"
                        aria-label="Girar à direita"
                        onClick={() => onRotateCard(1)}
                      >
                        <RotateCw aria-hidden="true" />
                        <kbd>E</kbd>
                      </button>
                    </div>
                  )}
                  {(() => {
                    if (!game?.mataAtlanticaPiles) return null;
                    if (!player.speciesId) return null;
                    if (speciesDefinitions[player.speciesId].usesForestCards) return null;
                    if (game.activePlayerId !== player.playerId) return null;
                    if (!mataAtlanticaPileIndexByCardId.has(card.id)) return null;
                    if (
                      (game.mataAtlanticaDiscardByPlayer ?? {})[player.playerId] === player.turnsTaken
                    )
                      return null;
                    return (
                      <button
                        type="button"
                        className="mata-discard-btn"
                        title="Descartar (Mata Atlântica)"
                        onClick={(event) => {
                          event.stopPropagation();
                          onMataDiscard(card.id);
                        }}
                      >
                        <X aria-hidden="true" />
                        <span>Descartar</span>
                      </button>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">
            {player.speciesId === "jaguar"
              ? "Esta espécie não usa cartas de floresta na mão."
              : "Sem cartas de floresta na mão."}
          </p>
        ))}
    </section>
  );
}
