import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Crown, Leaf, LogOut, Play, Sprout, Star, Target, Trophy, Users } from "lucide-react";
import type { FinalScoreBreakdown, FinalScoreEntry, SpeciesId } from "@oikos/shared";
import { speciesDefinitions } from "@oikos/content";
import { speciesVar } from "./speciesStyle";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * Final-score ceremony. Reveals each scoring category one at a time over a
 * forest-themed backdrop, growing every player's number and re-sorting the
 * ranking as players overtake each other, then crowns the winner.
 *
 * Scoring logic stays in the rules engine: this component only consumes the
 * `FinalScoreBreakdown` it is handed and animates the reveal. Works for 1-5
 * players. Objective/scenario stages only appear when the mini-expansions were
 * actually in play (i.e. some player scored in them).
 */

type CategoryKey = "base" | "majority" | "seed" | "objective" | "scenario";

interface Category {
  key: CategoryKey;
  label: string;
  hint: string;
  color: string;
  icon: typeof Leaf;
  points: (entry: FinalScoreEntry) => number;
}

interface EndgameCeremonyProps {
  breakdown: FinalScoreBreakdown;
  winnerPlayerIds: string[];
  isLocalRoom: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

const STAGE_INTERVAL_MS = 2200;

function rankSort(a: { score: number; entry: FinalScoreEntry }, b: { score: number; entry: FinalScoreEntry }) {
  return (
    b.score - a.score ||
    b.entry.remainingResources - a.entry.remainingResources ||
    b.entry.populationValue - a.entry.populationValue
  );
}

export function EndgameCeremony({
  breakdown,
  winnerPlayerIds,
  isLocalRoom,
  onPlayAgain,
  onLeave
}: EndgameCeremonyProps) {
  const { entries, pointCap } = breakdown;

  // Build the reveal order. Base is always first; objective/scenario only join
  // when those mini-expansions contributed any points this match.
  const categories = useMemo<Category[]>(() => {
    const hasObjective = entries.some((e) => e.objectivePoints !== 0);
    const hasScenario = entries.some((e) => e.scenarioPoints !== 0);
    const list: Category[] = [
      { key: "base", label: "Pontos da partida", hint: "Conquistados ao longo do jogo", color: "#5fd08a", icon: Leaf, points: (e) => e.baseScore },
      { key: "majority", label: "Maioria de recursos", hint: "Carne, ovo e fruta dominados", color: "#f2c14e", icon: Trophy, points: (e) => e.resourceMajorityPoints },
      { key: "seed", label: "Sementes", hint: "1 ponto a cada 2 sementes", color: "#4cc6e8", icon: Sprout, points: (e) => e.seedPoints }
    ];
    if (hasObjective) {
      list.push({ key: "objective", label: "Objetivos", hint: "Metas da mini-expansão", color: "#b98cff", icon: Target, points: (e) => e.objectivePoints });
    }
    if (hasScenario) {
      list.push({ key: "scenario", label: "Cenário", hint: "Bônus do bioma em jogo", color: "#ef8b5a", icon: Star, points: (e) => e.scenarioPoints });
    }
    return list;
  }, [entries]);

  // revealCount = how many categories are currently revealed (1 = only base).
  const [revealCount, setRevealCount] = useState(1);
  const [done, setDone] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion.current) {
      setRevealCount(categories.length);
      setDone(true);
    }
  }, [categories.length]);

  // Auto-advance the reveal one category at a time.
  useEffect(() => {
    if (done) return;
    if (revealCount >= categories.length) {
      const t = window.setTimeout(() => setDone(true), 1100);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setRevealCount((n) => n + 1), STAGE_INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [revealCount, categories.length, done]);

  const skip = () => {
    setRevealCount(categories.length);
    setDone(true);
  };

  // Displayed (capped) score per player, summing only revealed categories.
  const scoreFor = (entry: FinalScoreEntry, upTo: number) => {
    let sum = 0;
    for (let i = 0; i < upTo && i < categories.length; i++) sum += categories[i].points(entry);
    return Math.min(pointCap, sum);
  };

  // Stacked bar segments per player. Each category is a colored slice whose
  // width is its share of the point cap, clamped so the bar never overflows.
  const segmentsFor = (entry: FinalScoreEntry) => {
    let used = 0;
    return categories.map((c, i) => {
      const raw = c.points(entry);
      const room = Math.max(0, pointCap - used);
      const val = Math.min(raw, room);
      used += val;
      return {
        key: c.key,
        color: c.color,
        widthPct: (val / pointCap) * 100,
        points: val,
        revealed: i < revealCount,
        active: !done && i === revealCount - 1
      };
    });
  };

  const ranking = useMemo(() => {
    const rows = entries.map((entry) => ({ entry, score: scoreFor(entry, revealCount) }));
    rows.sort(rankSort);
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, revealCount, categories, pointCap]);

  const currentCategory = categories[Math.min(revealCount, categories.length) - 1];
  const isBaseStage = revealCount <= 1;

  const winnerText =
    winnerPlayerIds.length === 0
      ? "Sem vencedor"
      : winnerPlayerIds.length === 1
        ? `${entries.find((e) => e.playerId === winnerPlayerIds[0])?.name ?? "Jogador"} venceu!`
        : `Empate: ${entries
            .filter((e) => winnerPlayerIds.includes(e.playerId))
            .map((e) => e.name)
            .join(", ")}`;

  // Decorative particles — leaves drifting down, fireflies glowing around panel.
  const leaves = useMemo<CSSProperties[]>(
    () =>
      Array.from({ length: 18 }, () => ({
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 8}s`,
        animationDuration: `${7 + Math.random() * 6}s`,
        fontSize: `${12 + Math.random() * 14}px`,
        ["--drift" as string]: `${-40 + Math.random() * 80}px`
      }) as CSSProperties),
    []
  );
  const fireflies = useMemo<CSSProperties[]>(
    () =>
      Array.from({ length: 22 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 5}s`,
        animationDuration: `${3 + Math.random() * 4}s`
      }) as CSSProperties),
    []
  );

  const rowH = entries.length > 4 ? 80 : 88;

  return (
    <div className="choice-modal-backdrop ceremony-backdrop" role="presentation">
      <div className="ceremony-leaves" aria-hidden="true">
        {leaves.map((style, i) => (
          <span key={i} className="ceremony-leaf" style={style}>
            🍃
          </span>
        ))}
      </div>
      <div className="ceremony-fireflies" aria-hidden="true">
        {fireflies.map((style, i) => (
          <span key={i} className="ceremony-firefly" style={style} />
        ))}
      </div>

      <div className="ceremony-panel" role="dialog" aria-modal="true" aria-label="Pontuação final">
        <header className="ceremony-head">
          <h2 className="ceremony-title">Pontuação Final</h2>
          {done && <p className={`ceremony-winner ${winnerPlayerIds.length ? "is-win" : ""}`}>{winnerText}</p>}
        </header>

        {/* Category being calculated right now — large, colored, prominent */}
        {!done && currentCategory && (
          <div
            className={`ceremony-stage ${isBaseStage ? "is-base" : ""}`}
            key={currentCategory.key}
            style={{ ["--cat" as string]: currentCategory.color } as CSSProperties}
          >
            <span className="ceremony-stage-leaf">
              <currentCategory.icon aria-hidden="true" />
            </span>
            <div className="ceremony-stage-text">
              <em>{isBaseStage ? "Revelando" : "Somando agora"}</em>
              <strong>{isBaseStage ? "Placar da partida" : currentCategory.label}</strong>
              <small>{currentCategory.hint}</small>
            </div>
            <div className="ceremony-stage-step">
              {revealCount}<span>/{categories.length}</span>
            </div>
          </div>
        )}

        {/* Color legend so players can map bar colors to categories */}
        {!done && (
          <div className="ceremony-legend">
            {categories.map((c, i) => (
              <span
                key={c.key}
                className={`ceremony-legend-item ${i < revealCount ? "on" : ""} ${
                  i === revealCount - 1 ? "current" : ""
                }`}
                style={{ ["--cat" as string]: c.color } as CSSProperties}
              >
                <i />
                {c.label}
              </span>
            ))}
          </div>
        )}

        {/* Ranking — rows are absolutely positioned by rank and slide on reorder */}
        <div className="ceremony-ranking" style={{ height: ranking.length * rowH }}>
          {ranking.map((row, rank) => {
            const entry = row.entry;
            const species = entry.speciesId ? speciesDefinitions[entry.speciesId] : null;
            const isWinner = done && winnerPlayerIds.includes(entry.playerId);
            const gain = !isBaseStage && currentCategory ? currentCategory.points(entry) : 0;
            const segments = segmentsFor(entry);
            return (
              <div
                key={entry.playerId}
                className={`ceremony-card rank-${rank + 1} ${isWinner ? "is-winner" : ""}`}
                style={{ ...speciesVar(entry.speciesId), transform: `translateY(${rank * rowH}px)` } as CSSProperties}
              >
                <span className="ceremony-rank">{rank + 1}</span>
                <span className="ceremony-portrait">
                  {isWinner && <Crown className="ceremony-crown" aria-hidden="true" />}
                  {species ? <img src={encodeURI(species.portraitAsset)} alt="" /> : <Users aria-hidden="true" />}
                </span>
                <div className="ceremony-main">
                  <div className="ceremony-id">
                    <strong>{entry.name}</strong>
                    {species && <small>{species.displayName}</small>}
                  </div>
                  <div className="ceremony-bar" role="presentation">
                    {segments.map((seg) => (
                      <span
                        key={seg.key}
                        className={`ceremony-seg ${seg.active ? "is-active" : ""}`}
                        style={{
                          width: seg.revealed ? `${seg.widthPct}%` : "0%",
                          background: seg.color
                        }}
                      />
                    ))}
                  </div>
                </div>
                <span className="ceremony-points">
                  {!done && gain > 0 && (
                    <span
                      className="ceremony-gain"
                      key={revealCount}
                      style={{ color: currentCategory?.color } as CSSProperties}
                    >
                      +{gain}
                    </span>
                  )}
                  <span className="ceremony-num">
                    <AnimatedNumber value={row.score} />
                  </span>
                  <small>pts</small>
                </span>
              </div>
            );
          })}
        </div>

        {/* Skip during reveal; details + navigation once done */}
        {!done ? (
          <div className="ceremony-actions">
            <button className="secondary-button" onClick={skip}>
              Pular animação
            </button>
          </div>
        ) : (
          <>
            {showDetails && (
              <div className="ceremony-details">
                {ranking.map((row, index) => {
                  const entry = row.entry;
                  const species = entry.speciesId ? speciesDefinitions[entry.speciesId] : null;
                  const isWinner = winnerPlayerIds.includes(entry.playerId);
                  const chips = categories
                    .map((c) => ({ key: c.key, label: c.label, icon: c.icon, color: c.color, value: c.points(entry) }))
                    .filter((c) => c.key === "base" || c.value !== 0);
                  return (
                    <div
                      key={entry.playerId}
                      className={`ceremony-detail-card ${isWinner ? "is-winner" : ""}`}
                      style={speciesVar(entry.speciesId)}
                    >
                      <span className="cd-rank">{index + 1}</span>
                      <span className="cd-portrait">
                        {species ? <img src={encodeURI(species.portraitAsset)} alt="" /> : <Users aria-hidden="true" />}
                      </span>
                      <div className="cd-body">
                        <div className="cd-head">
                          <strong>{entry.name}</strong>
                          {species && <small>{species.displayName}</small>}
                        </div>
                        <div className="cd-chips">
                          {chips.map((c) => (
                            <span key={c.key} className="cd-chip" style={{ ["--cat" as string]: c.color } as CSSProperties}>
                              <c.icon aria-hidden="true" />
                              <em>{c.label}</em>
                              <b>{c.key === "base" ? c.value : `+${c.value}`}</b>
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="cd-total">
                        <strong>{entry.totalScore}</strong>
                        <small>pts</small>
                      </span>
                    </div>
                  );
                })}
                <p className="ceremony-note">
                  Limite {pointCap} pts. Desempate: recursos restantes, depois maior população.
                </p>
              </div>
            )}
            <div className="ceremony-actions">
              <button className="secondary-button" onClick={() => setShowDetails((v) => !v)}>
                <Trophy aria-hidden="true" />
                {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
              </button>
              {isLocalRoom && (
                <button className="primary-button" onClick={onPlayAgain}>
                  <Play aria-hidden="true" />
                  Jogar novamente
                </button>
              )}
              <button className="secondary-button" onClick={onLeave}>
                <LogOut aria-hidden="true" />
                {isLocalRoom ? "Voltar ao menu" : "Voltar ao lobby"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
