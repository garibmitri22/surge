"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserPlus, MessageSquare, Zap, Check, ChevronDown } from "lucide-react";

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
}

const employees: Employee[] = [
  {
    name: "Aria",
    role: "Sales Representative",
    initials: "AR",
    accent: "#a78bfa",
    description: "Qualifies leads, sends follow-ups, and books qualified meetings while you sleep.",
    stats: [
      { label: "Leads qualified", value: "847" },
      { label: "Meetings booked", value: "156" },
      { label: "Response rate", value: "34%" },
    ],
  },
  {
    name: "Nova",
    role: "Marketing Director",
    initials: "NV",
    accent: "#34d399",
    description: "Creates campaigns, writes copy, and grows your audience daily.",
    stats: [
      { label: "Campaigns live", value: "23" },
      { label: "Content pieces", value: "412" },
      { label: "Engagement", value: "+127%" },
    ],
  },
  {
    name: "Opus",
    role: "Operations Assistant",
    initials: "OP",
    accent: "#60a5fa",
    description: "Manages workflows, organizes data, and keeps everything running.",
    stats: [
      { label: "Tasks completed", value: "2,341" },
      { label: "Hours saved", value: "168/mo" },
      { label: "Accuracy", value: "99.7%" },
    ],
  },
];

const steps = [
  {
    icon: UserPlus,
    title: "Hire",
    description: "Pick your AI employee from our roster. Each one specializes in a different business function.",
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
    price: "$399",
    period: "/mo",
    description: "One AI hire, fully onboarded to your business",
    features: [
      "1 AI employee — Aria, Nova, or Opus",
      "Works a full workday, every day",
      "Daily reports & live dashboard",
      "Email support",
    ],
    highlighted: false,
  },
  {
    name: "Hire the Team",
    price: "$999",
    period: "/mo",
    description: "Your whole AI workforce — the way Surge is meant to run",
    features: [
      "All 3 AI employees — Aria, Nova & Opus",
      "Your whole team works a full workday, every day",
      "Real-time Workforce Performance Score",
      "Priority support",
      "Custom training on your business",
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
      "Unlimited employees",
      "Higher capacity & custom quotas",
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
      "No. ChatGPT is a general assistant. Our AI employees are specialized agents trained on specific business functions — sales, marketing, operations — with persistent memory, workflow automation, and direct integrations into your tools. They don't wait for prompts. They work.",
  },
  {
    question: "What do they actually do?",
    answer:
      "Real work. Aria qualifies leads, sends follow-ups, and books qualified meetings. Nova writes blog posts, manages social media, creates ad copy, and analyzes campaigns. Opus handles data entry, schedules, email management, and operational workflows. They report daily.",
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

function Header() {
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
        <nav className="hidden md:flex items-center gap-8">
          <a href="#team" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Team
          </a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </a>
          <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>
        <Button
          asChild
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Link href="/signup">Get started</Link>
        </Button>
      </div>
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
          className="text-5xl md:text-7xl font-semibold tracking-tight text-foreground text-balance"
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
          $399 a month. No salaries. No turnover. No sick days.
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
      <div className="grid grid-cols-3 gap-4">
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
            Meet the team
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Three AI employees ready to work for your business today.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
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
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
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
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
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
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
