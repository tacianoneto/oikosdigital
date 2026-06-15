import { AlertTriangle, Leaf } from "lucide-react";
import { getForestCardDefinition, resourceAssets, resourceLabels } from "@oikos/content";
import type { Resource } from "@oikos/shared";

// Presentational dialogs for the pending-scenario / threat resolutions
// (Caça ilegal, Caatinga, Cerrado, Mata Atlântica). The parent keeps the
// visibility conditions and game wiring; JSX is identical to the inline
// versions these replaced.

interface CacaIlegalChoiceModalProps {
  playerName: string;
  topResources: Resource[];
  resources: Partial<Record<Resource, number>>;
  hasRemovablePieces: boolean;
  onSpendResource: (resource: Resource) => void;
  onEnterRemovalMode: () => void;
}

export function CacaIlegalChoiceModal({
  playerName,
  topResources,
  resources,
  hasRemovablePieces,
  onSpendResource,
  onEnterRemovalMode
}: CacaIlegalChoiceModalProps) {
  return (
    <div className="caatinga-choice-backdrop" role="presentation">
      <section className="caatinga-choice-modal caca-choice-modal" role="dialog" aria-modal="true" aria-labelledby="caca-choice-title">
        <div className="caatinga-choice-head caca-choice-head">
          <AlertTriangle aria-hidden="true" />
          <span>Ameaca Caca ilegal</span>
        </div>
        <h2 id="caca-choice-title">Escolha a perda do turno</h2>
        <p>
          {playerName}, ao final do seu turno remova 1 peca sua do tabuleiro
          ou gaste 1 recurso entre os que voce mais possui.
        </p>
        {topResources.length > 0 && (
          <div className="caca-choice-section">
            <strong>Gastar recurso</strong>
            <div className="caca-resource-grid">
              {topResources.map((resource) => (
                <button
                  key={resource}
                  type="button"
                  className="caatinga-collect-btn caca-resource-btn"
                  onClick={() => onSpendResource(resource)}
                >
                  <img src={encodeURI(resourceAssets[resource])} alt="" />
                  {resourceLabels[resource]} ({resources[resource] ?? 0})
                </button>
              ))}
            </div>
          </div>
        )}
        {hasRemovablePieces && (
          <div className="caca-choice-section">
            <strong>Remover peca</strong>
            <button
              type="button"
              className="caatinga-collect-btn caca-remove-mode-btn"
              onClick={onEnterRemovalMode}
            >
              Voltar para a floresta e escolher peca
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

interface CacaIlegalRemovalBannerProps {
  selectedCount: number;
  confirmDisabled: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function CacaIlegalRemovalBanner({
  selectedCount,
  confirmDisabled,
  onConfirm,
  onBack
}: CacaIlegalRemovalBannerProps) {
  return (
    <div className="caca-board-removal-floating" role="status" aria-live="polite">
      <span>
        Selecione uma peca sua na floresta. Selecionada: <strong>{selectedCount}/1</strong>.
      </span>
      <button
        type="button"
        className="caca-board-confirm-btn"
        disabled={confirmDisabled}
        onClick={onConfirm}
      >
        Remover peca
      </button>
      <button
        type="button"
        className="caca-board-cancel-btn"
        onClick={onBack}
      >
        Voltar
      </button>
    </div>
  );
}

interface CaatingaChoiceModalProps {
  playerName: string;
  trigger: string;
  resource: Resource;
  currentResourceCount: number;
  onChoice: (mode: "gain" | "lose" | "skip") => void;
}

export function CaatingaChoiceModal({
  playerName,
  trigger,
  resource,
  currentResourceCount,
  onChoice
}: CaatingaChoiceModalProps) {
  return (
    <div className="caatinga-choice-backdrop" role="presentation">
      <section className="caatinga-choice-modal" role="dialog" aria-modal="true" aria-labelledby="caatinga-choice-title">
        <div className="caatinga-choice-head">
          <AlertTriangle aria-hidden="true" />
          <span>Cenário Caatinga</span>
        </div>
        <h2 id="caatinga-choice-title">
          {trigger === "remove" ? "Você removeu uma peça" : "Você adicionou uma peça"}
        </h2>
        <p>
          {playerName}, escolha o efeito no local:{" "}
          <strong>{resourceLabels[resource]}</strong>.
          Você só pode usar Caatinga uma vez nesta rodada.
        </p>
        <div className="caatinga-choice-resource">
          <img src={encodeURI(resourceAssets[resource])} alt="" />
          <span>{resourceLabels[resource]}</span>
        </div>
        <div className="caatinga-choice-actions">
          <button type="button" className="caatinga-collect-btn" onClick={() => onChoice("gain")}>
            <img src={encodeURI(resourceAssets[resource])} alt="" />
            Ganhar +1
          </button>
          <button
            type="button"
            className="caatinga-collect-btn caatinga-collect-btn--lose"
            onClick={() => onChoice("lose")}
            disabled={currentResourceCount <= 0}
            title={currentResourceCount <= 0 ? "Sem recurso para perder" : undefined}
          >
            <img src={encodeURI(resourceAssets[resource])} alt="" />
            Perder -1
          </button>
          <button
            type="button"
            className="caatinga-collect-btn caatinga-collect-btn--skip"
            onClick={() => onChoice("skip")}
          >
            Agora não
          </button>
        </div>
      </section>
    </div>
  );
}

interface CerradoChoiceModalProps {
  playerName: string;
  resource: Resource;
  onChoice: (mode: "collect" | "skip") => void;
}

export function CerradoChoiceModal({ playerName, resource, onChoice }: CerradoChoiceModalProps) {
  return (
    <div className="caatinga-choice-backdrop" role="presentation">
      <section className="caatinga-choice-modal" role="dialog" aria-modal="true" aria-labelledby="cerrado-choice-title">
        <div className="caatinga-choice-head">
          <Leaf aria-hidden="true" />
          <span>Cenário Cerrado</span>
        </div>
        <h2 id="cerrado-choice-title">Você encontrou um novo recurso</h2>
        <p>
          {playerName}, você ainda não possui{" "}
          <strong>{resourceLabels[resource]}</strong>. Ative o Cerrado agora para coletar 2,
          ou deixe para tentar em outro momento desta rodada.
        </p>
        <div className="caatinga-choice-resource">
          <img src={encodeURI(resourceAssets[resource])} alt="" />
          <span>{resourceLabels[resource]}</span>
        </div>
        <div className="caatinga-choice-actions caatinga-choice-actions--stack">
          <button type="button" className="caatinga-collect-btn" onClick={() => onChoice("collect")}>
            <img src={encodeURI(resourceAssets[resource])} alt="" />
            Coletar 2
          </button>
          <button
            type="button"
            className="caatinga-collect-btn caatinga-collect-btn--skip"
            onClick={() => onChoice("skip")}
          >
            Agora não
          </button>
        </div>
      </section>
    </div>
  );
}

interface MataAtlanticaDiscardModalProps {
  playerName: string;
  pileTopIds: string[];
  onDiscard: (cardId: string) => void;
}

export function MataAtlanticaDiscardModal({
  playerName,
  pileTopIds,
  onDiscard
}: MataAtlanticaDiscardModalProps) {
  return (
    <div className="caatinga-choice-backdrop" role="presentation">
      <section className="caatinga-choice-modal mata-discard-modal" role="dialog" aria-modal="true" aria-labelledby="mata-discard-title">
        <div className="caatinga-choice-head">
          <Leaf aria-hidden="true" />
          <span>Cenário Mata Atlântica</span>
        </div>
        <h2 id="mata-discard-title">Escolha 1 carta para descartar</h2>
        <p>
          {playerName}, sua espécie não usa cartas. No início do turno você deve
          descartar 1 carta aberta de uma das 3 pilhas.
        </p>
        <div className="mata-discard-grid">
          {pileTopIds.map((cardId, index) => {
            const def = getForestCardDefinition(cardId);
            return (
              <button
                key={cardId}
                type="button"
                className="mata-discard-option"
                onClick={() => onDiscard(cardId)}
                title={`Descartar carta da pilha ${index + 1}`}
              >
                <span className="mata-discard-pile-label">Pilha {index + 1}</span>
                <img src={encodeURI(def.imagePath)} alt={`Carta da pilha ${index + 1}`} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
