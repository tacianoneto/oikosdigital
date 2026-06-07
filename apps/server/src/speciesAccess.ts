import type { SpeciesId } from "@oikos/shared";
import { getUserEntitlements } from "./auth";

const baseSpeciesIds = new Set<string>(["jaguar", "maned_wolf", "armadillo", "macaw", "galo_de_campina", "capuchin", "coati"]);

const typeKeys = ["item_type", "entitlement_type", "type", "kind", "category"];
const valueKeys = ["item_key", "entitlement_key", "key", "species_id", "item_id"];

function getString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function isInactive(row: Record<string, unknown>): boolean {
  return row.active === false || row.enabled === false || row.revoked === true;
}

function matchesSpeciesEntitlement(row: Record<string, unknown>, speciesId: SpeciesId): boolean {
  if (isInactive(row)) {
    return false;
  }

  const type = getString(row, typeKeys);
  const key = getString(row, valueKeys);
  const acceptedKeys = new Set([speciesId, `species:${speciesId}`, `species_${speciesId}`, `species-${speciesId}`]);

  return (type === "species" && Boolean(key && acceptedKeys.has(key))) || Boolean(key && acceptedKeys.has(key));
}

export async function canUseSpecies(userId: string, speciesId: SpeciesId): Promise<boolean> {
  if (baseSpeciesIds.has(speciesId)) {
    return true;
  }

  const entitlements = await getUserEntitlements(userId);
  return entitlements.some((row) => matchesSpeciesEntitlement(row, speciesId));
}
