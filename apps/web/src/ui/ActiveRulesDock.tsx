import { AlertTriangle, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import type { ScenarioCardDefinition, ThreatCardDefinition } from "@oikos/shared";
import { ResourceText } from "./ResourceText";
import { ScenarioDescription } from "./ScenarioDescription";

export function ActiveRulesDock({
  scenarios,
  threat,
  open,
  onToggle
}: {
  scenarios: ScenarioCardDefinition[];
  threat: ThreatCardDefinition | null;
  open: boolean;
  onToggle: () => void;
}) {
  const ruleCount = scenarios.length + (threat ? 1 : 0);
  if (ruleCount === 0) return null;

  return (
    <aside className={`scenario-dock ${open ? "is-open" : ""}`} aria-label="Regras ativas">
      <button
        type="button"
        className="scenario-dock-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <MapPin aria-hidden="true" />
        <span>Regras</span>
        <strong>{ruleCount}</strong>
        {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </button>
      {open && (
        <div className="scenario-dock-panel">
          <div className="scenario-dock-head">
            <span>Regras da partida</span>
            <small>Ameaca por rodada; cenarios ate o fim</small>
          </div>
          <div className="scenario-dock-list">
            {threat && (
              <article className="scenario-dock-card scenario-dock-threat-card">
                {threat.imagePath ? (
                  <img src={encodeURI(threat.imagePath)} alt="" />
                ) : (
                  <div className="scenario-dock-threat-icon">
                    <AlertTriangle aria-hidden="true" />
                  </div>
                )}
                <div>
                  <div className="threat-dock-badge">
                    <AlertTriangle aria-hidden="true" />
                    <span>Ameaca da rodada</span>
                  </div>
                  <strong>{threat.label}</strong>
                  <p><ResourceText text={threat.description} /></p>
                </div>
              </article>
            )}
            {scenarios.map((scenario) => (
              <article className="scenario-dock-card" key={scenario.id}>
                <img src={encodeURI(scenario.imagePath)} alt="" />
                <div>
                  <strong>{scenario.label}</strong>
                  <p><ScenarioDescription text={scenario.description} /></p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
