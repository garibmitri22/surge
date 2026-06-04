// Avatar component — clean placeholder style until AI-generated portraits are added
// Each character has a distinct gradient + initial that feels premium, not generic

const avatarStyles: Record<string, { gradient: string; initials: string; textColor: string }> = {
  aria: {
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    initials: 'AR',
    textColor: '#fff',
  },
  nova: {
    gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    initials: 'NV',
    textColor: '#fff',
  },
  opus: {
    gradient: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
    initials: 'OP',
    textColor: '#fff',
  },
};

const pipelineStyles: Record<string, { gradient: string; initials: string }> = {
  recruiter: { gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)', initials: 'RX' },
  cs:        { gradient: 'linear-gradient(135deg, #db2777 0%, #f472b6 100%)', initials: 'CL' },
  ea:        { gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)', initials: 'EV' },
  pm:        { gradient: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)', initials: 'PP' },
  finance:   { gradient: 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)', initials: 'FN' },
};

export function EmployeeAvatar({ id, size = 48 }: { id: string; size?: number }) {
  const style = avatarStyles[id] || pipelineStyles[id];
  const radius = size <= 36 ? '50%' : '12px';
  const fontSize = size <= 28 ? Math.floor(size * 0.35) : size <= 48 ? Math.floor(size * 0.28) : Math.floor(size * 0.24);

  if (!style) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius,
        background: 'linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: '800', color: '#fff',
        letterSpacing: '-0.5px', userSelect: 'none',
      }}>?</div>
    );
  }

  const initials = size <= 28 ? style.initials[0] : style.initials;

  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: style.gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize, fontWeight: '800', color: 'textColor' in style ? style.textColor : '#fff',
      letterSpacing: '-0.5px', userSelect: 'none', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
