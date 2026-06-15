import { Trophy } from "lucide-react";
import { resourceAssets } from "@oikos/content";
import { ResourceIcon, ResourceText } from "./ResourceText";

// Presentational dialogs for the pre-final-scoring objective prompts (extra turn
// and seed-spend). The parent keeps the visibility conditions and resolvers; JSX
// is identical to the inline versions these replaced.

interface ExtraTurnObjectiveModalProps {
  playerName: string;
  acceptDisabled: boolean;
  onResolve: (accept: boolean) => void;
}

export function ExtraTurnObjectiveModal({
  playerName,
  acceptDisabled,
  onResolve
}: ExtraTurnObjectiveModalProps) {
  return (
    <div className="caatinga-choice-backdrop" role="presentation">
      <section className="caatinga-choice-modal" role="dialog" aria-modal="true" aria-labelledby="extra-turn-title">
        <div className="caatinga-choice-head">
          <Trophy aria-hidden="true" />
          <span>Objetivo de turno extra</span>
        </div>
        <h2 id="extra-turn-title">Jogar 1 turno extra?</h2>
        <p>
          {playerName}, voce pode perder 1 ponto para jogar sozinho um turno extra
          antes da pontuacao final.
        </p>
        <div className="caatinga-choice-actions caatinga-choice-actions--stack">
          <button
            type="button"
            className="caatinga-collect-btn"
            onClick={() => onResolve(true)}
            disabled={acceptDisabled}
          >
            <Trophy aria-hidden="true" />
            Perder 1 ponto e jogar
          </button>
          <button
            type="button"
            className="caatinga-collect-btn caatinga-collect-btn--skip"
            onClick={() => onResolve(false)}
          >
            Recusar e finalizar
          </button>
        </div>
      </section>
    </div>
  );
}

interface SeedSpendObjectiveModalProps {
  playerName: string;
  spendCount: number;
  points: number;
  acceptDisabled: boolean;
  onResolve: (accept: boolean) => void;
}

export function SeedSpendObjectiveModal({
  playerName,
  spendCount,
  points,
  acceptDisabled,
  onResolve
}: SeedSpendObjectiveModalProps) {
  return (
    <div className="caatinga-choice-backdrop" role="presentation">
      <section className="caatinga-choice-modal" role="dialog" aria-modal="true" aria-labelledby="seed-spend-title">
        <div className="caatinga-choice-head">
          <Trophy aria-hidden="true" />
          <span><ResourceText text="Objetivo de sementes" /></span>
        </div>
        <h2 id="seed-spend-title">
          Gastar {spendCount} <ResourceIcon resource="seed" label="sementes" />?
        </h2>
        <p>
          {playerName}, antes da pontuacao final voce pode gastar{" "}
          <strong>{spendCount} <ResourceIcon resource="seed" label="sementes" /></strong> para ganhar{" "}
          <strong>{points} pontos</strong>. Depois disso, <ResourceIcon resource="seed" label="sementes" /> restantes ainda pontuam normalmente.
        </p>
        <div className="caatinga-choice-actions caatinga-choice-actions--stack">
          <button
            type="button"
            className="caatinga-collect-btn"
            onClick={() => onResolve(true)}
            disabled={acceptDisabled}
          >
            Gastar {spendCount}
            <img src={encodeURI(resourceAssets.seed)} alt="sementes" />
            para fazer {points}
            <img src={encodeURI(resourceAssets.point)} alt="pontos" />
          </button>
          <button
            type="button"
            className="caatinga-collect-btn caatinga-collect-btn--skip"
            onClick={() => onResolve(false)}
          >
            Nao gastar
          </button>
        </div>
      </section>
    </div>
  );
}
