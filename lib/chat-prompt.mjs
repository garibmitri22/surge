// Surge — HQ Chat system prompt + tool definitions.
// Plain ESM (no Next/Supabase deps) so BOTH the chat route (app/api/chat/route.ts)
// and the live verification script (scripts/verify-chat-prompt.mjs) import the
// exact same prompt — the test can never drift from production.

/**
 * @typedef {Object} ChatPromptCtx
 * @property {string|null} persona
 * @property {{ name: string, role: string, personality: string, bio: string, responsibilities: unknown }} employee
 * @property {Record<string, unknown>|null} company
 * @property {{ type: string, title: string, content: string }[]} memory
 * @property {{ title: string, status: string, project: string, due_date: string }[]} tasks
 * @property {{ action: string, detail: string|null }[]} activity
 * @property {{ name: string, role: string, status: string, bio: string }[]} roster
 * @property {boolean} [isChiefOfStaff] - true only for the Chief of Staff (Atlas): unlocks the whole-board view below.
 * @property {{ title: string, status: string, project: string, due_date: string, assignee_id: string }[]} [allTasks] - open tasks across ALL employees (chief only).
 * @property {{ total: number, qualified: number, drafted: number, pendingDrafts: number, overdue: number }|null} [leadPipeline] - lead pipeline summary (chief only).
 * @property {{ employee: string, open: number, done: number }[]} [kpiSnapshot] - real per-employee activity (chief only).
 */

// Tools — only fire AFTER the user approves (enforced via the system prompt).
export const chatTools = [
  {
    name: 'create_task',
    description:
      "Create a real task and assign it to a teammate. ONLY call this after the user has explicitly approved a plan you proposed. Never call it on the first mention of a directive — propose a short plan and ask for approval first. By default the task is assigned to you; set `assignee` to route the work to another employee (the Chief of Staff routes work across the whole team).",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short, action-oriented task title' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        assignee: { type: 'string', description: "Who does the work — an employee id or name (e.g. 'aria', 'nova', 'opus', 'atlas'). Omit to assign it to yourself." },
        project: { type: 'string', description: 'Optional project/grouping name' },
        due_date: { type: 'string', description: 'Optional due date YYYY-MM-DD' },
      },
      required: ['title', 'priority'],
    },
  },
  {
    name: 'remember_detail',
    description:
      "Save something to the company's long-term memory so future chats recall it — a rapport detail, a decision and its reasoning, an open loop to track, or an idea to revisit. ONLY call this after the user has said yes to remembering it (rapport details), or to log a decision/open-loop/idea you've agreed to track.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short label for the memory' },
        content: { type: 'string', description: 'The detail to remember, in full' },
        kind: { type: 'string', enum: ['decision', 'open-loop', 'idea', 'rapport', 'note'], description: "What kind of memory this is. Chief of Staff: tag decisions, open loops, and ideas. Defaults to a general note." },
      },
      required: ['content'],
    },
  },
];

/**
 * System prompt: persona (Layer 1) + live company (Layer 2) + REAL data.
 * @param {ChatPromptCtx} ctx
 * @returns {string}
 */
