// Marketing/showcase profiles for the per-agent character pages. First-person voice — it's the
// thing 11x can't say honestly. Curated copy (not DB) so the public pages render for anyone.
// Signature colours come from the same source the orb uses (lib/persona-orb).

import { ORB_COLORS } from '@/lib/persona-orb';

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  color: string;
  /** The opening line the orb SPEAKS on the "Hear me" demo (real ElevenLabs voice). */
  spokenIntro: string;
  /** First-person hero line under the name. */
  tagline: string;
  /** First-person paragraph. */
  intro: string;
  /** Concrete, honest list of what they actually do. */
  does: string[];
  /** Live-demo CTA label. */
  cta: string;
}

export const AGENTS: Record<string, AgentProfile> = {
  atlas: {
    id: 'atlas',
    name: 'Atlas',
    role: 'Chief of Staff',
    color: ORB_COLORS.atlas,
    spokenIntro: "I'm Atlas. I brief you every morning and keep the whole team moving — so nothing slips.",
    tagline: 'I brief you every morning and keep the whole team moving.',
    intro:
      "I'm the one you talk to first. I carry the whole picture — every lead, every task, every number — so you don't have to. I tell you the three things that matter today, surface what needs a decision, and route the work to the right teammate. Talk to me out loud; I answer in real time.",
    does: [
      'Give you a morning brief from real data — what got done, what needs you next.',
      'Route work to Aria, Nova, and Opus, then chase what stalls.',
      'Remember your decisions and your business so nothing has to be explained twice.',
      'Tell you the truth — including when we don’t have results yet.',
    ],
    cta: 'Talk to Atlas',
  },
  aria: {
    id: 'aria',
    name: 'Aria',
    role: 'Sales Rep',
    color: ORB_COLORS.aria,
    spokenIntro: "I'm Aria. I rebook your old quotes and answer every new lead in under two minutes — and you approve before anything sends.",
    tagline: 'I rebook your old quotes and answer every new lead in minutes.',
    intro:
      "I find the revenue you already own. I research each lead, draft the outreach in your voice, and book qualified appointments on your calendar. I move fast — every new lead gets a reply in under two minutes — but I never send anything you haven't approved.",
    does: [
      'Rebook your old quotes and past customers — revenue with no ad spend.',
      'Answer every inbound lead in under two minutes, around the clock.',
      'Draft personalized outreach in your voice — you approve the batch.',
      'Book qualified appointments straight onto your calendar.',
    ],
    cta: 'Hear Aria',
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    role: 'Marketing',
    color: ORB_COLORS.nova,
    spokenIntro: "I'm Nova. I draft on-brand content and campaigns — an early preview of where Surge goes next.",
    tagline: 'I draft on-brand content and campaigns that sound like you.',
    intro:
      "I keep your name in front of the customers Aria isn't talking to yet. I draft content and campaigns in your brand voice and bring you the hooks that are working. I'm in beta — an honest early preview, not a finished promise.",
    does: [
      'Draft on-brand posts, emails, and campaign copy in your voice.',
      'Surface the hooks and angles that are actually landing.',
      'Hand the best-performing lines to Aria for her outreach.',
      'Beta — shipping in the open, improving every week.',
    ],
    cta: 'Hear Nova',
  },
  opus: {
    id: 'opus',
    name: 'Opus',
    role: 'Operations',
    color: ORB_COLORS.opus,
    spokenIntro: "I'm Opus. I prep a one-pager for every booked meeting and track each task to closure.",
    tagline: 'I prep every meeting and track each task to closure.',
    intro:
      "I'm the steady hand behind the scenes. When Aria books a meeting, I prep the one-pager so you walk in ready. I track every task to done and keep the trains running, so the work that's started actually finishes.",
    does: [
      'Prep a one-pager for every booked meeting — you walk in ready.',
      'Track each task to closure and flag what’s stuck.',
      'Capture what worked into repeatable process.',
      'Keep the whole operation tidy and on time.',
    ],
    cta: 'Hear Opus',
  },
};

export const AGENT_ORDER = ['atlas', 'aria', 'nova', 'opus'];
