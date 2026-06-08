"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClipboardList, PenLine, CalendarCheck, Check, ChevronDown, Menu, X } from "lucide-react";
import { CinematicBackground } from "@/components/CinematicBackground";
import { PresenceOrb } from "@/components/PresenceOrb";

// First motion is a conversation, not self-serve. All primary CTAs point here.
// (Placeholder — swap for the real booking link / Calendly when it's live.)
const BOOK_CALL = "mailto:hello@surgehq.io?subject=Book%20a%2015-minute%20Surge%20walkthrough";
const CONTACT_MAILTO = "mailto:hello@surgehq.io?subject=Surge%20inquiry";

// ============================================================================
// DATA
// ============================================================================

interface Employee {
  name: string;
  role: string;
  initials: string;
  accent: string;
  description: string;
  badge?: string;
}

// Outcome-first. No fake "Active" status, no invented stats. Not-yet-live roles are honestly
// badged "Coming" — never implied as live (NORTH-STAR).
const employees: Employee[] = [
  {
    name: "Aria",
    role: "Lead Gen & Sales",
    initials: "AR",
    accent: "#a78bfa",
    description:
      "Researches and rebooks leads, answers new ones in minutes, drafts personalized outreach in your voice, and books qualified appointments. You approve before anything sends.",
  },
  {
    name: "Atlas",
    role: "Chief of Staff",
    initials: "AT",
    accent: "#f59e0b",
    badge: "Included",
    description: "Runs the team and briefs you each morning on what got done and what needs you next — so nothing slips.",
  },
  {
    name: "Nova",
    role: "Marketing",
    initials: "NV",
    accent: "#34d399",
    badge: "Beta",
    description:
      "Drafts on-brand content and campaigns to keep your name in front of your market. In beta.",
  },
  {
    name: "Opus",
    role: "Operations",
    initials: "OP",
    accent: "#60a5fa",
    description: "Preps a one-pager for every booked meeting and tracks each task to closure.",
  },
  {
    name: "Reception",
    role: "Calls & front desk",
    initials: "RC",
    accent: "#22d3ee",
    badge: "Coming",
    description:
      "Answers and places calls — books and reschedules by phone so you never miss a customer.",
  },
];

const steps = [
  {
    icon: ClipboardList,
    title: "We load your list",
    description: "Your old quotes and past customers — the revenue you already own.",
  },
  {
    icon: PenLine,
    title: "Aria drafts in your voice",
    description: "She researches and writes the outreach; you review and approve a batch.",
  },
  {
    icon: CalendarCheck,
    title: "Appointments get booked",
    description: "They land on your calendar — and you only start paying once they do.",
  },
];

const offerFeatures = [
  "Researches & rebooks your old quotes and past customers — revenue from a list you already own, no ad spend.",
  "Answers every new lead in under 2 minutes, 24/7 — in home services, speed wins the job.",
  "On-brand marketing that keeps your name in front of your market — Nova, in beta.",
  "You approve every message before it sends. Nothing goes out you wouldn't say yourself.",
  "Weekly results report — appointments booked, jobs in motion. Every number is real, never inflated.",
  "White-glove setup — tuned to your business and your voice, then it runs hands-off.",
  "Phone reception that answers and books calls — coming next.",
  "Month-to-month. Cancel anytime. You close the jobs; we fill your calendar.",
];

const faqs = [
  {
    question: "Is this just ChatGPT?",
    answer:
      "No. ChatGPT is a general assistant. Surge is a specialized AI workforce with persistent memory of your business — your customers, your voice, your jobs — that takes real action: researches and rebooks leads, drafts outreach, books appointments, and keeps your marketing going. You don't prompt it. You approve it.",
  },
  {
    question: "What does it actually do?",
    answer:
      "Your team works the whole funnel: Aria researches and rebooks old quotes, answers every new lead in under two minutes, drafts in your voice, and books qualified appointments; Nova (beta) drafts on-brand marketing; Atlas runs the team and briefs you daily. Phone reception is coming next. You approve before anything sends, and you close the jobs. Every number in your weekly report is real — never inflated.",
  },
  {
    question: "What does it cost?",
    answer:
      "$1,500/mo founding rate, locked for life. You pay nothing until qualified appointments are booked on your calendar. Month-to-month, cancel anytime.",
  },
  {
    question: "Do I still close the jobs?",
    answer:
      "Yes. You're the expert on your work and your pricing. Surge finds and books qualified appointments; you do what you already do best.",
  },
  {
    question: "How fast do I see results?",
    answer:
      "We start with the list you already own, so the first booked appointments can come within days — revenue from customers you already have, with no ad spend.",
  },
  {
    question: "Is my data safe?",
    answer:
      "Your data is isolated per business, encrypted in transit and at rest, and never used to train anyone else's. You can delete everything at any time.",
  },
];

