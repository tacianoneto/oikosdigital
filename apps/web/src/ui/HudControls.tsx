import { Eye, EyeOff, Settings } from "lucide-react";

interface HudControlsProps {
  showRoundIndicator: boolean;
  round: number;
  maxRounds: number;
  showCleanToggle: boolean;
  cleanBoardMode: boolean;
  showConfigButton: boolean;
  onToggleCleanBoard: () => void;
  onOpenConfig: () => void;
}

// Top-level in-game HUD controls: round counter, clean-board (hide HUD) toggle
// and the table/settings button.
export function HudControls({
  showRoundIndicator,
  round,
  maxRounds,
  showCleanToggle,
  cleanBoardMode,
  showConfigButton,
  onToggleCleanBoard,
  onOpenConfig
}: HudControlsProps) {
  return (
    <>
      {showRoundIndicator && (
        <div className="hud-round-indicator" aria-label={`Rodada ${round} de ${maxRounds}`}>
          Rodada {round}/{maxRounds}
        </div>
      )}

      {showCleanToggle && (
        <button
          type="button"
          className={`clean-board-toggle ${cleanBoardMode ? "is-clean" : ""}`}
          title={cleanBoardMode ? "Mostrar HUD" : "Ocultar HUD"}
          aria-label={cleanBoardMode ? "Mostrar HUD" : "Ocultar HUD"}
          aria-pressed={cleanBoardMode}
          onClick={onToggleCleanBoard}
        >
          {cleanBoardMode ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      )}

      {showConfigButton && (
        <button
          type="button"
          className="hud-config-btn"
          title="Mesa e configurações"
          aria-label="Mesa e configurações"
          onClick={onOpenConfig}
        >
          <Settings aria-hidden="true" />
        </button>
      )}
    </>
  );
}
