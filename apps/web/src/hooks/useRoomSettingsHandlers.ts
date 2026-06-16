import { type Dispatch, type SetStateAction } from "react";
import {
  TURN_TIMER_DEFAULT_MS,
  TURN_TIMER_OPTIONS_MS,
  areScenariosExclusive,
  type MiniExpansionId,
  type PublicRoomState,
  type ScenarioCardId,
  type ScenarioCount
} from "@oikos/shared";
import { roomApi, type OikosSocket } from "../socket";
import { localRoomId, maxBotTurnDelayMs, minBotTurnDelayMs } from "../ui/gameConstants";

interface RoomSettingsHandlersParams {
  room: PublicRoomState | null;
  isHost: boolean;
  isLocalRoom: boolean;
  botTurnDelayMs: number;
  turnTimerMs: number | null;
  enabledMiniExpansions: readonly MiniExpansionId[];
  scenarioSelectionMode: "vote" | "host";
  scenarioCount: ScenarioCount;
  hostSelectedScenarioIds: ScenarioCardId[];
  localScenarioCount: ScenarioCount;
  setRoom: Dispatch<SetStateAction<PublicRoomState | null>>;
  setLocalBotTurnDelayMs: Dispatch<SetStateAction<number>>;
  setLocalEnabledMiniExpansions: Dispatch<SetStateAction<MiniExpansionId[]>>;
  setLocalScenarioCount: Dispatch<SetStateAction<ScenarioCount>>;
  setLocalSelectedScenarioIds: Dispatch<SetStateAction<ScenarioCardId[]>>;
  run: (action: () => Promise<PublicRoomState>, success?: string) => Promise<void>;
  requireSocket: () => OikosSocket;
  setNotice: (notice: string | null) => void;
}

