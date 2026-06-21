import { useEffect, useMemo, useRef, useState } from "react";
import {
  forestCardsById,
  objectiveCardsById,
  resourceAssets,
  scenarioCardsById,
  speciesDefinitions,
  threatCardsById
} from "@oikos/content";
import type { GameState } from "@oikos/shared";

interface GamePreloaderState {
  ready: boolean;
  progress: number;
  label: string;
}

const minimumLoadingMs = 650;

export function useGamePreloader(game: GameState | null | undefined): GamePreloaderState {
  const assets = useMemo(() => getEssentialGameAssets(game), [game]);
  const loadedGameIdsRef = useRef<Set<string>>(new Set());
  const [state, setState] = useState<GamePreloaderState>({ ready: !game, progress: 1, label: "Pronto" });

  useEffect(() => {
    if (!game) {
      setState({ ready: true, progress: 1, label: "Pronto" });
      return;
    }

    if (loadedGameIdsRef.current.has(game.gameId)) {
      setState({ ready: true, progress: 1, label: "Partida pronta" });
      return;
    }

    let cancelled = false;
    const startedAt = window.performance.now();
    const total = assets.length;
    let finished = 0;

    setState({
      ready: total === 0,
      progress: total === 0 ? 1 : 0,
      label: getLoadingLabel(game, 0)
    });

    const completeOne = () => {
      finished += 1;
      const progress = total === 0 ? 1 : finished / total;
      if (!cancelled) {
        setState({ ready: false, progress, label: getLoadingLabel(game, progress) });
      }
    };

    const loaders = assets.map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => {
            completeOne();
            resolve();
          };
          image.onerror = () => {
            completeOne();
            resolve();
          };
          image.src = src;
        })
    );

    void Promise.all(loaders).then(() => {
      const elapsed = window.performance.now() - startedAt;
      const waitMs = Math.max(0, minimumLoadingMs - elapsed);
      window.setTimeout(() => {
        if (!cancelled) {
          loadedGameIdsRef.current.add(game.gameId);
          setState({ ready: true, progress: 1, label: "Partida pronta" });
        }
      }, waitMs);
    });

    return () => {
      cancelled = true;
    };
  }, [assets, game]);

  return state;
}

function getEssentialGameAssets(game: GameState | null | undefined): string[] {
  if (!game) {
    return [];
  }

  const assets = new Set<string>(Object.values(resourceAssets));
  for (const player of game.players) {
    if (!player.speciesId) {
      continue;
    }
    const species = speciesDefinitions[player.speciesId];
    assets.add(species.boardAsset);
    assets.add(species.meepleAsset);
    assets.add(species.portraitAsset);
    assets.add(species.movementAsset);

    for (const cardId of player.hand) {
      addForestCardAsset(assets, cardId);
    }
    for (const cardId of player.objectiveChoices) {
      addObjectiveAsset(assets, cardId);
    }
    if (player.selectedObjectiveCardId) {
      addObjectiveAsset(assets, player.selectedObjectiveCardId);
    }
  }

  for (const card of game.forest.cards) {
    addForestCardAsset(assets, card.definitionId);
  }
  for (const pile of game.mataAtlanticaPiles ?? []) {
    if (pile[0]) {
      addForestCardAsset(assets, pile[0]);
    }
  }
  for (const scenarioId of game.activeScenarioIds ?? []) {
    const scenario = scenarioCardsById.get(scenarioId);
    if (scenario) {
      assets.add(scenario.imagePath);
    }
  }
  if (game.activeThreatCardId) {
    const threat = threatCardsById.get(game.activeThreatCardId);
    if (threat?.imagePath) {
      assets.add(threat.imagePath);
    }
  }

  return Array.from(assets);
}

function addForestCardAsset(assets: Set<string>, cardId: string): void {
  const card = forestCardsById.get(cardId);
  if (card) {
    assets.add(card.imagePath);
  }
}

function addObjectiveAsset(assets: Set<string>, cardId: string): void {
  const card = objectiveCardsById.get(cardId);
  if (card) {
    assets.add(card.imagePath);
  }
}

function getLoadingLabel(game: GameState, progress: number): string {
  if (progress < 0.28) return "Carregando cartas";
  if (progress < 0.58) return "Preparando floresta";
  if (progress < 0.86) return game.status === "setup" ? "Preparando setup" : "Sincronizando mesa";
  return "Quase pronto";
}
