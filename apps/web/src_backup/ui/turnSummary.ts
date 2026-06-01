import { speciesDefinitions } from "@oikos/content";
import type { GameLogEntry, PieceState, SpeciesId } from "@oikos/shared";

export interface TurnSummaryEntry {
  id: string;
  icon: "place" | "add" | "move" | "remove" | "hide" | "score" | "spend" | "info";
  text: string;
  points?: number;
  cardInstanceIds: string[];
}

export interface TurnSummary {
  key: number;
  playerName: string;
  speciesId: SpeciesId | null;
  scoreDelta: number;
  entries: TurnSummaryEntry[];
}

export interface TurnRecapState {
  history: TurnSummary[];
  index: number;
  visible: boolean;
}

const habitatShortLabel: Record<"forest" | "field" | "river", string> = {
  forest: "Bosque",
  field: "Campo",
  river: "Rio"
};

function pieceShortName(speciesId: SpeciesId | null | undefined): string {
  switch (speciesId) {
    case "jaguar": return "Onça";
    case "maned_wolf": return "Lobo";
    case "armadillo": return "Tatu";
    case "macaw": return "Arara";
    case "capuchin": return "Macaco";
    case "coati": return "Quati";
    default: return "peça";
  }
}

function pieceDisplayName(speciesId: SpeciesId | null | undefined): string {
  return speciesId ? speciesDefinitions[speciesId]?.displayName ?? pieceShortName(speciesId) : "peça";
}

function summarizePiecesBySpecies(pieces: PieceState[], fallbackSpeciesId: SpeciesId | null, fallbackCount = 1): string {
  const counts = new Map<SpeciesId, number>();
  for (const piece of pieces) {
    counts.set(piece.speciesId, (counts.get(piece.speciesId) ?? 0) + 1);
  }

  if (counts.size === 0) {
    const count = Math.max(1, fallbackCount);
    const label = pieceDisplayName(fallbackSpeciesId);
    return count === 1 ? label : `${count}x ${label}`;
  }

  return [...counts.entries()]
    .map(([pieceSpeciesId, count]) => (count === 1 ? pieceDisplayName(pieceSpeciesId) : `${count}x ${pieceDisplayName(pieceSpeciesId)}`))
    .join(", ");
}

function habitatFromEntry(entry: GameLogEntry): string | null {
  const habitat = entry.payload?.habitat;
  return habitat ? habitatShortLabel[habitat] : null;
}

function fromPayload(entry: GameLogEntry, speciesId: SpeciesId | null, pieceById: Map<string, PieceState>): TurnSummaryEntry | null {
  const payload = entry.payload;
  if (!payload) return null;
  const pieceLabel = pieceShortName(speciesId);
  const actorLabel = pieceDisplayName(speciesId);
  const habitat = habitatFromEntry(entry);
  const cards = payload.cardInstanceId ? [payload.cardInstanceId] : [];
  const payloadPieces = (payload.pieceIds ?? [])
    .map((pieceId) => pieceById.get(pieceId))
    .filter((piece): piece is PieceState => Boolean(piece));

  switch (payload.kind) {
    case "place_card":
      return { id: entry.id, icon: "place", text: `Colocou carta de ${habitat ?? "floresta"}`, cardInstanceIds: cards };
    case "setup_place":
      return { id: entry.id, icon: "add", text: `Posicionou ${pieceLabel} inicial em ${habitat ?? "carta inicial"}`, cardInstanceIds: cards };
    case "add_piece":
      return { id: entry.id, icon: "add", text: `Adicionou 1 ${pieceLabel}${habitat ? ` em ${habitat}` : ""}`, cardInstanceIds: cards };
    case "move_piece":
      return { id: entry.id, icon: "move", text: `Moveu 1 ${pieceLabel}${habitat ? ` para ${habitat}` : ""}`, cardInstanceIds: cards };
    case "remove_piece": {
      const removedPieces =
        payloadPieces.length > 1 && payload.actorPlayerId
          ? payloadPieces.filter((piece) => piece.ownerId !== payload.actorPlayerId)
          : payloadPieces;
      const removedLabel = summarizePiecesBySpecies(
        removedPieces.length > 0 ? removedPieces : payloadPieces,
        speciesId,
        payload.count ?? 1
      );
      return {
        id: entry.id,
        icon: "remove",
        text: `${actorLabel} removeu ${removedLabel}${habitat ? ` em ${habitat}` : ""}`,
        cardInstanceIds: cards
      };
    }
    case "hide_piece":
      return { id: entry.id, icon: "hide", text: `Escondeu 1 ${pieceLabel}${habitat ? ` em ${habitat}` : ""}`, cardInstanceIds: cards };
    case "pair_bonus":
      return { id: entry.id, icon: "add", text: `Dupla de quatis: +1 ${pieceLabel} adjacente`, points: payload.points, cardInstanceIds: cards };
    case "score":
      return { id: entry.id, icon: "score", text: `Pontuou ação ${payload.actionId ?? ""}`.trim(), points: payload.points, cardInstanceIds: cards };
    case "objective":
      return { id: entry.id, icon: "score", text: "Cumpriu objetivo", points: payload.points, cardInstanceIds: cards };
    case "spend":
      return {
        id: entry.id,
        icon: "spend",
        text: `Gastou ${payload.count ?? payload.resources?.length ?? 0} recurso(s)`,
        points: payload.points,
        cardInstanceIds: cards
      };
    default:
      return null;
  }
}

