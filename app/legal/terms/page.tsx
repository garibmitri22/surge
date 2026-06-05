import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service — Surge' };

const EFFECTIVE = 'June 5, 2026';

const h2: React.CSSProperties = { fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '10px' };
const p: React.CSSProperties = { fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' };
const li: React.CSSProperties = { ...p, marginBottom: '6px' };

export default function TermsPage() {
  return (
    <article>
      <h1 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>Terms of Service</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '24px' }}>Last updated {EFFECTIVE}</p>

      <p style={p}>These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Surge (&ldquo;Surge,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;), an AI workforce platform that provides AI &ldquo;employees&rdquo; to help you run sales, marketing, and operations. By creating an account or using the service, you agree to these Terms.</p>

      <h2 style={h2}>1. The service</h2>
      <p style={p}>Surge provides AI agents that research, draft, and organize work on your behalf, coordinated by a Chief of Staff agent. The AI assists you; it does not replace your judgment. You direct and approve the work, and you remain responsible for what you send or publish.</p>

      <h2 style={h2}>2. Your account</h2>
      <p style={p}>You must provide accurate information and keep your credentials secure. You are responsible for activity under your account. You must be able to form a binding contract to use Surge.</p>

      <h2 style={h2}>3. Acceptable use</h2>
      <p style={li}>• Do not use Surge for anything illegal, deceptive, or harmful.</p>
      <p style={li}>• When using outbound email or other outreach, you must comply with all applicable laws, including the CAN-SPAM Act and similar regulations: accurate sender and subject lines, a valid physical address, and a working unsubscribe that you honor. Surge includes these by default, but you are responsible for lawful use.</p>
      <p style={li}>• Do not send to people who have opted out, scrape prohibited sources, or misrepresent who you are.</p>
      <p style={li}>• Do not attempt to break, overload, or reverse-engineer the service.</p>

      <h2 style={h2}>4. AI output</h2>
      <p style={p}>AI-generated content can be inaccurate or incomplete. You are responsible for reviewing and approving anything before it is sent, published, or relied upon. Outbound messages are drafted for your approval and are not sent without the controls described in our documentation. We are not liable for actions taken based on AI output you approve.</p>

      <h2 style={h2}>5. Plans, hours, and billing</h2>
      <p style={p}>Surge is sold in plans that include a monthly allowance of AI working time, measured in hours. Conversations with your team are free; work consumes hours. When a plan&rsquo;s hours are used up, you may purchase additional hours (&ldquo;overtime&rdquo;) or upgrade. Prices and allowances are shown in the product and may change with notice. When paid billing is enabled, fees are billed in advance and are non-refundable except where required by law.</p>

      <h2 style={h2}>6. Your data</h2>
      <p style={p}>You own the business information and content you provide. You grant us a limited license to process it solely to operate and improve the service for you. We do not sell your data and we do not use your business data to train AI models. See our <a href="/legal/privacy" style={{ color: 'var(--accent)' }}>Privacy Policy</a>.</p>

      <h2 style={h2}>7. Service availability &amp; warranties</h2>
      <p style={p}>The service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, to the maximum extent permitted by law. We do not warrant that the service will be uninterrupted, error-free, or that AI output will meet your requirements.</p>

      <h2 style={h2}>8. Limitation of liability</h2>
      <p style={p}>To the maximum extent permitted by law, Surge will not be liable for any indirect, incidental, special, or consequential damages, or for lost profits or revenues. Our total liability for any claim is limited to the amount you paid us in the three months before the claim.</p>

      <h2 style={h2}>9. Termination</h2>
      <p style={p}>You may stop using Surge at any time. We may suspend or terminate access for violation of these Terms or to protect the service. You can delete your data from within the product, or request account deletion via the contact below.</p>

      <h2 style={h2}>10. Changes</h2>
      <p style={p}>We may update these Terms. Material changes will be communicated through the product or by email, and continued use after changes take effect constitutes acceptance.</p>

      <h2 style={h2}>11. Governing law</h2>
      <p style={p}>These Terms are governed by the laws of the State of Texas, USA, without regard to conflict-of-laws rules, unless your local law requires otherwise.</p>

      <h2 style={h2}>12. Contact</h2>
      <p style={p}>Questions about these Terms: <a href="mailto:support@getsurgehq.com" style={{ color: 'var(--accent)' }}>support@getsurgehq.com</a>.</p>
    </article>
  );
}
