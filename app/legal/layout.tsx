import Link from 'next/link';

// Public legal pages (Terms / Privacy). Standalone, light theme, no app chrome.
// NOTE FOR MITRI: these are solid, accurate starting policies — have counsel review
// and confirm the legal entity name + registered address before charging the first
// customer. Content is written to match what the product actually does.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/landing" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#fff' }}>S</div>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>SURGE</span>
          </Link>
          <nav style={{ display: 'flex', gap: '18px', fontSize: '13px' }}>
            <Link href="/legal/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms</Link>
            <Link href="/legal/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy</Link>
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px 80px' }}>{children}</main>
    </div>
  );
}
