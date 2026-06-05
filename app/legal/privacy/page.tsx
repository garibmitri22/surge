import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy — Surge' };

const EFFECTIVE = 'June 5, 2026';

const h2: React.CSSProperties = { fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '10px' };
const p: React.CSSProperties = { fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' };
const li: React.CSSProperties = { ...p, marginBottom: '6px' };

export default function PrivacyPage() {
  return (
    <article>
      <h1 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>Privacy Policy</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '24px' }}>Last updated {EFFECTIVE}</p>

      <p style={p}>This policy explains what Surge (&ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, how we use it, and the choices you have. We built Surge so your business knowledge makes your AI team smarter — and we treat that knowledge as yours.</p>

      <h2 style={h2}>What we collect</h2>
      <p style={li}>• <strong>Account data:</strong> your email and authentication details.</p>
      <p style={li}>• <strong>Company brain:</strong> the profile, ICP, offer, brand voice, goals, notes, and other knowledge you (or your AI team) save.</p>
      <p style={li}>• <strong>Work data:</strong> conversations with your AI employees, tasks, leads, drafts, and usage/cost telemetry needed to run and meter the service.</p>
      <p style={li}>• We do not intentionally collect sensitive personal categories; please don&rsquo;t put them into the product.</p>

      <h2 style={h2}>How we use it</h2>
      <p style={p}>We use your data only to provide and improve the service for you: running your AI employees, personalizing their work to your business, generating your dashboard and briefings, and metering usage. We do not sell your data, and we do not use your business data to train AI models.</p>

      <h2 style={h2}>Who processes it (subprocessors)</h2>
      <p style={li}>• <strong>Supabase</strong> — database and authentication hosting. Your data is stored here, encrypted in transit and at rest, and isolated per account.</p>
      <p style={li}>• <strong>Anthropic</strong> — the AI models powering your employees. Data sent to Anthropic&rsquo;s API is not used to train their models.</p>
      <p style={li}>• <strong>Resend</strong> — outbound email delivery, used only when you enable the email channel.</p>
      <p style={p}>These providers process data on our behalf under their own terms and security commitments.</p>

      <h2 style={h2}>Security &amp; isolation</h2>
      <p style={p}>Data is encrypted in transit (TLS) and at rest. Access is scoped per account at the database level (row-level security), so one customer&rsquo;s data is not visible to another. We restrict internal access to what is needed to operate the service.</p>

      <h2 style={h2}>Email &amp; outreach</h2>
      <p style={p}>If you enable the email channel, outbound messages include a valid physical address and a working unsubscribe link. Unsubscribes are recorded and honored automatically, and we maintain a suppression list so opted-out recipients are not contacted again.</p>

      <h2 style={h2}>Retention &amp; your choices</h2>
      <p style={p}>You can delete individual memory entries, reset your company profile, or remove company data from within the product. To request full account deletion, contact us and we will delete your data within a reasonable period, except where we must retain it to comply with law.</p>

      <h2 style={h2}>Your rights</h2>
      <p style={p}>Depending on where you live, you may have rights to access, correct, export, or delete your personal data. Contact us to exercise them and we will respond as required by applicable law.</p>

      <h2 style={h2}>Changes</h2>
      <p style={p}>We may update this policy; material changes will be communicated through the product or by email.</p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>Privacy questions or requests: <a href="mailto:support@getsurgehq.com" style={{ color: 'var(--accent)' }}>support@getsurgehq.com</a>.</p>
    </article>
  );
}
