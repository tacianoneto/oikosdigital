import {
  ChevronRight,
  GraduationCap,
  LogIn,
  MapPin,
  Play,
  Settings,
  Users
} from "lucide-react";
import { GAME_VERSION } from "../version";

export type LandingMode = "idle" | "create" | "join" | "local" | "tutorials";

interface MainMenuScreenProps {
  name: string;
  onNameChange: (name: string) => void;
  onNavigate: (mode: Exclude<LandingMode, "idle">) => void;
  onOpenSettings: () => void;
}

const menuActions = [
  { mode: "create" as const, icon: Play, title: "Criar Sala", sub: "Hospede uma partida online", primary: true },
  { mode: "join" as const, icon: LogIn, title: "Entrar em Sala", sub: "Sala aberta ou código", primary: false },
  { mode: "local" as const, icon: MapPin, title: "Teste Local", sub: "Controle 2-6 espécies nesta tela", primary: false },
  { mode: "tutorials" as const, icon: GraduationCap, title: "Tutoriais", sub: "Aprenda a jogar passo a passo", primary: false }
];

export function MainMenuScreen({
  name,
  onNameChange,
  onNavigate,
  onOpenSettings
}: MainMenuScreenProps) {
  return (
    <div className="forest-menu" role="main">
      <div className="forest-menu-bg" aria-hidden="true">
        <span className="fm-glow fm-glow-green" />
        <span className="fm-glow fm-glow-amber" />
        <span className="fm-firefly fm-firefly-1" />
        <span className="fm-firefly fm-firefly-2" />
        <span className="fm-firefly fm-firefly-3" />
        <span className="fm-firefly fm-firefly-4" />
        <span className="fm-vignette" />
      </div>

      <div className="forest-menu-content">
        <div className="menu-brand">
          <img src="/oikos-logo.webp" alt="Oikos Digital" />
          <p className="menu-brand-tagline">
            Jogo de tabuleiro multiplayer
            <span className="menu-brand-badge">{GAME_VERSION}</span>
          </p>
        </div>

        <div className="forest-panel">
          <label className="forest-name-field">
            <Users aria-hidden="true" />
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={24}
              placeholder="Seu nome"
              aria-label="Seu nome"
            />
          </label>

          <div className="forest-actions">
            {menuActions.map(({ mode, icon: Icon, title, sub, primary }) => (
              <button
                key={mode}
                type="button"
                className={`forest-btn ${primary ? "is-primary" : ""}`}
                onClick={() => onNavigate(mode)}
              >
                <span className="forest-btn-glow" aria-hidden="true" />
                <span className="forest-btn-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="forest-btn-text">
                  <strong>{title}</strong>
                  <small>{sub}</small>
                </span>
                <ChevronRight className="forest-btn-chevron" aria-hidden="true" />
              </button>
            ))}

            <button type="button" className="forest-btn" onClick={onOpenSettings}>
              <span className="forest-btn-glow" aria-hidden="true" />
              <span className="forest-btn-icon">
                <Settings aria-hidden="true" />
              </span>
              <span className="forest-btn-text">
                <strong>Configurações</strong>
                <small>Som e preferências</small>
              </span>
              <ChevronRight className="forest-btn-chevron" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <footer className="forest-footer">
        <span>Oikos Digital</span>
        <span className="forest-footer-sep">·</span>
        <span>Servidor autoritativo · Socket.IO</span>
      </footer>
    </div>
  );
}
