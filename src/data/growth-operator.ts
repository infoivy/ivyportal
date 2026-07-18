/**
 * DFY Growth Operator — static doctrine for Portal Content Phase 1.
 * Grounded in Grow Acquisition / Ivy Operating Bible. No fake metrics.
 */

export type FunnelStage = "tof" | "mof";

export type SeedSlot = {
  /** 0 = Mon … 6 = Sun */
  dayOffset: number;
  stage: FunnelStage;
  title: string;
  hook: string;
  script: string;
  format: string;
  tags: string[];
};

/** Default week of reels for @abdulrahmankaderr / Ivy Sales Academy */
export const IVY_SEED_WEEK: SeedSlot[] = [
  {
    dayOffset: 0,
    stage: "tof",
    title: "Skill path for Muslim men",
    hook: "Nobody told Muslim brothers this about making money online.",
    script:
      "Nobody told Muslim brothers this about making money online.\n\nMost guys either grind a dead-end job, or they fall into haram shortcuts and fake gurus.\nThere's a third path: learn a real skill that companies pay for.\n\nAppointment setting is simple: you book sales calls for businesses. You get trained, you work a system, you get paid when you perform.\n\nI'm building Ivy Sales Academy for Muslim men who want that skill path with deen and standards intact.\nNot hype. Skill.\n\nIf that resonates, follow along.",
    format: "Reel",
    tags: ["tof", "identity", "education"],
  },
  {
    dayOffset: 1,
    stage: "tof",
    title: "Month one of setting",
    hook: "Month one of appointment setting almost broke me. Here's why.",
    script:
      "Month one of appointment setting almost broke me.\n\nNot because the skill is impossible. Because I thought motivation would carry me.\n\nWhat actually works: a daily system. Dials or DMs. Scripts. Feedback. Tracking.\nRejection is normal. Inconsistency is what kills you.\n\nIf you're a Muslim man learning sales skills, build the reps before you chase the highlight reel.\nFollow for the real path.",
    format: "Reel",
    tags: ["tof", "authority", "process"],
  },
  {
    dayOffset: 2,
    stage: "tof",
    title: "Building from Medina",
    hook: "Studying in Saudi. Building a company for Muslim setters.",
    script:
      "Studying in Saudi. Building a company for Muslim men who want remote sales skills.\n\nI started in appointment setting, learned the hard way inside someone else's system, then built Ivy Sales Academy with my partners so the training, standards, and job board fit our community.\n\nNot a guru story. A skill path.\nIf you're building quietly and seriously, you're not alone. Follow along.",
    format: "Reel",
    tags: ["tof", "story", "identity"],
  },
  {
    dayOffset: 3,
    stage: "tof",
    title: "3 traits that last",
    hook: "3 traits of brothers who actually last in appointment setting.",
    script:
      "3 traits of brothers who actually last in appointment setting.\n\nOne: coachable. You take feedback without ego.\nTwo: consistent. You hit the number on the days you don't feel like it.\nThree: honest. No fake screenshots, no haram shortcuts.\n\nPersonality is optional. Character and reps are not.\nFollow if you're building that way.",
    format: "Reel",
    tags: ["tof", "education", "values"],
  },
  {
    dayOffset: 4,
    stage: "mof",
    title: "What a setter day looks like",
    hook: "What a real setter day looks like (no fake $ screenshots).",
    script:
      "What a real setter day looks like.\n\nMorning: clear list, clear script, clear target.\nBlock for outreach. Track dials or DMs. Log every conversation.\nMidday: review objections, fix the openers that flopped.\nEnd of day: EOD numbers. Honest ones.\n\nThat's the skill. Not vibes.\nIf you want the full breakdown for Muslim men on this path, DM PATH.",
    format: "Reel",
    tags: ["mof", "process", "cta"],
  },
  {
    dayOffset: 5,
    stage: "mof",
    title: "I'm shy / not a salesman",
    hook: "\"I'm shy. I'm not a natural salesman.\" Good.",
    script:
      "\"I'm shy. I'm not a natural salesman.\"\n\nGood. Appointment setting is not about being the loudest person in the room.\nIt's scripts, listening, structure, and reps.\n\nSome of the best setters I know are quiet. They follow the process and they get better every week.\n\nIf that's you, you're not disqualified. You're coachable.\nDM PATH if you want the skill path we built for Muslim men.",
    format: "Reel",
    tags: ["mof", "objection", "cta"],
  },
  {
    dayOffset: 6,
    stage: "mof",
    title: "Building in public honestly",
    hook: "I'd rather show the real climb than fake 30-day Lambos.",
    script:
      "I'd rather show the real climb than fake 30-day Lambos.\n\nEarly company. Real costs. Real learning. One close at a time. Setters who need management. Content that has to be consistent.\n\nIf you're a Muslim man who wants a real remote skill, not a fantasy, you're in the right place.\nFollow, turn on alerts, and when you're ready, DM PATH.",
    format: "Reel",
    tags: ["mof", "honesty", "cta"],
  },
];

