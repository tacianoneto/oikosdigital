import type { CSSProperties } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  Leaf,
  LogOut,
  Minus,
  Play,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { scenarioCards, speciesDefinitions } from "@oikos/content";
import { MAX_PLAYERS, formatTurnTimer } from "@oikos/shared";
import type {
  MiniExpansionId,
  PublicRoomState,
  RoomPlayer,
  ScenarioCardId,
  SpeciesId
} from "@oikos/shared";
import { ScenarioDescription } from "../ui/ScenarioDescription";
import {
  SPECIES_HEX,
  botTurnDelayStepMs,
  categoryLabels,
  speciesList
} from "../ui/gameConstants";
import { miniExpansionOptions } from "./preGameOptions";

interface LobbyScreenProps {
  room: PublicRoomState;
  playerId: string | null;
  controlledPlayerId: string | null;
  currentPlayer: RoomPlayer | null;
  selectedSpecies: SpeciesId | "";
  isLocalRoom: boolean;
  isSpectator: boolean;
  isHost: boolean;
  readyPlayerCount: number;
  enabledMiniExpansions: MiniExpansionId[];
  scenarioSelectionMode: "vote" | "host";
  scenarioCount: number;
  hostSelectedScenarioIds: ScenarioCardId[];
  turnTimerMs: number | null;
  botTurnDelayMs: number;
  roomHasBots: boolean;
  needsHostScenarioSelection: boolean;
  formatBotDelay: (delayMs: number) => string;
  onExit: () => void;
  onCopyCode: () => void;
  onRenameSelf: () => void;
  onKickPlayer: (playerId: string, playerName: string) => void;
  onToggleMiniExpansion: (expansionId: MiniExpansionId) => void;
  onSetScenarioMode: (mode: "vote" | "host") => void;
  onToggleHostScenario: (scenarioId: ScenarioCardId) => void;
  onToggleTurnTimer: () => void;
  onAdjustTurnTimer: (direction: number) => void;
  onRemoveBots: () => void;
  onAdjustBotSpeed: (deltaMs: number) => void;
  onSelectSpecies: (speciesId: SpeciesId) => void;
  onToggleBotSpecies: (speciesId: SpeciesId, remove: boolean) => void;
  onReady: (ready: boolean) => void;
  onStart: () => void;
}

const getOpenPortraitAsset = (portraitAsset: string) =>
  portraitAsset.replace("/assets/portraits/", "/assets/portraits-open/");

