'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import CommandBar from './CommandBar';

const NO_SIDEBAR = ['/onboarding', '/', '/landing', '/login', '/signup'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR.includes(pathname);

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {children}
      </main>
      <CommandBar />
    </div>
  );
}
