"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserPlus, MessageSquare, Zap, Check, ChevronDown, Menu, X } from "lucide-react";
import { SINGLE_LABEL, TEAM_LABEL, ALLOWANCES, HOUR_PRICES } from "@/lib/pricing.mjs";

// Plain-English "about N runs" derived from the hour math (no overpromising).
const SINGLE_RUNS = Math.round(ALLOWANCES.single / HOUR_PRICES.aria_run);
const TEAM_RUNS = Math.round(ALLOWANCES.team / HOUR_PRICES.aria_run);

// Contact-sales destination (placeholder — update to the real sales inbox).
const CONTACT_SALES_MAILTO = "mailto:hello@surge.app?subject=Surge%20Enterprise%20inquiry";

// ============================================================================
// DATA
// ============================================================================

interface Employee {
  name: string;
  role: string;
  initials: string;
  accent: string;
  description: string;
  stats: { label: string; value: string }[];
  tagline?: string;
}

const employees: Employee[] = [
  {
    name: "Aria",
    role: "Sales Representative",
    initials: "AR",
    accent: "#a78bfa",
    description: "Researches real prospects, scores every lead, and drafts the personalized outreach that books qualified meetings — you approve before anything sends.",
    stats: [
      { label: "Prospecting", value: "Daily" },
      { label: "Every lead scored", value: "0–100" },
      { label: "Follow-up cadence", value: "Day 3/7/14" },
    ],
  },
  {
    name: "Nova",
    role: "Marketing Director",
    initials: "NV",
    accent: "#34d399",
    description: "Writes posts, scripts, and campaigns native to every channel — in your brand voice, measured against a real metric.",
    stats: [
      { label: "Content & scripts", value: "Daily" },
      { label: "Every channel", value: "Native" },
      { label: "Every piece", value: "Measured" },
    ],
  },
  {
    name: "Opus",
    role: "Operations Assistant",
    initials: "OP",
    accent: "#60a5fa",
    description: "Documents your processes, preps complete handoff briefs, and tracks every task to closure — nothing falls through the cracks.",
    stats: [
      { label: "Tasks dropped", value: "0" },
      { label: "Every process", value: "Documented" },
      { label: "Every handoff", value: "Complete" },
    ],
  },
  {
    name: "Atlas",
    role: "Chief of Staff",
    initials: "AT",
    accent: "#f59e0b",
    tagline: "Included in every plan",
    description: "Briefs you every morning, turns your ideas into assigned work, and keeps the whole team moving. The reason the others run as a team.",
    stats: [
      { label: "Morning brief", value: "Daily" },
      { label: "Open loops dropped", value: "0" },
      { label: "The whole board", value: "Tracked" },
    ],
  },
];

const steps = [
  {
    icon: UserPlus,
    title: "Hire",
    description: "Pick one employee — or hire the whole team. Each one specializes in a different business function.",
  },
  {
    icon: MessageSquare,
    title: "Brief",
    description: "A 5-minute interview teaches them your business, voice, and goals. That's all they need.",
  },
  {
    icon: Zap,
    title: "They work",
    description: "Real tasks, real results, daily reports. Watch your business move while you focus elsewhere.",
  },
];

const upcomingEmployees = [
  { name: "Rex", role: "Recruiter", initials: "RX" },
  { name: "Clara", role: "Customer Service", initials: "CL" },
  { name: "Evan", role: "Executive Assistant", initials: "EV" },
  { name: "Piper", role: "Project Manager", initials: "PP" },
  { name: "Finn", role: "Finance Manager", initials: "FN" },
];