export function useRoomSettingsHandlers({
  room,
  isHost,
  isLocalRoom,
  botTurnDelayMs,
  turnTimerMs,
  enabledMiniExpansions,
  scenarioSelectionMode,
  scenarioCount,
  hostSelectedScenarioIds,
  localScenarioCount,
  setRoom,
  setLocalBotTurnDelayMs,
  setLocalEnabledMiniExpansions,
  setLocalScenarioCount,
  setLocalSelectedScenarioIds,
  run,
  requireSocket,
  setNotice
}: RoomSettingsHandlersParams) {
  function formatBotDelay(delayMs: number): string {
    return delayMs >= 1000 ? `${(delayMs / 1000).toFixed(delayMs % 1000 === 0 ? 0 : 1)}s` : `${delayMs}ms`;
  }

  function clampBotSpeed(delayMs: number): number {
    return Math.max(minBotTurnDelayMs, Math.min(maxBotTurnDelayMs, delayMs));
  }

  function adjustLocalBotSpeed(deltaMs: number) {
    setLocalBotTurnDelayMs((current) => clampBotSpeed(current + deltaMs));
  }

  function adjustBotSpeed(deltaMs: number) {
    if (!room) {
      return;
    }

    const nextDelay = clampBotSpeed(botTurnDelayMs + deltaMs);
    if (isLocalRoom) {
      setLocalBotTurnDelayMs(nextDelay);
      setRoom((current) =>
        current?.roomId === localRoomId
          ? {
              ...current,
              botTurnDelayMs: nextDelay
            }
          : current
      );
      return;
    }

    if (!isHost) {
      return;
    }

    void run(() => roomApi.setBotSpeed(requireSocket(), room.roomId, nextDelay));
  }

  function toggleTurnTimer() {
    if (!room || !isHost) {
      return;
    }

    void run(
      () => roomApi.setTurnTimer(requireSocket(), room.roomId, turnTimerMs ? null : TURN_TIMER_DEFAULT_MS),
      turnTimerMs ? "Cronômetro de turno desligado." : "Cronômetro de turno ligado."
    );
  }

  function adjustTurnTimer(direction: number) {
    if (!room || !isHost || !turnTimerMs) {
      return;
    }

    const timerOptions: readonly number[] = TURN_TIMER_OPTIONS_MS;
    const currentIndex = timerOptions.indexOf(turnTimerMs);
    const baseIndex = currentIndex >= 0 ? currentIndex : timerOptions.indexOf(TURN_TIMER_DEFAULT_MS);
    const nextIndex = Math.max(0, Math.min(timerOptions.length - 1, baseIndex + direction));
    void run(() => roomApi.setTurnTimer(requireSocket(), room.roomId, timerOptions[nextIndex]));
  }

  function toggleMiniExpansion(expansionId: MiniExpansionId) {
    if (!room || !isHost || room.status !== "lobby") {
      return;
    }

    const enabled = !enabledMiniExpansions.includes(expansionId);
    void run(
      () => roomApi.setMiniExpansion(requireSocket(), room.roomId, expansionId, enabled),
      enabled ? "Mini-expansão ligada." : "Mini-expansão desligada."
    );
  }

  function setScenarioMode(mode: "vote" | "host") {
    if (!room || !isHost || room.status !== "lobby" || scenarioSelectionMode === mode) {
      return;
    }

    void run(
      () => roomApi.setScenarioSelectionMode(requireSocket(), room.roomId, mode),
      mode === "vote" ? "Cenários serão votados." : "Host escolherá os cenários."
    );
  }

  function setRoomScenarioCount(nextCount: ScenarioCount) {
    if (!room || !isHost || room.status !== "lobby" || scenarioCount === nextCount) {
      return;
    }

    void run(
      () => roomApi.setScenarioCount(requireSocket(), room.roomId, 1),
      "1 cenario por partida."
    );
  }

  function toggleHostScenario(scenarioId: ScenarioCardId) {
    if (!room || !isHost || room.status !== "lobby") {
      return;
    }

    if (
      !hostSelectedScenarioIds.includes(scenarioId) &&
      hostSelectedScenarioIds.some((id) => areScenariosExclusive(id, scenarioId))
    ) {
      setNotice("Pantanal e Mata Atlântica não podem ser jogados juntos.");
      return;
    }

    const next = hostSelectedScenarioIds.includes(scenarioId)
      ? hostSelectedScenarioIds.filter((id) => id !== scenarioId)
      : hostSelectedScenarioIds.length >= scenarioCount
        ? hostSelectedScenarioIds
        : [...hostSelectedScenarioIds, scenarioId];

    if (next === hostSelectedScenarioIds) {
      setNotice(`Escolha no maximo ${scenarioCount} cenario(s).`);
      return;
    }

    void run(() => roomApi.setHostSelectedScenarios(requireSocket(), room.roomId, next));
  }

  function toggleLocalMiniExpansion(expansionId: MiniExpansionId) {
    setLocalEnabledMiniExpansions((current) =>
      current.includes(expansionId)
        ? current.filter((candidate) => candidate !== expansionId)
        : [...current, expansionId]
    );
  }

  function setLocalScenarioCountValue(nextCount: ScenarioCount) {
    setLocalScenarioCount(1);
    setLocalSelectedScenarioIds((current) => current.slice(0, 1));
  }

  function toggleLocalScenario(scenarioId: ScenarioCardId) {
    setLocalSelectedScenarioIds((current) => {
      if (current.includes(scenarioId)) {
        return current.filter((candidate) => candidate !== scenarioId);
      }

      if (current.length >= localScenarioCount) {
        setNotice(`Escolha no maximo ${localScenarioCount} cenario(s).`);
        return current;
      }

      if (current.some((id) => areScenariosExclusive(id, scenarioId))) {
        setNotice("Pantanal e Mata Atlantica nao podem ser jogados juntos.");
        return current;
      }

      return [...current, scenarioId];
    });
  }

  return {
    formatBotDelay,
    clampBotSpeed,
    adjustLocalBotSpeed,
    adjustBotSpeed,
    toggleTurnTimer,
    adjustTurnTimer,
    toggleMiniExpansion,
    setScenarioMode,
    setRoomScenarioCount,
    toggleLocalMiniExpansion,
    setLocalScenarioCountValue,
    toggleLocalScenario,
    toggleHostScenario
  };
}
