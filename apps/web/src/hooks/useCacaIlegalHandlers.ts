import { useCallback, type Dispatch, type SetStateAction } from "react";
import { resolveCacaIlegal } from "@oikos/rules";
import type { GameState, PublicRoomState, Resource } from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";

type PendingCacaIlegal = NonNullable<GameState["cacaIlegalPending"]>;
type CacaIlegalChoice = { kind: "remove_piece"; pieceId: string } | { kind: "spend_resource"; resource: Resource };

interface CacaIlegalHandlersParams {
  room: PublicRoomState | null;
  setRoom: Dispatch<SetStateAction<PublicRoomState | null>>;
  cacaIlegalPending: PendingCacaIlegal | null;
  canResolveCacaIlegal: boolean;
  cacaIlegalRemovalMode: boolean;
  setCacaIlegalRemovalMode: Dispatch<SetStateAction<boolean>>;
  selectedRemovalPieceIds: string[];
  setSelectedRemovalPieceIds: Dispatch<SetStateAction<string[]>>;
  isLocalRoom: boolean;
  run: (action: () => Promise<PublicRoomState>, success?: string) => Promise<void>;
  requireSocket: () => OikosSocket;
  setError: Dispatch<SetStateAction<string | null>>;
}

export function useCacaIlegalHandlers({
  room,
  setRoom,
  cacaIlegalPending,
  canResolveCacaIlegal,
  cacaIlegalRemovalMode,
  setCacaIlegalRemovalMode,
  selectedRemovalPieceIds,
  setSelectedRemovalPieceIds,
  isLocalRoom,
  run,
  requireSocket,
  setError
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

      if (isLocalRoom) {
        try {
          const nextGame = resolveCacaIlegal(room.game, cacaIlegalPending.playerId, choice);
          setRoom((current) => (current ? { ...current, game: nextGame } : current));
          clearCacaIlegalRemoval();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha ao resolver Caca ilegal.");
        }
        return;
      }

      const rid = room.roomId;
      run(() => roomApi.resolveCacaIlegal(requireSocket(), rid, choice)).then(clearCacaIlegalRemoval);
    },
    [
      cacaIlegalPending,
      canResolveCacaIlegal,
      clearCacaIlegalRemoval,
      isLocalRoom,
      requireSocket,
      room,
      run,
      setError,
      setRoom
    ]
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
