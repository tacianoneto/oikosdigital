import { Check, MapPin, Play, X } from "lucide-react";
import { resourceAssets, resourceLabels } from "@oikos/content";
import type {
  ActionId,
  GameState,
  PlayerState,
  SpeciesDefinition
} from "@oikos/shared";
import { ActionStepsViewer } from "./ActionStepsViewer";
import { resourceOrder } from "./gameConstants";
import { ResourceIcon, ResourceText } from "./ResourceText";
import { speciesVar } from "./speciesStyle";

interface LeftActionDockProps {
  activeActionId: ActionId | null;
  activeGamePlayer: PlayerState | null;
  activeSpecies: SpeciesDefinition | null;
  armadilloHideablePieceCount: number;
  armadilloShareScore: number;
  canControlActivePlayer: boolean;
  canPlaceSetupPiece: boolean;
  canResolveCacaIlegal: boolean;
  canSkipJaguarMove: boolean;
  capuchinHabitatScore: number;
  capuchinPlacementTargetCount: number;
  capuchinReserveCount: number;
  cacaIlegalPending: boolean;
  cacaIlegalRemovalMode: boolean;
  collapsed: boolean;
  currentGamePlayer: PlayerState | null;
  game: GameState;
  hasPendingCoatiPairBonus: boolean;
  hasSelectedJaguarDestination: boolean;
  hasTurnRecap: boolean;
  macawEggTargetCount: number;
  macawLineScore: number;
  requiredCoatiRemovalCount: number;
  selectedPieceId: string | null;
  selectedRemovalPieceIds: string[];
  selectedWolfTargetPieceId: string | null;
  setupActivePlayer: PlayerState | null;
  setupNeeded: number;
  setupPlaced: number;
  tutorialActive: boolean;
  isBasicTutorial: boolean;
  wolfMeatTargetCount: number;
  wolfRemovableBasePieceCount: number;
  onCancelCacaIlegalRemoval: () => void;
  onCompleteAction: () => void;
  onHideArmadillo: () => void;
  onRemoveSelectedPieces: () => void;
  onRemoveWolfBasePiece: () => void;
  onResolveSelectedCacaIlegalPiece: () => void;
}