export type PlaybookSurface = "live" | "next" | "hermes";

/** Where the founder should operate this doctrine */
export type AppAction =
  "weekly" | "recording" | "hooks" | "calendar" | "seed" | "operator" | "none";

export type Playbook = {
  id: string;
  title: string;
  module: string;
  summary: string;
  localFile?: string;
  externalUrl?: string;
  phase: "profile" | "content" | "conversations" | "ads" | "leadership";
  /** live = already a dashboard workflow; next = building into UI; hermes = partner via chat */
  surface: PlaybookSurface;
  /** Content tab view to open when live */
  appAction: AppAction;
  /** Short DFY outcome the founder feels */
  dfy: string;
};

export const GROW_PLAYBOOKS: Playbook[] = [
  {
    id: "weekly-tof-mof",
    title: "TOF / MOF weekly calendar",
    module: "Planning",
    summary: "Mon–Thu top of funnel, Fri–Sun middle. 4 TOF + 3 MOF reels.",
    phase: "content",
    surface: "live",
    appAction: "weekly",
    dfy: "Open Weekly plan. Seed fills empty slots with real hooks + scripts.",
  },
  {
    id: "recording-day",
    title: "Recording day / batch film",
    module: "Publishing",
    summary: "Batch-record the 2-week horizon in one sitting (Grow reel SOP).",
    localFile: "loom/reel-sop.txt",
    externalUrl: "https://www.loom.com/share/a17c270a8e1c4274846fa55e6d76a1a6",
    phase: "content",
    surface: "live",
    appAction: "recording",
    dfy: "Open Recording day. Film what’s scripted, mark done in the pipeline.",
  },
  {
    id: "hooks-7",
    title: "7 hook frameworks",
    module: "Hooks",
    summary:
      "Call-out, pattern break, failed expectations, transformation, mechanism, cultural, one-liners.",
    localFile: "fathom/training-session-1.txt",
    phase: "content",
    surface: "live",
    appAction: "hooks",
    dfy: "Open Hook library. Save winners; Hermes can generate more on demand.",
  },
  {
    id: "ideation",
    title: "Ideation → pad → promote",
    module: "Planning",
    summary: "Turn calls, objections, wins into the ideation pad, then promote to slots.",
    localFile: "fathom/ideation-training.txt",
    phase: "content",
    surface: "live",
    appAction: "weekly",
    dfy: "Use ideation pad on Weekly plan. Promote MOF/TOF ideas into empty slots.",
  },
  {
    id: "exec-summary",
    title: "Order of ops (profile funnel stages)",
    module: "Onboarding",
    summary: "Profile → content system → open conversations → ads. Linear. No skipping.",
    localFile: "sops/1uzRtWjO-Mz6H86I2b6Ue1OzLDYW6xpmQfxRvG-4MQgo.txt",
    phase: "profile",
    surface: "live",
    appAction: "operator",
    dfy: "Use Growth Operator checklist. Stages are the product spine.",
  },
  {
    id: "start-here",
    title: "Start Here highlight builder",
    module: "Profile assets",
    summary: "10–25 slides: accolades → proof → backstory → bridge → after → CTA.",
    localFile: "loom/start-here-sop.txt",
    externalUrl: "https://www.loom.com/share/8458b430c3d94534bb32c39a63a8877b",
    phase: "profile",
    surface: "next",
    appAction: "none",
    dfy: "Coming: slide checklist wizard in-app. Until then Hermes drafts slides with you.",
  },
  {
    id: "carousel",
    title: "Pinned carousel builder",
    module: "Profile assets",
    summary: "Pinned carousel structure for the profile funnel.",
    localFile: "loom/carousel-framework-sop.txt",
    externalUrl: "https://www.loom.com/share/e713161a32c541c2a43ab7e7902082cb",
    phase: "profile",
    surface: "next",
    appAction: "none",
    dfy: "Coming: carousel slide builder. Hermes can draft frame-by-frame now.",
  },
  {
    id: "bio",
    title: "Bio lab (PATH)",
    module: "Profile assets",
    summary: "Approved Ivy bio: 3–5K claim + DM PATH. Revise ~every 1.5 months.",
    localFile: "loom/ig-bio-feedback-and-next-steps.txt",
    phase: "profile",
    surface: "next",
    appAction: "operator",
    dfy: "Checklist tracks bio. Next: in-app bio variants + approve.",
  },
  {
    id: "brand-kit",
    title: "Brand kit",
    module: "Brand",
    summary: "Visual system, voice, consistency across profile and creatives.",
    localFile: "sops/14afWu5IN0OGOo8wv-8SeLU7aYrYdNN94TlmiBu0_c5Q.txt",
    externalUrl: "https://fathom.video/share/aABYEi8LyJLVMMmKZnNDjT--w7scXq6t",
    phase: "content",
    surface: "next",
    appAction: "none",
    dfy: "Coming: brand tokens in founder settings driving creative defaults.",
  },
  {
    id: "hook-diagnostic",
    title: "Hook diagnostic",
    module: "Hooks",
    summary: "Diagnose weak hooks; documented vs undocumented content slides.",
    localFile: "fathom/hook-diagnostic-training.txt",
    phase: "content",
    surface: "next",
    appAction: "hooks",
    dfy: "Hook library is live; diagnostic scoring lands next on each hook card.",
  },
  {
    id: "reel-sop",
    title: "Post checklist (Stories + Mochi)",
    module: "Publishing",
    summary: "Post feed → Stories in 5–10 min → log Mochi → recycle winners.",
    localFile: "loom/reel-sop.txt",
    externalUrl: "https://www.loom.com/share/a17c270a8e1c4274846fa55e6d76a1a6",
    phase: "content",
    surface: "next",
    appAction: "recording",
    dfy: "Coming: one-click post checklist on each content item.",
  },
  {
    id: "creative-formats",
    title: "Creative / visual formats",
    module: "Creative",
    summary: "Camera angles and formats (talking head, Miro, vlog, etc.).",
    localFile: "loom/creative-sop-choose-your-visual-formats.txt",
    phase: "content",
    surface: "live",
    appAction: "weekly",
    dfy: "Creative types already on Weekly plan promote flow.",
  },
  {
    id: "story-sequences",
    title: "Story sequence studio",
    module: "Nurture",
    summary: "Multi-day story sequences for profile funnel nurture.",
    localFile: "fathom/story-sequences-training.txt",
    externalUrl: "https://gamma.app/docs/Story-Sequences-SOP-q9xt40t9z0a3cw2?mode=doc",
    phase: "content",
    surface: "next",
    appAction: "none",
    dfy: "Coming: sequence builder. Hermes runs sequences with you in chat for now.",
  },
  {
    id: "core-8020",
    title: "Core message 80/20",
    module: "Positioning",
    summary: "Lead with the outcome the market wants; mechanism second.",
    localFile: "fathom/core-message-8020.txt",
    phase: "content",
    surface: "hermes",
    appAction: "none",
    dfy: "Ask Hermes: strategist mode. Doctrine is in Operating Bible.",
  },
  {
    id: "formats-angles",
    title: "Content formats & angles",
    module: "Positioning",
    summary: "Visual aspects and angle library for reels and carousels.",
    localFile: "fathom/content-formats-angles.txt",
    phase: "content",
    surface: "hermes",
    appAction: "none",
    dfy: "Hermes applies angles when scripting; angle library UI later.",
  },
  {
    id: "follower-ads-p1",
    title: "Follower ads structure",
    module: "Ads (gated)",
    summary: "Campaign structure only after organic proof / asset threshold.",
    localFile: "sops/1XSZWIqMbwAl1MhpHioKJ1-3VdiFDozTcOIiY2qQDTLA.txt",
    phase: "ads",
    surface: "next",
    appAction: "none",
    dfy: "Locked until Growth Operator ads-gate is green. Hermes advises, doesn’t push spend.",
  },
  {
    id: "systems",
    title: "Think in systems",
    module: "Leadership",
    summary: "Funnels, backend, metrics: become a systemiser.",
    localFile: "fathom/systems-thinking.txt",
    phase: "leadership",
    surface: "hermes",
    appAction: "none",
    dfy: "Partner topic in chat. Dashboard already encodes systems (EOD, plan, CRM).",
  },
  {
    id: "bad-month",
    title: "Bad month leadership",
    module: "Leadership",
    summary: "Team motivation, EOM review, backend saving a weak frontend month.",
    localFile: "fathom/bad-month-leadership.txt",
    phase: "leadership",
    surface: "hermes",
    appAction: "none",
    dfy: "Use Portal EODs + Hermes ops brief. Full EOM wizard later on Overview.",
  },
  {
    id: "setter-ops",
    title: "Setter performance (real EODs)",
    module: "Conversations / sales",
    summary: "Who hit KPI, who missed EOD. Not Overview prop tiles.",
    phase: "conversations",
    surface: "live",
    appAction: "none",
    dfy: "Hermes Portal Ops every morning 06:05 + EODs page in Portal for the team.",
    externalUrl: "https://portal.ivysalesacademy.com/eods",
  },
];

