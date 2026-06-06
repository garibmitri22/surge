'use client';

import { useEffect, useState } from 'react';
import { getHoursSummary, type HoursSummary } from '@/lib/data';
import { formatHours } from '@/lib/pricing.mjs';
import { hoursDisplay } from '@/lib/hours.mjs';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';

// Dashboard fuel gauge for the team's hours. Calm, not a taxi meter. Hidden until
// the hours migration is applied (getHoursSummary returns null), so it never breaks
// the dashboard pre-migration.
export function HoursWidget() {
  const [h, setH] = useState<HoursSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getHoursSummary();
      if (!cancelled) { setH(s); setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!loaded || !h) return null;

  // Display is computed by the shared, guarded helper — never "{balance} of {allowance}"
  // when balance > allowance (correct or gone).
  const disp = hoursDisplay(h);
  const pct = disp.pct;
  const low = disp.mode === 'ratio' && pct < 15;
  const color = low ? '#ef4444' : pct < 35 ? '#f59e0b' : '#22c55e';

  // Days left at the current pace (this month's burn so far). Only meaningful on the
  // ratio path (a metered account with a real allowance).
  const day = new Date().getDate();
  const perDay = h.thisMonthUsed > 0 ? h.thisMonthUsed / day : 0;
  const daysLeft = disp.mode === 'ratio' && perDay > 0 ? Math.floor(h.balance / perDay) : null;

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow)', padding: '18px 20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Team Hours</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)' }}>{disp.primary}</span>
            {disp.secondary ? <> {disp.secondary}</> : null}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          {daysLeft !== null && <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>~{daysLeft} days at this pace</p>}
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'capitalize' }}>{h.plan} plan</p>
        </div>
      </div>

      {/* Fuel gauge — internal/owner accounts are unlimited, so the gauge is full. */}
      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: h.unlimited ? '100%' : `${pct}%`, background: h.unlimited ? '#22c55e' : color, borderRadius: '999px', transition: 'width 0.8s ease' }} />
      </div>

      {!h.unlimited && low && (
        <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '10px', lineHeight: 1.5 }}>
          Running low on hours. The team can put in overtime to keep going, or move up a plan. Ask Atlas.
        </p>
      )}

      {h.byEmployee.length > 0 && (
        <div style={{ display: 'flex', gap: '16px', marginTop: '14px', flexWrap: 'wrap' }}>
          {h.byEmployee.map((e) => (
            <div key={e.employeeId} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <EmployeeAvatar id={e.employeeId} size={20} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ textTransform: 'capitalize' }}>{e.employeeId}</span> {formatHours(e.hours)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