const plans = [
  {
    name: "Single Employee",
    price: SINGLE_LABEL,
    period: "/mo",
    description: "One working AI employee — run by your Chief of Staff",
    features: [
      "1 AI employee — Aria, Nova, or Opus",
      "Atlas, your Chief of Staff — included",
      `${ALLOWANCES.single} hours of employee time a month (about ${SINGLE_RUNS} prospecting runs)`,
      "Unlimited chat — talking to your team is always free",
      "Overtime anytime, so you never get stuck",
      "Daily morning brief & live dashboard",
    ],
    highlighted: false,
  },
  {
    name: "Hire the Team",
    price: TEAM_LABEL,
    period: "/mo",
    description: "Four employees — $250 each — run by a Chief of Staff",
    features: [
      "Aria, Nova & Opus — your full AI workforce",
      "Atlas, your Chief of Staff — included",
      `${ALLOWANCES.team} hours of team time a month (about ${TEAM_RUNS} prospecting runs)`,
      "Unlimited chat — talking to your team is always free",
      "Overtime anytime, so you never get stuck",
      "Priority support & custom training",
    ],
    highlighted: true,
    badge: "Most popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For larger teams with custom needs",
    features: [
      "Custom team size + Atlas",
      "Custom hour allowances",
      "Dedicated support",
      "Enterprise integrations",
      "SLA guarantee",
    ],
    highlighted: false,
  },
];

const faqs = [
  {
    question: "Is this just ChatGPT?",
    answer:
      "No. ChatGPT is a general assistant. Our AI employees are specialized agents trained on specific business functions — sales, marketing, operations — with persistent memory of YOUR business and a Chief of Staff who briefs you and routes their work. You don't prompt them. You manage them.",
  },
  {
    question: "What do they actually do?",
    answer:
      "Real work. Aria researches and scores real prospects, drafts personalized outreach, and works a follow-up cadence — you approve before anything sends. Nova writes posts, scripts, ad copy, and campaigns for every channel. Opus documents your processes, preps briefs, and tracks every task to closure. Atlas briefs you each morning and runs the team. They report daily — real numbers only.",
  },
  {
    question: "Is my data safe?",
    answer:
      "Your data is isolated per workspace, encrypted in transit and at rest, and never used to train other companies' employees. You can delete everything at any time. Enterprise plans include custom data residency options.",
  },
  {
    question: "Can I fire one?",
    answer:
      "Instantly. No two-week notice, no severance, no awkward conversations. Cancel anytime from your dashboard. Your AI employee stops working immediately, and you won't be charged again.",
  },
  {
    question: "How fast do I see results?",
    answer:
      "Most customers see their first completed tasks within 24 hours. Meaningful business impact — qualified leads, published content, streamlined operations — typically shows within the first week. We include onboarding support to get you there faster.",
  },
];

// ============================================================================
// HEADER
// ============================================================================