export const SURFACE_LABEL: Record<PlaybookSurface, string> = {
  live: "In the dashboard now",
  next: "Becoming a product view",
  hermes: "Hermes partner (chat)",
};

/** 7 hook frameworks (Grow training-session-1) + Ivy-flavored starters */
export const HOOK_FRAMEWORKS: {
  id: string;
  name: string;
  blurb: string;
  examples: { stage: "tof" | "mof"; text: string }[];
}[] = [
  {
    id: "callout",
    name: "Call-out & identity",
    blurb: "Speak to Muslim men / remote skill seekers by pain or mechanism.",
    examples: [
      { stage: "tof", text: "If you're a Muslim man still applying to random remote jobs at 2am…" },
      { stage: "tof", text: "For brothers who want skill-based income, not guru fantasies…" },
    ],
  },
  {
    id: "pattern",
    name: "Pattern break / contrarian",
    blurb: "Break a belief the market holds.",
    examples: [
      { stage: "tof", text: "You'd think sales is for loud extroverts. Wrong." },
      { stage: "tof", text: "Degree first, then money? That's the slowest path for most of us." },
    ],
  },
  {
    id: "failed",
    name: "Failed expectations",
    blurb: "They tried something else and got burned.",
    examples: [
      {
        stage: "tof",
        text: "I thought another free YouTube course would fix my income. It didn't.",
      },
      {
        stage: "mof",
        text: "I thought appointment setting was just spam DMs. Then I learned the system.",
      },
    ],
  },
  {
    id: "transform",
    name: "Mini transformation",
    blurb: "Only real numbers. Soft if early-stage.",
    examples: [
      { stage: "tof", text: 'From "I need any remote job" to "I have a real skill path."' },
      { stage: "mof", text: "What changed when I treated setting like reps, not vibes." },
    ],
  },
  {
    id: "mechanism",
    name: "Unique mechanism",
    blurb: "Profile funnel / skill path in plain language.",
    examples: [
      {
        stage: "tof",
        text: "There's a skill companies pay for that most Muslim men never hear about.",
      },
      {
        stage: "mof",
        text: "The profile funnel in one sentence: content → profile → DMs → calls.",
      },
    ],
  },
  {
    id: "cultural",
    name: "Cultural / scene",
    blurb: "Relevant to deen-conscious remote builders (stay clean).",
    examples: [
      {
        stage: "tof",
        text: "Building a company from Medina hits different when the mission is clear.",
      },
      {
        stage: "tof",
        text: "Your circle doesn't get online skills. That doesn't mean you're crazy.",
      },
    ],
  },
  {
    id: "oneliner",
    name: "One-liner",
    blurb: "3–7 second insight + intrigue.",
    examples: [
      { stage: "tof", text: "Skill beats vibes. Every time." },
      { stage: "tof", text: "Consistency is the real flex in appointment setting." },
    ],
  },
];

