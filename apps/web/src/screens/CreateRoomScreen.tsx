import { ChevronLeft, Lock, Play, Users } from "lucide-react";

interface CreateRoomScreenProps {
  name: string;
  createPassword: string;
  onNameChange: (name: string) => void;
  onPasswordChange: (password: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

// Online room creation flow. Hosts a public room when the password is left
// blank, private otherwise.
export function CreateRoomScreen({
  name,
  createPassword,
  onNameChange,
  onPasswordChange,
  onBack,
  onSubmit
}: CreateRoomScreenProps) {
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
          <Play aria-hidden="true" />
        </div>
        <h2 className="flow-title">Criar Sala</h2>
        <p className="flow-subtitle">
          Hospede uma partida online. Deixe a senha em branco para uma sala pública.
        </p>

        <form
          className="flow-card flow-card-join"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
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

          <label className="landing-name-field flow-name">
            <Lock aria-hidden="true" />
            <input
              type="password"
              value={createPassword}
              onChange={(event) => onPasswordChange(event.target.value)}
              maxLength={32}
              placeholder="Senha (opcional)"
              autoComplete="new-password"
            />
          </label>

          <button type="submit" className="flow-submit">
            <Play aria-hidden="true" />
            Criar Sala
          </button>
          <small className="flow-spectate-hint">
            {createPassword
              ? "Sala privada: só entra quem tiver o código e a senha."
              : "Sala pública: aparece na lista de salas abertas."}
          </small>
        </form>
      </div>
    </div>
  );
}
