import type { ComponentType, MouseEvent } from "react";
import { ResourceIcon, ResourceText } from "./ResourceText";
import { ArmadilloSharePanel } from "./ArmadilloSharePanel";
import { SpeciesHudShell } from "./SpeciesHudShell";
import type { ScoringPreview } from "../hooks/scoringPreview";
import type {
  ActionId,
  GameState,
  GridPosition,
  PlayerState,
  Resource,
  SpeciesId
} from "@oikos/shared";

type ExpansionKind = "objective" | "scenarios" | "threat";

interface ActionContentProps {
  game: GameState;
  player: PlayerState;
  activeActionId: ActionId | null;
  tutorialActive: boolean;
  canSkipJaguarMove: boolean;
  selectedJaguarDestination: GridPosition | null;
  selectedPieceId: string | null;
  selectedWolfTargetPieceId: string | null;
  selectedRemovalPieceIds: string[];
  wolfRemovableBasePieceCount: number;
  wolfMeatTargetCount: number;
  armadilloHideablePieceCount: number;
  armadilloSharing: ScoringPreview["armadillo"];
  macawActionCTargetCount: number;
  macawLineScore: number;
  galoSeedCardScore: number;
  capuchinReserveCount: number;
  capuchinPlacementTargetCount: number;
  capuchinHabitatScore: number;
  requiredCoatiRemovalCount: number;
  hasPendingCoatiPairBonus: boolean;
  onCompleteAction: () => void;
  onHideArmadillo: () => void;
  onRemoveWolfBasePiece: () => void;
  onRemoveSelectedPieces: () => void;
}

interface SpeciesActionHudProps extends ActionContentProps {
  resourceMajority: Record<Resource, boolean>;
  showObjective: boolean;
  objectiveCompleted: boolean;
  objectiveDiscarded: boolean;
  showScenarios: boolean;
  showThreat: boolean;
  setEffectTarget: (key: string, element: HTMLElement | null) => void;
  onExpansionToggle: (kind: ExpansionKind, event: MouseEvent<HTMLButtonElement>) => void;
}

function SecondaryActionButton({
  children,
  disabled,
  onClick
}: {
  children: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="action-box-actions">
      <button className="action-box-btn is-secondary" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    </div>
  );
}

function JaguarActionContent({
  activeActionId,
  canSkipJaguarMove,
  selectedJaguarDestination,
  onCompleteAction
}: ActionContentProps) {
  return (
    <>
      {(activeActionId === "A" || activeActionId === "B") && (
        <div className="action-box-hint">
          {canSkipJaguarMove
            ? "Nenhum destino válido. Conclua a ação para seguir."
            : selectedJaguarDestination
              ? "Escolha qual meeple remover no destino selecionado."
              : "Selecione a Onça e clique em um destino destacado."}
        </div>
      )}
      {activeActionId === "C" && (
        <div className="action-box-hint">
          <ResourceText text="Defina quantas carnes converter em pontos na janela central." />
        </div>
      )}
      {canSkipJaguarMove && (activeActionId === "A" || activeActionId === "B") && (
        <SecondaryActionButton disabled={false} onClick={onCompleteAction}>
          Concluir
        </SecondaryActionButton>
      )}
    </>
  );
}

