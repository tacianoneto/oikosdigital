// Phones/small tablets: start with the side docks and hand collapsed so the
// board owns the screen; the edge tabs reopen each panel on demand.
export function isSmallScreen(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 820;
}

// Phone breakpoint that switches the HUD to the tabbed bottom-sheet layout.
// Matches the `.mobile-hud` media query in styles.css.
export const MOBILE_HUD_QUERY = "(max-width: 560px)";
export function isMobileWidth(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_HUD_QUERY).matches;
}

export const DESKTOP_ONLY_QUERY = "(max-width: 1023px)";
export function isBelowDesktopWidth(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_ONLY_QUERY).matches;
}
