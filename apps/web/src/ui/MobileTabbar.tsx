import { Clock, Leaf, Play, Users } from "lucide-react";

export type MobileTabId = "acao" | "mao" | "jogadores" | "resumo";

interface MobileTabbarProps {
  activeSheet: MobileTabId | null;
  canShowHand: boolean;
  canShowPlayers: boolean;
  canShowSummary: boolean;
  onSelect: (id: MobileTabId) => void;
}

export function MobileTabbar({
  activeSheet,
  canShowHand,
  canShowPlayers,
  canShowSummary,
  onSelect
}: MobileTabbarProps) {
  const tabs = [
    { id: "acao", label: "Ação", icon: Play, available: true },
    { id: "mao", label: "Mão", icon: Leaf, available: canShowHand },
    { id: "jogadores", label: "Jogadores", icon: Users, available: canShowPlayers },
    { id: "resumo", label: "Resumo", icon: Clock, available: canShowSummary }
  ] as const;

  return (
    <nav className="mobile-tabbar" aria-label="Painéis do jogo">
      {tabs.map(({ id, label, icon: Icon, available }) => (
        <button
          key={id}
          type="button"
          className={`mobile-tab ${activeSheet === id ? "is-active" : ""}`}
          aria-pressed={activeSheet === id}
          disabled={!available}
          onClick={() => onSelect(id)}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
