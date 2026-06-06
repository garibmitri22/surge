// Vertical pack registry. To add vertical #2 (e.g. med spas): create
// lib/verticals/med-spas.ts exporting a VerticalPack, then add it to VERTICALS below.
// That's the whole change — the onboarding picker + apply endpoint are data-driven.
import type { VerticalPack } from './types';
import { homeServices } from './home-services';
import { medSpas } from './med-spas';

export type { VerticalPack } from './types';

export const VERTICALS: VerticalPack[] = [
  homeServices,
  medSpas,
];

export function getVertical(id: string): VerticalPack | undefined {
  return VERTICALS.find((v) => v.id === id);
}

/** Lightweight list for the onboarding picker (no heavy content payload). */
export function verticalChoices(): { id: string; label: string; sub: string }[] {
  return VERTICALS.map((v) => ({ id: v.id, label: v.label, sub: v.sub }));
}
