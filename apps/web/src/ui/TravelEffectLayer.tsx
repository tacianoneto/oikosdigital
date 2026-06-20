import type { CSSProperties } from "react";
import { resourceAssets, speciesDefinitions } from "@oikos/content";
import type { TravelEffect } from "./gameEffects";

// Renders resources/meeples animating from a source to a destination point
// (e.g. a collected resource flying into a player's HUD). Purely cosmetic.
export function TravelEffectLayer({ effects }: { effects: TravelEffect[] }) {
  if (effects.length === 0) {
    return null;
  }

  return (
    <div className="travel-effect-layer" aria-hidden="true">
      {effects.map((effect) => {
        const src =
          effect.kind === "resource" && effect.resource
            ? resourceAssets[effect.resource]
            : effect.speciesId
              ? speciesDefinitions[effect.speciesId].meepleAsset
              : resourceAssets.point;

        return (
          <span
            className={`travel-effect ${effect.kind}`}
            key={effect.id}
            style={
              {
                "--from-x": `${effect.from.x}px`,
                "--from-y": `${effect.from.y}px`,
                "--to-x": `${effect.to.x}px`,
                "--to-y": `${effect.to.y}px`
              } as CSSProperties
            }
          >
            <img src={encodeURI(src)} alt="" />
          </span>
        );
      })}
    </div>
  );
}
