import { useState } from "react";
import type { MiniExpansionId, ScenarioCardId, ScenarioCount, SpeciesId } from "@oikos/shared";
import { defaultBotTurnDelayMs } from "../ui/gameConstants";

const DEFAULT_LOCAL_SPECIES_IDS: SpeciesId[] = ["maned_wolf", "coati"];
const DEFAULT_LOCAL_SCENARIO_IDS: ScenarioCardId[] = ["amazonia"];

/**
 * Owns the local ("teste local") lobby configuration: which species play, which
 * are bots, bot speed, enabled mini-expansions and scenario selection. These
 * values are only meaningful before a local game starts; extracting them keeps
 * OikosApp's state surface smaller without changing any behavior.
 */
export function useLocalGameConfig() {
  const [localSpeciesIds, setLocalSpeciesIds] = useState<SpeciesId[]>(DEFAULT_LOCAL_SPECIES_IDS);
  const [localBotSpeciesIds, setLocalBotSpeciesIds] = useState<SpeciesId[]>([]);
  const [localBotTurnDelayMs, setLocalBotTurnDelayMs] = useState(defaultBotTurnDelayMs);
  const [localEnabledMiniExpansions, setLocalEnabledMiniExpansions] = useState<MiniExpansionId[]>([]);
  const [localScenarioCount, setLocalScenarioCount] = useState<ScenarioCount>(1);
  const [localSelectedScenarioIds, setLocalSelectedScenarioIds] = useState<ScenarioCardId[]>(DEFAULT_LOCAL_SCENARIO_IDS);

  return {
    localSpeciesIds,
    setLocalSpeciesIds,
    localBotSpeciesIds,
    setLocalBotSpeciesIds,
    localBotTurnDelayMs,
    setLocalBotTurnDelayMs,
    localEnabledMiniExpansions,
    setLocalEnabledMiniExpansions,
    localScenarioCount,
    setLocalScenarioCount,
    localSelectedScenarioIds,
    setLocalSelectedScenarioIds
  };
}
