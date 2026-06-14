import type { CSSProperties } from "react";
import { Check, X } from "lucide-react";
import { speciesDefinitions } from "@oikos/content";
import type { SpeciesId } from "@oikos/shared";
import { SPECIES_HEX } from "./gameConstants";

// Armadillo (Tatu-bola) action D scoring summary: one portrait chip per rival
// species, marked with a check when it shares a tile with the armadillo or an X
// when it does not, plus the resulting points.
export function ArmadilloSharePanel({
  details
}: {
  details: { points: number; sharedSpecies: SpeciesId[]; missingSpecies: SpeciesId[] };
}) {
  const entries = [
    ...details.sharedSpecies.map((speciesId) => ({ speciesId, shared: true })),
    ...details.missingSpecies.map((speciesId) => ({ speciesId, shared: false }))
  ];
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="tatu-share-panel">
      <div className="tatu-share-chips">
        {entries.map(({ speciesId, shared }) => {
          const species = speciesDefinitions[speciesId];
          return (
            <div
              key={speciesId}
              className={`tatu-share-chip ${shared ? "is-shared" : "is-missing"}`}
              style={{ "--species-color": SPECIES_HEX[speciesId] } as CSSProperties}
              title={`${species.displayName}: ${shared ? "compartilha local" : "sem local em comum"}`}
            >
              <img src={encodeURI(species.portraitAsset)} alt={species.displayName} />
              <span className="tatu-share-mark" aria-hidden="true">
                {shared ? <Check /> : <X />}
              </span>
            </div>
          );
        })}
      </div>
      <div className="tatu-share-total">
        <span>Compartilhamento</span>
        <strong>+{details.points}</strong>
      </div>
    </div>
  );
}