function WolfActionContent({
  game,
  activeActionId,
  tutorialActive,
  selectedWolfTargetPieceId,
  wolfRemovableBasePieceCount,
  wolfMeatTargetCount,
  onCompleteAction,
  onRemoveWolfBasePiece
}: ActionContentProps) {
  if (activeActionId === "A") {
    return (
      <div className="action-box-hint">
        {game.activePlayedForestCardId ? (
          <>
            Conduza os lobos destacados pelo padrão da carta. Pendentes:{" "}
            <strong>{game.pendingWolfMoves?.pieceIds.length ?? 0}</strong>.
          </>
        ) : (
          "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."
        )}
      </div>
    );
  }

  if (activeActionId === "B") {
    return (
      <>
        <div className="action-box-hint">
          {wolfRemovableBasePieceCount > 0
            ? selectedWolfTargetPieceId
              ? "Peça de base selecionada. Confirme a remoção ou cancele a ação."
              : "Clique em uma peça de base que divida local com um lobo."
            : "Nenhuma peça de base partilha local com lobo."}
        </div>
        <div className="action-box-actions">
          <button
            className="action-box-btn"
            disabled={!selectedWolfTargetPieceId}
            onClick={onRemoveWolfBasePiece}
          >
            Remover peça
          </button>
          <button
            className="action-box-btn is-secondary"
            disabled={tutorialActive}
            onClick={onCompleteAction}
          >
            Concluir
          </button>
        </div>
      </>
    );
  }

  if (activeActionId === "C") {
    return <div className="action-box-hint">Escolha na janela central os recursos a converter em pontos.</div>;
  }

  if (activeActionId === "D") {
    return (
      <>
        <div className="action-box-hint">
          Clique em uma carta de <ResourceIcon resource="meat" /> para abrigar 1 lobo. Locais válidos:{" "}
          <strong>{wolfMeatTargetCount}</strong>.
        </div>
        <SecondaryActionButton disabled={tutorialActive} onClick={onCompleteAction}>
          Concluir sem adicionar
        </SecondaryActionButton>
      </>
    );
  }

  return null;
}

function ArmadilloActionContent({
  game,
  activeActionId,
  tutorialActive,
  selectedPieceId,
  armadilloHideablePieceCount,
  armadilloSharing,
  onCompleteAction,
  onHideArmadillo
}: ActionContentProps) {
  if (activeActionId === "A") {
    return (
      <>
        <div className="action-box-hint">
          <ResourceText
            text={
              game.activePlayedForestCardId
                ? "Clique em uma carta com semente destacada para abrigar 1 tatu."
                : "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."
            }
          />
        </div>
        {game.activePlayedForestCardId && (
          <SecondaryActionButton disabled={tutorialActive} onClick={onCompleteAction}>
            Avançar sem adicionar
          </SecondaryActionButton>
        )}
      </>
    );
  }

  if (activeActionId === "B") {
    return (
      <div className="action-box-hint">
        Selecione um Tatu-bola e clique em um destino destacado para conduzi-lo pelo padrão da carta jogada.
      </div>
    );
  }

  if (activeActionId === "C") {
    return (
      <>
        <div className="action-box-hint">
          Selecione um Tatu-bola visível para recolhê-lo em sua carapaça.
        </div>
        {selectedPieceId ? (
          <div className="action-box-actions">
            <button className="action-box-btn" onClick={onHideArmadillo}>
              Esconder Tatu-bola
            </button>
          </div>
        ) : armadilloHideablePieceCount === 0 ? (
          <SecondaryActionButton disabled={tutorialActive} onClick={onCompleteAction}>
            Concluir ação
          </SecondaryActionButton>
        ) : null}
      </>
    );
  }

  if (activeActionId === "D") {
    return (
      <>
        <div className="action-box-hint">
          Cada espécie no mesmo local de um Tatu-bola conta como compartilhamento.
        </div>
        {armadilloSharing && <ArmadilloSharePanel details={armadilloSharing} />}
      </>
    );
  }

  return null;
}

function MacawActionContent({
  game,
  activeActionId,
  tutorialActive,
  selectedPieceId,
  macawActionCTargetCount,
  macawLineScore,
  onCompleteAction
}: ActionContentProps) {
  if (activeActionId === "A") {
    return (
      <>
        <div className="action-box-hint">
          <ResourceText
            text={
              game.activePlayedForestCardId
                ? "Clique em uma carta com ovo destacada para abrigar 1 arara."
                : "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."
            }
          />
        </div>
        {game.activePlayedForestCardId && (
          <SecondaryActionButton disabled={tutorialActive} onClick={onCompleteAction}>
            Avançar sem adicionar
          </SecondaryActionButton>
        )}
      </>
    );
  }

  if (activeActionId === "B") {
    return (
      <div className="action-box-hint">
        Selecione uma Arara-azul e clique em um destino destacado para conduzi-la pelo padrão da carta jogada.
      </div>
    );
  }

  if (activeActionId === "C") {
    return (
      <>
        <div className="action-box-hint">
          Adicione uma arara da reserva ou realoque outra ao redor da que acabou de se mover.
        </div>
        <SecondaryActionButton disabled={tutorialActive} onClick={onCompleteAction}>
          {macawActionCTargetCount === 0 && !selectedPieceId
            ? "Concluir (sem espaço válido)"
            : "Avançar sem adicionar"}
        </SecondaryActionButton>
      </>
    );
  }

  if (activeActionId === "D") {
    return (
      <div className="action-box-hint">
        Pontuação automática: <strong>+{macawLineScore}</strong>{" "}
        {macawLineScore === 1 ? "ponto" : "pontos"} pelas formações lineares.
      </div>
    );
  }

  return null;
}

