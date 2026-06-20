import { speciesDefinitions } from "@oikos/content";
import type { CapuchinScoreAnim, MacawScoreAnim } from "../hooks/useGameFeedback";

// Narration panels for the macaw (Action D straight lines) and capuchin
// (Action D habitat spread) scoring animations. The matching highlights are
// drawn on the board by the Phaser scene; these panels just describe the
// result. Both are hidden in clean board mode.
export function ScoreAnimationPanels({
  cleanBoardMode,
  macawScoreAnim,
  capuchinScoreAnim
}: {
  cleanBoardMode: boolean;
  macawScoreAnim: MacawScoreAnim | null;
  capuchinScoreAnim: CapuchinScoreAnim | null;
}) {
  if (cleanBoardMode) {
    return null;
  }

  return (
    <>
      {macawScoreAnim && (
        // The scoring lines themselves are drawn on the board by the Phaser scene
        // (scoringLineHighlights); this panel just narrates the result.
        <div className="macaw-score-panel" role="status">
          <div className="macaw-score-panel-icon">
            <img src={encodeURI(speciesDefinitions.macaw.meepleAsset)} alt="" />
          </div>
          <div className="macaw-score-panel-text">
            <small>{macawScoreAnim.playerName}</small>
            <strong>
              {macawScoreAnim.points} linha{macawScoreAnim.points > 1 ? "s" : ""} de 3 araras
            </strong>
            <span className="macaw-score-panel-total">
              = <em>+{macawScoreAnim.points}</em> ponto{macawScoreAnim.points > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
      {capuchinScoreAnim && (
        // The scored habitat cards are highlighted on the board by the Phaser
        // scene (scoringCardHighlights); this panel narrates the result.
        <div className="capuchin-score-panel" role="status">
          <div className="capuchin-score-panel-icon">
            <img src={encodeURI(speciesDefinitions.capuchin.meepleAsset)} alt="" />
          </div>
          <div className="capuchin-score-panel-text">
            <small>{capuchinScoreAnim.playerName}</small>
            <strong>
              {capuchinScoreAnim.points} habitat{capuchinScoreAnim.points > 1 ? "s" : ""} com 2+ macacos
            </strong>
            <span className="capuchin-score-panel-total">
              = <em>+{capuchinScoreAnim.points}</em> ponto{capuchinScoreAnim.points > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
