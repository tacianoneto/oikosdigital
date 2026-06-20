import type { Resource } from "@oikos/shared";
import { ExtraTurnObjectiveModal, SeedSpendObjectiveModal } from "../ui/EndgameObjectiveDialogs";
import {
  CaatingaChoiceModal,
  CacaIlegalChoiceModal,
  CacaIlegalRemovalBanner,
  CerradoChoiceModal,
  MataAtlanticaDiscardModal
} from "../ui/ScenarioPendingDialogs";

interface PendingInterruptDialogsProps {
  cacaIlegalChoice:
    | { playerName: string; topResources: Resource[]; resources: Partial<Record<Resource, number>>; hasRemovablePieces: boolean }
    | null;
  cacaIlegalRemoval: { selectedCount: number; confirmDisabled: boolean } | null;
  caatinga: { playerName: string; trigger: "add" | "remove"; resource: Resource; currentResourceCount: number } | null;
  cerrado: { playerName: string; resource: Resource } | null;
  extraTurn: { playerName: string; acceptDisabled: boolean } | null;
  seedSpend: { playerName: string; spendCount: number; points: number; acceptDisabled: boolean } | null;
  mataAtlantica: { playerName: string; pileTopIds: string[] } | null;
  onCacaIlegalSpend: (resource: Resource) => void;
  onCacaIlegalEnterRemoval: () => void;
  onCacaIlegalConfirmRemoval: () => void;
  onCacaIlegalBackRemoval: () => void;
  onCaatingaChoice: (mode: "gain" | "lose" | "skip") => void;
  onCerradoChoice: (mode: "collect" | "skip") => void;
  onExtraTurnResolve: (accept: boolean) => void;
  onSeedSpendResolve: (accept: boolean) => void;
  onMataDiscard: (cardId: string) => void;
}

// Groups the turn-pausing interrupt dialogs (Caça ilegal, Caatinga, Cerrado,
// extra-turn / seed-spend objectives, Mata Atlântica forced discard). The
// caller decides visibility by passing a populated object or null per slot.
export function PendingInterruptDialogs({
  cacaIlegalChoice,
  cacaIlegalRemoval,
  caatinga,
  cerrado,
  extraTurn,
  seedSpend,
  mataAtlantica,
  onCacaIlegalSpend,
  onCacaIlegalEnterRemoval,
  onCacaIlegalConfirmRemoval,
  onCacaIlegalBackRemoval,
  onCaatingaChoice,
  onCerradoChoice,
  onExtraTurnResolve,
  onSeedSpendResolve,
  onMataDiscard
}: PendingInterruptDialogsProps) {
  return (
    <>
      {cacaIlegalChoice && (
        <CacaIlegalChoiceModal
          playerName={cacaIlegalChoice.playerName}
          topResources={cacaIlegalChoice.topResources}
          resources={cacaIlegalChoice.resources}
          hasRemovablePieces={cacaIlegalChoice.hasRemovablePieces}
          onSpendResource={onCacaIlegalSpend}
          onEnterRemovalMode={onCacaIlegalEnterRemoval}
        />
      )}
      {cacaIlegalRemoval && (
        <CacaIlegalRemovalBanner
          selectedCount={cacaIlegalRemoval.selectedCount}
          confirmDisabled={cacaIlegalRemoval.confirmDisabled}
          onConfirm={onCacaIlegalConfirmRemoval}
          onBack={onCacaIlegalBackRemoval}
        />
      )}
      {caatinga && (
        <CaatingaChoiceModal
          playerName={caatinga.playerName}
          trigger={caatinga.trigger}
          resource={caatinga.resource}
          currentResourceCount={caatinga.currentResourceCount}
          onChoice={onCaatingaChoice}
        />
      )}
      {cerrado && (
        <CerradoChoiceModal
          playerName={cerrado.playerName}
          resource={cerrado.resource}
          onChoice={onCerradoChoice}
        />
      )}
      {extraTurn && (
        <ExtraTurnObjectiveModal
          playerName={extraTurn.playerName}
          acceptDisabled={extraTurn.acceptDisabled}
          onResolve={onExtraTurnResolve}
        />
      )}
      {seedSpend && (
        <SeedSpendObjectiveModal
          playerName={seedSpend.playerName}
          spendCount={seedSpend.spendCount}
          points={seedSpend.points}
          acceptDisabled={seedSpend.acceptDisabled}
          onResolve={onSeedSpendResolve}
        />
      )}
      {mataAtlantica && (
        <MataAtlanticaDiscardModal
          playerName={mataAtlantica.playerName}
          pileTopIds={mataAtlantica.pileTopIds}
          onDiscard={onMataDiscard}
        />
      )}
    </>
  );
}