export function LeftActionDock({
  activeActionId,
  activeGamePlayer,
  activeSpecies,
  armadilloHideablePieceCount,
  armadilloShareScore,
  canControlActivePlayer,
  canPlaceSetupPiece,
  canResolveCacaIlegal,
  canSkipJaguarMove,
  capuchinHabitatScore,
  capuchinPlacementTargetCount,
  capuchinReserveCount,
  cacaIlegalPending,
  cacaIlegalRemovalMode,
  collapsed,
  currentGamePlayer,
  game,
  hasPendingCoatiPairBonus,
  hasSelectedJaguarDestination,
  hasTurnRecap,
  isBasicTutorial,
  macawEggTargetCount,
  macawLineScore,
  requiredCoatiRemovalCount,
  selectedPieceId,
  selectedRemovalPieceIds,
  selectedWolfTargetPieceId,
  setupActivePlayer,
  setupNeeded,
  setupPlaced,
  tutorialActive,
  wolfMeatTargetCount,
  wolfRemovableBasePieceCount,
  onCancelCacaIlegalRemoval,
  onCompleteAction,
  onHideArmadillo,
  onRemoveSelectedPieces,
  onRemoveWolfBasePiece,
  onResolveSelectedCacaIlegalPiece
}: LeftActionDockProps) {
  return (
    <div
      className={`hud-action hud-dock hud-left ${collapsed ? "is-collapsed" : ""} ${
        hasTurnRecap ? "has-turn-recap" : ""
      }`}
    >
      {game.status === "setup" && (
        <section className="panel-block setup-block">
          <div className="section-title">
            <MapPin aria-hidden="true" />
            <h2>Setup</h2>
          </div>
          <p>
            Vez de <strong>{setupActivePlayer?.name ?? "jogador"}</strong> posicionar peças iniciais.
          </p>
          {currentGamePlayer && (
            <div className="setup-meter">
              <span>Suas peças iniciais</span>
              <strong>
                {setupPlaced}/{setupNeeded}
              </strong>
            </div>
          )}
          {canPlaceSetupPiece && <p className="action-hint">Clique em qualquer carta da floresta inicial.</p>}
        </section>
      )}

      {game.status === "active" && activeGamePlayer && !isBasicTutorial && (
        <section className="panel-block active-turn-block" style={speciesVar(activeGamePlayer.speciesId)}>
          <div className="section-title">
            <Play aria-hidden="true" />
            <h2>Turno ativo</h2>
          </div>
          {activeSpecies && (
            <div className="action-list">
              {activeSpecies.actions.map((action) => (
                <span className={action === activeActionId ? "current" : ""} key={action}>
                  {action}
                </span>
              ))}
            </div>
          )}
          <div className="active-turn-vitals" aria-label="Resumo do jogador ativo">
            <span>
              <img src={encodeURI(resourceAssets.point)} alt="" />
              <strong>{activeGamePlayer.score}</strong>
            </span>
            <span>
              <strong>{activeGamePlayer.piecesInForest.length}</strong>
              <small>/ {activeSpecies?.totalPieces ?? activeGamePlayer.piecesInForest.length}</small>
            </span>
            {resourceOrder.map((resource) => (
              <span key={resource} title={resourceLabels[resource]}>
                <img src={encodeURI(resourceAssets[resource])} alt="" />
                <strong>{activeGamePlayer.resources[resource] ?? 0}</strong>
              </span>
            ))}
          </div>
          {cacaIlegalPending && canResolveCacaIlegal && cacaIlegalRemovalMode && (
            <div className="caca-board-removal-panel">
              <small>
                Selecione uma peca sua na floresta e confirme a remocao. Selecionada:{" "}
                {selectedRemovalPieceIds.length}/1.
              </small>
              <div className="caca-board-removal-actions">
                <button
                  className="secondary-button"
                  disabled={selectedRemovalPieceIds.length !== 1}
                  onClick={onResolveSelectedCacaIlegalPiece}
                >
                  Remover peca
                </button>
                <button className="secondary-button" onClick={onCancelCacaIlegalRemoval}>
                  Voltar
                </button>
              </div>
            </div>
          )}
          {activeSpecies && activeActionId && !isBasicTutorial && (
            <div className="current-action-card">
              <ActionStepsViewer
                speciesId={activeSpecies.speciesId}
                activeActionId={activeActionId}
                variant="card"
              />
              {activeSpecies.speciesId === "coati" && hasPendingCoatiPairBonus && canControlActivePlayer && (
                <small>
                  A passiva foi ativada: adicione 1 quati da reserva em uma carta adjacente. Essa adição marca
                  1 ponto.
                </small>
              )}
              {activeSpecies.speciesId === "coati" &&
                !hasPendingCoatiPairBonus &&
                activeActionId === "A" &&
                canControlActivePlayer && (
                  <>
                    <small>
                      <ResourceText
                        text={
                          game.activePlayedForestCardId
                            ? "Escolha uma carta com fruta para adicionar 1 quati, ou conclua sem adicionar."
                            : "Selecione uma carta na mão e coloque em um espaço vazio destacado."
                        }
                      />
                    </small>
                    {game.activePlayedForestCardId && !tutorialActive && (
                      <button className="secondary-button" onClick={onCompleteAction}>
                        Concluir sem adicionar
                      </button>
                    )}
                  </>
                )}
              {activeSpecies.speciesId === "coati" &&
                !hasPendingCoatiPairBonus &&
                activeActionId === "B" &&
                canControlActivePlayer && (
                  <small>Selecione um meeple do Quati no tabuleiro e clique em um destino destacado.</small>
                )}
              {activeSpecies.speciesId === "coati" &&
                !hasPendingCoatiPairBonus &&
                activeActionId === "C" &&
                canControlActivePlayer &&
                !tutorialActive &&
                requiredCoatiRemovalCount === 0 && (
                  <button className="secondary-button" onClick={onCompleteAction}>
                    Concluir ação {activeActionId}
                  </button>
                )}
              {activeSpecies.speciesId === "coati" &&
                !hasPendingCoatiPairBonus &&
                activeActionId === "C" &&
                canControlActivePlayer &&
                requiredCoatiRemovalCount > 0 && (
                  <>
                    <small>
                      Selecione {requiredCoatiRemovalCount} quatis da floresta. Selecionados:{" "}
                      {selectedRemovalPieceIds.length}/{requiredCoatiRemovalCount}.
                    </small>
                    <button
                      className="secondary-button"
                      disabled={selectedRemovalPieceIds.length !== requiredCoatiRemovalCount}
                      onClick={onRemoveSelectedPieces}
                    >
                      Remover quatis
                    </button>
                  </>
                )}
              {activeSpecies.speciesId === "jaguar" &&
                (activeActionId === "A" || activeActionId === "B") &&
                canControlActivePlayer && (
                  <>
                    <small>
                      {canSkipJaguarMove
                        ? "Não há destino válido para mover nesta ação."
                        : hasSelectedJaguarDestination
                          ? "Escolha qual meeple a Onça deve remover no destino selecionado."
                          : "Selecione a Onça e clique em um destino destacado. Com 1 meeple no destino, a remoção é automática; com mais de 1, escolha qual remover depois."}
                    </small>
                    {canSkipJaguarMove && (
                      <button className="secondary-button" onClick={onCompleteAction}>
                        Concluir sem movimento
                      </button>
                    )}
                  </>
                )}
              {activeSpecies.speciesId === "jaguar" &&
                activeActionId === "C" &&
                canControlActivePlayer && (
                  <small>
                    <ResourceText text="Escolha quantas carnes gastar na janela central." />
                  </small>
                )}
              {activeSpecies.speciesId === "capuchin" &&
                activeActionId === "A" &&
                canControlActivePlayer && (
                  <>
                    <small>
                      {!game.activePlayedForestCardId
                        ? "Selecione uma carta na mão e coloque em um espaço vazio destacado."
                        : capuchinReserveCount === 0 || capuchinPlacementTargetCount === 0
                          ? "Sem macacos na reserva. Conclua a ação para seguir."
                          : `Clique na carta jogada destacada para adicionar 1 macaco, ou conclua sem adicionar. Reserva: ${capuchinReserveCount}.`}
                    </small>
                    {game.activePlayedForestCardId && (
                      <button className="secondary-button" onClick={onCompleteAction}>
                        Concluir sem adicionar
                      </button>
                    )}
                  </>
                )}
              {activeSpecies.speciesId === "capuchin" &&
                activeActionId === "B" &&
                canControlActivePlayer && (
                  <small>
                    Selecione um meeple do Macaco-prego e clique em um destino destacado conforme a carta jogada.
                  </small>
                )}
              {activeSpecies.speciesId === "capuchin" &&
                activeActionId === "C" &&
                canControlActivePlayer && (
                  <>
                    <small>
                      {capuchinReserveCount === 0 || capuchinPlacementTargetCount === 0
                        ? "Sem macaco na reserva ou sem local válido. Conclua a ação para pontuar."
                        : `Clique em um local destacado que já tenha outro Macaco-prego, ou conclua sem adicionar. Reserva: ${capuchinReserveCount}.`}
                    </small>
                    <button className="secondary-button" onClick={onCompleteAction}>
                      Concluir sem adicionar
                    </button>
                  </>
                )}
              {activeSpecies.speciesId === "capuchin" &&
                activeActionId === "D" &&
                canControlActivePlayer && (
                  <small>Pontuação automática: +{capuchinHabitatScore} ponto(s) por habitat com macacos.</small>
                )}
              {activeSpecies.speciesId === "macaw" &&
                activeActionId === "A" &&
                canControlActivePlayer && (
                  <>
                    <small>
                      <ResourceText
                        text={
                          !game.activePlayedForestCardId
                            ? "Selecione uma carta na mão e coloque em um espaço vazio destacado."
                            : activeGamePlayer.reservePieces.length === 0
                              ? "Sem araras na reserva. Conclua a ação para seguir."
                              : macawEggTargetCount === 0
                                ? "Nenhuma carta com ovo disponível. Conclua a ação para seguir."
                                : `Clique em uma carta com ovo destacada para adicionar 1 arara, ou conclua sem adicionar. Reserva: ${activeGamePlayer.reservePieces.length}.`
                        }
                      />
                    </small>
                    {game.activePlayedForestCardId && (
                      <button className="secondary-button" onClick={onCompleteAction}>
                        Concluir sem adicionar
                      </button>
                    )}
                  </>
                )}
              {activeSpecies.speciesId === "macaw" &&
                activeActionId === "B" &&
                canControlActivePlayer && (
                  <small>Selecione uma Arara-azul e clique em um destino destacado conforme a carta jogada.</small>
                )}
              {activeSpecies.speciesId === "macaw" &&
                activeActionId === "C" &&
                canControlActivePlayer && (
                  <>
                    <small>
                      Adicione uma arara da reserva ou selecione outra arara para realocar ao redor da arara
                      movida.
                    </small>
                    <button className="secondary-button" onClick={onCompleteAction}>
                      Concluir sem adicionar/realocar
                    </button>
                  </>
                )}
              {activeSpecies.speciesId === "macaw" &&
                activeActionId === "D" &&
                canControlActivePlayer && (
                  <small>Pontuação automática: +{macawLineScore} ponto(s) por linha de 3 araras.</small>
                )}
              {activeSpecies.speciesId === "armadillo" &&
                activeActionId === "A" &&
                canControlActivePlayer && (
                  <>
                    <small>
                      <ResourceText
                        text={
                          game.activePlayedForestCardId
                            ? "Clique em uma carta com semente destacada para adicionar 1 tatu, ou conclua sem adicionar."
                            : "Selecione uma carta na mão e coloque em um espaço vazio destacado."
                        }
                      />
                    </small>
                    {game.activePlayedForestCardId && (
                      <button className="secondary-button" onClick={onCompleteAction}>
                        Concluir sem adicionar
                      </button>
                    )}
                  </>
                )}
              {activeSpecies.speciesId === "armadillo" &&
                activeActionId === "B" &&
                canControlActivePlayer && (
                  <small>Selecione um Tatu-bola e clique em um destino destacado conforme a carta jogada.</small>
                )}
              {activeSpecies.speciesId === "armadillo" &&
                activeActionId === "C" &&
                canControlActivePlayer && (
                  <>
                    <small>Selecione um Tatu-bola visível próprio para esconder.</small>
                    {selectedPieceId ? (
                      <button className="secondary-button" onClick={onHideArmadillo}>
                        Esconder Tatu-bola
                      </button>
                    ) : armadilloHideablePieceCount === 0 ? (
                      <button className="secondary-button" onClick={onCompleteAction}>
                        Concluir ação {activeActionId}
                      </button>
                    ) : null}
                  </>
                )}
              {activeSpecies.speciesId === "armadillo" &&
                activeActionId === "D" &&
                canControlActivePlayer && (
                  <small>Pontuação automática: +{armadilloShareScore} ponto(s) por compartilhamento.</small>
                )}
              {activeSpecies.speciesId === "maned_wolf" &&
                activeActionId === "A" &&
                canControlActivePlayer && (
                  <small>
                    {game.activePlayedForestCardId
                      ? `Mova os lobos destacados. Pendentes: ${game.pendingWolfMoves?.pieceIds.length ?? 0}.`
                      : "Selecione uma carta na mão e coloque em um espaço vazio destacado."}
                  </small>
                )}
              {activeSpecies.speciesId === "maned_wolf" &&
                activeActionId === "B" &&
                canControlActivePlayer && (
                  <div className="wolf-base-panel">
                    <div className="wolf-base-summary">
                      <span>Alvos válidos</span>
                      <strong>{wolfRemovableBasePieceCount}</strong>
                    </div>
                    <small>
                      {wolfRemovableBasePieceCount > 0
                        ? selectedWolfTargetPieceId
                          ? "Peça de base selecionada. Remova ou cancele a ação."
                          : "Clique em uma peça de base que esteja no mesmo local de um lobo."
                        : "Nenhuma peça de base divide local com lobo."}
                    </small>
                    <div className="wolf-base-actions">
                      <button
                        className="wolf-remove-button"
                        disabled={!selectedWolfTargetPieceId}
                        onClick={onRemoveWolfBasePiece}
                      >
                        <X aria-hidden="true" />
                        Remover peça
                      </button>
                      <button className="wolf-skip-button" disabled={tutorialActive} onClick={onCompleteAction}>
                        <Check aria-hidden="true" />
                        Concluir
                      </button>
                    </div>
                  </div>
                )}
              {activeSpecies.speciesId === "maned_wolf" &&
                activeActionId === "C" &&
                canControlActivePlayer && <small>Escolha os recursos na janela central para pontuar.</small>}
              {activeSpecies.speciesId === "maned_wolf" &&
                activeActionId === "D" &&
                canControlActivePlayer && (
                  <>
                    <small>
                      Clique em uma carta com <ResourceIcon resource="meat" /> para adicionar 1 lobo, ou
                      conclua sem adicionar. Locais válidos: {wolfMeatTargetCount}.
                    </small>
                    <button className="secondary-button" disabled={tutorialActive} onClick={onCompleteAction}>
                      Concluir sem adicionar
                    </button>
                  </>
                )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
