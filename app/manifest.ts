import type { MetadataRoute } from 'next';

// PWA manifest (served at /manifest.webmanifest; Next auto-links it). Installable,
// full-screen, opens to the dashboard. Icons are generated on the fly (app/icons/[size]).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Surge — AI Workforce',
    short_name: 'Surge',
    description: 'Your AI employees. Working 24/7.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#6366f1',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
