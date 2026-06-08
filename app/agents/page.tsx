'use client';

import Link from 'next/link';
import { CinematicBackground } from '@/components/CinematicBackground';
import { PresenceOrb } from '@/components/PresenceOrb';
import { AGENTS, AGENT_ORDER } from '@/lib/agents';

// "Meet the team" — the four living presences on one cinematic stage. Each is a real working
// agent, not a stock avatar. The orb is the honest face of the product.
export default function AgentsIndex() {
  return (
    <main style={{ position: 'relative', minHeight: '100vh', background: '#05060a', color: '#e8eaf0', overflow: 'hidden' }}>
      <CinematicBackground color="#6366f1" intensity={0.85} />

      <nav style={{ position: 'relative', zIndex: 2, maxWidth: '1100px', margin: '0 auto', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/landing" style={{ fontSize: '18px', fontWeight: 700, color: '#fff', textDecoration: 'none', letterSpacing: '-0.02em' }}>Surge</Link>
        <Link href="/dashboard" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Open the app →</Link>
      </nav>

      <section style={{ position: 'relative', zIndex: 2, maxWidth: '1100px', margin: '0 auto', padding: '40px 28px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '46px', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>Meet your team</h1>
        <p style={{ fontSize: '17px', color: 'rgba(232,234,240,0.7)', marginTop: '14px', maxWidth: '46ch', marginInline: 'auto', lineHeight: 1.6 }}>
          Four AI specialists, run for you. No stock avatars, no fake faces — each is a living presence that does real work. <span style={{ color: '#fff', fontWeight: 600 }}>Real numbers. Never faked.</span>
        </p>
      </section>

      <section style={{ position: 'relative', zIndex: 2, maxWidth: '1000px', margin: '0 auto', padding: '24px 28px 80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        {AGENT_ORDER.map((id) => {
          const a = AGENTS[id];
          return (
            <Link
              key={id}
              href={`/agents/${id}`}
              style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '28px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', transition: 'border-color 0.2s, background 0.2s' }}
            >
              <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${a.color}5e 0%, ${a.color}1f 40%, transparent 68%)`, filter: 'blur(18px)' }} />
                <PresenceOrb employeeId={id} state="idle" size={116} onDark aria-label={`${a.name} presence`} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#cfe9d8' }}>Active</span>
                </div>
                <p style={{ fontSize: '19px', fontWeight: 700, color: '#fff', margin: 0 }}>{a.name}</p>
                <p style={{ fontSize: '13px', color: a.color, fontWeight: 600, marginTop: '2px' }}>{a.role}</p>
                <p style={{ fontSize: '13px', color: 'rgba(232,234,240,0.62)', marginTop: '10px', lineHeight: 1.5 }}>{a.tagline}</p>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
