import { Eye, LogOut } from "lucide-react";

// Spectator-mode badge with a leave button, shown to non-playing viewers.
export function SpectatorBanner({ onLeave }: { onLeave: () => void }) {
  return (
    <div className="spectator-banner" role="status">
      <Eye aria-hidden="true" />
      <span>Modo espectador</span>
      <button type="button" className="spectator-leave" onClick={onLeave} title="Sair">
        <LogOut aria-hidden="true" />
      </button>
    </div>
  );
}
