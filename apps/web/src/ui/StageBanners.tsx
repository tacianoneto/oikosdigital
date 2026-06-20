import { speciesDefinitions } from "@oikos/content";
import { speciesVar } from "./speciesStyle";
import type { TurnBanner } from "../hooks/useGameFeedback";

interface StageBannersProps {
  cleanBoardMode: boolean;
  turnBanner: TurnBanner | null;
  galoInterrupt: boolean;
  isCurrentGaloInterruptOwner: boolean;
  galoInterruptOwnerName: string | null;
  showGaloWaitingBanner: boolean;
  galoInterruptBannerText: string;
  interruptedGaloPlayerName: string | null;
  isCurrentPlayerWaitingForGaloInterrupt: boolean;
}

// Transient banners overlaid on the tabletop stage: whose turn it is, plus the
// Galo-de-campina interrupt badge/banner/wait-overlay states.
export function StageBanners({
  cleanBoardMode,
  turnBanner,
  galoInterrupt,
  isCurrentGaloInterruptOwner,
  galoInterruptOwnerName,
  showGaloWaitingBanner,
  galoInterruptBannerText,
  interruptedGaloPlayerName,
  isCurrentPlayerWaitingForGaloInterrupt
}: StageBannersProps) {
  return (
    <>
      {!cleanBoardMode && turnBanner && (
        <div
          className="turn-banner"
          key={turnBanner.key}
          style={speciesVar(turnBanner.speciesId)}
          role="status"
        >
          {turnBanner.speciesId && (
            <img src={encodeURI(speciesDefinitions[turnBanner.speciesId].portraitAsset)} alt="" />
          )}
          <span className="turn-banner-label">Vez:</span>
          <strong>{turnBanner.label}</strong>
        </div>
      )}
      {galoInterrupt && (
        <div
          className={`galo-interrupt-badge ${isCurrentGaloInterruptOwner ? "is-owner" : "is-waiting"}`}
          style={speciesVar("galo_de_campina")}
          role="status"
        >
          <span>{isCurrentGaloInterruptOwner ? "Sua reacao" : "Turno pausado"}</span>
          <strong>
            {isCurrentGaloInterruptOwner
              ? "Mova 1 galo"
              : `Aguardando ${galoInterruptOwnerName ?? "Galo"}`}
          </strong>
        </div>
      )}
      {showGaloWaitingBanner && (
        <div
          className="galo-interrupt-banner is-waiting"
          style={speciesVar("galo_de_campina")}
          role="status"
        >
          <span>Turno pausado</span>
          <strong>{galoInterruptBannerText}</strong>
          <small>{interruptedGaloPlayerName ?? "Jogador ativo"} continua depois desta reacao.</small>
        </div>
      )}
      {isCurrentPlayerWaitingForGaloInterrupt && (
        <div className="galo-interrupt-wait-overlay" aria-hidden="true" />
      )}
    </>
  );
}
