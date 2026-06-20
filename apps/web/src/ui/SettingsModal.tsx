import type { CSSProperties } from "react";
import { AlertTriangle, Copy, Eye, LogOut, Minus, Play, Plus, Settings, Users, Volume2, VolumeX, X } from "lucide-react";
import type { AudioSettings } from "./audio";
import { initAudioOnGesture, playClick } from "./audio";
import { ScenarioDescription } from "./ScenarioDescription";
import { ResourceText } from "./ResourceText";

interface TableScenarioInfo {
  id: string;
  label: string;
  description: string;
  imagePath: string;
}

interface TableThreatInfo {
  label: string;
  description: string;
  imagePath?: string;
}

interface TableContext {
  roomLabel: string;
  roomId: string;
  onCopy?: () => void;
  botSpeed?: { label: string; onFaster: () => void; onSlower: () => void } | null;
  scenarios: TableScenarioInfo[];
  threat: TableThreatInfo | null;
  onExit: () => void;
}

interface SettingsModalProps {
  audio: AudioSettings;
  onUpdate: (partial: Partial<AudioSettings>) => void;
  visualAccessibility: boolean;
  onVisualAccessibilityChange: (enabled: boolean) => void;
  onClose: () => void;
  // When opened during a game, the table controls (room code, bot speed,
  // scenarios/threat, leave) are shown above the audio settings.
  table?: TableContext;
}

/**
 * Polished, themed settings dialog. Shared between the main menu and the
 * in-game config button. Without `table` it shows only the global preferences
 * (audio); with `table` it also renders the current table's controls so the
 * in-game panel looks and behaves the same as the menu's. Closes on the X or
 * the backdrop.
 */
export function SettingsModal({
  audio,
  onUpdate,
  visualAccessibility,
  onVisualAccessibilityChange,
  onClose,
  table
}: SettingsModalProps) {
  const volumePct = Math.round(audio.sfxVolume * 100);

  return (
    <div className="settings-backdrop" role="presentation" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Configurações"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="settings-close" aria-label="Fechar" onClick={onClose}>
          <X aria-hidden="true" />
        </button>

        <header className="settings-head">
          <span className="settings-head-icon">
            <Settings aria-hidden="true" />
          </span>
          <div>
            <h2>Configurações</h2>
            <p>{table ? "Mesa, som e preferências" : "Ajuste o som e a experiência"}</p>
          </div>
        </header>

        {table && (
          <section className="settings-group">
            <div className="settings-group-title">
              <Users aria-hidden="true" />
              <span>Mesa</span>
            </div>

            <div className="settings-row">
              <div className="settings-row-text">
                <strong>{table.roomLabel}</strong>
                <small>{table.roomId}</small>
              </div>
              {table.onCopy && (
                <button type="button" className="settings-icon-btn" title="Copiar código da sala" onClick={table.onCopy}>
                  <Copy aria-hidden="true" />
                </button>
              )}
            </div>

            {table.botSpeed && (
              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Velocidade dos bots</strong>
                  <small>{table.botSpeed.label}</small>
                </div>
                <div className="settings-stepper">
                  <button type="button" className="settings-icon-btn" title="Bots mais rápidos" onClick={table.botSpeed.onFaster}>
                    <Minus aria-hidden="true" />
                  </button>
                  <button type="button" className="settings-icon-btn" title="Bots mais lentos" onClick={table.botSpeed.onSlower}>
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {table.scenarios.length > 0 && (
              <div className="settings-cards">
                <span className="settings-cards-label">Cenários ativos</span>
                {table.scenarios.map((scenario) => (
                  <article key={scenario.id} className="settings-card">
                    <img src={encodeURI(scenario.imagePath)} alt="" />
                    <div>
                      <strong>{scenario.label}</strong>
                      <p><ScenarioDescription text={scenario.description} /></p>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {table.threat && (
              <div className="settings-cards">
                <span className="settings-cards-label">Ameaça ativa</span>
                <article className="settings-card">
                  {table.threat.imagePath ? (
                    <img src={encodeURI(table.threat.imagePath)} alt="" />
                  ) : (
                    <span className="settings-card-icon" aria-hidden="true">
                      <AlertTriangle />
                    </span>
                  )}
                  <div>
                    <strong>{table.threat.label}</strong>
                    <p><ResourceText text={table.threat.description} /></p>
                  </div>
                </article>
              </div>
            )}

            <button type="button" className="settings-exit" onClick={table.onExit}>
              <LogOut aria-hidden="true" />
              Sair da mesa
            </button>
          </section>
        )}

        <section className="settings-group">
          <div className="settings-group-title">
            <Eye aria-hidden="true" />
            <span>Acessibilidade</span>
          </div>

          <div className="settings-row">
            <div className="settings-row-text">
              <strong>Alto contraste e padroes</strong>
              <small>Marcas extras para especies e recursos</small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={visualAccessibility}
              aria-label="Ativar modo de alto contraste e padroes visuais"
              className={`settings-switch ${visualAccessibility ? "is-on" : ""}`}
              onClick={() => onVisualAccessibilityChange(!visualAccessibility)}
            >
              <span className="settings-switch-knob" aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="settings-group">
          <div className="settings-group-title">
            {audio.muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
            <span>Áudio</span>
          </div>

          <div className="settings-row">
            <div className="settings-row-text">
              <strong>Som</strong>
              <small>Efeitos sonoros do jogo</small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!audio.muted}
              aria-label="Ligar ou desligar o som"
              className={`settings-switch ${audio.muted ? "" : "is-on"}`}
              onClick={() => onUpdate({ muted: !audio.muted })}
            >
              <span className="settings-switch-knob" aria-hidden="true" />
            </button>
          </div>

          <div className={`settings-row settings-row-stack ${audio.muted ? "is-disabled" : ""}`}>
            <div className="settings-row-text">
              <strong>Volume dos efeitos</strong>
              <small>{volumePct}%</small>
            </div>
            <div className="settings-volume">
              <VolumeX aria-hidden="true" />
              <input
                type="range"
                min={0}
                max={100}
                value={volumePct}
                disabled={audio.muted}
                aria-label="Volume dos efeitos"
                style={{ ["--pct" as string]: `${volumePct}%` } as CSSProperties}
                onChange={(event) => onUpdate({ sfxVolume: Number(event.target.value) / 100 })}
              />
              <Volume2 aria-hidden="true" />
            </div>
          </div>

          <button
            type="button"
            className="settings-test"
            disabled={audio.muted}
            onClick={() => {
              initAudioOnGesture();
              playClick();
            }}
          >
            <Play aria-hidden="true" />
            Testar som
          </button>
        </section>

        <footer className="settings-foot">
          <span>Oikos Digital</span>
          <span className="settings-foot-sep">·</span>
          <span>v0.1.7 · beta</span>
        </footer>
      </div>
    </div>
  );
}