// ============================================================================
// HEADER
// ============================================================================

const NAV_LINKS: [string, string][] = [
  ["#how", "How it works"],
  ["#offer", "Pricing"],
  ["#faq", "FAQ"],
];

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/landing" className="text-xl font-semibold text-foreground tracking-tight">
          Surge
        </Link>

        {/* Desktop nav + CTA */}
        <div className="hidden md:flex items-center gap-8">
          <nav className="flex items-center gap-8">
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {label}
              </a>
            ))}
          </nav>
          <Button
            asChild
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <a href={BOOK_CALL}>Book a walkthrough</a>
          </Button>
        </div>

        {/* Mobile hamburger (44px tap target) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="md:hidden inline-flex items-center justify-center h-11 w-11 -mr-2 rounded-lg text-foreground hover:bg-muted transition-colors"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <nav className="md:hidden border-t border-border bg-background/95 backdrop-blur-lg px-6 pb-4 pt-1">
          {NAV_LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block py-3 text-base text-foreground hover:text-primary transition-colors"
            >
              {label}
            </a>
          ))}
          <a
            href={BOOK_CALL}
            onClick={() => setOpen(false)}
            className="block mt-2 text-center bg-primary text-primary-foreground rounded-lg py-3 text-base font-medium hover:bg-primary/90 transition-colors"
          >
            Book a walkthrough
          </a>
        </nav>
      )}
    </motion.header>
  );
}

// ============================================================================
// HERO
// ============================================================================

function Hero() {
  return (
    <section
      className="relative flex items-start justify-center overflow-hidden px-6"
      style={{ minHeight: "90vh", background: "#05060a" }}
    >
      {/* Living, code-rendered atmospheric stage — no video, all shader. */}
      <CinematicBackground color="#f59e0b" intensity={1.0} />

      {/* Top-aligned so the orb always reads first, even on shorter screens. */}
      <div className="relative z-10 max-w-4xl mx-auto text-center" style={{ paddingTop: "clamp(40px, 7vh, 96px)", paddingBottom: 64 }}>
        {/* Atlas — the living presence, on its stage. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="flex justify-center mb-8"
        >
          <div style={{ position: "relative", width: 188, height: 188, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", width: 188, height: 188, borderRadius: "50%", background: "radial-gradient(circle, #f59e0b66 0%, #f59e0b22 40%, transparent 68%)", filter: "blur(26px)" }} />
            <PresenceOrb employeeId="atlas" state="idle" size={188} onDark aria-label="Surge — your AI team" />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-sm font-medium uppercase tracking-wide mb-5"
          style={{ color: "#f59e0b" }}
        >
          Done-for-you AI growth · Home services
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight text-balance"
          style={{ color: "#ffffff" }}
        >
          We find, message, and book your next customers.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 text-lg md:text-xl max-w-2xl mx-auto text-pretty"
          style={{ color: "rgba(236,238,244,0.86)" }}
        >
          Surge staffs your business with an AI workforce — it researches and rebooks your old quotes,
          answers every new lead in under two minutes, drafts on-brand marketing, and books qualified
          appointments. You approve every message. <span style={{ color: "#fff", fontWeight: 500 }}>You pay nothing until qualified appointments are booked on your calendar.</span>
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25"
          >
            <a href={BOOK_CALL}>See it on your list — book 15 min</a>
          </Button>
          <Link
            href="/agents"
            className="inline-flex items-center gap-2 rounded-md border px-6 py-3 text-base font-medium transition-colors"
            style={{ borderColor: "rgba(255,255,255,0.16)", color: "#fff" }}
          >
            Meet the team →
          </Link>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Real numbers. Never faked. Founding-customer rate: <span style={{ color: "#fff", fontWeight: 500 }}>$1,500/mo, locked for life.</span>
        </motion.p>
      </div>
    </section>
  );
}

// ============================================================================
// HOW IT WORKS
// ============================================================================

function HowItWorks() {
  return (
    <section id="how" className="py-24 px-6 bg-card">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">How it works</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            We start with the list you already own — and you only pay once appointments are landing.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
                <step.icon className="w-7 h-7" />
              </div>
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// TEAM
// ============================================================================

function EmployeeCard({ employee, index }: { employee: Employee; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm"
          style={{ backgroundColor: employee.accent }}
        >
          {employee.initials}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{employee.name}</h3>
            {employee.badge && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${employee.accent}1a`, color: employee.accent }}
              >
                {employee.badge}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{employee.role}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{employee.description}</p>
    </motion.div>
  );
}

function Team() {
  return (
    <section id="team" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
            The team behind your results
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            One AI workforce, run for you. You approve the work; they fill your calendar.
          </p>
        </motion.div>
        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {employees.map((employee, index) => (
            <EmployeeCard key={employee.name} employee={employee} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// PROOF  (replaces the invented "87" performance score)
// ============================================================================

function Proof() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-semibold text-foreground mb-5"
        >
          We show you the money, not a dashboard.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-muted-foreground text-lg leading-relaxed"
        >
          Every week you see exactly what your AI team did — appointments booked, jobs in motion, and the
          revenue in play. Counts you can open into the real lead, the real message, the real booked
          meeting. No vanity scores.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          {["Appointments booked", "Jobs in motion", "Revenue in play"].map((label) => (
            <span
              key={label}
              className="text-sm font-medium text-foreground bg-card border border-border rounded-full px-4 py-2"
            >
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// THE OFFER  (replaces the 3-tier pricing menu)
// ============================================================================

function Offer() {
  return (
    <section id="offer" className="py-24 px-6 bg-card">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-3">One engine. One price.</h2>
          <p className="text-muted-foreground">No menu, no per-seat math. One done-for-you outcome.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative rounded-2xl p-8 bg-background border border-border shadow-xl shadow-primary/10"
        >
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
            Founding rate
          </span>

          <h3 className="text-xl font-semibold text-foreground">Done-for-you AI Growth Engine</h3>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-5xl font-bold text-foreground">$1,500</span>
            <span className="text-muted-foreground">/mo</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Founding rate, locked for life{" "}
            <span className="text-muted-foreground/80">(standard rate becomes $2,500–5,000)</span>
          </p>
          <p className="mt-4 text-sm font-medium text-foreground bg-primary/10 rounded-lg px-4 py-3">
            You pay nothing until qualified appointments are booked on your calendar.
          </p>

          <ul className="space-y-3 mt-6 mb-8">
            {offerFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            asChild
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <a href={BOOK_CALL}>Book a 15-minute walkthrough</a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FAQ
// ============================================================================

function FAQItem({ faq, index }: { faq: (typeof faqs)[0]; index: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="border-b border-border"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left group"
      >
        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
          {faq.question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <p className="pb-5 text-muted-foreground text-sm leading-relaxed">{faq.answer}</p>
      </motion.div>
    </motion.div>
  );
}

function FAQ() {
  return (
    <section id="faq" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">Questions? Answered.</h2>
        </motion.div>
        <div>
          {faqs.map((faq, index) => (
            <FAQItem key={faq.question} faq={faq} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FINAL CTA
// ============================================================================

function FinalCTA() {
  return (
    <section className="py-24 px-6 bg-[#0f172a]">
      <div className="max-w-4xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-5xl font-semibold text-white mb-6 text-balance"
        >
          Your list is full of jobs you haven&rsquo;t booked yet.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-white/70 mb-10 max-w-xl mx-auto"
        >
          Let me show you on your actual customers — you pay nothing until appointments are landing.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Button
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25"
          >
            <a href={BOOK_CALL}>Book a 15-minute walkthrough</a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================

function Footer() {
  return (
    <footer className="py-12 px-6 bg-background border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">Surge</span>
            <span className="text-muted-foreground text-sm">© 2026</span>
          </div>
          <nav className="flex items-center gap-6">
            <a href="/legal/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="/legal/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </a>
            <a href={CONTACT_MAILTO} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16">
        <Hero />
        <HowItWorks />
        <Team />
        <Proof />
        <Offer />
        <FAQ />
        <FinalCTA />
        <Footer />
      </div>
    </main>
  );
}