export function LobbyScreen({
  room,
  playerId,
  controlledPlayerId,
  currentPlayer,
  selectedSpecies,
  isLocalRoom,
  isSpectator,
  isHost,
  readyPlayerCount,
  enabledMiniExpansions,
  scenarioSelectionMode,
  scenarioCount,
  hostSelectedScenarioIds,
  turnTimerMs,
  botTurnDelayMs,
  roomHasBots,
  needsHostScenarioSelection,
  formatBotDelay,
  onExit,
  onCopyCode,
  onRenameSelf,
  onKickPlayer,
  onToggleMiniExpansion,
  onSetScenarioMode,
  onToggleHostScenario,
  onToggleTurnTimer,
  onAdjustTurnTimer,
  onRemoveBots,
  onAdjustBotSpeed,
  onSelectSpecies,
  onToggleBotSpecies,
  onReady,
  onStart
}: LobbyScreenProps) {
  return (
    <div className="flow-screen flow-screen-lobby" role="main">
      <header className="flow-header">
        <button type="button" className="flow-back" onClick={onExit} aria-label="Sair da sala">
          <LogOut aria-hidden="true" />
          <span>Sair</span>
        </button>
        <div className="landing-logo flow-logo">
          <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.webp" alt="Oikos" />
        </div>
        <span className="flow-spacer" aria-hidden="true" />
      </header>

      <div className="flow-body flow-body-lobby">
        <div className="lobby-hero">
          <div className="lobby-hero-copy">
            <span className="lobby-badge">
              {isLocalRoom ? "Teste Local" : isSpectator ? "Espectador" : "Sala Online"}
            </span>
            <h2 className="flow-title lobby-title">
              {isLocalRoom ? "Mesa Local" : isSpectator ? "Assistindo" : "Sala de Espera"}
            </h2>
            <div className="lobby-status-strip" aria-label="Status da sala">
              <span>
                <Users aria-hidden="true" />
                {room.players.length}/{MAX_PLAYERS} jogadores
              </span>
              <span>
                <Check aria-hidden="true" />
                {readyPlayerCount}/{room.players.length} prontos
              </span>
              <span>
                <Leaf aria-hidden="true" />
                {enabledMiniExpansions.includes("objectives") ? "Objetivos ligados" : "Objetivos desligados"}
              </span>
            </div>
          </div>
          {!isLocalRoom && (
            <div className="lobby-code-card">
              <span className="lobby-code-label">Código da Sala</span>
              <div className="lobby-code-display">
                <span className="lobby-code-value">{room.roomId}</span>
                <button type="button" className="lobby-code-copy" title="Copiar código" onClick={onCopyCode}>
                  <Copy aria-hidden="true" />
                </button>
              </div>
              <small>Compartilhe com seus amigos para entrarem.</small>
            </div>
          )}
        </div>

        <div className="lobby-columns">
          <div className="lobby-side-stack">
            <section className="lobby-card lobby-players">
              <header className="lobby-card-header">
                <Users aria-hidden="true" />
                <h3>Jogadores</h3>
                <span className="lobby-count">{room.players.length}</span>
                {Boolean(room.spectatorCount) && (
                  <span className="lobby-spectator-count" title="Espectadores assistindo">
                    <Eye aria-hidden="true" />
                    {room.spectatorCount}
                  </span>
                )}
              </header>
              <ul className="lobby-player-list">
                {room.players.map((player) => {
                  const species = player.speciesId ? speciesDefinitions[player.speciesId] : null;
                  const isYou = player.playerId === playerId;
                  const isThisHost = player.playerId === room.hostPlayerId;
                  return (
                    <li
                      key={player.playerId}
                      className={`lobby-player ${player.ready ? "ready" : ""} ${isYou ? "you" : ""}`}
                      style={
                        species
                          ? ({ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties)
                          : undefined
                      }
                    >
                      <div className="lobby-player-avatar">
                        {species ? (
                          <img className="is-portrait" src={encodeURI(species.portraitAsset)} alt="" />
                        ) : (
                          <Users aria-hidden="true" />
                        )}
                      </div>
                      <div className="lobby-player-text">
                        <strong>
                          {player.name || "Jogador"}
                          {isYou && <span className="lobby-tag lobby-tag-you">Você</span>}
                          {isThisHost && !isLocalRoom && <span className="lobby-tag lobby-tag-host">Host</span>}
                          {player.isBot && <span className="lobby-tag lobby-tag-bot">Bot</span>}
                        </strong>
                        <small>
                          {species ? species.displayName : "Sem espécie"}
                          {player.ready && " · Pronto"}
                        </small>
                      </div>
                      {player.ready && (
                        <span className="lobby-player-check" aria-hidden="true">
                          <Check />
                        </span>
                      )}
                      {!isLocalRoom && isYou && !player.isBot && (
                        <button
                          type="button"
                          className="lobby-player-action"
                          onClick={onRenameSelf}
                          title="Renomear"
                          aria-label="Renomear"
                        >
                          ✎
                        </button>
                      )}
                      {!isLocalRoom && isHost && !isYou && !player.isBot && (
                        <button
                          type="button"
                          className="lobby-player-action is-danger"
                          onClick={() => onKickPlayer(player.playerId, player.name)}
                          title="Remover jogador"
                          aria-label="Remover jogador"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {!isLocalRoom && (
              <section className="lobby-card lobby-settings">
                <header className="lobby-card-header">
                  <Settings aria-hidden="true" />
                  <h3>Configuração da Mesa</h3>
                  {isHost ? <span className="lobby-count">Host</span> : <span className="lobby-count">Leitura</span>}
                </header>

                <details className="lobby-settings-details">
                  <summary>
                    <span>
                      <strong>Regras da partida</strong>
                      <small>
                        {enabledMiniExpansions.length} mini-expansão
                        {enabledMiniExpansions.length === 1 ? "" : "es"} ativa
                        {enabledMiniExpansions.length === 1 ? "" : "s"} ·{" "}
                        {turnTimerMs ? formatTurnTimer(turnTimerMs) : "sem cronômetro"}
                      </small>
                    </span>
                    <ChevronDown aria-hidden="true" />
                  </summary>

                  <div className="lobby-setting-list">
                    <div className="lobby-expansions-block">
                      <div className="lobby-expansions-head">
                        <strong>Mini-expansões</strong>
                        <span className="lobby-expansions-count">
                          {enabledMiniExpansions.filter((id) => miniExpansionOptions.some((option) => option.id === id)).length}/
                          {miniExpansionOptions.length}
                        </span>
                      </div>
                      <ul className="lobby-expansion-list">
                        {miniExpansionOptions.map((expansion) => {
                          const enabled = enabledMiniExpansions.includes(expansion.id);
                          const locked = !isHost || room.status !== "lobby";
                          return (
                            <li key={expansion.id}>
                              <label
                                className={`lobby-expansion-card ${enabled ? "is-on" : ""} ${locked ? "is-locked" : ""}`}
                              >
                                <span className="lobby-expansion-thumb" aria-hidden="true">
                                  <img src={encodeURI(expansion.iconPath)} alt="" />
                                </span>
                                <span className="lobby-expansion-text">
                                  <strong>{expansion.label}</strong>
                                  <small>{expansion.description}</small>
                                </span>
                                <span className="lobby-switch" aria-hidden="true">
                                  <span className="lobby-switch-knob" />
                                </span>
                                <input
                                  type="checkbox"
                                  className="lobby-expansion-input"
                                  checked={enabled}
                                  disabled={locked}
                                  onChange={() => onToggleMiniExpansion(expansion.id)}
                                  aria-label={`${enabled ? "Desligar" : "Ligar"} ${expansion.label}. ${expansion.description}`}
                                />
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                      {enabledMiniExpansions.includes("scenarios") && (
                        <div className="lobby-scenario-picker">
                          <div className="lobby-scenario-picker-head">
                            <div>
                              <strong>Cenários</strong>
                              <small>
                                {scenarioSelectionMode === "vote"
                                  ? "Jogadores votam em 1 carta antes do setup."
                                  : `Definido pelo host (${hostSelectedScenarioIds.length}/1).`}
                              </small>
                            </div>
                            <div className="lobby-segmented" role="group" aria-label="Modo de escolha dos cenários">
                              <button
                                type="button"
                                className={scenarioSelectionMode === "vote" ? "is-active" : ""}
                                disabled={!isHost || room.status !== "lobby"}
                                onClick={() => onSetScenarioMode("vote")}
                              >
                                Votação
                              </button>
                              <button
                                type="button"
                                className={scenarioSelectionMode === "host" ? "is-active" : ""}
                                disabled={!isHost || room.status !== "lobby"}
                                onClick={() => onSetScenarioMode("host")}
                              >
                                Definido
                              </button>
                            </div>
                          </div>

                          {scenarioSelectionMode === "host" && (
                            <ul className="lobby-scenario-card-list">
                              {scenarioCards.map((scenario) => {
                                const selected = hostSelectedScenarioIds.includes(scenario.id);
                                const disabled =
                                  !isHost ||
                                  room.status !== "lobby" ||
                                  (!selected && hostSelectedScenarioIds.length >= scenarioCount);
                                return (
                                  <li key={scenario.id}>
                                    <button
                                      type="button"
                                      className={`lobby-scenario-card ${selected ? "is-selected" : ""}`}
                                      disabled={disabled}
                                      onClick={() => onToggleHostScenario(scenario.id)}
                                      aria-pressed={selected}
                                    >
                                      <img src={encodeURI(scenario.imagePath)} alt="" />
                                      <span>
                                        <strong>{scenario.label}</strong>
                                        <small><ScenarioDescription text={scenario.description} /></small>
                                      </span>
                                      {selected && <Check aria-hidden="true" />}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="lobby-setting-row">
                      <div className="lobby-setting-copy">
                        <strong>Cronômetro</strong>
                        <small>{turnTimerMs ? `${formatTurnTimer(turnTimerMs)} por turno` : "Sem limite por turno."}</small>
                      </div>
                      <div className="lobby-setting-actions">
                        <button
                          type="button"
                          className={`lobby-mini-button ${turnTimerMs ? "is-on" : ""}`}
                          disabled={!isHost}
                          onClick={onToggleTurnTimer}
                        >
                          <Clock aria-hidden="true" />
                          {turnTimerMs ? "Ligado" : "Desligado"}
                        </button>
                        {turnTimerMs && (
                          <div className="lobby-stepper">
                            <button
                              type="button"
                              className="icon-button compact"
                              title="Menos tempo por turno"
                              disabled={!isHost}
                              onClick={() => onAdjustTurnTimer(-1)}
                            >
                              <Minus aria-hidden="true" />
                            </button>
                            <span>{formatTurnTimer(turnTimerMs)}</span>
                            <button
                              type="button"
                              className="icon-button compact"
                              title="Mais tempo por turno"
                              disabled={!isHost}
                              onClick={() => onAdjustTurnTimer(1)}
                            >
                              <Plus aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lobby-setting-row">
                      <div className="lobby-setting-copy">
                        <strong>Bots</strong>
                        <small>Velocidade: {formatBotDelay(botTurnDelayMs)}</small>
                      </div>
                      <div className="lobby-setting-actions">
                        {isHost && roomHasBots && (
                          <button type="button" className="lobby-mini-button" onClick={onRemoveBots}>
                            <X aria-hidden="true" />
                            Remover bots
                          </button>
                        )}
                        <div className="lobby-stepper">
                          <button
                            type="button"
                            className="icon-button compact"
                            title="Bots mais rápidos"
                            disabled={!isHost}
                            onClick={() => onAdjustBotSpeed(-botTurnDelayStepMs)}
                          >
                            <Minus aria-hidden="true" />
                          </button>
                          <span>{formatBotDelay(botTurnDelayMs)}</span>
                          <button
                            type="button"
                            className="icon-button compact"
                            title="Bots mais lentos"
                            disabled={!isHost}
                            onClick={() => onAdjustBotSpeed(botTurnDelayStepMs)}
                          >
                            <Plus aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              </section>
            )}
          </div>

          {isSpectator ? (
            <section className="lobby-card lobby-species">
              <header className="lobby-card-header">
                <Eye aria-hidden="true" />
                <h3>Modo Espectador</h3>
              </header>
              <div className="lobby-spectator-note">
                <Eye aria-hidden="true" />
                <p>
                  Você está assistindo a esta sala. Quando o anfitrião iniciar, a partida
                  aparecerá aqui automaticamente.
                </p>
              </div>
            </section>
          ) : (
            <section className="lobby-card lobby-species">
              <header className="lobby-card-header">
                <ShieldCheck aria-hidden="true" />
                <h3>Escolha sua Espécie</h3>
              </header>
              <div className="lobby-species-grid">
                {speciesList.map((species) => {
                  const takenBy = room.players.find((player) => player.speciesId === species.speciesId);
                  const selected =
                    currentPlayer?.speciesId === species.speciesId || selectedSpecies === species.speciesId;
                  const takenByOther = Boolean(takenBy && takenBy.playerId !== controlledPlayerId);
                  const isBotSlot = Boolean(takenBy?.isBot);
                  const isHumanSlot = Boolean(takenBy && !takenBy.isBot);
                  const disabled = takenByOther || room.status !== "lobby";
                  const canToggleBot = isHost && !isLocalRoom && room.status === "lobby" && !isHumanSlot;
                  return (
                    <div
                      key={species.speciesId}
                      className={`lobby-species-card-wrap ${isBotSlot ? "is-bot" : ""}`}
                      data-species={species.speciesId}
                      style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
                    >
                      <button
                        type="button"
                        className={`lobby-species-card ${selected ? "selected" : ""}`}
                        disabled={disabled}
                        onClick={() => onSelectSpecies(species.speciesId)}
                      >
                        <img
                          className="lobby-species-portrait"
                          src={encodeURI(getOpenPortraitAsset(species.portraitAsset))}
                          alt=""
                        />
                        <div className="lobby-species-text">
                          <strong>{species.displayName}</strong>
                          <small>{categoryLabels[species.category]}</small>
                        </div>
                        {isBotSlot && (
                          <span className="lobby-species-taken lobby-species-bot-tag">
                            <Bot aria-hidden="true" />
                            Bot
                          </span>
                        )}
                        {isHumanSlot && takenBy?.playerId !== controlledPlayerId && (
                          <span className="lobby-species-taken">{takenBy?.name || "Em uso"}</span>
                        )}
                      </button>
                      {canToggleBot && (
                        <button
                          type="button"
                          className={`lobby-species-bot-btn ${isBotSlot ? "active" : ""}`}
                          title={isBotSlot ? "Remover bot" : "Adicionar bot"}
                          aria-label={isBotSlot ? "Remover bot" : "Adicionar bot"}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleBotSpecies(species.speciesId, isBotSlot);
                          }}
                        >
                          {isBotSlot ? <X aria-hidden="true" /> : <Bot aria-hidden="true" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="lobby-footer-actions">
          {!isLocalRoom && !isSpectator && (
            <button
              type="button"
              className={`lobby-ready-btn ${currentPlayer?.ready ? "is-ready" : ""}`}
              onClick={() => onReady(!currentPlayer?.ready)}
              disabled={!currentPlayer?.speciesId}
            >
              <Check aria-hidden="true" />
              {currentPlayer?.ready ? "Pronto!" : "Marcar Pronto"}
            </button>
          )}
          {isHost && !isLocalRoom && (
            <button
              type="button"
              className="flow-submit lobby-start-btn"
              onClick={onStart}
              disabled={needsHostScenarioSelection}
              title={needsHostScenarioSelection ? `Escolha ${scenarioCount} cenario(s) antes de iniciar.` : undefined}
            >
              <Play aria-hidden="true" />
              Iniciar Partida
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
