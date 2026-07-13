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

export type Playbook = {
  id: string;
  title: string;
  module: string;
  summary: string;
  localFile?: string;
  externalUrl?: string;
  phase: "profile" | "content" | "conversations" | "ads" | "leadership";
};

export const GROW_PLAYBOOKS: Playbook[] = [
  {
    id: "exec-summary",
    title: "Exec summary / order of ops",
    module: "Onboarding",
    summary: "Profile → content system → open conversations → ads. Linear. No skipping.",
    localFile: "sops/1uzRtWjO-Mz6H86I2b6Ue1OzLDYW6xpmQfxRvG-4MQgo.txt",
    phase: "profile",
  },
  {
    id: "start-here",
    title: "Start Here highlight SOP",
    module: "Profile assets",
    summary:
      "10–25 slides: accolades → proof → backstory → bridge → after → CTA + carousel repost.",
    localFile: "loom/start-here-sop.txt",
    externalUrl: "https://www.loom.com/share/8458b430c3d94534bb32c39a63a8877b",
    phase: "profile",
  },
  {
    id: "carousel",
    title: "Carousel framework",
    module: "Profile assets",
    summary: "Pinned carousel structure for the profile funnel.",
    localFile: "loom/carousel-framework-sop.txt",
    externalUrl: "https://www.loom.com/share/e713161a32c541c2a43ab7e7902082cb",
    phase: "profile",
  },
  {
    id: "bio",
    title: "Bio optimisation (Isaiah)",
    module: "Profile assets",
    summary: "Approved Ivy bio pattern: 3–5K claim + DM PATH. Revise ~every 1.5 months.",
    localFile: "loom/ig-bio-feedback-and-next-steps.txt",
    phase: "profile",
  },
  {
    id: "brand-kit",
    title: "Brand kit",
    module: "Brand",
    summary: "Visual system, voice, consistency across profile and creatives.",
    localFile: "sops/14afWu5IN0OGOo8wv-8SeLU7aYrYdNN94TlmiBu0_c5Q.txt",
    externalUrl: "https://fathom.video/share/aABYEi8LyJLVMMmKZnNDjT--w7scXq6t",
    phase: "content",
  },
  {
    id: "hooks-7",
    title: "7 hook frameworks",
    module: "Hooks",
    summary:
      "Call-out, pattern break, failed expectations, transformation, mechanism, cultural, one-liners.",
    localFile: "fathom/training-session-1.txt",
    phase: "content",
  },
  {
    id: "hook-diagnostic",
    title: "Hook diagnostic",
    module: "Hooks",
    summary: "Diagnose weak hooks; documented vs undocumented content slides.",
    localFile: "fathom/hook-diagnostic-training.txt",
    phase: "content",
  },
  {
    id: "reel-sop",
    title: "Reel distribution SOP",
    module: "Publishing",
    summary: "Batch record, post, Stories in 5–10 min, recycle winners, track metrics.",
    localFile: "loom/reel-sop.txt",
    externalUrl: "https://www.loom.com/share/a17c270a8e1c4274846fa55e6d76a1a6",
    phase: "content",
  },
  {
    id: "creative-formats",
    title: "Creative / visual formats",
    module: "Creative",
    summary: "Choose camera angles and formats (talking head, Miro, vlog, etc.).",
    localFile: "loom/creative-sop-choose-your-visual-formats.txt",
    phase: "content",
  },
  {
    id: "story-sequences",
    title: "Story sequences",
    module: "Nurture",
    summary: "In-depth story sequence systems for profile funnel nurture.",
    localFile: "fathom/story-sequences-training.txt",
    externalUrl: "https://gamma.app/docs/Story-Sequences-SOP-q9xt40t9z0a3cw2?mode=doc",
    phase: "content",
  },
  {
    id: "ideation",
    title: "Ideation training",
    module: "Planning",
    summary: "Turn calls, objections, and wins into a content engine.",
    localFile: "fathom/ideation-training.txt",
    phase: "content",
  },
  {
    id: "core-8020",
    title: "Core message 80/20",
    module: "Positioning",
    summary: "Lead with the outcome the market wants; mechanism second.",
    localFile: "fathom/core-message-8020.txt",
    phase: "content",
  },
  {
    id: "formats-angles",
    title: "Content formats & angles",
    module: "Positioning",
    summary: "Visual aspects and angle library for reels and carousels.",
    localFile: "fathom/content-formats-angles.txt",
    phase: "content",
  },
  {
    id: "follower-ads-p1",
    title: "Follower ads part 1 — structure",
    module: "Ads (later)",
    summary: "Campaign structure and decision framework. Unlock after organic works.",
    localFile: "sops/1XSZWIqMbwAl1MhpHioKJ1-3VdiFDozTcOIiY2qQDTLA.txt",
    phase: "ads",
  },
  {
    id: "systems",
    title: "How to think in systems",
    module: "Leadership",
    summary: "Funnels, backend, metrics: become a systemiser.",
    localFile: "fathom/systems-thinking.txt",
    phase: "leadership",
  },
  {
    id: "bad-month",
    title: "Bad month leadership",
    module: "Leadership",
    summary: "Team motivation, EOM review, backend saving a weak frontend month.",
    localFile: "fathom/bad-month-leadership.txt",
    phase: "leadership",
  },
];

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
