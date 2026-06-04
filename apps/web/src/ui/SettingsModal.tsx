import type { CSSProperties } from "react";
import { Play, Settings, Volume2, VolumeX, X } from "lucide-react";
import type { AudioSettings } from "./audio";
import { initAudioOnGesture, playClick } from "./audio";

interface SettingsModalProps {
  audio: AudioSettings;
  onUpdate: (partial: Partial<AudioSettings>) => void;
  onClose: () => void;
}

/**
 * Polished, themed settings dialog. Shared between the main menu and anywhere
 * else that needs the global preferences (currently audio). Closes on the X,
 * the backdrop, or Escape (handled by the caller).
 */
export function SettingsModal({ audio, onUpdate, onClose }: SettingsModalProps) {
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
            <p>Ajuste o som e a experiência</p>
          </div>
        </header>

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
          <span>v0.1 · beta</span>
        </footer>
      </div>
    </div>
  );
}