/** Flat list of starter hooks for one-click seed into content_hooks */
export function ivyStarterHooks(): {
  text: string;
  funnel_stage: "tof" | "mof";
  category: string;
}[] {
  const out: { text: string; funnel_stage: "tof" | "mof"; category: string }[] = [];
  for (const f of HOOK_FRAMEWORKS) {
    for (const ex of f.examples) {
      out.push({ text: ex.text, funnel_stage: ex.stage, category: f.id });
    }
  }
  return out;
}

/** Extra doctrine titles so Playbooks shows the full Grow corpus feel */
export const EXTRA_DOCTRINE: Playbook[] = [
  {
    id: "ads-p2",
    title: "Follower ads part 2 · winners",
    module: "Ads",
    summary: "What to do when a creative wins.",
    localFile: "sops/1B-pvOfhEGCqETuT5Jw0Lk96Ys1-fzCxpXXYdutnutIc.txt",
    phase: "ads",
    surface: "hermes",
    appAction: "none",
    dfy: "Ask Hermes when you're ads-ready. Not the priority before organic is tight.",
  },
  {
    id: "ads-p3",
    title: "Follower ads part 3 · advanced",
    module: "Ads",
    summary: "Advanced follower ads strategy.",
    localFile: "sops/1_418lCYEz-dRcxbAe1gjBZi7MDc_CKwGVagvlVbsqdc.txt",
    phase: "ads",
    surface: "hermes",
    appAction: "none",
    dfy: "Hermes walks you through when gate opens.",
  },
  {
    id: "sales-script",
    title: "Sales / setting frameworks",
    module: "Sales",
    summary: "Sales session + DFY agency script patterns from GA packet.",
    localFile: "sops/1L-Naz6sPK1BQ2ImigKVbwafXG7sa5CbS7hs2YWinx8E.txt",
    phase: "conversations",
    surface: "hermes",
    appAction: "none",
    dfy: "Partner with Hermes + Abu Bilal on sales process; EODs track reality.",
  },
  {
    id: "testimonials",
    title: "Video testimonial questions",
    module: "Proof",
    summary: "Where were you / biggest shift / where now.",
    localFile: "sops/1gg-iqimQvwkwshRKT9E-9de4rK5khYt6p21ho6DZuhs.txt",
    phase: "content",
    surface: "hermes",
    appAction: "none",
    dfy: "Hermes drafts ask scripts; you record real students only with permission.",
  },
  {
    id: "client-success",
    title: "Client success & onboarding",
    module: "Fulfillment",
    summary: "Onboarding framework for clients after close.",
    localFile: "sops/1h8Ib0VjWKttqhSCHbe0RrpOAoXC1ToWTepxKZHj4i00.txt",
    phase: "leadership",
    surface: "hermes",
    appAction: "none",
    dfy: "Faizan lane + Hermes SOPs. Portal students surface is team ops.",
  },
  {
    id: "nik-strategy",
    title: "Business strategy with Nik",
    module: "Strategy",
    summary: "Content, mindset, and business strategy training.",
    localFile: "fathom/business-strategy-nik.txt",
    phase: "leadership",
    surface: "hermes",
    appAction: "none",
    dfy: "Strategy sessions with Hermes using this doctrine.",
  },
  {
    id: "differentiation",
    title: "Differentiation & unique style",
    module: "Positioning",
    summary: "How to differentiate and find your unique style.",
    localFile: "fathom/differentiation-training.txt",
    phase: "content",
    surface: "hermes",
    appAction: "none",
    dfy: "Ask Hermes strategist mode before a brand refresh.",
  },
  {
    id: "drop-in-qa",
    title: "Drop-in Q&A",
    module: "Training",
    summary: "Group Q&A themes from GA calls.",
    localFile: "fathom/drop-in-qa.txt",
    phase: "content",
    surface: "hermes",
    appAction: "none",
    dfy: "Hermes mines Q&A for content angles when you ask.",
  },
];

