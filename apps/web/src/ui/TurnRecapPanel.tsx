import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from "lucide-react";
import { speciesDefinitions } from "@oikos/content";
import { speciesVar } from "./speciesStyle";
import type { TurnRecapState, TurnSummary } from "./turnSummary";

interface TurnRecapPanelProps {
  turnSummary: TurnSummary;
  turnRecap: TurnRecapState;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onMoveHistory: (delta: 1 | -1) => void;
  onClose: () => void;
  onHoverEntry: (cardInstanceIds: string[]) => void;
}

// Floating recap of the previous turn: per-action log with points, plus history
// navigation across earlier turns.
export function TurnRecapPanel({
  turnSummary,
  turnRecap,
  collapsed,
  onToggleCollapsed,
  onMoveHistory,
  onClose,
  onHoverEntry
}: TurnRecapPanelProps) {
  return (
    <aside
      className={`turn-recap ${collapsed ? "is-collapsed" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Resumo do turno anterior"
      style={speciesVar(turnSummary.speciesId)}
    >
      <header className="turn-recap-head">
        {turnSummary.speciesId && (
          <img src={encodeURI(speciesDefinitions[turnSummary.speciesId].meepleAsset)} alt="" />
        )}
        <div className="turn-recap-title">
          <span>Turno anterior</span>
          <h3>{turnSummary.playerName}</h3>
        </div>
        <div className="turn-recap-history" aria-label="Historico de turnos">
          <button
            type="button"
            className="turn-recap-history-btn"
            onClick={() => onMoveHistory(-1)}
            disabled={turnRecap.index <= 0}
            aria-label="Ver turno mais antigo"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span>{turnRecap.index + 1}/{turnRecap.history.length}</span>
          <button
            type="button"
            className="turn-recap-history-btn"
            onClick={() => onMoveHistory(1)}
            disabled={turnRecap.index >= turnRecap.history.length - 1}
            aria-label="Ver turno mais recente"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        <div className="turn-recap-score" title="Pontos no turno">
          <span>+{turnSummary.scoreDelta}</span>
          <small>pts</small>
        </div>
        <button
          type="button"
          className="turn-recap-toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expandir resumo" : "Recolher resumo"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="turn-recap-close"
          onClick={onClose}
          aria-label="Fechar resumo"
        >
          <X aria-hidden="true" />
        </button>
      </header>
      {!collapsed && (
        <ul className="turn-recap-list">
          {turnSummary.entries.map((entry) => (
            <li
              key={`${turnSummary.key}_${entry.id}`}
              className={`turn-recap-item ${entry.cardInstanceIds.length > 0 ? "is-hoverable" : ""}`}
              onMouseEnter={() => entry.cardInstanceIds.length > 0 && onHoverEntry(entry.cardInstanceIds)}
              onMouseLeave={() => onHoverEntry([])}
              onFocus={() => entry.cardInstanceIds.length > 0 && onHoverEntry(entry.cardInstanceIds)}
              onBlur={() => onHoverEntry([])}
              tabIndex={entry.cardInstanceIds.length > 0 ? 0 : -1}
            >
              <span className={`turn-recap-icon turn-recap-icon-${entry.icon}`} aria-hidden="true" />
              <span className="turn-recap-text">{entry.text}</span>
              {typeof entry.points === "number" && entry.points > 0 && (
                <span className="turn-recap-points">+{entry.points}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
