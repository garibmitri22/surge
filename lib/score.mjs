// Surge — Workforce Performance Score. "The One Number" (CEO doc): the emotional
// center of the product. It is computed from REAL company data only — never invented.
// A workspace with no real work yet returns score = null (the UI shows a "getting
// started" state, never a fake number). Plain ESM so the data layer + a verify
// script share the exact formula.
//
// v1 formula (transparent, re-tunable from real usage):
//   Execution 40% — task completion rate (completed / all tasks)
//   Pipeline  35% — qualified-or-better leads (ramps to 100 at 20)
//   Momentum  25% — real work in the last 7 days (leads + drafts; 100 at 10)
// Weights renormalize over the components that have data, so a team that hasn't
// touched a given lane yet isn't penalized for it.

export const SCORE_WEIGHTS = { execution: 0.40, pipeline: 0.35, momentum: 0.25 };

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * @param {{ tasksCompleted?:number, tasksOpen?:number, leadsTotal?:number, leadsQualified?:number, recentWork?:number }} input
 * @returns {{ score:number|null, hasEnoughData:boolean, components:{key:string,label:string,value:number,weight:number}[] }}
 */
export function computeWorkforceScore({ tasksCompleted = 0, tasksOpen = 0, leadsTotal = 0, leadsQualified = 0, recentWork = 0 } = {}) {
  // Enough signal to score honestly? A brand-new workspace is NOT scored.
  const hasEnoughData = tasksCompleted >= 1 || leadsTotal >= 3 || recentWork >= 3;
  if (!hasEnoughData) return { score: null, hasEnoughData: false, components: [] };

  const components = [];
  const totalTasks = tasksCompleted + tasksOpen;
  if (totalTasks > 0) {
    components.push({ key: 'execution', label: 'Task Execution', value: clamp((tasksCompleted / totalTasks) * 100), weight: SCORE_WEIGHTS.execution });
  }
  if (leadsTotal > 0) {
    components.push({ key: 'pipeline', label: 'Pipeline', value: clamp(leadsQualified * 5), weight: SCORE_WEIGHTS.pipeline });
  }
  // Momentum is always counted once we're scoring: going quiet legitimately lowers it.
  components.push({ key: 'momentum', label: 'Momentum (7d)', value: clamp(recentWork * 10), weight: SCORE_WEIGHTS.momentum });

  const weightSum = components.reduce((s, c) => s + c.weight, 0);
  const score = clamp(components.reduce((s, c) => s + c.value * c.weight, 0) / weightSum);
  return { score, hasEnoughData: true, components };
}
