import type { CSSProperties } from "react";
import { Bot, Check, ChevronLeft, MapPin, Minus, Play, Plus, X } from "lucide-react";
import { scenarioCards } from "@oikos/content";
import { MAX_PLAYERS } from "@oikos/shared";
import type { MiniExpansionId, ScenarioCardId, SpeciesId } from "@oikos/shared";
import { ScenarioDescription } from "../ui/ScenarioDescription";
import {
  SPECIES_HEX,
  botTurnDelayStepMs,
  categoryLabels,
  speciesList
} from "../ui/gameConstants";
import { miniExpansionOptions } from "./preGameOptions";

interface LocalSetupScreenProps {
  speciesIds: SpeciesId[];
  botSpeciesIds: SpeciesId[];
  botTurnDelayMs: number;
  enabledMiniExpansions: MiniExpansionId[];
  scenarioCount: number;
  selectedScenarioIds: ScenarioCardId[];
  formatBotDelay: (delayMs: number) => string;
  onBack: () => void;
  onToggleSpecies: (speciesId: SpeciesId) => void;
  onToggleBot: (speciesId: SpeciesId) => void;
  onToggleMiniExpansion: (expansionId: MiniExpansionId) => void;
  onToggleScenario: (scenarioId: ScenarioCardId) => void;
  onAdjustBotSpeed: (deltaMs: number) => void;
  onStart: () => void;
}

export function LocalSetupScreen({
  speciesIds,
  botSpeciesIds,
  botTurnDelayMs,
  enabledMiniExpansions,
  scenarioCount,
  selectedScenarioIds,
  formatBotDelay,
  onBack,
  onToggleSpecies,
  onToggleBot,
  onToggleMiniExpansion,
  onToggleScenario,
  onAdjustBotSpeed,
  onStart
}: LocalSetupScreenProps) {
  return (
    <div className="flow-screen flow-screen-local" role="main">
      <div className="landing-bg-orbs" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-3" />
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

      <div className="flow-body flow-body-wide">
        <div className="flow-icon-large flow-icon-amber">
          <MapPin aria-hidden="true" />
        </div>
        <h2 className="flow-title">Teste Local</h2>
        <p className="flow-subtitle">
          Controle de 2 a 6 espécies nesta mesma tela. Ideal para aprender as regras e testar estratégias.
        </p>

        <div className="flow-card flow-card-local">
          <div className="flow-card-header">
            <span>Escolha as espécies</span>
            <span className="flow-counter">
              {speciesIds.length}/{MAX_PLAYERS}
            </span>
          </div>
          <div className="flow-species-grid">
            {speciesList.map((species) => {
              const selected = speciesIds.includes(species.speciesId);
              const isBotSlot = botSpeciesIds.includes(species.speciesId);
              const selectionLimitReached = speciesIds.length >= MAX_PLAYERS && !selected;
              return (
                <div
                  key={species.speciesId}
                  className={`flow-species-card-wrap ${isBotSlot ? "is-bot" : ""}`}
                  data-species={species.speciesId}
                  style={{ "--species-color": SPECIES_HEX[species.speciesId] } as CSSProperties}
                >
                  <button
                    type="button"
                    className={`flow-species-card ${selected ? "selected" : ""}`}
                    onClick={() => onToggleSpecies(species.speciesId)}
                    disabled={selectionLimitReached}
                    title={selectionLimitReached ? `Máximo de ${MAX_PLAYERS} espécies atingido` : undefined}
                  >
                    <div className="flow-species-thumb">
                      <img src={encodeURI(species.meepleAsset)} alt="" />
                    </div>
                    <div className="flow-species-text">
                      <strong>{species.displayName}</strong>
                      <small>{categoryLabels[species.category]}</small>
                    </div>
                    {isBotSlot ? (
                      <span className="flow-species-bot-tag" aria-hidden="true">
                        <Bot /> Bot
                      </span>
                    ) : (
                      selected && (
                        <span className="flow-species-check" aria-hidden="true">
                          <Check />
                        </span>
                      )
                    )}
                  </button>
                  <button
                    type="button"
                    className={`flow-species-bot-btn ${isBotSlot ? "active" : ""}`}
                    title={isBotSlot ? "Controlar manualmente" : "Controlar por bot"}
                    aria-label={isBotSlot ? "Controlar manualmente" : "Controlar por bot"}
                    onClick={() => onToggleBot(species.speciesId)}
                    disabled={selectionLimitReached}
                  >
                    {isBotSlot ? <X aria-hidden="true" /> : <Bot aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="lobby-expansions-block">
            <div className="lobby-expansions-head">
              <strong>Mini-expansoes</strong>
              <span className="lobby-expansions-count">
                {enabledMiniExpansions.filter((id) => miniExpansionOptions.some((option) => option.id === id)).length}/
                {miniExpansionOptions.length}
              </span>
            </div>
            <ul className="lobby-expansion-list">
              {miniExpansionOptions.map((expansion) => {
                const enabled = enabledMiniExpansions.includes(expansion.id);
                return (
                  <li key={expansion.id}>
                    <label className={`lobby-expansion-card ${enabled ? "is-on" : ""}`}>
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
                    <strong>Cenarios</strong>
                    <small>Escolha 1 cenario para o teste local ({selectedScenarioIds.length}/1).</small>
                  </div>
                </div>
                <ul className="lobby-scenario-card-list">
                  {scenarioCards.map((scenario) => {
                    const selected = selectedScenarioIds.includes(scenario.id);
                    const disabled = !selected && selectedScenarioIds.length >= scenarioCount;
                    return (
                      <li key={scenario.id}>
                        <button
                          type="button"
                          className={`lobby-scenario-card ${selected ? "is-selected" : ""}`}
                          disabled={disabled}
                          onClick={() => onToggleScenario(scenario.id)}
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
              </div>
            )}
          </div>

          <div className="flow-bot-speed" aria-label="Velocidade dos bots no teste local">
            <button
              type="button"
              className="icon-button compact"
              title="Bots mais rápidos"
              aria-label="Bots mais rápidos"
              onClick={() => onAdjustBotSpeed(-botTurnDelayStepMs)}
            >
              <Minus aria-hidden="true" />
            </button>
            <span>Bots {formatBotDelay(botTurnDelayMs)}</span>
            <button
              type="button"
              className="icon-button compact"
              title="Bots mais lentos"
              aria-label="Bots mais lentos"
              onClick={() => onAdjustBotSpeed(botTurnDelayStepMs)}
            >
              <Plus aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className="flow-submit"
            onClick={onStart}
            disabled={speciesIds.length < 2 || speciesIds.length > MAX_PLAYERS}
          >
            <Play aria-hidden="true" />
            Iniciar Partida ({speciesIds.length} espécies)
          </button>
          {speciesIds.length < 2 && (
            <small className="flow-hint">Mínimo 2 espécies para iniciar.</small>
          )}
          {speciesIds.length === MAX_PLAYERS && (
            <small className="flow-hint">Limite de {MAX_PLAYERS} espécies atingido.</small>
          )}
        </div>
      </div>
    </div>
  );
}
