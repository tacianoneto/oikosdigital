import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  // Tracks the value currently on screen so an interrupted animation always
  // resumes from what the user sees and lands exactly on the latest value.
  const shownRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) {
      return;
    }
    const start = performance.now();
    const duration = 600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (value - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        shownRef.current = value;
        setShown(value);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <span className={shown !== value ? "num-roll active" : "num-roll"}>{shown}</span>;
}