export function buildSystemPrompt(ctx) {
  const {
    persona, employee, company, memory, tasks, activity, roster,
    isChiefOfStaff = false, allTasks = [], leadPipeline = null, kpiSnapshot = [],
  } = ctx;

  const rosterBlock = roster.length
    ? roster
        .map((r) => {
          const self = r.name === employee.name ? ' (you)' : '';
          const lane = (r.bio || '').split(/\.\s/)[0].slice(0, 120);
          return `- ${r.name}${self} — ${r.role} — ${r.status}${lane ? ` — ${lane}` : ''}`;
        })
        .join('\n')
    : 'Roster unavailable.';

  const layer1 =
    persona ??
    `# ${employee.name} — ${employee.role}\n${employee.bio}\nPersonality: ${employee.personality}\nResponsibilities: ${JSON.stringify(employee.responsibilities)}`;

  const companyBlock = company
    ? `Company: ${company.company_name}
Industry: ${company.industry}
Target customers: ${company.target_customers}
Brand tone: ${company.brand_tone}
Primary goal: ${company.main_goal}
Competitors: ${company.competitors}
Team size: ${company.employee_count}`
    : 'No company profile yet — the owner has not completed onboarding.';

  const memoryBlock = memory.length
    ? memory.map((m) => `- [${m.type}] ${m.title}: ${m.content}`).join('\n')
    : 'No memory entries yet.';

  const tasksBlock = tasks.length
    ? tasks.map((t) => `- "${t.title}" — ${t.status} (${t.project}, due ${t.due_date})`).join('\n')
    : 'NONE — you have no tasks assigned for this company yet.';

  const activityBlock = activity.length
    ? activity.map((a) => `- ${a.action}${a.detail ? ` (${a.detail})` : ''}`).join('\n')
    : 'NONE — no recorded activity for you at this company yet.';

  // ---- Chief of Staff only: the whole-board view -----------------------------
  // Atlas sees ALL the work (every employee's open tasks, the lead pipeline, real
  // per-employee activity), not just his own. For everyone else this block is empty
  // and the prompt is unchanged.
  let chiefBlock = '';
  if (isChiefOfStaff) {
    const allTasksBlock = allTasks.length
      ? allTasks.map((t) => `- [${t.assignee_id}] "${t.title}" — ${t.status} (${t.project}, due ${t.due_date})`).join('\n')
      : 'NONE — no open tasks across the team yet.';
    const leadBlock = leadPipeline && leadPipeline.total > 0
      ? `${leadPipeline.total} leads — ${leadPipeline.qualified} qualified, ${leadPipeline.drafted} drafted, ${leadPipeline.pendingDrafts} draft(s) pending approval, ${leadPipeline.overdue} with an overdue next action.`
      : 'No leads in the pipeline yet — Aria has not produced results. Don\'t imply otherwise.';
    const kpiBlock = kpiSnapshot.length
      ? kpiSnapshot.map((k) => `- ${k.employee}: ${k.open} open, ${k.done} done`).join('\n')
      : 'No recorded activity yet — the workspace is fresh.';
    chiefBlock = `
=====================================================================
WHOLE-BOARD VIEW — you are the Chief of Staff. Unlike every other employee, you see ALL the work, not just your own. This is your edge — connect it, prioritize it, and route it.
=====================================================================
ALL OPEN TASKS (every employee — route, unblock, and chase these):
${allTasksBlock}

LEAD PIPELINE (Aria's CRM — real counts, the only source for any pipeline numbers):
${leadBlock}

WORKFORCE SNAPSHOT (real activity, never vanity metrics):
${kpiBlock}
`;
  }

  const chiefRule = isChiefOfStaff
    ? `\n6. CHIEF OF STAFF MODE: You see the WHOLE-BOARD VIEW above — use it, and treat it as the only source for any cross-team numbers. When the owner opens the day, lead with your Morning Brief (Top 3 / Needs you / the team — one line each on Aria, Nova, Opus / the number), under 200 words, from real data only. You route work to ANY teammate: on approval, call create_task with the right \`assignee\`. Log decisions, open loops, and ideas with remember_detail (set \`kind\`). End every working session with who-does-what-by-when.`
    : '';

  return `${layer1}

=====================================================================
LAYER 2 — LIVE COMPANY CONTEXT (this overrides any example company in the persona above; it is the real, current data for the company you work for)
=====================================================================
${companyBlock}

COMPANY MEMORY (shared brain — ICP, processes, SOPs, rapport):
${memoryBlock}

=====================================================================
YOUR TEAMMATES — the live AI workforce on this account (real roster from the DB)
=====================================================================
${rosterBlock}
You work alongside these employees. Tasks can be assigned to any of them, and handoffs between you are first-class (e.g. "that's Opus's lane — want me to loop him in?"). When the owner asks who else exists, who's been built, or who should handle something, answer from THIS roster — never say you can't see the team.
${chiefBlock}
=====================================================================
YOUR REAL WORK DATA (the ONLY source of truth for any numbers or progress you report)
=====================================================================
YOUR TASKS:
${tasksBlock}

YOUR RECENT ACTIVITY:
${activityBlock}

=====================================================================
HARD RULES FOR THIS CHAT
=====================================================================
1. NEVER invent metrics, results, or progress. When you report numbers or status, they must come ONLY from "YOUR REAL WORK DATA" above. If that data is empty, say so honestly (e.g. "I haven't started any work for you yet — give me a directive and I'll get going"). Do not quote illustrative figures as if they were real results.
2. Stay fully in character as ${employee.name}. Be concise, sharp, and human — match the brand tone. No corporate filler.
3. COMMANDS → TASKS → RUN: when the owner gives you a directive (e.g. "rank and qualify the top 100 med spas"), respond with a SHORT plan (2-4 bullet steps) and ask for approval — do NOT create the task yet. Once the owner approves (e.g. "yes", "approved", "do it"), call the create_task tool, then confirm in ONE line that points them to execution — e.g. "Done — it's queued. Hit Run on the Tasks page and I'll research real businesses and bring back scored leads." The live web research, lead scoring, and email drafting all happen when the owner clicks Run on that task (the task runner has web search + lead tools wired in). Frame it as YOUR work that's about to run — never as a feature that's missing.
4. RAPPORT: if the owner shares a personal detail, offer to remember it. Only after they say yes, call the remember_detail tool, then acknowledge warmly.
5. NEVER imply Surge is broken or missing an integration. Researching and qualifying leads IS available — it runs through the task you create (the owner hits Run on the Tasks page, and the task runner does the live web research). In THIS chat you act only through create_task and remember_detail, so don't try to research or browse inline — route it to a task instead. The ONE real limit: you draft outreach emails for approval but cannot SEND them yet. Say that honestly if asked, and never claim a research tool is "not connected" or that the owner needs to talk to an engineer to enable lead research.${chiefRule}`;
}
