import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { threatCardsById } from "@oikos/content";
import type { ScenarioCardDefinition, ThreatCardId } from "@oikos/shared";

interface ScenarioThreatOrchestrationParams {
  activeScenarioDefinitions: ScenarioCardDefinition[];
  activeThreatCardId: ThreatCardId | null;
  gameId: string | null;
  setScenarioDockOpen: Dispatch<SetStateAction<boolean>>;
  setThreatReveal: Dispatch<SetStateAction<ThreatCardId | null>>;
  threatReveal: ThreatCardId | null;
}

export function useScenarioThreatOrchestration({
  activeScenarioDefinitions,
  activeThreatCardId,
  gameId,
  setScenarioDockOpen,
  setThreatReveal,
  threatReveal
}: ScenarioThreatOrchestrationParams) {
  const lastThreatRef = useRef<{ gameId: string | null; threatId: ThreatCardId | null }>({
    gameId: null,
    threatId: null
  });

  useEffect(() => {
    if (!gameId) {
      lastThreatRef.current = { gameId: null, threatId: null };
      return;
    }
    const prev = lastThreatRef.current;
    if (prev.gameId !== gameId) {
      lastThreatRef.current = { gameId, threatId: activeThreatCardId };
      return;
    }
    if (activeThreatCardId && activeThreatCardId !== prev.threatId) {
      setThreatReveal(activeThreatCardId);
    }
    lastThreatRef.current = { gameId, threatId: activeThreatCardId };
  }, [activeThreatCardId, gameId, setThreatReveal]);

  useEffect(() => {
    if (!threatReveal) return;
    const timer = setTimeout(() => setThreatReveal(null), 5000);
    return () => clearTimeout(timer);
  }, [setThreatReveal, threatReveal]);

  const activeScenarioKey = activeScenarioDefinitions.map((scenario) => scenario.id).join("|");
  useEffect(() => {
    setScenarioDockOpen(Boolean(activeScenarioKey));
  }, [activeScenarioKey, setScenarioDockOpen]);

  return useMemo(
    () => ({
      threatRevealDefinition: threatReveal ? threatCardsById.get(threatReveal) ?? null : null
    }),
    [threatReveal]
  );
}
