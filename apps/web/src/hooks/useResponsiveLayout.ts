import { useEffect, useState } from "react";
import {
  DESKTOP_ONLY_QUERY,
  MOBILE_HUD_QUERY,
  isBelowDesktopWidth,
  isMobileWidth
} from "../ui/responsive";

// Tracks the two responsive breakpoints that drive the HUD layout: `isMobile`
// (phone bottom-sheet layout) and `isBelowDesktop`. Each subscribes to
// matchMedia plus a resize fallback for environments that don't dispatch the
// matchMedia "change" event reliably.
export function useResponsiveLayout(): { isMobile: boolean; isBelowDesktop: boolean } {
  const [isMobile, setIsMobile] = useState(isMobileWidth);
  const [isBelowDesktop, setIsBelowDesktop] = useState(isBelowDesktopWidth);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(MOBILE_HUD_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    // Fallback: some environments don't dispatch matchMedia "change" reliably.
    window.addEventListener("resize", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(DESKTOP_ONLY_QUERY);
    const onChange = () => setIsBelowDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return { isMobile, isBelowDesktop };
}