export function allPlaybooks(): Playbook[] {
  const seen = new Set<string>();
  const out: Playbook[] = [];
  for (const p of [...GROW_PLAYBOOKS, ...EXTRA_DOCTRINE]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

export const CHECKLIST_STORAGE_KEY = "ivy-funnel-checklist-v1";

export type ExampleLink = {
  label: string;
  url: string;
  kind: "profile" | "carousel" | "highlight" | "other";
};

export const GROW_EXAMPLES: ExampleLink[] = [
  { label: "sofiascales_", url: "https://www.instagram.com/sofiascales_/", kind: "profile" },
  { label: "kevinleong_bnb", url: "https://www.instagram.com/kevinleong_bnb/", kind: "profile" },
  { label: "aamerjanbeyy", url: "https://www.instagram.com/aamerjanbeyy/", kind: "profile" },
  { label: "daniel.budden", url: "https://www.instagram.com/daniel.budden/", kind: "profile" },
  { label: "dlucs_", url: "https://www.instagram.com/dlucs_/", kind: "profile" },
  { label: "steckogp", url: "https://www.instagram.com/steckogp/", kind: "profile" },
  {
    label: "Carousel example 1",
    url: "https://www.instagram.com/p/DTdTC-Rk773/",
    kind: "carousel",
  },
  {
    label: "Carousel example 2",
    url: "https://www.instagram.com/p/DTYbn1skta2/",
    kind: "carousel",
  },
  {
    label: "Carousel example 3",
    url: "https://www.instagram.com/p/DPR7A-7DiJE/",
    kind: "carousel",
  },
  {
    label: "Carousel example 4",
    url: "https://www.instagram.com/p/DURJ67IksCj/",
    kind: "carousel",
  },
  {
    label: "Start Here highlight sample",
    url: "https://www.instagram.com/stories/highlights/18107321104602781/",
    kind: "highlight",
  },
];

export type StageCheck = {
  id: string;
  label: string;
  detail: string;
  href?: string;
};

/** Static checklist — founder marks progress mentally; Phase 2 can persist */
export const FUNNEL_STAGE_CHECKS: StageCheck[] = [
  {
    id: "bio",
    label: "Bio live (PATH)",
    detail: "3–5K claim + DM PATH trigger",
    href: "https://www.instagram.com/abdulrahmankaderr/",
  },
  { id: "pfp", label: "Clear headshot", detail: "Well lit, confident, no logo mess" },
  { id: "start-here", label: "Start Here highlight", detail: "10–25 slides per SOP" },
  { id: "carousel", label: "Pinned carousel", detail: "Evergreen framework carousel" },
  {
    id: "highlights",
    label: "5 core highlights",
    detail: "Results first, lifestyle, about, value",
  },
  { id: "grid", label: "First 9 grid intentional", detail: "No random spam grid" },
  {
    id: "week-plan",
    label: "This week plan filled",
    detail: "7 reels with real hooks (not placeholders)",
  },
  { id: "recording", label: "Recording day habit", detail: "Batch film Thu / fixed day" },
  {
    id: "convos",
    label: "Open DM conversations",
    detail: "10–20 open when scaling conversations stage",
  },
  {
    id: "ads-gate",
    label: "Ads unlocked only later",
    detail: "After organic proof or asset threshold",
  },
];

export const CONTENT_PLAN_URL = "https://portal.ivysalesacademy.com/content?tab=plan";
export const DOCTRINE_NOTE =
  "Doctrine: Documents/knowledge/IVY_OPERATING_BIBLE.md · Catalog: GA_SOURCE_CATALOG.md";
