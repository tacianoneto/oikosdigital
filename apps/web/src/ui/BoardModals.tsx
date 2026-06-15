import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { speciesDefinitions } from "@oikos/content";
import type { SpeciesId } from "@oikos/shared";
import { speciesVar } from "./speciesStyle";

// Presentational species board viewer and floating movement-guide tooltip,
// extracted from OikosApp. The parent keeps the visibility conditions (and the
// createPortal wrapper for the movement guide); JSX is identical to the inline
// versions these replaced.

interface SpeciesBoardModalProps {
  speciesId: SpeciesId;
  onClose: () => void;
}

export function SpeciesBoardModal({ speciesId, onClose }: SpeciesBoardModalProps) {
  const species = speciesDefinitions[speciesId];
  return (
    <div className="board-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="board-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Tabuleiro de ${species.displayName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="board-modal-head">
          <img src={encodeURI(species.meepleAsset)} alt="" />
          <div>
            <h2>{species.displayName}</h2>
            <span>{species.scientificName}</span>
          </div>
          <button
            type="button"
            className="board-modal-close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="board-modal-body">
          <img
            src={encodeURI(species.boardAsset)}
            alt={`Tabuleiro de ${species.displayName}`}
          />
        </div>
      </div>
    </div>
  );
}

interface MovementGuideFloatingProps {
  speciesId: SpeciesId;
  left: number;
  top: number;
}

export function MovementGuideFloating({ speciesId, left, top }: MovementGuideFloatingProps) {
  const species = speciesDefinitions[speciesId];
  return (
    <div
      className="movement-guide-floating"
      role="tooltip"
      style={
        {
          ...speciesVar(speciesId),
          left,
          top
        } as CSSProperties
      }
    >
      <strong>{species.displayName}</strong>
      <img src={encodeURI(species.movementAsset)} alt={`Movimentos de ${species.displayName}`} />
    </div>
  );
}