const NAV_LINKS: [string, string][] = [
  ["#team", "Team"],
  ["#pricing", "Pricing"],
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
            <Link href="/signup">Get started</Link>
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
          <Link
            href="/signup"
            onClick={() => setOpen(false)}
            className="block mt-2 text-center bg-primary text-primary-foreground rounded-lg py-3 text-base font-medium hover:bg-primary/90 transition-colors"
          >
            Get started
          </Link>
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
    <section className="relative min-h-[90vh] flex items-center justify-center px-6 py-24">
      <div className="max-w-4xl mx-auto text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight text-foreground text-balance"
        >
          Hire your AI workforce.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty"
        >
          AI employees that sell, market, and operate your business — 24/7, from
          {` ${SINGLE_LABEL} `}a month. No salaries. No turnover. No sick days.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10"
        >
          <Button
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25"
          >
            <Link href="/signup">Meet your team</Link>
          </Button>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 text-sm text-muted-foreground"
        >
          Early access — founding customers get direct input on the roster
        </motion.p>
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
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm"
            style={{ backgroundColor: employee.accent }}
          >
            {employee.initials}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{employee.name}</h3>
            <p className="text-sm text-muted-foreground">{employee.role}</p>
            {employee.tagline && (
              <span
                className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${employee.accent}1a`, color: employee.accent }}
              >
                {employee.tagline}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: employee.accent }}
          />
          <span className="text-xs text-muted-foreground">Active</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{employee.description}</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {employee.stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-lg font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
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
            Your team comes with a Chief of Staff.
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Three AI employees do the work. Atlas runs them — briefing you each morning
            and routing every task. No competitor ships a team that manages itself.
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
// HOW IT WORKS
// ============================================================================

function HowItWorks() {
  return (
    <section className="py-24 px-6 bg-card">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From hire to results in under 10 minutes.
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
// PERFORMANCE SCORE
// ============================================================================

function AnimatedRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-64 h-64 md:w-80 md:h-80">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 256 256">
        <circle
          cx="128"
          cy="128"
          r="120"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-border"
        />
        <motion.circle
          cx="128"
          cy="128"
          r="120"
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber target={score} />
        <p className="text-sm text-muted-foreground mt-1">out of 100</p>
      </div>
    </div>
  );
}

function AnimatedNumber({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    let start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [isInView, target]);

  return (
    <span ref={ref} className="text-5xl md:text-6xl font-bold text-foreground">
      {count}
    </span>
  );
}

function PerformanceScore() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Workforce Performance Score
            </h2>
            <p className="text-muted-foreground mb-6">
              One number that tells you your business is moving. Like an Oura Ring — but for your company.
            </p>
            <ul className="space-y-3">
              {[
                "Real-time performance metrics",
                "Daily progress reports",
                "Actionable insights",
                "Goal tracking",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex justify-center"
          >
            <AnimatedRing score={87} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// COMING SOON
// ============================================================================

function ComingSoon() {
  return (
    <section className="py-24 px-6 bg-card">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
            Coming soon
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            More AI employees joining the workforce.
          </p>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {upcomingEmployees.map((employee, index) => (
            <motion.div
              key={employee.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="bg-background rounded-xl p-5 border border-border text-center opacity-60"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium mx-auto mb-3">
                {employee.initials}
              </div>
              <h3 className="font-medium text-foreground text-sm">{employee.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{employee.role}</p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-4 w-full text-xs h-8 hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Link href="/signup">Join waitlist</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// PRICING
// ============================================================================

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Compare: A human hire costs $50,000+/year. Our AI employees? 93% less.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative rounded-2xl p-6 ${
                plan.highlighted
                  ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-105"
                  : "bg-card border border-border"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-medium px-3 py-1 rounded-full">
                  {plan.badge}
                </span>
              )}
              <div className="mb-6">
                <h3 className={`text-lg font-semibold ${plan.highlighted ? "" : "text-foreground"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mt-1 ${plan.highlighted ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>
              </div>
              <div className="mb-6">
                <span className={`text-4xl font-bold ${plan.highlighted ? "" : "text-foreground"}`}>
                  {plan.price}
                </span>
                <span className={plan.highlighted ? "text-primary-foreground/80" : "text-muted-foreground"}>
                  {plan.period}
                </span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check className={`w-4 h-4 ${plan.highlighted ? "" : "text-primary"}`} />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className={`w-full ${
                  plan.highlighted
                    ? "bg-white text-primary hover:bg-white/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                } transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}
              >
                {plan.price === "Custom" ? (
                  <a href={CONTACT_SALES_MAILTO}>Contact sales</a>
                ) : (
                  <Link href="/signup">Get started</Link>
                )}
              </Button>
            </motion.div>
          ))}
        </div>
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
    <section id="faq" className="py-24 px-6 bg-card">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
            Questions? Answered.
          </h2>
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
          Your first employee starts today.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-white/70 mb-10 max-w-xl mx-auto"
        >
          Start building your AI workforce now.
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
            <Link href="/signup">Meet your team</Link>
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
            <a href={CONTACT_SALES_MAILTO} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
        <Team />
        <HowItWorks />
        <PerformanceScore />
        <ComingSoon />
        <Pricing />
        <FAQ />
        <FinalCTA />
        <Footer />
      </div>
    </main>
  );
}
