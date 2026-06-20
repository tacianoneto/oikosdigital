import type { Resource } from "@oikos/shared";
import { JaguarScoreModal, WolfScoreModal } from "../ui/ScoreSpendModals";

interface SpeciesScoreModalsProps {
  jaguar: { availablePointSpendCount: number; completeDisabled: boolean } | null;
  wolf:
    | {
        resources: Partial<Record<Resource, number>>;
        selectedResources: Resource[];
        spendableResources: Resource[];
        availablePointSpendCount: number;
        completeDisabled: boolean;
      }
    | null;
  onJaguarSpend: (count: number) => void;
  onWolfToggleResource: (resource: Resource) => void;
  onWolfSpend: () => void;
  onComplete: () => void;
}

// The action-C spend-to-score modals for Jaguar (spend meat) and Wolf (spend
// distinct resources). The caller decides visibility per slot; the two are
// mutually exclusive in practice (different active species).
export function SpeciesScoreModals({
  jaguar,
  wolf,
  onJaguarSpend,
  onWolfToggleResource,
  onWolfSpend,
  onComplete
}: SpeciesScoreModalsProps) {
  return (
    <>
      {jaguar && (
        <JaguarScoreModal
          availablePointSpendCount={jaguar.availablePointSpendCount}
          completeDisabled={jaguar.completeDisabled}
          onSpend={onJaguarSpend}
          onComplete={onComplete}
        />
      )}
      {wolf && (
        <WolfScoreModal
          resources={wolf.resources}
          selectedResources={wolf.selectedResources}
          spendableResources={wolf.spendableResources}
          availablePointSpendCount={wolf.availablePointSpendCount}
          completeDisabled={wolf.completeDisabled}
          onToggleResource={onWolfToggleResource}
          onSpend={onWolfSpend}
          onComplete={onComplete}
        />
      )}
    </>
  );
}
