'use client';

import { computeRunPhase, runProgressLabel, isRunActive } from '@/lib/run-progress.mjs';

// The legible run state. Renders an ALIVE working card (phase + live counter ticking up),
// a COMPLETION card (✓ found N, drafted M — review primary, run-again secondary), or nothing
// when idle. Driven entirely by REAL signals passed in (task status + live counts).
interface RunProgressProps {
  inFlight: boolean;     // a run is currently in flight (polling)
  completed: boolean;    // the run finished (task completed)
  failed?: boolean;      // the run failed / didn't start
  leads: number;         // NEW leads produced THIS run (real, from polling)
  drafts: number;        // NEW drafts produced THIS run (real, from polling)
  onReview?: () => void;
  reviewLabel?: string;
  onRunAgain?: () => void;
  runAgainLabel?: string;
}

export function RunProgress({
  inFlight, completed, failed = false, leads, drafts,
  onReview, reviewLabel = 'Review leads', onRunAgain, runAgainLabel = 'Run again to keep building',
}: RunProgressProps) {
  const phase = computeRunPhase({ inFlight, completed, failed, leads, drafts });
  if (phase === 'idle') return null;
  const { title, sub } = runProgressLabel(phase, { leads, drafts });
  const active = isRunActive(phase);
  // During research the live number is leads; once drafting, it's drafts.
  const tickerValue = phase === 'drafting' ? drafts : leads;
  const tickerLabel = phase === 'drafting' ? `draft${drafts === 1 ? '' : 's'}` : `lead${leads === 1 ? '' : 's'}`;

  const accent = phase === 'done' ? 'var(--green)' : phase === 'failed' ? 'var(--red)' : 'var(--accent)';
  const tint = phase === 'done' ? '#16a34a12' : phase === 'failed' ? '#ef444412' : 'var(--accent-dim)';
  const border = phase === 'done' ? '#16a34a40' : phase === 'failed' ? '#ef444440' : '#6366f130';

  return (
    <div style={{ background: tint, border: `1px solid ${border}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', animation: 'fadeIn 0.3s ease' }}>
      {/* Alive indicator / status glyph */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}>
        {active ? (
          <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: accent, animation: 'pulse-green 1.4s infinite' }} />
        ) : (
          <span style={{ fontSize: '24px', color: accent }}>{phase === 'done' ? '✓' : '!'}</span>
        )}
      </div>

      {/* Live ticker (real counts only) */}
      {active && (
        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '52px' }}>
          <p key={tickerValue} style={{ fontSize: '30px', fontWeight: 800, color: accent, fontFamily: 'var(--font-geist-mono)', lineHeight: 1, animation: 'fadeIn 0.4s ease' }}>{tickerValue}</p>
          <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '3px' }}>{tickerLabel}</p>
        </div>
      )}

      {/* Title + sub */}
      <div style={{ flex: 1, minWidth: '200px' }}>
        <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{phase === 'done' ? `✓ ${title}` : title}</p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.5 }}>{sub}</p>
      </div>

      {/* Completion / failure actions: review is PRIMARY, run-again is clearly SECONDARY */}
      {!active && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          {phase === 'done' && onReview && (
            <button onClick={onReview} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '11px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {reviewLabel} →
            </button>
          )}
          {onRunAgain && (
            <button onClick={onRunAgain} style={{ background: 'none', color: 'var(--text-secondary)', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              {phase === 'failed' ? 'Try again' : runAgainLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
