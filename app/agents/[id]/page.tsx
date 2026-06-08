'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CinematicBackground } from '@/components/CinematicBackground';
import { PresenceOrb } from '@/components/PresenceOrb';
import { useSpeechOrb } from '@/lib/use-speech-orb';
import { AGENTS, AGENT_ORDER } from '@/lib/agents';

// Per-agent character page — modeled on 11x's Alice/Julian, our way: the agent's living orb on a
// cinematic dark stage, first-person voice, an honest list of what they actually do, and a live
// voice demo (the orb reacts to REAL ElevenLabs speech). Marketing/showcase surface — cinematic
// dark, distinct from the clean light working app.

export default function AgentPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || 'atlas').toLowerCase();
  const agent = AGENTS[id] ?? AGENTS.atlas;
  const { speaking, analyser, play, stop } = useSpeechOrb(agent.id);

  const accent = agent.color;

  return (
    <main style={{ position: 'relative', minHeight: '100vh', background: '#05060a', color: '#e8eaf0', overflow: 'hidden' }}>
      <CinematicBackground color={accent} intensity={speaking ? 1.25 : 0.9} />

      {/* Top bar */}
      <nav style={{ position: 'relative', zIndex: 2, maxWidth: '1100px', margin: '0 auto', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/landing" style={{ fontSize: '18px', fontWeight: 700, color: '#fff', textDecoration: 'none', letterSpacing: '-0.02em' }}>Surge</Link>
        <Link href="/agents" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>← Meet the team</Link>
      </nav>

      <section style={{ position: 'relative', zIndex: 2, maxWidth: '1100px', margin: '0 auto', padding: '24px 28px 80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px', alignItems: 'center', minHeight: '74vh' }}>
        {/* Orb on its stage */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px' }}>
          <div style={{ position: 'relative', width: 360, height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', background: `radial-gradient(circle, ${accent}66 0%, ${accent}22 38%, transparent 68%)`, filter: 'blur(30px)' }} />
            <PresenceOrb employeeId={agent.id} state={speaking ? 'talking' : 'idle'} size={300} analyser={analyser} onDark aria-label={`${agent.name} presence`} />
          </div>
          <button
            type="button"
            onClick={() => (speaking ? stop() : play(agent.spokenIntro))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', background: accent, color: '#0a0b10', border: 'none', borderRadius: '999px', padding: '12px 22px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: `0 8px 30px ${accent}55` }}
          >
            {speaking ? (
              <><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> Stop</>
            ) : (
              <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" /></svg> {agent.cta}</>
            )}
          </button>
          {agent.id === 'atlas' && (
            <Link href="/dashboard" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>or start a live conversation in your dashboard →</Link>
          )}
        </div>

        {/* Character copy */}
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: `1px solid ${accent}55`, background: `${accent}1a`, borderRadius: '999px', padding: '5px 12px', marginBottom: '18px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#cfe9d8' }}>Active</span>
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 7vw, 56px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>{agent.name}</h1>
          <p style={{ fontSize: '15px', fontWeight: 600, color: accent, marginTop: '8px', letterSpacing: '0.02em' }}>{agent.role}</p>
          <p style={{ fontSize: '21px', lineHeight: 1.45, color: '#fff', marginTop: '20px', fontWeight: 500 }}>{agent.tagline}</p>
          <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'rgba(232,234,240,0.72)', marginTop: '16px', maxWidth: '52ch' }}>{agent.intro}</p>

          <div style={{ marginTop: '26px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
            {agent.does.map((d) => (
              <div key={d} style={{ display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
                <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: `${accent}26`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <span style={{ fontSize: '14.5px', lineHeight: 1.5, color: 'rgba(232,234,240,0.86)' }}>{d}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '28px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '18px' }}>
            <span style={{ color: '#fff', fontWeight: 600 }}>Every number you see is real</span> — real leads, real booked jobs. No inflated dashboards, ever. You approve every message before it sends.
          </p>
        </div>
      </section>

      {/* Teammate switcher */}
      <div style={{ position: 'relative', zIndex: 2, maxWidth: '1100px', margin: '0 auto', padding: '0 28px 56px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {AGENT_ORDER.map((aid) => {
          const a = AGENTS[aid];
          const on = aid === agent.id;
          return (
            <Link key={aid} href={`/agents/${aid}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', border: `1px solid ${on ? a.color : 'rgba(255,255,255,0.12)'}`, background: on ? `${a.color}1f` : 'rgba(255,255,255,0.03)', borderRadius: '999px', padding: '8px 14px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.color, boxShadow: `0 0 8px ${a.color}` }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: on ? '#fff' : 'rgba(255,255,255,0.7)' }}>{a.name}</span>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{a.role}</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
