const VISUAL_ACCESSIBILITY_KEY = "oikos.visualAccessibility";

export function getVisualAccessibilityPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(VISUAL_ACCESSIBILITY_KEY) === "true";
}

export function setVisualAccessibilityPreference(enabled: boolean): boolean {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VISUAL_ACCESSIBILITY_KEY, enabled ? "true" : "false");
  }
  return enabled;
}
