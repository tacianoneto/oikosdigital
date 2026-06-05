import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Check, ChevronDown, Crown, Fingerprint, Leaf, UserCircle, X } from "lucide-react";
import { speciesDefinitions } from "@oikos/content";
import type { SpeciesId } from "@oikos/shared";
import { supabase } from "./supabase";

interface ProfilePanelProps {
  user: User;
}

type EntitlementRow = Record<string, unknown>;

interface ProfileInventory {
  entitlements: EntitlementRow[];
  loading: boolean;
}

const profilePortraitKey = "profile_portrait_species";

function getDisplayName(user: User): string {
  const metaName = user.user_metadata?.display_name;
  if (typeof metaName === "string" && metaName.trim()) {
    return metaName.trim();
  }

  return user.email?.split("@")[0] ?? "Jogador";
}

function getString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function isSpeciesEntitlement(row: EntitlementRow): boolean {
  const type = getString(row, ["item_type", "entitlement_type", "type", "kind", "category"]);
  const key = getString(row, ["item_key", "entitlement_key", "key", "species_id", "item_id"]);
  return type === "species" || Boolean(key?.startsWith("species:"));
}

function getEntitlementLabel(row: EntitlementRow): string {
  const key = getString(row, ["item_key", "entitlement_key", "key", "species_id", "item_id"]) ?? "extra";
  return key.replace(/^species:/, "").replace(/[_-]/g, " ");
}

function getEntitlementSpeciesId(row: EntitlementRow): SpeciesId | null {
  const key = getString(row, ["item_key", "entitlement_key", "key", "species_id", "item_id"])?.replace(/^species:/, "");
  if (key && key in speciesDefinitions) {
    return key as SpeciesId;
  }

  return null;
}

function parseProfilePortrait(value: unknown): SpeciesId | null {
  if (!value || typeof value !== "object" || !("speciesId" in value)) return null;
  const speciesId = (value as { speciesId?: unknown }).speciesId;
  return typeof speciesId === "string" && speciesId in speciesDefinitions ? (speciesId as SpeciesId) : null;
}

export function ProfilePanel({ user }: ProfilePanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedPortraitSpeciesId, setSelectedPortraitSpeciesId] = useState<SpeciesId>("jaguar");
  const [savingPortrait, setSavingPortrait] = useState(false);
  const [inventory, setInventory] = useState<ProfileInventory>({
    entitlements: [],
    loading: false
  });

  const displayName = getDisplayName(user);
  const baseSpecies = useMemo(
    () =>
      (Object.keys(speciesDefinitions) as SpeciesId[]).map((speciesId) => ({
        id: speciesId,
        definition: speciesDefinitions[speciesId]
      })),
    []
  );
  const extraSpecies = inventory.entitlements.filter(isSpeciesEntitlement);
  const selectableSpecies = useMemo(() => {
    const extraIds = extraSpecies
      .map(getEntitlementSpeciesId)
      .filter((speciesId): speciesId is SpeciesId => Boolean(speciesId));
    const uniqueIds = new Set<SpeciesId>([...baseSpecies.map((species) => species.id), ...extraIds]);
    return [...uniqueIds].map((speciesId) => ({
      id: speciesId,
      definition: speciesDefinitions[speciesId]
    }));
  }, [baseSpecies, extraSpecies]);
  const selectedPortraitSpecies =
    selectableSpecies.find((species) => species.id === selectedPortraitSpeciesId) ?? selectableSpecies[0] ?? baseSpecies[0];

  useEffect(() => {
    if (!open) return;

    let active = true;
    setInventory((current) => ({ ...current, loading: true }));

    Promise.all([
      supabase.from("entitlements").select("*").eq("user_id", user.id),
      supabase.from("user_progress").select("value").eq("user_id", user.id).eq("key", profilePortraitKey).maybeSingle()
    ])
      .then(([entitlementsResult, portraitResult]) => {
        if (!active) return;
        setInventory({
          entitlements: entitlementsResult.data ?? [],
          loading: false
        });
        setSelectedPortraitSpeciesId(parseProfilePortrait(portraitResult.data?.value) ?? "jaguar");
      })
      .catch(() => {
        if (!active) return;
        setInventory({ entitlements: [], loading: false });
      });

    return () => {
      active = false;
    };
  }, [open, user.id]);

  const choosePortrait = async (speciesId: SpeciesId) => {
    setSelectedPortraitSpeciesId(speciesId);
    setSavingPortrait(true);
    try {
      await supabase.from("user_progress").upsert({
        user_id: user.id,
        key: profilePortraitKey,
        value: { speciesId },
        updated_at: new Date().toISOString()
      });
    } finally {
      setSavingPortrait(false);
    }
  };

  return (
    <>
      <button type="button" className="profile-launcher" onClick={() => setOpen(true)}>
        <UserCircle aria-hidden="true" />
        <span>Perfil</span>
        <ChevronDown aria-hidden="true" />
      </button>

      {open && (
        <div className="profile-backdrop" role="presentation">
          <section className="profile-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title">
            <header className="profile-header">
              <div className="profile-avatar" aria-hidden="true">
                {selectedPortraitSpecies && <img src={encodeURI(selectedPortraitSpecies.definition.portraitAsset)} alt="" />}
              </div>
              <div>
                <span>Perfil do jogador</span>
                <h2 id="profile-title">{displayName}</h2>
                <p>{user.email}</p>
              </div>
              <button type="button" className="profile-close" onClick={() => setOpen(false)} aria-label="Fechar perfil">
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="profile-stats">
              <div>
                <Fingerprint aria-hidden="true" />
                <span>ID</span>
                <strong>{user.id.slice(0, 8)}</strong>
              </div>
              <div>
                <Check aria-hidden="true" />
                <span>Email</span>
                <strong>{user.email_confirmed_at ? "Confirmado" : "Pendente"}</strong>
              </div>
              <div>
                <Crown aria-hidden="true" />
                <span>Especies</span>
                <strong>{baseSpecies.length + extraSpecies.length}</strong>
              </div>
            </div>

            <div className="profile-section">
              <div className="profile-section-title">
                <Leaf aria-hidden="true" />
                <h3>Especies liberadas</h3>
                {savingPortrait && <span className="profile-saving">Salvando foto...</span>}
              </div>
              <div className="profile-species-grid">
                {baseSpecies.map(({ id, definition }) => (
                  <button
                    key={id}
                    type="button"
                    className={`profile-species-card profile-portrait-option${selectedPortraitSpecies?.id === id ? " is-selected" : ""}`}
                    onClick={() => void choosePortrait(id)}
                  >
                    <img src={encodeURI(definition.portraitAsset)} alt="" />
                    <div>
                      <strong>{definition.displayName}</strong>
                      <span>{selectedPortraitSpecies?.id === id ? "Foto atual" : "Usar como foto"}</span>
                    </div>
                  </button>
                ))}
                {extraSpecies.map((row, index) => (
                  <article key={`${getEntitlementLabel(row)}-${index}`} className="profile-species-card is-extra">
                    <div className="profile-extra-icon" aria-hidden="true">
                      +
                    </div>
                    <div>
                      <strong>{getEntitlementLabel(row)}</strong>
                      <span>Extra</span>
                    </div>
                  </article>
                ))}
              </div>
              {inventory.loading && <p className="profile-loading">Carregando inventario...</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
