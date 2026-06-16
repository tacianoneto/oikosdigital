import { useEffect, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import { speciesDefinitions } from "@oikos/content";
import type { GameState, GridPosition, PlayerState, SpeciesId } from "@oikos/shared";
import type { ForestCanvasHandle } from "../game/ForestCanvasTypes";
import { maxTurnHistory, resourceOrder } from "../ui/gameConstants";
import type { FloatingGain, TravelEffect } from "../ui/gameEffects";
import { elementCenter, sameGridPosition } from "../ui/geometry";
import { buildTurnSummaryEntries, type TurnSummary } from "../ui/turnSummary";
import type { TurnBanner } from "./useGameFeedback";
import type { TurnRecapState } from "../ui/turnSummary";

interface TurnTransitionEffectsParams {
  game: GameState | null;
  hudGamePlayer: PlayerState | null;
  turnBanner: TurnBanner | null;
  forestCanvasRef: RefObject<ForestCanvasHandle | null>;
  effectTargetRefs: MutableRefObject<Map<string, HTMLElement>>;
  setTurnBanner: Dispatch<SetStateAction<TurnBanner | null>>;
  setFloatingGains: Dispatch<SetStateAction<FloatingGain[]>>;
  setTravelEffects: Dispatch<SetStateAction<TravelEffect[]>>;
  setTurnRecap: Dispatch<SetStateAction<TurnRecapState>>;
  setRecapCollapsed: Dispatch<SetStateAction<boolean>>;
  setHoveredSummaryCardIds: Dispatch<SetStateAction<string[]>>;
}

// Watches the authoritative game state for turn transitions and resource/piece
// diffs, driving the transient visual feedback: the "next player" banner, the
// floating resource gains on the HUD, the fly-to-target travel effects and the
// per-turn recap entries. Pure observer — owns only its own diff refs; reads the
// game/HUD and writes through the feedback setters injected from OikosApp.
export function useTurnTransitionEffects({
  game,
  hudGamePlayer,
  turnBanner,
  forestCanvasRef,
  effectTargetRefs,
  setTurnBanner,
  setFloatingGains,
  setTravelEffects,
  setTurnRecap,
  setRecapCollapsed,
  setHoveredSummaryCardIds
}: TurnTransitionEffectsParams) {
  const prevTurnRef = useRef<string | null>(null);
  const prevSnapshotRef = useRef<{ playerId: string; score: number; resources: Record<string, number> } | null>(null);
  const prevGameRef = useRef<GameState | null>(null);
  const turnSnapshotRef = useRef<{ playerId: string; score: number; logLength: number; name: string; speciesId: SpeciesId | null } | null>(null);
  const travelSeqRef = useRef(0);
  const gainSeqRef = useRef(0);

  function appendTurnSummary(summary: TurnSummary): void {
    setTurnRecap((current) => {
      const history = [...current.history, summary].slice(-maxTurnHistory);
      return { history, index: history.length - 1, visible: true };
    });
    setRecapCollapsed(true);
    setHoveredSummaryCardIds([]);
  }

  useEffect(() => {
    if (game?.status !== "active") {
      prevTurnRef.current = null;
      return;
    }
    const activeId = game.activePlayerId ?? null;
    if (!activeId || prevTurnRef.current === activeId) {
      return;
    }
    const first = prevTurnRef.current === null;
    prevTurnRef.current = activeId;
    if (first) {
      return;
    }
    const player = game.players.find((candidate) => candidate.playerId === activeId);
    const sp = player?.speciesId ? speciesDefinitions[player.speciesId] : null;
    setTurnBanner({
      key: Date.now(),
      label: sp?.displayName ?? player?.name ?? "Próximo jogador",
      speciesId: player?.speciesId ?? null
    });
  }, [game?.activePlayerId, game?.status, game?.players]);

  useEffect(() => {
    if (!turnBanner) {
      return;
    }
    const timer = window.setTimeout(() => setTurnBanner(null), 2200);
    return () => window.clearTimeout(timer);
  }, [turnBanner]);

  useEffect(() => {
    if (!hudGamePlayer) {
      prevSnapshotRef.current = null;
      return;
    }
    const snap = {
      playerId: hudGamePlayer.playerId,
      score: hudGamePlayer.score,
      resources: { ...hudGamePlayer.resources } as Record<string, number>
    };
    const prev = prevSnapshotRef.current;
    prevSnapshotRef.current = snap;
    if (!prev || prev.playerId !== snap.playerId) {
      return;
    }
    const gains: FloatingGain[] = [];
    const scoreDelta = snap.score - prev.score;
    if (scoreDelta > 0) {
      gains.push({ id: ++gainSeqRef.current, resource: "point", amount: scoreDelta });
    }
    for (const resource of resourceOrder) {
      const delta = (snap.resources[resource] ?? 0) - (prev.resources[resource] ?? 0);
      if (delta > 0) {
        gains.push({ id: ++gainSeqRef.current, resource, amount: delta });
      }
    }
    if (gains.length === 0) {
      return;
    }
    setFloatingGains((current) => [...current, ...gains]);
    const ids = new Set(gains.map((gain) => gain.id));
    const timer = window.setTimeout(() => {
      setFloatingGains((current) => current.filter((gain) => !ids.has(gain.id)));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [hudGamePlayer]);

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null;
      turnSnapshotRef.current = null;
      return;
    }

    const prevGame = prevGameRef.current;
    const activePlayerId = game.status === "active" ? game.activePlayerId : null;

    if (!activePlayerId) {
      turnSnapshotRef.current = null;
    } else if (!turnSnapshotRef.current) {
      const activePlayer = game.players.find((candidate) => candidate.playerId === activePlayerId);
      if (activePlayer) {
        turnSnapshotRef.current = {
          playerId: activePlayer.playerId,
          score: activePlayer.score,
          logLength: game.log.length,
          name: activePlayer.name,
          speciesId: activePlayer.speciesId
        };
      }
    } else if (turnSnapshotRef.current.playerId !== activePlayerId) {
      const finishedSnapshot = turnSnapshotRef.current;
      const finishedPlayer = game.players.find((candidate) => candidate.playerId === finishedSnapshot.playerId);
      if (finishedPlayer) {
        const scoreDelta = Math.max(0, finishedPlayer.score - finishedSnapshot.score);
        const turnLog = game.log.slice(finishedSnapshot.logLength).filter((entry) => {
          const payload = entry.payload;
          if (payload?.actorPlayerId) {
            return payload.actorPlayerId === finishedPlayer.playerId;
          }
          return entry.message?.startsWith(finishedPlayer.name) ?? false;
        });
        appendTurnSummary({
          key: Date.now(),
          playerName: finishedPlayer.name,
          speciesId: finishedPlayer.speciesId,
          scoreDelta,
          entries: buildTurnSummaryEntries(turnLog, finishedPlayer.speciesId, scoreDelta, game.pieces)
        });
      }

      const nextPlayer = game.players.find((candidate) => candidate.playerId === activePlayerId);
      turnSnapshotRef.current = nextPlayer
        ? {
            playerId: nextPlayer.playerId,
            score: nextPlayer.score,
            logLength: game.log.length,
            name: nextPlayer.name,
            speciesId: nextPlayer.speciesId
          }
        : null;
    }

    if (prevGame) {
      const prevPieces = new Map(prevGame.pieces.map((piece) => [piece.pieceId, piece]));
      const currentPieces = new Map(game.pieces.map((piece) => [piece.pieceId, piece]));
      const sourcesByOwner = new Map<string, GridPosition[]>();
      const removedPieces: Array<{ pieceId: string; ownerId: string; speciesId: SpeciesId; location: GridPosition }> = [];

      for (const piece of game.pieces) {
        const previous = prevPieces.get(piece.pieceId);
        if (piece.location && (!previous?.location || !sameGridPosition(previous.location, piece.location))) {
          const sources = sourcesByOwner.get(piece.ownerId) ?? [];
          sources.push(piece.location);
          sourcesByOwner.set(piece.ownerId, sources);
        }
      }

      for (const previous of prevGame.pieces) {
        const current = currentPieces.get(previous.pieceId);
        if (previous.location && !current?.location) {
          removedPieces.push({
            pieceId: previous.pieceId,
            ownerId: previous.ownerId,
            speciesId: previous.speciesId,
            location: previous.location
          });
        }
      }

      const nextEffects: TravelEffect[] = [];
      const sourceFallbacks = [
        ...Array.from(sourcesByOwner.values()).flat(),
        ...removedPieces.map((piece) => piece.location)
      ];

      for (const player of game.players) {
        const prevPlayer = prevGame.players.find((candidate) => candidate.playerId === player.playerId);
        if (!prevPlayer) {
          continue;
        }

        for (const resource of resourceOrder) {
          const delta = (player.resources[resource] ?? 0) - (prevPlayer.resources[resource] ?? 0);
          if (delta <= 0) {
            continue;
          }

          const source =
            sourcesByOwner.get(player.playerId)?.[0] ??
            removedPieces.find((piece) => piece.ownerId === player.playerId)?.location ??
            sourceFallbacks[0];
          const from = source ? forestCanvasRef.current?.getCardCenter(source) : null;
          // Own resources fly to the new species HUD bar; an opponent's fly
          // straight to their portrait in the rail. Legacy keys remain as
          // fallbacks for spectators / when the new HUD is not mounted.
          const isOwnPlayer = hudGamePlayer?.playerId === player.playerId;
          const target = isOwnPlayer
            ? effectTargetRefs.current.get(`hudbar:${resource}`) ??
              effectTargetRefs.current.get(`hud:${resource}`)
            : effectTargetRefs.current.get(`portrait:${player.playerId}`) ??
              effectTargetRefs.current.get(`${player.playerId}:${resource}`);
          const to = elementCenter(target);
          if (from && to) {
            nextEffects.push({
              id: ++travelSeqRef.current,
              kind: "resource",
              resource,
              from,
              to
            });
          }
        }
      }

      for (const removed of removedPieces) {
        // Exact last meeple position (card-local offset included); fall back to
        // the card center only if the piece was never rendered. The shrink +
        // red flash + particle burst itself is drawn inside the Phaser scene
        // (camera-locked); here we only fly a token to the reserve/portrait.
        const from =
          forestCanvasRef.current?.getPieceCenter(removed.pieceId) ??
          forestCanvasRef.current?.getCardCenter(removed.location);
        const isOwnPlayer = hudGamePlayer?.playerId === removed.ownerId;
        const target = isOwnPlayer
          ? effectTargetRefs.current.get("hudbar:reserve") ?? effectTargetRefs.current.get("hud:reserve")
          : effectTargetRefs.current.get(`portrait:${removed.ownerId}`) ??
            effectTargetRefs.current.get(`${removed.ownerId}:reserve`);
        const to = elementCenter(target);
        if (from && to) {
          nextEffects.push({
            id: ++travelSeqRef.current,
            kind: "piece",
            speciesId: removed.speciesId,
            from,
            to
          });
        }
      }

      if (nextEffects.length > 0) {
        setTravelEffects((current) => [...current, ...nextEffects]);
        const ids = new Set(nextEffects.map((effect) => effect.id));
        window.setTimeout(() => {
          setTravelEffects((current) => current.filter((effect) => !ids.has(effect.id)));
        }, 1850);
      }
    }

    prevGameRef.current = game;
  }, [hudGamePlayer?.playerId, game]);
}
