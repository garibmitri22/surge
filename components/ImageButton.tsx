'use client';

import { useRef } from 'react';

// Downscale a picked image to a sane size (phone photos are multi-MB) and return a
// base64 JPEG data URL. Keeps the request small while staying clear enough for vision.
async function toDownscaledDataUrl(file: File, max = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas context');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Attach an image to a chat message (camera or gallery on mobile). Calls onImage with
// a downscaled base64 data URL; the parent stores it and sends it with the next message.
export function ImageButton({ onImage, disabled }: { onImage: (dataUrl: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { onImage(await toDownscaledDataUrl(file)); } catch { /* ignore unreadable image */ }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        aria-label="Attach image"
        title="Attach image"
        style={{
          flexShrink: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)',
          color: 'var(--text-secondary)', cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.5-3.5a2 2 0 0 0-3 0L5 21" />
        </svg>
      </button>
      <input ref={ref} type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
    </>
  );
}
