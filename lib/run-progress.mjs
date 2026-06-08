// Surge — the run state machine. ONE source of truth for "what is this run doing right now",
// derived from REAL signals (task status + live lead/draft counts), shared by every surface
// that kicks a run (dashboard activation, /leads, tasks) and by the verify. No fabricated state.
//
// The agent run is: research loop (writes leads incrementally) → ONE post-loop drafting batch
// (writes drafts). So `drafts > 0` deterministically means research finished and drafting began
// — that's how we surface the Research → Drafting transition without any server-side flag.
//
// Phases: idle → queued → researching → drafting → done   (failed is the error branch)

/**
 * @param {{ inFlight?: boolean, completed?: boolean, failed?: boolean, leads?: number, drafts?: number }} s
 * @returns {'idle'|'queued'|'researching'|'drafting'|'done'|'failed'}
 */
export function computeRunPhase(s = {}) {
  const { inFlight = false, completed = false, failed = false, leads = 0, drafts = 0 } = s;
  if (failed) return 'failed';
  if (completed) return 'done';
  if (!inFlight) return 'idle';
  if (drafts > 0) return 'drafting';     // post-loop drafting started ⇒ research is done
  if (leads > 0) return 'researching';   // leads ticking up
  return 'queued';                       // kicked, nothing written yet
}

const plural = (n) => (n === 1 ? '' : 's');

/** Human copy for a phase, using REAL counts only. */
export function runProgressLabel(phase, { leads = 0, drafts = 0 } = {}) {
  switch (phase) {
    case 'queued':
      return { title: 'Aria is starting your run…', sub: 'Spinning up — the first prospects land in a moment.' };
    case 'researching':
      return { title: 'Aria is researching prospects…', sub: `${leads} real lead${plural(leads)} found so far` };
    case 'drafting':
      return { title: `Found ${leads} lead${plural(leads)} — now writing your drafts…`, sub: `${drafts} draft${plural(drafts)} ready so far` };
    case 'done':
      return { title: `Aria found ${leads} lead${plural(leads)} and drafted ${drafts}`, sub: 'Review them, then approve what you want to send.' };
    case 'failed':
      return { title: "That run didn't finish", sub: 'Nothing was charged — give it another go.' };
    default:
      return { title: '', sub: '' };
  }
}

/** True while a run is actively working (show the alive state). */
export function isRunActive(phase) {
  return phase === 'queued' || phase === 'researching' || phase === 'drafting';
}
