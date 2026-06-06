// Vertical pack shape — the data contract every pack file fills. Adding a vertical
// is a new data file that satisfies this type + one line in ./index — never new code.

export type PackMemoryType = 'icp' | 'offer' | 'voice' | 'goal';

export interface VerticalPack {
  id: string;                 // slug, e.g. 'home-services'
  label: string;              // 'Home Services'
  sub: string;                // 'Roofing · HVAC · flooring'
  industry: string;          // written to companies.industry
  /** The four required brain singletons (icp/offer/voice/goal) — confirm-not-fill. */
  memory: { type: PackMemoryType; title: string; content: string }[];
  /** Message-template / playbook brain entries (stored as 'process'). */
  templates: { title: string; content: string }[];
  /** Tilts Aria's 0–100 lead-scoring rubric for this vertical. */
  scoringTilt: string;
  /** Starter content drafts seeded into Nova's library (editable, pending approval). */
  content: { type: 'post' | 'script' | 'ugc_brief' | 'caption'; platform: string; title: string; body: string; brief: string }[];
}
