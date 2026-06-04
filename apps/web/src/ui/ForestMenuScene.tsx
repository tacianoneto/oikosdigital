import { useMemo } from "react";
import type { CSSProperties } from "react";

/**
 * Decorative, non-interactive forest scene for the main menu. Pure CSS + SVG
 * (no emojis, no image assets): layered depth (far/mid/near), light rays,
 * drifting leaves, blinking fireflies, gentle wind sway, and a few subtle
 * woodland animals (owl, deer, fox mascot, rabbit, bird) with small idle
 * motions. Everything here is aria-hidden — it's ambiance, not UI.
 */
export function ForestMenuScene() {
  const leaves = useMemo<CSSProperties[]>(
    () =>
      Array.from({ length: 16 }, () => ({
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 12}s`,
        animationDuration: `${9 + Math.random() * 8}s`,
        width: `${12 + Math.random() * 12}px`,
        ["--sway" as string]: `${(Math.random() > 0.5 ? 1 : -1) * (30 + Math.random() * 60)}px`
      }) as CSSProperties),
    []
  );
  const fireflies = useMemo<CSSProperties[]>(
    () =>
      Array.from({ length: 26 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${30 + Math.random() * 65}%`,
        animationDelay: `${Math.random() * 6}s`,
        animationDuration: `${3 + Math.random() * 4}s`,
        ["--fx" as string]: `${-40 + Math.random() * 80}px`,
        ["--fy" as string]: `${-30 + Math.random() * 60}px`
      }) as CSSProperties),
    []
  );

  return (
    <div className="forest-scene" aria-hidden="true">
      {/* Sky / dusk gradient + warm sun glow */}
      <div className="forest-sky" />
      <div className="forest-sun" />

      {/* Sun rays filtering through the canopy */}
      <div className="forest-rays">
        <span style={{ left: "18%", ["--ang" as string]: "-14deg" } as CSSProperties} />
        <span style={{ left: "34%", ["--ang" as string]: "-7deg" } as CSSProperties} />
        <span style={{ left: "52%", ["--ang" as string]: "4deg" } as CSSProperties} />
        <span style={{ left: "70%", ["--ang" as string]: "11deg" } as CSSProperties} />
      </div>

      {/* FAR layer — soft, blurred distant trees */}
      <svg className="forest-layer forest-far" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
        <g fill="#3f6b4a">
          {[80, 230, 410, 600, 790, 980, 1130].map((x, i) => (
            <g key={i} transform={`translate(${x} ${i % 2 ? 250 : 290})`}>
              <rect x="-10" y="120" width="20" height="180" rx="8" fill="#2e5238" />
              <ellipse cx="0" cy="90" rx="70" ry="110" />
              <ellipse cx="-45" cy="150" rx="55" ry="80" />
              <ellipse cx="45" cy="150" rx="55" ry="80" />
            </g>
          ))}
        </g>
      </svg>

      {/* A deer grazing in the mid-distance */}
      <svg className="forest-layer forest-deer" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
        <g transform="translate(880 380)" fill="#23362a" className="forest-deer-body">
          <ellipse cx="0" cy="0" rx="46" ry="26" />
          <rect x="-38" y="18" width="9" height="46" rx="4" />
          <rect x="-20" y="20" width="9" height="44" rx="4" />
          <rect x="20" y="20" width="9" height="44" rx="4" />
          <rect x="34" y="18" width="9" height="46" rx="4" />
          <g className="forest-deer-head">
            <path d="M40 -8 q26 -6 30 -34 q4 22 -10 40 q-8 10 -24 12 z" />
            <path d="M62 -44 l-6 -22 l10 16 l4 -20 l4 22 z" />
            <ellipse cx="50" cy="-2" rx="14" ry="10" />
          </g>
        </g>
      </svg>

      {/* MID layer — colored forest trees */}
      <svg className="forest-layer forest-mid" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
        <g>
          {[
            { x: 30, c: "#2f5a3c", h: 360 },
            { x: 200, c: "#356845", h: 410 },
            { x: 1000, c: "#356845", h: 400 },
            { x: 1170, c: "#2f5a3c", h: 360 }
          ].map((t, i) => (
            <g key={i} transform={`translate(${t.x} ${600 - t.h})`} className="forest-sway" style={{ ["--d" as string]: `${i * 0.7}s` } as CSSProperties}>
              <rect x="-16" y={t.h - 200} width="32" height="220" rx="12" fill="#3a2a1c" />
              <ellipse cx="0" cy="60" rx="120" ry="150" fill={t.c} />
              <ellipse cx="-80" cy="150" rx="90" ry="120" fill={t.c} />
              <ellipse cx="80" cy="150" rx="90" ry="120" fill={t.c} />
            </g>
          ))}
        </g>
      </svg>

      {/* NEAR layer — dark framing trunks, hanging vines, bushes, mushrooms, rocks */}
      <svg className="forest-layer forest-near" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
        {/* Left framing trunk */}
        <path d="M-40 600 L-40 0 C 60 40 120 120 95 240 C 80 360 130 480 90 600 Z" fill="#1c2a1e" />
        {/* Right framing trunk */}
        <path d="M1240 600 L1240 0 C 1140 40 1080 120 1105 240 C 1120 360 1070 480 1110 600 Z" fill="#1c2a1e" />

        {/* Top branch spanning across (the sign hangs from this) */}
        <path d="M120 40 C 360 110 840 110 1080 40" stroke="#241a10" strokeWidth="20" fill="none" strokeLinecap="round" />

        {/* Hanging vines with leaves */}
        <g stroke="#2c4a30" strokeWidth="4" fill="none" className="forest-sway-soft">
          <path d="M210 70 q -16 70 6 150" />
          <path d="M980 70 q 16 70 -6 150" />
        </g>
        <g fill="#3c6b40" className="forest-sway-soft">
          {[[210, 120], [205, 165], [215, 205], [980, 120], [985, 165], [975, 205]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y} q 14 -10 26 2 q -14 12 -26 -2 z`} />
          ))}
        </g>

        {/* Foreground bushes */}
        <g fill="#16261a">
          <ellipse cx="160" cy="600" rx="220" ry="120" />
          <ellipse cx="1040" cy="600" rx="220" ry="120" />
          <ellipse cx="600" cy="640" rx="420" ry="120" />
        </g>
        <g fill="#1e3422">
          <ellipse cx="120" cy="585" rx="90" ry="60" />
          <ellipse cx="1080" cy="585" rx="90" ry="60" />
        </g>

        {/* Mushrooms (bottom-left cluster) */}
        <g className="forest-mushrooms">
          <g transform="translate(250 560)">
            <rect x="-6" y="0" width="12" height="26" rx="5" fill="#e9dcc4" />
            <path d="M-22 2 q22 -34 44 0 z" fill="#c0512e" />
            <circle cx="-8" cy="-8" r="3" fill="#f3e6cf" />
            <circle cx="8" cy="-4" r="2.5" fill="#f3e6cf" />
          </g>
          <g transform="translate(285 572) scale(0.7)">
            <rect x="-6" y="0" width="12" height="26" rx="5" fill="#e9dcc4" />
            <path d="M-22 2 q22 -34 44 0 z" fill="#cf6a36" />
          </g>
        </g>

        {/* Smooth rocks (bottom-right) */}
        <g fill="#3a4550">
          <ellipse cx="930" cy="580" rx="46" ry="28" />
          <ellipse cx="980" cy="592" rx="34" ry="20" fill="#46525e" />
        </g>
      </svg>

      {/* Owl perched on the left branch — blinks, head tilts */}
      <svg className="forest-owl" viewBox="0 0 120 140">
        <g className="forest-owl-body">
          <ellipse cx="60" cy="84" rx="40" ry="46" fill="#5a4632" />
          <ellipse cx="60" cy="90" rx="26" ry="34" fill="#7a6045" />
          <path d="M24 54 q-6 -26 16 -30 q-8 16 4 26 z" fill="#4a3826" />
          <path d="M96 54 q6 -26 -16 -30 q8 16 -4 26 z" fill="#4a3826" />
          <g className="forest-owl-eyes">
            <circle cx="46" cy="62" r="15" fill="#f3ead4" />
            <circle cx="74" cy="62" r="15" fill="#f3ead4" />
            <circle className="forest-owl-pupil" cx="46" cy="62" r="7" fill="#1c130a" />
            <circle className="forest-owl-pupil" cx="74" cy="62" r="7" fill="#1c130a" />
            <rect className="forest-owl-lid" x="30" y="47" width="60" height="30" fill="#5a4632" />
          </g>
          <path d="M60 70 l-7 9 h14 z" fill="#d8a33c" />
        </g>
      </svg>

      {/* Fox mascot — sits beside the menu, tail sways, ear twitches, blinks */}
      <svg className="forest-fox" viewBox="0 0 200 200">
        <g transform="translate(20 20)">
          <path className="forest-fox-tail" d="M150 120 q60 -10 50 -60 q-2 40 -40 46 q24 14 -10 28 z" fill="#d9763a" />
          <ellipse cx="90" cy="150" rx="60" ry="34" fill="#c9692f" />
          <path d="M70 160 h12 v22 h-12 z M108 160 h12 v22 h-12 z" fill="#3a241a" />
          <ellipse cx="90" cy="150" rx="40" ry="22" fill="#f0ddc2" />
          <g className="forest-fox-head">
            <circle cx="78" cy="92" r="44" fill="#d9763a" />
            <path className="forest-fox-ear" d="M44 64 l-8 -44 l34 26 z" fill="#d9763a" />
            <path d="M44 64 l-4 -24 l16 16 z" fill="#3a241a" />
            <path className="forest-fox-ear forest-fox-ear-r" d="M112 64 l8 -44 l-34 26 z" fill="#d9763a" />
            <path d="M112 64 l4 -24 l-16 16 z" fill="#3a241a" />
            <path d="M78 96 q-40 8 -52 36 q40 6 52 -4 q12 10 52 4 q-12 -28 -52 -36 z" fill="#f7e9d4" />
            <g className="forest-fox-eyes">
              <ellipse cx="60" cy="86" rx="6" ry="8" fill="#241308" />
              <ellipse cx="96" cy="86" rx="6" ry="8" fill="#241308" />
            </g>
            <path d="M78 108 l-9 9 h18 z" fill="#241308" />
          </g>
        </g>
      </svg>

      {/* Rabbit hiding in the right bush — ear twitches */}
      <svg className="forest-rabbit" viewBox="0 0 120 120">
        <g transform="translate(20 30)">
          <ellipse cx="44" cy="64" rx="32" ry="26" fill="#8a8278" />
          <circle cx="44" cy="40" r="20" fill="#8a8278" />
          <path className="forest-rabbit-ear" d="M34 24 q-6 -34 6 -36 q10 4 4 36 z" fill="#8a8278" />
          <path d="M34 24 q-3 -24 5 -30 q6 4 2 30 z" fill="#c9a9a0" />
          <path className="forest-rabbit-ear forest-rabbit-ear-r" d="M54 24 q6 -34 -6 -36 q-10 4 -4 36 z" fill="#8a8278" />
          <circle cx="38" cy="40" r="3" fill="#241308" />
          <circle cx="52" cy="40" r="3" fill="#241308" />
        </g>
      </svg>

      {/* Bird gliding across the canopy occasionally */}
      <svg className="forest-bird" viewBox="0 0 60 30">
        <path className="forest-bird-w" d="M2 16 q14 -16 28 0 q14 -16 28 0" stroke="#1f2d20" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>

      {/* Drifting leaves */}
      <div className="forest-leaves">
        {leaves.map((style, i) => (
          <span key={i} className="forest-leaf" style={style}>
            <svg viewBox="0 0 20 20">
              <path d="M10 1 C 17 5 17 15 10 19 C 3 15 3 5 10 1 Z" fill={i % 3 === 0 ? "#c98a3a" : i % 3 === 1 ? "#7fae53" : "#d6a64a"} />
              <path d="M10 3 L10 18" stroke="#5c4a22" strokeWidth="0.8" />
            </svg>
          </span>
        ))}
      </div>

      {/* Fireflies */}
      <div className="forest-fireflies">
        {fireflies.map((style, i) => (
          <span key={i} className="forest-firefly" style={style} />
        ))}
      </div>

      {/* Soft vignette to settle the composition */}
      <div className="forest-vignette" />
    </div>
  );
}
