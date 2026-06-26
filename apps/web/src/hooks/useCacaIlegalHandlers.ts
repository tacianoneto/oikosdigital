import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { GameState, PublicRoomState, Resource } from "@oikos/shared";
import type { ExecuteGameIntent } from "./useSimpleActionHandlers";

type PendingCacaIlegal = NonNullable<GameState["cacaIlegalPending"]>;
type CacaIlegalChoice = { kind: "remove_piece"; pieceId: string } | { kind: "spend_resource"; resource: Resource };

interface CacaIlegalHandlersParams {
  room: PublicRoomState | null;
  cacaIlegalPending: PendingCacaIlegal | null;
  canResolveCacaIlegal: boolean;
  cacaIlegalRemovalMode: boolean;
  setCacaIlegalRemovalMode: Dispatch<SetStateAction<boolean>>;
  selectedRemovalPieceIds: string[];
  setSelectedRemovalPieceIds: Dispatch<SetStateAction<string[]>>;
  executeGameIntent: ExecuteGameIntent;
}

export function useCacaIlegalHandlers({
  room,
  cacaIlegalPending,
  canResolveCacaIlegal,
  cacaIlegalRemovalMode,
  setCacaIlegalRemovalMode,
  selectedRemovalPieceIds,
  setSelectedRemovalPieceIds,
  executeGameIntent
}: CacaIlegalHandlersParams) {
  const clearCacaIlegalRemoval = useCallback(() => {
    setCacaIlegalRemovalMode(false);
    setSelectedRemovalPieceIds([]);
  }, [setCacaIlegalRemovalMode, setSelectedRemovalPieceIds]);

  const enterCacaIlegalRemovalMode = useCallback(() => {
    setSelectedRemovalPieceIds([]);
    setCacaIlegalRemovalMode(true);
  }, [setCacaIlegalRemovalMode, setSelectedRemovalPieceIds]);

  const resolveCacaIlegalChoice = useCallback(
    (choice: CacaIlegalChoice) => {
      if (!room?.game || !cacaIlegalPending || !canResolveCacaIlegal) return;

      executeGameIntent(
        cacaIlegalPending.playerId,
        { type: "threat.caca-ilegal-resolve", choice },
        "Caca ilegal resolvida.",
        clearCacaIlegalRemoval
      );
    },
    [cacaIlegalPending, canResolveCacaIlegal, clearCacaIlegalRemoval, executeGameIntent, room]
  );

  const resolveSelectedCacaIlegalPiece = useCallback(() => {
    if (!cacaIlegalRemovalMode) return;
    const pieceId = selectedRemovalPieceIds[0];
    if (!pieceId) return;
    resolveCacaIlegalChoice({ kind: "remove_piece", pieceId });
  }, [cacaIlegalRemovalMode, resolveCacaIlegalChoice, selectedRemovalPieceIds]);

  return {
    clearCacaIlegalRemoval,
    enterCacaIlegalRemovalMode,
    resolveCacaIlegalChoice,
    resolveSelectedCacaIlegalPiece
  };
}
