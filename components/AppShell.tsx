'use client';

import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import Sidebar from './Sidebar';
import CommandBar from './CommandBar';

const NO_SIDEBAR = ['/onboarding', '/', '/landing', '/login', '/signup'];

// Subscribe to the phone-width media query without setState-in-effect (SSR snapshot
// = desktop, so there's no hydration mismatch).
const MOBILE_MQ = '(max-width: 767px)';
function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR.includes(pathname) || pathname.startsWith('/legal');

  const isMobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_MQ).matches,
    () => false,
  );
  const [drawer, setDrawer] = useState(false);

  if (hideSidebar) return <>{children}</>;

  // ---- Desktop: fixed sidebar + scrolling main ----
  if (!isMobile) {
    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>{children}</main>
        <CommandBar />
      </div>
    );
  }

  // ---- Mobile: top bar + slide-in drawer ----
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, height: '56px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#fff' }}>S</div>
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>SURGE</span>
        </div>
        <button
          type="button"
          onClick={() => setDrawer((v) => !v)}
          aria-label={drawer ? 'Close menu' : 'Open menu'}
          aria-expanded={drawer}
          style={{ width: '44px', height: '44px', marginRight: '-8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {drawer ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
          </svg>
        </button>
      </header>

      {/* Scrim */}
      {drawer && (
        <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, top: '56px', background: 'rgba(17,24,39,0.4)', zIndex: 55 }} />
      )}

      {/* Drawer (the existing Sidebar, slid in). Closes on nav via onNavigate. */}
      <div style={{ position: 'fixed', top: 0, left: 0, height: '100dvh', zIndex: 60, transform: drawer ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.22s ease', boxShadow: drawer ? '0 0 40px rgba(0,0,0,0.18)' : 'none' }}>
        <Sidebar onNavigate={() => setDrawer(false)} />
      </div>

      <main style={{ background: 'var(--bg)' }}>{children}</main>
      <CommandBar />
    </div>
  );
}
