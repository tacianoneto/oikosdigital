import { supabase } from "./supabase";
import type { TutorialId } from "../ui/tutorials";

const progressKey = "tutorials_completed";
const localProgressKey = "oikos:tutorials-completed";

let completedTutorials = new Set<TutorialId>();
let activeUserId: string | null = null;

function parseTutorialIds(value: unknown): TutorialId[] {
  if (!value || typeof value !== "object" || !("ids" in value)) return [];
  const ids = (value as { ids?: unknown }).ids;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is TutorialId =>
    id === "initial" ||
    id === "jaguar" ||
    id === "wolf" ||
    id === "armadillo" ||
    id === "macaw" ||
    id === "capuchin" ||
    id === "coati"
  );
}

function readLocal(): TutorialId[] {
  try {
    const raw = window.localStorage.getItem(localProgressKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return parseTutorialIds(parsed);
  } catch {
    return [];
  }
}

function writeLocal(ids: TutorialId[]): void {
  try {
    window.localStorage.setItem(localProgressKey, JSON.stringify({ ids }));
  } catch {
    // local fallback only
  }
}

export function isTutorialProgressDone(tutorialId: TutorialId): boolean {
  return completedTutorials.has(tutorialId);
}

export function getCompletedTutorialIds(): TutorialId[] {
  return [...completedTutorials];
}

export async function loadTutorialProgress(userId: string): Promise<void> {
  activeUserId = userId;
  const localIds = readLocal();
  completedTutorials = new Set(localIds);

  const { data, error } = await supabase
    .from("user_progress")
    .select("value")
    .eq("user_id", userId)
    .eq("key", progressKey)
    .maybeSingle();

  if (error) {
    return;
  }

  const remoteIds = parseTutorialIds(data?.value);
  completedTutorials = new Set([...localIds, ...remoteIds]);
  writeLocal([...completedTutorials]);

  if (localIds.some((id) => !remoteIds.includes(id))) {
    await saveTutorialProgress(userId);
  }
}

export async function markTutorialProgressDone(tutorialId: TutorialId): Promise<void> {
  completedTutorials.add(tutorialId);
  writeLocal([...completedTutorials]);
  if (activeUserId) {
    await saveTutorialProgress(activeUserId);
  }
}

async function saveTutorialProgress(userId: string): Promise<void> {
  await supabase
    .from("user_progress")
    .upsert({
      user_id: userId,
      key: progressKey,
      value: { ids: [...completedTutorials] },
      updated_at: new Date().toISOString()
    });
}
