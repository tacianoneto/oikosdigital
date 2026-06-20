import { ChevronLeft, Eye, LogIn, Lock, RotateCw, Users } from "lucide-react";
import type { RoomSummary } from "@oikos/shared";

interface JoinRoomScreenProps {
  name: string;
  joinCode: string;
  joinPassword: string;
  openRooms: RoomSummary[];
  roomsLoading: boolean;
  onNameChange: (name: string) => void;
  onJoinCodeChange: (code: string) => void;
  onJoinPasswordChange: (password: string) => void;
  onBack: () => void;
  onRefreshRooms: () => void;
  onJoinRoom: (roomId: string) => void;
  onSpectateRoom: (roomId: string) => void;
  onJoinByCode: () => void;
  onSpectateByCode: () => void;
}

// Online room entry flow: pick an open room from the live list or join/spectate
// by a shared code.
export function JoinRoomScreen({
  name,
  joinCode,
  joinPassword,
  openRooms,
  roomsLoading,
  onNameChange,
  onJoinCodeChange,
  onJoinPasswordChange,
  onBack,
  onRefreshRooms,
  onJoinRoom,
  onSpectateRoom,
  onJoinByCode,
  onSpectateByCode
}: JoinRoomScreenProps) {
  return (
    <div className="flow-screen flow-screen-join" role="main">
      <div className="landing-bg-orbs" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
      </div>

      <header className="flow-header">
        <button type="button" className="flow-back" onClick={onBack} aria-label="Voltar">
          <ChevronLeft aria-hidden="true" />
          <span>Voltar</span>
        </button>
        <div className="landing-logo flow-logo">
          <img className="brand-logo-img brand-logo-img-sm" src="/oikos-logo.webp" alt="Oikos" />
        </div>
        <span className="flow-spacer" aria-hidden="true" />
      </header>

      <div className="flow-body">
        <div className="flow-icon-large">
          <LogIn aria-hidden="true" />
        </div>
        <h2 className="flow-title">Entrar em Sala</h2>
        <p className="flow-subtitle">
          Escolha uma sala aberta na lista ou digite o código compartilhado pelo anfitrião.
        </p>

        <div className="flow-card flow-rooms-card">
          <div className="flow-rooms-header">
            <span className="flow-code-label">Salas abertas</span>
            <button
              type="button"
              className="icon-button compact"
              title="Atualizar lista"
              aria-label="Atualizar lista"
              onClick={onRefreshRooms}
            >
              <RotateCw aria-hidden="true" />
            </button>
          </div>

          {openRooms.length === 0 ? (
            <p className="flow-rooms-empty">
              {roomsLoading ? "Procurando salas…" : "Nenhuma sala aberta no momento. Crie uma ou use um código."}
            </p>
          ) : (
            <ul className="flow-rooms-list">
              {openRooms.map((summary) => {
                const full = summary.playerCount >= summary.maxPlayers;
                const joinable = summary.status === "lobby" && !full;
                return (
                  <li key={summary.roomId}>
                    <button
                      type="button"
                      className="flow-room-row"
                      onClick={() => {
                        if (joinable) {
                          onJoinRoom(summary.roomId);
                        } else {
                          onSpectateRoom(summary.roomId);
                        }
                      }}
                    >
                      <span className="flow-room-main">
                        <strong>{summary.roomId}</strong>
                        <small>{summary.hostName}</small>
                      </span>
                      <span className="flow-room-meta">
                        <span className="flow-room-players">
                          <Users aria-hidden="true" />
                          {summary.playerCount}/{summary.maxPlayers}
                        </span>
                        {summary.spectatorCount > 0 && (
                          <span className="flow-room-spectators">
                            <Eye aria-hidden="true" />
                            {summary.spectatorCount}
                          </span>
                        )}
                        <span className={`flow-room-status ${summary.status}`}>
                          {summary.status === "lobby"
                            ? full
                              ? "Cheia · assistir"
                              : "Aguardando"
                            : "Em jogo · assistir"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form
          className="flow-card flow-card-join"
          onSubmit={(event) => {
            event.preventDefault();
            if (joinCode.length >= 4) {
              onJoinByCode();
            }
          }}
        >
          <label className="landing-name-field flow-name">
            <Users aria-hidden="true" />
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={24}
              placeholder="Seu nome"
            />
          </label>

          <div className="flow-code-field">
            <span className="flow-code-label">Código da sala</span>
            <input
              className="landing-code-input flow-code-input"
              value={joinCode}
              onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
              placeholder="ABCDE"
              maxLength={5}
            />
          </div>

          <label className="landing-name-field flow-name">
            <Lock aria-hidden="true" />
            <input
              type="password"
              value={joinPassword}
              onChange={(event) => onJoinPasswordChange(event.target.value)}
              maxLength={32}
              placeholder="Senha (se a sala for privada)"
              autoComplete="off"
            />
          </label>

          <button type="submit" className="flow-submit" disabled={joinCode.length < 4}>
            <LogIn aria-hidden="true" />
            Entrar para Jogar
          </button>

          <button
            type="button"
            className="flow-submit flow-submit-ghost"
            disabled={joinCode.length < 4}
            onClick={() => {
              if (joinCode.length >= 4) {
                onSpectateByCode();
              }
            }}
          >
            <Eye aria-hidden="true" />
            Entrar como Espectador
          </button>
          <small className="flow-spectate-hint">
            Espectador assiste à partida sem ocupar uma vaga de jogador.
          </small>
        </form>
      </div>
    </div>
  );
}
