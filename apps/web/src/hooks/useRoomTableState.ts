import { useMemo } from "react";
import { scenarioCardsById, threatCardsById } from "@oikos/content";
import { createPreviewInitialForest } from "@oikos/rules";
import type { PublicRoomState, ScenarioCardDefinition } from "@oikos/shared";
import { defaultBotTurnDelayMs } from "../ui/gameConstants";

interface RoomTableStateParams {
  isLocalRoom: boolean;
  localBotTurnDelayMs: number;
  playerId: string | null;
  room: PublicRoomState | null;
}

export function useRoomTableState({
  isLocalRoom,
  localBotTurnDelayMs,
  playerId,
  room
}: RoomTableStateParams) {
  const enabledMiniExpansions = room?.enabledMiniExpansions ?? room?.game?.enabledMiniExpansions ?? [];
  const scenarioSelectionMode = room?.scenarioSelectionMode ?? "vote";
  const scenarioCount = room?.scenarioCount ?? 1;
  const hostSelectedScenarioIds = room?.hostSelectedScenarioIds ?? [];
  const activeScenarioDefinitions = useMemo(
    () => (room?.game?.activeScenarioIds ?? []).map((id) => scenarioCardsById.get(id)).filter(Boolean) as ScenarioCardDefinition[],
    [room?.game?.activeScenarioIds]
  );
  const roomWarnings = useMemo(() => {
    const warnings = [...(room?.warnings ?? []), ...(room?.game?.contentWarnings ?? [])];
    return [...new Set(warnings)];
  }, [room]);

  return {
    isHost: Boolean(room && !isLocalRoom && playerId === room.hostPlayerId),
    roomHasBots: Boolean(room?.players.some((player) => player.isBot)),
    readyPlayerCount: room?.players.filter((player) => player.ready).length ?? 0,
    enabledMiniExpansions,
    scenarioSelectionMode,
    scenarioCount,
    hostSelectedScenarioIds,
    needsHostScenarioSelection:
      !isLocalRoom &&
      enabledMiniExpansions.includes("scenarios") &&
      scenarioSelectionMode === "host" &&
      hostSelectedScenarioIds.length !== scenarioCount,
    activeScenarioDefinitions,
    activeThreatDefinition: room?.game?.activeThreatCardId
      ? threatCardsById.get(room.game.activeThreatCardId) ?? null
      : null,
    botTurnDelayMs: isLocalRoom
      ? room?.botTurnDelayMs ?? localBotTurnDelayMs
      : room?.botTurnDelayMs ?? defaultBotTurnDelayMs,
    turnTimerMs: room?.turnTimerMs ?? null,
    showTurnCountdown: Boolean(
      !isLocalRoom && room?.game?.status === "active" && room?.turnTimerMs && room?.activeTurnStartedAt
    ),
    forestCards: room?.game?.forest.cards ?? createPreviewInitialForest(),
    pieces: room?.game?.pieces ?? [],
    roomWarnings
  };
}