function GaloActionContent({
  game,
  player,
  activeActionId,
  tutorialActive,
  galoSeedCardScore,
  onCompleteAction
}: ActionContentProps) {
  if (activeActionId === "A") {
    return (
      <>
        <div className="action-box-hint">
          {game.activePlayedForestCardId
            ? "Clique em uma carta de campo destacada para abrigar 1 galo-de-campina."
            : "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."}
        </div>
        {game.activePlayedForestCardId && (
          <SecondaryActionButton disabled={tutorialActive} onClick={onCompleteAction}>
            Avançar sem adicionar
          </SecondaryActionButton>
        )}
      </>
    );
  }

  if (activeActionId === "B") {
    return (
      <div className="action-box-hint">
        Selecione um Galo-de-campina e clique em um destino destacado para conduzi-lo pelo padrão da carta jogada.
      </div>
    );
  }

  if (activeActionId === "C") {
    const hasPendingAdd = game.pendingGaloAdjacentAdd?.playerId === player.playerId;
    return (
      <>
        <div className="action-box-hint">
          <ResourceText
            text={
              hasPendingAdd
                ? "Clique em um local destacado adjacente ao galo movido para adicionar 1 galo-de-campina."
                : (player.resources.seed ?? 0) <= 0
                  ? "Sem semente disponível: conclua a ação para seguir."
                  : "Opcional: gaste 1 semente ao mover outro galo-de-campina pelo padrão da carta jogada e adicione 1 galo em um local adjacente a ele."
            }
          />
        </div>
        <SecondaryActionButton disabled={tutorialActive} onClick={onCompleteAction}>
          {hasPendingAdd ? "Concluir sem adicionar" : "Concluir sem gastar"}
        </SecondaryActionButton>
      </>
    );
  }

  if (activeActionId === "D") {
    return (
      <div className="action-box-hint">
        Pontuação automática: <strong>+{galoSeedCardScore}</strong>{" "}
        {galoSeedCardScore === 1 ? "ponto" : "pontos"}: +1 se presente em 3+ campinas, +1 se presente
        em 3+ locais de <ResourceIcon resource="seed" />.
      </div>
    );
  }

  return null;
}

function CapuchinActionContent({
  game,
  activeActionId,
  tutorialActive,
  capuchinReserveCount,
  capuchinPlacementTargetCount,
  capuchinHabitatScore,
  onCompleteAction
}: ActionContentProps) {
  if (activeActionId === "A") {
    return (
      <>
        <div className="action-box-hint">
          {capuchinReserveCount === 0 || capuchinPlacementTargetCount === 0 ? (
            "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."
          ) : (
            <>
              Clique na carta recém-revelada para abrigar 1 macaco. Reserva disponível:{" "}
              <strong>{capuchinReserveCount}</strong>.
            </>
          )}
        </div>
        {game.activePlayedForestCardId && (
          <SecondaryActionButton disabled={tutorialActive} onClick={onCompleteAction}>
            Avançar sem adicionar
          </SecondaryActionButton>
        )}
      </>
    );
  }

  if (activeActionId === "B") {
    return (
      <div className="action-box-hint">
        Selecione um Macaco-prego e clique em um destino destacado para conduzi-lo pelo padrão da carta jogada.
      </div>
    );
  }

  if (activeActionId === "C") {
    return (
      <>
        <div className="action-box-hint">
          {capuchinReserveCount === 0 || capuchinPlacementTargetCount === 0 ? (
            "Sem locais elegíveis ou reserva esgotada. Conclua a ação para seguir."
          ) : (
            <>
              Clique em um local com macaco já estabelecido para reforçar o bando. Reserva:{" "}
              <strong>{capuchinReserveCount}</strong>.
            </>
          )}
        </div>
        <SecondaryActionButton disabled={tutorialActive} onClick={onCompleteAction}>
          {capuchinPlacementTargetCount === 0 ? "Concluir ação" : "Avançar sem reforçar"}
        </SecondaryActionButton>
      </>
    );
  }

  if (activeActionId === "D") {
    return (
      <div className="action-box-hint">
        Pontuação automática: <strong>+{capuchinHabitatScore}</strong>{" "}
        {capuchinHabitatScore === 1 ? "ponto" : "pontos"} pelos habitats dominados.
      </div>
    );
  }

  return null;
}