function fromMessage(entry: GameLogEntry, speciesId: SpeciesId | null): TurnSummaryEntry | null {
  const id = entry.id;
  const text = entry.message ?? "";
  const lower = text.toLowerCase();
  const pieceLabel = pieceShortName(speciesId);

  const cardLabelMatch = text.match(/colocou\s+(Bosque|Campo|Rio|Inicial|Floresta)[^\.]*\sna floresta/i);
  if (cardLabelMatch) {
    const raw = cardLabelMatch[1].toLowerCase();
    const habitat = raw.startsWith("bosque") || raw === "floresta" ? "Bosque"
      : raw === "campo" ? "Campo"
      : raw === "rio" ? "Rio"
      : "floresta";
    return { id, icon: "place", text: `Colocou carta de ${habitat}`, cardInstanceIds: [] };
  }

  const pointsMatch = text.match(/marcou\s+(\d+)\s+ponto/i);
  if (pointsMatch) {
    return { id, icon: "score", text: "Pontuou ação", points: Number(pointsMatch[1]), cardInstanceIds: [] };
  }

  const spendMatch = text.match(/gastou\s+(\d+)\s+(carne|recurso)/i);
  if (spendMatch) {
    return { id, icon: "spend", text: `Gastou ${spendMatch[1]} recurso(s)`, points: Number(spendMatch[1]), cardInstanceIds: [] };
  }

  if (lower.includes("dupla de quatis")) {
    return { id, icon: "add", text: `Dupla de quatis: +1 ${pieceLabel} adjacente`, points: 1, cardInstanceIds: [] };
  }

  if (lower.includes("adicionou")) {
    const adicionouMatch = text.match(/adicionou\s+\d+\s+([^\s\.]+)([^\.]*)/i);
    return { id, icon: "add", text: adicionouMatch ? `Adicionou 1 ${adicionouMatch[1]}` : "Adicionou peça", cardInstanceIds: [] };
  }

  if (lower.includes("moveu")) {
    return { id, icon: "move", text: `Moveu 1 ${pieceLabel}`, cardInstanceIds: [] };
  }

  if (lower.includes("removeu")) {
    return { id, icon: "remove", text: "Removeu peça(s)", cardInstanceIds: [] };
  }

  if (lower.includes("escondeu")) {
    return { id, icon: "hide", text: `Escondeu 1 ${pieceLabel}`, cardInstanceIds: [] };
  }

  if (lower.includes("posicionou")) {
    return { id, icon: "add", text: `Posicionou ${pieceLabel} inicial`, cardInstanceIds: [] };
  }

  if (lower.includes("pulou") || lower.includes("concluiu") || lower.includes("avançou") || lower.includes("avancou")) {
    return null;
  }

  return null;
}

export function buildTurnSummaryEntries(
  entries: GameLogEntry[],
  speciesId: SpeciesId | null,
  scoreDelta: number,
  pieces: PieceState[]
): TurnSummaryEntry[] {
  const out: TurnSummaryEntry[] = [];
  const pieceById = new Map(pieces.map((piece) => [piece.pieceId, piece]));

  for (const entry of entries) {
    const fromPayloadEntry = fromPayload(entry, speciesId, pieceById);
    if (fromPayloadEntry) {
      out.push(fromPayloadEntry);
      continue;
    }
    const fromMessageEntry = fromMessage(entry, speciesId);
    if (fromMessageEntry) {
      out.push(fromMessageEntry);
    }
  }

  if (out.length === 0) {
    out.push({
      id: "fallback",
      icon: "info",
      text: scoreDelta > 0 ? "Pontuou por efeito de ação final." : "Não marcou pontos neste turno.",
      cardInstanceIds: []
    });
  }

  return out;
}
