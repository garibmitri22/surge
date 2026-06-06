import { ImageResponse } from 'next/og';

// apple-touch-icon (iOS home screen). Next auto-adds the <link>. 180×180, solid
// indigo with the S (iOS applies its own rounded mask, so keep it full-bleed-ish).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          fontSize: 112,
          fontWeight: 800,
          fontFamily: 'sans-serif',
        }}
      >
        S
      </div>
    ),
    size,
  );
}
