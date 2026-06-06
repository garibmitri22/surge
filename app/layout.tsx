import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Surge — AI Workforce Platform",
  description: "Your AI employees. Working 24/7.",
  manifest: "/manifest.webmanifest",
  // iOS doesn't read the manifest for these — Next emits the apple-mobile-web-app meta.
  appleWebApp: { capable: true, title: "Surge", statusBarStyle: "default" },
  // Next 16 emits the modern `mobile-web-app-capable`; add the legacy apple flag too
  // so older iOS launches full-screen from the home screen.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
