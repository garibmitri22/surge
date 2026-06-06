// Centralized identity + living-modulation config for the PresenceOrb.
//
// IDENTITY IS FIXED — each employee keeps their NAME + signature colour so you
// always know who-is-who at a glance. LIFE MODULATES ON TOP: motion speed,
// turbulence, glow and a hue tint shift by STATE. These values are the approved
// prototype spec (see prompts/voice-alive-prompt.md), not suggestions.
//
// This is the single source of truth for orb colours. The dashboard ticker and
// chat panels already use the same hexes; keep them in sync here.

export type OrbState =
  | 'idle'        // slow calm breathing
  | 'thinking'    // faster shimmer — request in flight
  | 'talking'     // flows with the audio / text-stream cadence
  | 'working'     // active churn — an in-progress task exists
  | 'done'        // brief green-tinted pulse
  | 'needs-owner'; // attention tone — stronger red pulse

// Fixed signature colour per employee. Always recognisable.
export const ORB_COLORS: Record<string, string> = {
  aria: '#a78bfa',  // purple — sales
  nova: '#34d399',  // green — marketing
  opus: '#60a5fa',  // blue — ops
  atlas: '#f59e0b', // amber — chief of staff
};

export const ORB_FALLBACK = '#6366f1'; // indigo accent for unknown ids

export function orbColor(employeeId: string): string {
  return ORB_COLORS[employeeId] ?? ORB_FALLBACK;
}

export interface OrbStateParams {
  speed: number;     // motion speed multiplier
  turbulence: number; // domain-warp / churn intensity
  glow: number;      // brightness / halo strength (0..1+)
  tint: string | null; // hue tint mixed on top of the base colour
  tintMix: number;   // 0..1 how far to mix toward `tint`
  pulse: number;     // attention pulse strength (0 = none)
}

// Per-state modulation, layered ON TOP of the fixed base colour.
export const ORB_STATE_PARAMS: Record<OrbState, OrbStateParams> = {
  idle:          { speed: 0.5, turbulence: 0.55, glow: 0.55, tint: null,      tintMix: 0,    pulse: 0   },
  thinking:      { speed: 1.7, turbulence: 1.05, glow: 0.65, tint: null,      tintMix: 0,    pulse: 0   },
  talking:       { speed: 1.2, turbulence: 1.25, glow: 0.95, tint: null,      tintMix: 0,    pulse: 0   },
  working:       { speed: 1.0, turbulence: 1.70, glow: 0.70, tint: null,      tintMix: 0,    pulse: 0   },
  done:          { speed: 0.8, turbulence: 0.70, glow: 0.90, tint: '#34d399', tintMix: 0.38, pulse: 1.0 },
  'needs-owner': { speed: 0.9, turbulence: 1.00, glow: 0.85, tint: '#f87171', tintMix: 0.38, pulse: 1.4 },
};

// Parse "#rrggbb" → [r,g,b] in 0..1. We pass raw rgb into the shader and bypass
// three's colour management, so the hex renders as the exact signature colour.
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
