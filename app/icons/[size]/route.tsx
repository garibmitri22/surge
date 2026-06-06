import { ImageResponse } from 'next/og';

// Generates the Surge "S" mark as PNG at the sizes the manifest needs — no binary
// asset files to maintain. /icons/192, /icons/512, /icons/maskable.
// Maskable: full-bleed indigo with the S inside the safe zone (no rounded corners,
// the OS applies its own mask).
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const maskable = size === 'maskable';
  const px = size === '192' ? 192 : 512;
  const fontSize = maskable ? Math.round(px * 0.5) : Math.round(px * 0.62);
  const radius = maskable ? 0 : Math.round(px * 0.19);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#6366f1',
          color: '#ffffff',
          fontSize,
          fontWeight: 800,
          borderRadius: radius,
          fontFamily: 'sans-serif',
        }}
      >
        S
      </div>
    ),
    { width: px, height: px },
  );
}
