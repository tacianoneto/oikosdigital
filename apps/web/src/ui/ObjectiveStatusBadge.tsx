import { Check, X } from "lucide-react";

export function ObjectiveStatusBadge({
  completed,
  discarded
}: {
  completed: boolean;
  discarded: boolean;
}) {
  if (discarded) {
    return (
      <span className="expansion-done-badge is-discarded" title="Objetivo descartado" aria-label="Objetivo descartado">
        <X aria-hidden="true" />
      </span>
    );
  }

  if (!completed) {
    return null;
  }

  return (
    <span className="expansion-done-badge" title="Objetivo cumprido" aria-label="Objetivo cumprido">
      <Check aria-hidden="true" />
    </span>
  );
}
