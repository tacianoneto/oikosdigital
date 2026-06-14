import { useEffect, useState } from "react";
import { Clock, Eye } from "lucide-react";
import { scenarioCardsById } from "@oikos/content";
import type { PublicRoomState, ScenarioCardId } from "@oikos/shared";
import { ResourceText } from "./ResourceText";

export function ScenarioVotingOverlay({
  room,
  playerId,
  isSpectator,
  onSubmitVotes
}: {
  room: PublicRoomState;
  playerId: string | null;
  isSpectator: boolean;
  onSubmitVotes: (votes: ScenarioCardId[]) => void;
}) {
  const voting = room.scenarioVoting;
  const [now, setNow] = useState(() => Date.now());
  const [localVotes, setLocalVotes] = useState<ScenarioCardId[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const scenarioCount = voting?.scenarioCount ?? room.scenarioCount ?? 1;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!voting || !playerId) return;
    const serverVotes = voting.votesByPlayer[playerId] ?? [];
    if (serverVotes.length >= scenarioCount) {
      setSubmitted(true);
      setLocalVotes(serverVotes);
    }
  }, [voting, playerId, scenarioCount]);

  if (!voting) return null;

  const remaining = Math.max(0, voting.deadline - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const low = remaining <= 10000;
  const canVote = Boolean(playerId) && !isSpectator && !submitted && !voting.selectedIds;
  const totalPlayers = room.players.length;
  const votedPlayers = room.players.filter(
    (p) => (voting.votesByPlayer[p.playerId] ?? []).length >= scenarioCount
  ).length;

  const toggleVote = (id: ScenarioCardId) => {
    if (!canVote) return;
    setLocalVotes((prev) => {
      if (prev.includes(id)) return prev.filter((v) => v !== id);
      if (prev.length >= scenarioCount) return prev;
      return [...prev, id];
    });
  };

  const submit = () => {
    if (!canVote || localVotes.length !== scenarioCount) return;
    onSubmitVotes(localVotes);
    setSubmitted(true);
  };

  const selectedDefinitions = voting.selectedIds?.map((id) => scenarioCardsById.get(id)).filter(Boolean) ?? [];

  return (
    <div className="scenario-vote-overlay" role="dialog" aria-label="Votação de cenários">
      <div className="scenario-vote-panel">
        <header className="scenario-vote-header">
          <div className="scenario-vote-copy">
            <span className="scenario-vote-badge">Mini-expansão: Cenários</span>
            <h2>Vote em {scenarioCount} carta{scenarioCount === 1 ? "" : "s"} de cenário</h2>
            <p>
              {scenarioCount === 1 ? "A mais votada altera" : "As mais votadas alteram"} regras durante toda esta partida.
            </p>
            <div className="scenario-vote-progress" aria-hidden="true">
              <span style={{ width: `${Math.round((votedPlayers / Math.max(1, totalPlayers)) * 100)}%` }} />
            </div>
          </div>
          <div className={`scenario-vote-timer ${low ? "is-low" : ""}`}>
            <Clock aria-hidden="true" />
            <span>{totalSeconds}s</span>
          </div>
        </header>

        <div className="scenario-vote-status">
          <span>{votedPlayers}/{totalPlayers} jogadores votaram</span>
          {isSpectator && <span>· Você está assistindo</span>}
          {submitted && !isSpectator && <span>· Aguardando demais jogadores…</span>}
        </div>

        <ul className="scenario-vote-grid">
          {voting.candidateIds.map((id) => {
            const def = scenarioCardsById.get(id);
            if (!def) return null;
            const selected = localVotes.includes(id);
            const winner = voting.selectedIds?.includes(id);
            return (
              <li key={id} className="scenario-vote-card-wrap">
                <button
                  type="button"
                  className={`scenario-vote-card ${selected ? "is-selected" : ""} ${winner ? "is-winner" : ""}`}
                  disabled={!canVote}
                  onClick={() => toggleVote(id)}
                  aria-pressed={selected}
                  aria-label={`${def.label}: ${def.description}`}
                >
                  <span className="scenario-vote-card-img">
                    <img src={encodeURI(def.imagePath)} alt={def.label} />
                    <span className="scenario-vote-zoom-cue" aria-hidden="true">
                      <Eye aria-hidden="true" />
                    </span>
                  </span>
                  <span className="scenario-vote-card-copy">
                    <span className="scenario-vote-card-name">{def.label}</span>
                    <span className="scenario-vote-card-desc"><ResourceText text={def.description} /></span>
                  </span>
                  {selected && (
                    <span className="scenario-vote-card-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
                <span className="scenario-vote-card-zoom" aria-hidden="true">
                  <img src={encodeURI(def.imagePath)} alt="" />
                </span>
              </li>
            );
          })}
        </ul>

        {voting.selectedIds && voting.selectedIds.length > 0 && (
          <div className="scenario-vote-result">
            <strong>Cenários selecionados:</strong>
            <div>
              {selectedDefinitions.map((def) =>
                def ? <span key={def.id} className="scenario-vote-result-tag">{def.label}</span> : null
              )}
            </div>
          </div>
        )}

        <footer className="scenario-vote-footer">
          {canVote ? (
            <button
              type="button"
              className="primary-button"
              disabled={localVotes.length !== scenarioCount}
              onClick={submit}
            >
              Confirmar voto ({localVotes.length}/{scenarioCount})
            </button>
          ) : isSpectator ? (
            <span className="scenario-vote-hint">Espectadores não votam.</span>
          ) : (
            <span className="scenario-vote-hint">Voto registrado.</span>
          )}
        </footer>
      </div>
    </div>
  );
}
