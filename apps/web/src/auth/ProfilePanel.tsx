import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Check, ChevronDown, Crown, Fingerprint, Leaf, Palette, UserCircle, X } from "lucide-react";
import { speciesDefinitions } from "@oikos/content";
import type { SpeciesId } from "@oikos/shared";
import { supabase } from "./supabase";

interface ProfilePanelProps {
  user: User;
}

type EntitlementRow = Record<string, unknown>;
type EquippedCosmeticRow = Record<string, unknown>;

interface ProfileInventory {
  entitlements: EntitlementRow[];
  equippedCosmetics: EquippedCosmeticRow[];
  loading: boolean;
}

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

function getCosmeticLabel(row: EquippedCosmeticRow): string {
  return (
    getString(row, ["cosmetic_key", "cosmetic_id", "item_key", "key", "skin_id"])?.replace(/[_-]/g, " ") ??
    "Cosmetico equipado"
  );
}

export function ProfilePanel({ user }: ProfilePanelProps) {
  const [open, setOpen] = useState(false);
  const [inventory, setInventory] = useState<ProfileInventory>({
    entitlements: [],
    equippedCosmetics: [],
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

  useEffect(() => {
    if (!open) return;

    let active = true;
    setInventory((current) => ({ ...current, loading: true }));

    Promise.all([
      supabase.from("entitlements").select("*").eq("user_id", user.id),
      supabase.from("equipped_cosmetics").select("*").eq("user_id", user.id)
    ])
      .then(([entitlementsResult, cosmeticsResult]) => {
        if (!active) return;
        setInventory({
          entitlements: entitlementsResult.data ?? [],
          equippedCosmetics: cosmeticsResult.data ?? [],
          loading: false
        });
      })
      .catch(() => {
        if (!active) return;
        setInventory({ entitlements: [], equippedCosmetics: [], loading: false });
      });

    return () => {
      active = false;
    };
  }, [open, user.id]);

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
                {displayName.slice(0, 1).toUpperCase()}
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
              </div>
              <div className="profile-species-grid">
                {baseSpecies.map(({ id, definition }) => (
                  <article key={id} className="profile-species-card">
                    <img src={encodeURI(definition.portraitAsset)} alt="" />
                    <div>
                      <strong>{definition.displayName}</strong>
                      <span>Base</span>
                    </div>
                  </article>
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
            </div>

            <div className="profile-section">
              <div className="profile-section-title">
                <Palette aria-hidden="true" />
                <h3>Skins e cosmeticos</h3>
              </div>
              <div className="profile-cosmetic-list">
                <article>
                  <strong>Meeples padrao</strong>
                  <span>Liberado</span>
                </article>
                <article>
                  <strong>Portrait padrao</strong>
                  <span>Liberado</span>
                </article>
                {inventory.equippedCosmetics.map((row, index) => (
                  <article key={`${getCosmeticLabel(row)}-${index}`}>
                    <strong>{getCosmeticLabel(row)}</strong>
                    <span>Equipado</span>
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