function CoatiActionContent({
  game,
  activeActionId,
  tutorialActive,
  selectedRemovalPieceIds,
  requiredCoatiRemovalCount,
  hasPendingCoatiPairBonus,
  onCompleteAction,
  onRemoveSelectedPieces
}: ActionContentProps) {
  if (hasPendingCoatiPairBonus) {
    return (
      <div className="action-box-hint">
        Passiva ativada! Adicione 1 quati da reserva em uma carta adjacente. Essa adição marca 1 ponto.
      </div>
    );
  }

  if (activeActionId === "A") {
    return (
      <>
        <div className="action-box-hint">
          <ResourceText
            text={
              game.activePlayedForestCardId
                ? "Clique em uma carta com fruta destacada para abrigar 1 quati."
                : "Escolha uma carta da sua mão e posicione-a em um espaço vazio destacado."
            }
          />
        </div>
        {game.activePlayedForestCardId && !tutorialActive && (
          <SecondaryActionButton disabled={false} onClick={onCompleteAction}>
            Avançar sem adicionar
          </SecondaryActionButton>
        )}
      </>
    );
  }

  if (activeActionId === "B") {
    return (
      <div className="action-box-hint">
        Selecione um quati no tabuleiro e clique em um destino destacado para conduzi-lo pelo padrão da carta jogada.
      </div>
    );
  }

  if (activeActionId === "C") {
    if (requiredCoatiRemovalCount === 0) {
      return (
        <SecondaryActionButton disabled={tutorialActive} onClick={onCompleteAction}>
          Concluir ação
        </SecondaryActionButton>
      );
    }

    return (
      <>
        <div className="action-box-hint">
          Selecione <strong>{requiredCoatiRemovalCount}</strong>{" "}
          {requiredCoatiRemovalCount === 1 ? "quati" : "quatis"} para retirar. Marcados:{" "}
          <strong>
            {selectedRemovalPieceIds.length}/{requiredCoatiRemovalCount}
          </strong>
          .
        </div>
        <div className="action-box-actions">
          <button
            className="action-box-btn"
            disabled={selectedRemovalPieceIds.length !== requiredCoatiRemovalCount}
            onClick={onRemoveSelectedPieces}
          >
            Retirar quatis
          </button>
        </div>
      </>
    );
  }

  return null;
}

const ACTION_CONTENT: Record<SpeciesId, ComponentType<ActionContentProps>> = {
  jaguar: JaguarActionContent,
  maned_wolf: WolfActionContent,
  armadillo: ArmadilloActionContent,
  macaw: MacawActionContent,
  galo_de_campina: GaloActionContent,
  capuchin: CapuchinActionContent,
  coati: CoatiActionContent
};

export function SpeciesActionHud(props: SpeciesActionHudProps) {
  const speciesId = props.player.speciesId;
  if (!speciesId) {
    return null;
  }

  const ActionContent = ACTION_CONTENT[speciesId];
  const isActivePlayer = props.game.activePlayerId === props.player.playerId;

  return (
    <SpeciesHudShell
      speciesId={speciesId}
      player={props.player}
      activeActionId={props.activeActionId}
      resourceMajority={props.resourceMajority}
      showObjective={props.showObjective}
      objectiveCompleted={props.objectiveCompleted}
      objectiveDiscarded={props.objectiveDiscarded}
      showScenarios={props.showScenarios}
      showThreat={props.showThreat}
      setEffectTarget={props.setEffectTarget}
      onExpansionToggle={props.onExpansionToggle}
    >
      {isActivePlayer && <ActionContent {...props} />}
    </SpeciesHudShell>
  );
}
