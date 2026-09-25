import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { DocSectionHeader, type DocSection } from "@/components/doc-shell";
import { cn } from "@/lib/utils";

/**
 * DM Setter Playbook (founder-directed 2026-09-25): the full DM setting system
 * in the order a conversation happens. Ground rules the founder set:
 * DM setters work organic Instagram leads in Mochi only (never logged into
 * Instagram itself), money never comes up in the Instagram DMs (Meta flags
 * it), outbound is paused unless approved, and the Typeform funnel belongs to
 * the phone setters. Copy is written to be pasted, so keep it lowercase and
 * natural, and never add em dashes.
 */

export const PLAYBOOK_SECTIONS: DocSection[] = [
  { id: "pb-job", label: "The job" },
  { id: "pb-leads", label: "Who you're talking to" },
  { id: "pb-toolkit", label: "Your toolkit" },
  { id: "pb-speed", label: "Leads and speed" },
  { id: "pb-open", label: "Your first reply" },
  { id: "pb-situation", label: "His situation" },
  { id: "pb-problem", label: "His goal and problem" },
  { id: "pb-help", label: "Value and wanting help" },
  { id: "pb-checks", label: "The checks" },
  { id: "pb-pitch", label: "Pitch and number" },
  { id: "pb-links", label: "The two links" },
  { id: "pb-examples", label: "Full conversations" },
  { id: "pb-nofit", label: "Not a fit" },
  { id: "pb-review", label: "Review and warm-up" },
  { id: "pb-triage", label: "Triage call" },
  { id: "pb-noshow", label: "Reminders and no-shows" },
  { id: "pb-aftercall", label: "After the call" },
  { id: "pb-followups", label: "Follow-ups" },
  { id: "pb-objections", label: "Questions and objections" },
  { id: "pb-rules", label: "Rules" },
  { id: "pb-day", label: "Your day" },
  { id: "pb-numbers", label: "Your numbers" },
  { id: "pb-dayone", label: "Day one" },
  { id: "pb-outbound", label: "Outbound (paused)" },
];

const TICKS_KEY = "isa-dm-playbook-ticks";
const QUIZ_KEY = "isa-dm-playbook-check";
const PASS_MARK = 11;

/* ─────────────────────────── building blocks ─────────────────────────── */

/** Renders "[placeholder]" segments as dashed chips and "\n" as line breaks. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).map((part, i) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <span
            key={i}
            className="whitespace-nowrap border-b border-dashed border-current font-mono text-[0.86em] opacity-80"
          >
            {part}
          </span>
        ) : (
          part.split("\n").map((line, j) => (
            <Fragment key={`${i}-${j}`}>
              {j > 0 && <br />}
              {line}
            </Fragment>
          ))
        ),
      )}
    </>
  );
}

type BubbleKind = "me" | "them" | "wa";

const BUBBLE: Record<BubbleKind, string> = {
  me: "rounded-[19px] rounded-br-[6px] bg-primary text-primary-foreground",
  them: "rounded-[19px] rounded-bl-[6px] bg-muted text-foreground",
  wa: "rounded-[12px] rounded-tr-[4px] bg-success-bg text-foreground",
};

function Bubble({
  kind,
  text,
  srLabel,
  className,
}: {
  kind: BubbleKind;
  text: string;
  srLabel?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "px-3.5 py-2 text-body leading-[1.42] [overflow-wrap:anywhere]",
        BUBBLE[kind],
        className,
      )}
    >
      {srLabel && <span className="sr-only">{srLabel}</span>}
      <Rich text={text} />
    </p>
  );
}

function Tag({ children, wa }: { children: ReactNode; wa?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-[6px] px-1.5 py-1 font-mono text-micro font-medium uppercase leading-none tracking-[0.08em]",
        wa ? "bg-success-bg text-success-fg" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, [state]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
  };
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={copy}
      className={cn("rounded-full px-3 text-caption", state === "done" && "text-success-fg")}
    >
      {state === "done" ? "Copied" : state === "failed" ? "Select it" : "Copy"}
    </Button>
  );
}

type Script = { tag?: string; ctx: string; text: string };

function ScriptList({ items }: { items: Script[] }) {
  return (
    <div className="mt-4 border-t border-border">
      {items.map((s, i) => {
        const wa = s.tag === "WhatsApp";
        return (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-border py-3.5"
          >
            <div className="col-span-2 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
              <Tag wa={wa}>{s.tag ?? "DM"}</Tag>
              <span>{s.ctx}</span>
            </div>
            <Bubble
              kind={wa ? "wa" : "me"}
              text={s.text}
              className="max-w-full justify-self-start sm:max-w-[580px]"
            />
            <CopyButton text={s.text} />
          </div>
        );
      })}
    </div>
  );
}

type ConvoLine = { he: string } | { you: string } | { note: string; warn?: boolean };

function Convo({ label, lines }: { label: string; lines: ConvoLine[] }) {
  return (
    <div
      aria-label={label}
      className="mt-3 flex max-w-[620px] flex-col gap-1.5 rounded-[22px] border border-border bg-card p-3.5 sm:p-5"
    >
      {lines.map((l, i) =>
        "note" in l ? (
          <p
            key={i}
            className={cn(
              "self-center py-1.5 text-center font-mono text-micro font-medium uppercase leading-relaxed tracking-[0.06em]",
              l.warn ? "text-warning-fg" : "text-muted-foreground",
            )}
          >
            <Rich text={l.note} />
          </p>
        ) : "you" in l ? (
          <Bubble
            key={i}
            kind="me"
            text={l.you}
            srLabel="You: "
            className="max-w-[90%] self-end sm:max-w-[84%]"
          />
        ) : (
          <Bubble
            key={i}
            kind="them"
            text={l.he}
            srLabel="He: "
            className="max-w-[90%] self-start sm:max-w-[84%]"
          />
        ),
      )}
    </div>
  );
}

function Section({
  id,
  no,
  title,
  children,
}: {
  id: string;
  no: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <DocSectionHeader kicker={no} title={title} />
      {children}
    </section>
  );
}

function Part({ no, title }: { no: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 border-t border-border pt-8">
      <span className="font-mono text-micro font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {no}
      </span>
      <span className="text-xl font-semibold tracking-tight">{title}</span>
    </div>
  );
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-2 max-w-[62ch] text-body leading-6 text-foreground/85">{children}</p>;
}

function Sub({ children }: { children: ReactNode }) {
  return <h3 className="mt-10 text-title">{children}</h3>;
}

function SubNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 max-w-[62ch] text-caption leading-5 text-muted-foreground">{children}</p>
  );
}

function Tip({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <p className="mt-3 max-w-[64ch] text-body leading-6 text-muted-foreground">
      {title && <b className="font-semibold text-foreground/80">{title} </b>}
      {children}
    </p>
  );
}

function Box({ title, warn, children }: { title: string; warn?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "mt-6 rounded-xl p-5",
        warn
          ? "border border-border bg-card shadow-[inset_2px_0_0_0_var(--warning)]"
          : "border border-border bg-card",
      )}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1.5 max-w-[64ch] text-body leading-6 text-foreground/85">{children}</p>
    </div>
  );
}

function Ticks({ items, kind }: { items: ReactNode[]; kind: "yes" | "no" | "dot" }) {
  return (
    <ul className="mt-3 max-w-[75ch] border-t border-border">
      {items.map((item, i) => (
        <li
          key={i}
          className="relative border-b border-border py-2.5 pl-7 text-body leading-6 text-foreground/85"
        >
          {kind === "yes" ? (
            <Check className="absolute left-0.5 top-3.5 h-4 w-4 text-success" />
          ) : kind === "no" ? (
            <X className="absolute left-0.5 top-3.5 h-4 w-4 text-danger" />
          ) : (
            <span className="absolute left-1.5 top-[1.15rem] h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          )}
          {item}
        </li>
      ))}
    </ul>
  );
}

function Rail({
  tone,
  className,
  children,
}: {
  tone: "green" | "amber" | "red";
  className?: string;
  children: ReactNode;
}) {
  const rail =
    tone === "green"
      ? "shadow-[inset_2px_0_0_0_var(--success)]"
      : tone === "amber"
        ? "shadow-[inset_2px_0_0_0_var(--warning)]"
        : "shadow-[inset_2px_0_0_0_var(--danger)]";
  return (
    <div className={cn("rounded-xl border border-border bg-card", rail, className)}>{children}</div>
  );
}

function Chips({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <li
          key={c}
          className={cn(
            "rounded-full px-2.5 py-1.5 text-caption leading-none",
            muted ? "bg-muted text-foreground/80" : "border border-border bg-card",
          )}
        >
          {c}
        </li>
      ))}
    </ul>
  );
}

function useStoredRecord<T>(key: string) {
  const [value, setValue] = useState<Record<string, T>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as Record<string, T>);
    } catch {}
  }, [key]);
  const update = (k: string, v: T) =>
    setValue((prev) => {
      const next = { ...prev, [k]: v };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  const reset = () => {
    setValue({});
    try {
      localStorage.removeItem(key);
    } catch {}
  };
  return { value, update, reset };
}

type CheckItem = { id: string; title: string; text?: string; meta: string };

function Checklist({
  items,
  ticks,
  onTick,
}: {
  items: CheckItem[];
  ticks: Record<string, boolean>;
  onTick: (id: string, on: boolean) => void;
}) {
  return (
    <ol className="mt-4 border-t border-border">
      {items.map((it) => {
        const on = !!ticks[it.id];
        return (
          <li key={it.id} className="border-b border-border">
            <label
              htmlFor={`pb-${it.id}`}
              className="grid cursor-pointer grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3.5 py-3.5"
            >
              <input
                id={`pb-${it.id}`}
                type="checkbox"
                checked={on}
                onChange={(e) => onTick(it.id, e.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--success)]"
              />
              <span
                className={cn(
                  "text-body leading-6",
                  on ? "text-muted-foreground" : "text-foreground/85",
                )}
              >
                <strong
                  className={cn(
                    "font-semibold",
                    on ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {it.title}
                </strong>
                {it.text ? ` ${it.text}` : ""}
              </span>
              <span className="whitespace-nowrap pt-0.5 font-mono text-caption text-muted-foreground">
                {it.meta}
              </span>
            </label>
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────────────────────────── content ─────────────────────────────── */

const JOURNEY = [
  {
    title: "The conversation",
    text: "He replies to a post with PATH or another keyword, or replies to one of our stories. You find out where he lives, what he does, what he wants and what's stopping him.",
    where: "DM",
  },
  {
    title: "The checks",
    text: "Where he lives, 18+, a laptop, wants a skill. No money talk in the DMs.",
    where: "DM",
  },
  {
    title: "His WhatsApp number",
    text: "It's how we send the link, confirm, remind and triage.",
    where: "DM",
  },
  {
    title: "The right booking link",
    text: "Soft link if he's already shown he's a fit, hard link if not. The form asks the money questions, so you never have to.",
    where: "WhatsApp",
  },
  {
    title: "Review and warm-up",
    text: "Check his form, confirm, send the pre-call video, keep him warm until the call.",
    where: "WhatsApp",
  },
  {
    title: "Triage, only if flagged",
    text: "Mainly a $0–$1,000 answer. He stays if he has at least $1,000 he can invest without borrowing.",
    where: "Phone",
  },
  { title: "Consultation call", text: "The closer runs it and makes the offer.", where: "Closer" },
  {
    title: "After the call",
    text: "Welcome the ones who join. Stay in touch with the rest.",
    where: "WhatsApp",
  },
];

const TOOLKIT: CheckItem[] = [
  {
    id: "kit-offer",
    title: "The offer doc.",
    text: "What's in the mentorship, who it's for, the price. The price is for you, never for the DMs.",
    meta: "Read",
  },
  {
    id: "kit-convos",
    title: "10+ good conversations.",
    text: "Screenshots of real chats that booked. Read how they sound.",
    meta: "Read",
  },
  {
    id: "kit-keywords",
    title: "The keyword list.",
    text: "Every keyword we're running (PATH and the others), which post it's on, and what that post promised him.",
    meta: "Read",
  },
  {
    id: "kit-links",
    title: "Both booking links.",
    text: "The soft link and the hard link.",
    meta: "Links",
  },
  {
    id: "kit-mochi",
    title: "Mochi.",
    text: "Where you talk to leads, tag them, see their history and send the videos. You're never logged into Instagram itself.",
    meta: "Access",
  },
  {
    id: "kit-whatsapp",
    title: "The team WhatsApp.",
    text: "Links, confirmations, reminders and triage all go out from it.",
    meta: "Access",
  },
  {
    id: "kit-tracker",
    title: "The tracker, the EOD form and the team chat.",
    text: "The chat is for questions and handoff notes to the closer.",
    meta: "Access",
  },
];

const DAY_ONE: CheckItem[] = [
  {
    id: "d1-read",
    title: "Read this page top to bottom.",
    text: "Say the scripts out loud once.",
    meta: "2 hrs",
  },
  {
    id: "d1-recall",
    title: "From memory, write the conversation steps in order and the 4 checks.",
    text: "Then check yourself against the page.",
    meta: "10 min",
  },
  {
    id: "d1-dm-roleplay",
    title: "DM role-plays with your manager.",
    text: "A hijra lead who replied with PATH, a retail worker who asks the price first, and a brother who lives outside our countries.",
    meta: "60 min",
  },
  {
    id: "d1-triage-roleplay",
    title: "Triage role-plays.",
    text: "One who has the money, one who'd have to borrow, one who doesn't pick up.",
    meta: "30 min",
  },
  {
    id: "d1-check",
    title: "Pass the check below.",
    text: "11 out of 12. Retake it as often as you need.",
    meta: "15 min",
  },
  {
    id: "d1-toolkit",
    title: "Finish your toolkit.",
    text: "Everything in section 03 ticked.",
    meta: "30 min",
  },
  {
    id: "d1-shift",
    title: "First live shift.",
    text: "Your manager reviews your first 10 conversations.",
    meta: "2 hrs",
  },
  { id: "d1-eod", title: "Send your first EOD.", meta: "10 min" },
];

const COUNTRY_REGIONS: { label: string; items: string[] }[] = [
  { label: "UK and Ireland", items: ["United Kingdom", "Ireland"] },
  { label: "North America", items: ["USA", "Canada"] },
  {
    label: "Western Europe",
    items: [
      "Netherlands",
      "Belgium",
      "Luxembourg",
      "Germany",
      "Austria",
      "Switzerland",
      "France",
      "Denmark",
      "Sweden",
      "Norway",
      "Finland",
      "Iceland",
      "Spain",
      "Portugal",
      "Italy",
    ],
  },
  { label: "Oceania", items: ["Australia", "New Zealand"] },
  { label: "The Gulf", items: ["UAE", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain", "Oman"] },
];

const OBJECTIONS: { q: string; a: string; then?: string }[] = [
  {
    q: "how much is it?",
    a: "it depends on what fits you, the guy on the call goes through all of it properly. what's your situation at the moment?",
    then: "No numbers in the DMs. If he keeps pushing, get his WhatsApp and tell him there: it's a four-figure investment, no finance, and the closer gives the exact number.",
  },
  {
    q: "can i pay monthly? klarna?",
    a: "all the payment stuff is covered on the call akhi. drop your whatsapp and i'll send you the link there",
    then: "On WhatsApp you can be straight: we don't do Klarna or any finance.",
  },
  {
    q: "is it halal?",
    a: "we take the deen seriously, no lying and no pressure selling. if you've got a specific concern about the work itself, ask a scholar who knows the details, and bring any questions to the call",
  },
  {
    q: "is a job guaranteed? will i make 3 to 5k?",
    a: "no honest program guarantees that. we train the skill and help you get in front of real roles. what you earn depends on the role and your work. what are you aiming for first?",
  },
  {
    q: "is this a scam?",
    a: "fair question, there's a lot of rubbish out there. look through the page, ask the guy on the call anything, and only move forward if it all makes sense to you. what made you cautious?",
  },
  {
    q: "i've got no experience",
    a: "most brothers who start with us have never sold anything. what matters is that you'll practice and take feedback. you up for that?",
  },
  {
    q: "can i keep doing it after i move?",
    a: "that's the point of it being remote. you need good internet and to work the hours the company needs. the guy on the call can go through how that looks for where you're moving",
  },
  {
    q: "i got burned by another course",
    a: "sorry to hear that akhi, it happens a lot in this space. since you're still looking, i can tell you're serious. what went wrong with the last one?",
  },
  {
    q: "just send me the info",
    a: "i can, but it won't answer what matters for you. i'll send you a video that covers the basics. what's your situation at the moment, so i know what to point you to?",
    then: "Send the basics video from Mochi.",
  },
  {
    q: "i need to think about it",
    a: "of course. what's the main thing you want to think through?",
  },
  {
    q: "need to ask my wife / parents",
    a: "respect, that's the right way to do it. they can join the call too, so nobody hears it second hand. want to pick a time that works for both of you?",
  },
  {
    q: "i don't have time",
    a: "how many hours could you honestly give it on a normal day?",
    then: "Under two hours most days: not now. Tag him Nurture.",
  },
  {
    q: "can i see results?",
    a: "check the highlights on the page. i won't promise you'll get the same, everyone starts from a different place. ask about it on the call",
  },
  {
    q: "am i talking to the guy in the videos?",
    a: "no akhi, it's [your name], i'm on the ivy team",
  },
];

type QuizQuestion = {
  q: string;
  options: [string, string, string];
  answer: 0 | 1 | 2;
  why: string;
};

const QUIZ: QuizQuestion[] = [
  {
    q: "A brother replies “PATH” to a post that promised a breakdown. What's your first message?",
    options: [
      "“Hey! Thanks so much for reaching out 😊 Here's the link to book your free call: [link]”",
      "“salam akhi 🤝 here's the breakdown from the post. what made you reach out?”",
      "“salam akhi, how much could you invest if this was the right fit?”",
    ],
    answer: 1,
    why: "Give him what the post promised, then ask one easy question. No booking link and no money question.",
  },
  {
    q: "He replies: “tryna make hijra but need an income i can take with me”. Best next message?",
    options: [
      "“that's why most brothers message us tbh. where you looking to move?”",
      "“perfect, our mentorship is exactly for that. want the link?”",
      "“what's your budget?”",
    ],
    answer: 0,
    why: "React to what he said and ask about it. The link comes much later, after he's said he wants help.",
  },
  {
    q: "You know his situation and his problem, but he hasn't said he wants help. What now?",
    options: [
      "Pitch the call straight away",
      "Ask how much he has saved",
      "“are you trying to figure this out on your own, or is it something you'd want help with?”",
    ],
    answer: 2,
    why: "Always ask if he wants help before you pitch. And never ask about money in the DMs.",
  },
  {
    q: "He lives in Lahore and says he's been saving. What do you do?",
    options: [
      "Book him, he's been saving",
      "Book him and let triage decide",
      "Send the “not our region” message and the free video. Only your manager can make an exception",
    ],
    answer: 2,
    why: "Where he lives comes first. Savings don't override the country check. Only your manager can.",
  },
  {
    q: "His family is from Pakistan and he lives in Manchester. He's 24, has a laptop and wants to learn the skill. What's next?",
    options: [
      "Keep going like with anyone who passes the checks",
      "Don't book him because of his background",
      "Ask for proof of address first",
    ],
    answer: 0,
    why: "We check where he lives, never his background. He passes all four checks.",
  },
  {
    q: "He passed the checks, wants help, and said “been saving for the move anyway”. Which link?",
    options: [
      "The hard link, always",
      "The soft link",
      "No link until he tells you exactly how much he has",
    ],
    answer: 1,
    why: "Checks passed, wants help, and he told you himself: soft link, less friction. When you're unsure, hard link.",
  },
  {
    q: "His hard-link form says he's 40% sure this is for him. What do you do?",
    options: [
      "Cancel the booking",
      "Nothing, the closer will deal with it",
      "Confirm, then ask on WhatsApp what he'd need to be clearer on before the call",
    ],
    answer: 2,
    why: "Clear his doubts before the call, so the closer isn't starting from “i'm not sure”.",
  },
  {
    q: "His form says $0–$1,000. What happens?",
    options: [
      "Cancel the booking right away",
      "Triage list. You call him the day before and check he has at least $1,000 he could invest without borrowing",
      "Nothing, the closer handles it",
    ],
    answer: 1,
    why: "People often pick the lowest option on forms. Triage finds out the truth before the closer spends an hour on it.",
  },
  {
    q: "On the triage call he says he has $400 and would have to borrow the rest.",
    options: [
      "Thank him for being honest, free the slot, send the free video, invite him back when he has it set aside",
      "Keep him on the calendar, the closer might find a way",
      "Suggest a loan or a credit card",
    ],
    answer: 0,
    why: "We never push anyone to borrow. Free the slot kindly and keep the door open.",
  },
  {
    q: "He goes quiet halfway through a good conversation. What's your first follow-up?",
    options: [
      "“just checking in, did you see my message?” an hour later",
      "Send the booking link so he has it",
      "Wait 6 to 12 hours, then one light line about what you were talking about",
    ],
    answer: 2,
    why: "Soft first, humour second, direct third, all inside Instagram's 7-day window. Never “just checking in”.",
  },
  {
    q: "He asks “how much is it?” in the Instagram DMs. What do you send?",
    options: [
      "“it depends on what fits you, the guy on the call goes through all of it properly. what's your situation at the moment?”",
      "“it's a four-figure investment. could you do that without borrowing?”",
      "Send him the exact price so he doesn't waste his time",
    ],
    answer: 0,
    why: "No numbers and no money questions in the Instagram DMs. Meta flags them. If he keeps pushing, move it to WhatsApp.",
  },
  {
    q: "A new follower looks like a perfect fit, but he hasn't messaged us. What do you do?",
    options: [
      "Message him, he looks perfect",
      "Nothing, unless your manager approves outbound. It's paused",
      "Log into Instagram and reply to his story",
    ],
    answer: 1,
    why: "Outbound is paused because Meta can flag it, and you never log into Instagram itself. You only talk to brothers who messaged us first.",
  },
];

/* ──────────────────────────────── page ──────────────────────────────── */

export function DmSetterPlaybook() {
  const ticks = useStoredRecord<boolean>(TICKS_KEY);
  return (
    <>
      <Part no="Part 1" title="Start here" />

      <Section id="pb-job" no="01" title="The job">
        <Lead>
          You turn Instagram conversations into booked, qualified consultation calls, and you make
          sure those brothers show up. You don't sell the mentorship. The closer does that on the
          call.
        </Lead>
        <ol className="mt-5 border-t border-border">
          {JOURNEY.map((j, i) => (
            <li
              key={j.title}
              className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-border py-4 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4"
            >
              <span className="font-mono text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground">
                <span className="hidden sm:inline">Step </span>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-semibold">{j.title}</p>
                <p className="mt-0.5 max-w-[60ch] text-body leading-6 text-foreground/80">
                  {j.text}
                </p>
              </div>
              <span className="col-start-2 justify-self-start whitespace-nowrap rounded-full border border-border px-2.5 py-1 font-mono text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground sm:col-start-auto">
                {j.where}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-semibold">You do</p>
            <Ticks
              kind="yes"
              items={[
                "Answer keyword replies and hot conversations within 30 minutes on shift",
                "Tag every lead in Mochi so nobody gets messaged twice",
                "Have real conversations that find what he wants and what's stopping him",
                "Run the checks and leave money to the form, WhatsApp and the call",
                "Send the right link and keep him warm until the call",
                "Triage flagged bookings, follow up on everyone else, send your EOD",
              ]}
            />
          </div>
          <div>
            <p className="font-semibold">You never</p>
            <Ticks
              kind="no"
              items={[
                "Talk price, money or savings in the Instagram DMs",
                "Message anyone who hasn't messaged us first, unless your manager approves it",
                "Promise income, a job or results",
                "Book someone who failed a check",
                "Judge a lead by his name, face, accent or background",
                "Pretend to be someone you're not",
              ]}
            />
          </div>
        </div>
        <p className="mt-8 max-w-[66ch] rounded-xl border border-border bg-muted/50 px-4 py-3.5 text-body leading-6 text-foreground/85">
          <b className="font-semibold text-foreground">How we work together:</b> patient while you
          learn, strict on the basics. Speed, honesty, your EOD and showing up.
        </p>
      </Section>

      <Section id="pb-leads" no="02" title="Who you're talking to">
        <Lead>
          Almost everyone who messages us is one of the first two. Build your conversations around
          them, not around people who already work in sales.
        </Lead>
        <div className="mt-5 border-t border-border">
          {[
            {
              n: "A",
              title: "He wants to make hijra",
              share: "Most leads",
              text: "He wants to move to a Muslim country, often with his wife and kids, and needs income that isn't tied to where he lives. The money isn't the dream. It's what gets him out.",
              says: [
                "tryna make hijra but need an income i can take with me",
                "me and the wife been planning it for a while",
                "need something i can do from anywhere",
              ],
            },
            {
              n: "B",
              title: "He's stuck and wants a real skill",
              share: "Most of the rest",
              text: "Works a job he doesn't like (warehouse, retail, driving, an office), studies, or is between things. He has usually never sold anything. Often he's tried dropshipping, trading or crypto and lost money.",
              says: [
                "wanna make money online",
                "i hate my job lol",
                "tried dropshipping, didn't work",
                "don't know where to start",
              ],
            },
            {
              n: "C",
              title: "He's already in sales",
              share: "Rare",
              text: "Only a handful ever. Ask about his current role and what isn't working. Everything else in this playbook still applies.",
              says: [],
            },
          ].map((t) => (
            <div
              key={t.n}
              className="grid grid-cols-[28px_minmax(0,1fr)] gap-3.5 border-b border-border py-5"
            >
              <span className="pt-0.5 font-mono text-caption text-muted-foreground">{t.n}</span>
              <div>
                <p className="font-semibold">
                  {t.title}
                  <span className="ml-2 whitespace-nowrap font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                    {t.share}
                  </span>
                </p>
                <p className="mt-1 max-w-[62ch] text-body leading-6 text-foreground/80">{t.text}</p>
                {t.says.length > 0 && (
                  <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="What he says">
                    {t.says.map((s) => (
                      <li
                        key={s}
                        className="rounded-[14px] rounded-bl-[5px] bg-muted px-2.5 py-1.5 text-caption leading-snug"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
        <Box title="What worries almost all of them">
          Is it halal. Is it a scam. Can I do it with no experience. Will I actually get work. Can I
          afford it. Every one of these has an honest answer in Questions and objections.
        </Box>
        <Box title="What Ivy is">
          A paid mentorship that trains Muslim brothers in remote sales, mainly appointment setting,
          so they can earn online and work from anywhere. It's a four-figure investment and we don't
          do finance or loans. That's for you to know. Price and money never come up in the
          Instagram DMs (section 09). The closer covers them on the call, and the offer doc from
          your manager has the details.
        </Box>
      </Section>

      <Section id="pb-toolkit" no="03" title="Your toolkit">
        <Lead>
          Your manager gives you all of this. Tick each one when you have it. Your ticks stay on
          this device.
        </Lead>
        <Checklist items={TOOLKIT} ticks={ticks.value} onTick={ticks.update} />
      </Section>

      <Part no="Part 2" title="The conversation" />

      <Section id="pb-speed" no="04" title="Leads and speed">
        <Lead>
          Your leads all come from our organic Instagram content. Nobody books on his own. He only
          ever gets the calendar link from you, after a conversation.
        </Lead>
        <ul className="mt-5 border-t border-border">
          {[
            {
              who: "Keyword reply",
              what: "Replied with PATH or another keyword, because a post asked him to.",
              when: "Within 30 min",
              hot: true,
            },
            {
              who: "Hot reply",
              what: "Mid-conversation and replying right now.",
              when: "Stay with him",
              hot: true,
            },
            {
              who: "Story reply",
              what: "Replied to one of our stories. It lands in Mochi like any other DM.",
              when: "Within 2 hours",
              hot: false,
            },
          ].map((r) => (
            <li
              key={r.who}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-border py-3.5 text-body sm:grid-cols-[160px_minmax(0,1fr)_auto]"
            >
              <span className="font-semibold">{r.who}</span>
              <span className="col-span-2 row-start-2 text-foreground/80 sm:col-span-1 sm:row-start-auto">
                {r.what}
              </span>
              <span
                className={cn(
                  "col-start-2 row-start-1 whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-caption sm:col-start-auto sm:row-start-auto",
                  r.hot ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {r.when}
              </span>
            </li>
          ))}
        </ul>
        <Tip title="Stay on hot leads.">
          When a brother is replying, stay in that chat instead of going back to the oldest unread.
          Someone texting you now can be booked today. By tomorrow he's cooled off. Tag hot leads in
          Mochi so you can find them fast.
        </Tip>
        <Tip title="You only talk to brothers who messaged us first.">
          Outbound is paused (section 24). Website and YouTube applications go through the Typeform
          to the phone setters, not to you.
        </Tip>
      </Section>

      <Section id="pb-open" no="05" title="Your first reply">
        <Lead>
          Every keyword comes from a post that promised him something, like “reply PATH if you want
          to know exactly how i did it”. Check which post it came from (the keyword list is in your
          toolkit), send him what the post promised from Mochi, then ask one easy question. No
          booking link, no price, no money question.
        </Lead>
        <ScriptList
          items={[
            {
              ctx: "He replied with a keyword · send what the post promised from Mochi",
              text: "salam akhi 🤝 here's the breakdown from the post. what made you reach out?",
            },
            {
              ctx: "He wrote “salam” with it · send what the post promised from Mochi",
              text: "wa alaykum salam akhi 🤝 here's the breakdown from the post. what made you reach out?",
            },
            {
              ctx: "The automation already sent it",
              text: "salam akhi 🤝 did the video come through? what made you reach out?",
            },
            {
              ctx: "He asked a question with it (“how does it work?”)",
              text: "wa alaykum salam. it's a mentorship that trains brothers in remote sales, mainly appointment setting. before i go into it, what's your situation at the moment, working or in between things?",
            },
            {
              ctx: "He replied to one of our stories",
              text: "appreciate that akhi 🤝 you looking into this yourself?",
            },
          ]}
        />
        <Tip title="Never say “how i did it” as if you're the brother in the videos.">
          You're on the team, and if he asks, you say so.
        </Tip>
      </Section>

      <Section id="pb-situation" no="06" title="His situation">
        <Lead>
          Two things you need early: where he lives and what he does. Both come up on their own if
          you're curious. Ask one thing, react to his answer, then ask the next. If he's already
          told you, don't ask.
        </Lead>
        <ScriptList
          items={[
            { ctx: "What he does", text: "what are you doing at the moment, working or studying?" },
            { ctx: "Where he lives", text: "where you based akhi?" },
            { ctx: "He mentioned hijra", text: "where you looking to move?" },
            { ctx: "He told you his job", text: "how long you been doing that?" },
            {
              ctx: "He's already in sales (rare)",
              text: "nice, what are you setting or closing for?",
            },
          ]}
        />
        <Sub>Lazy questions, and what to ask instead</Sub>
        <SubNote>
          A lazy question is one where he can hear the answer you want. He feels sold to and goes
          quiet.
        </SubNote>
        <div className="mt-4 border-t border-border">
          {[
            [
              "what's your biggest problem?",
              "is it more the money, the hours, or wanting to move?",
            ],
            ["how much do you make?", "what do you do for work at the moment?"],
            ["what are your goals?", "what's the plan for income once you're out there?"],
            ["are you happy with your job?", "how long you been doing nights?"],
            ["how much can you invest?", "never in the DMs, the booking form asks it"],
          ].map(([bad, good]) => (
            <div
              key={bad}
              className="grid gap-0.5 border-b border-border py-3 text-body sm:grid-cols-[minmax(0,1fr)_22px_minmax(0,1fr)] sm:items-center sm:gap-3"
            >
              <span className="text-muted-foreground line-through decoration-danger">{bad}</span>
              <span
                className="hidden text-center text-muted-foreground sm:block"
                aria-hidden="true"
              >
                →
              </span>
              <span>{good}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="pb-problem" no="07" title="His goal and problem">
        <Lead>
          The problem is the anchor for everything after it: the call pitch, the link and the
          closer's call. Get it in his own words.
        </Lead>
        {[
          {
            k: "A",
            title: "He wants to make hijra",
            items: [
              { ctx: "Find the gap", text: "what's the plan for income once you're out there?" },
              {
                ctx: "Go one level deeper",
                text: "so you'd want something remote sorted first, then move once it's stable?",
              },
            ],
          },
          {
            k: "B",
            title: "He's stuck and wants a skill",
            items: [
              {
                ctx: "What he's tried",
                text: "have you tried anything online before, or would this be the first thing?",
              },
              {
                ctx: "He tried something and it went badly",
                text: "that happens a lot. setting is different, you work for a business and get paid on results, you're not buying stock or running ads",
              },
            ],
          },
          {
            k: "C",
            title: "He's vague",
            items: [
              {
                ctx: "Give him options to pick from",
                text: "is it more the money, the hours, or you just want out?",
              },
              {
                ctx: "He picked one but it's still thin",
                text: "what would change for you if that was sorted?",
              },
            ],
          },
        ].map((stage) => (
          <div key={stage.k} className="mt-8">
            <p className="flex items-baseline gap-2.5 font-semibold">
              <span className="font-mono text-micro font-medium text-muted-foreground">
                {stage.k}
              </span>
              {stage.title}
            </p>
            <ScriptList items={stage.items} />
          </div>
        ))}
        <Tip title="React before you ask.">
          “nights are rough.” “may Allah make it easy for you both.” “fair enough.” One short line
          that shows you heard him, then your question.
        </Tip>
      </Section>

      <Section id="pb-help" no="08" title="Value and wanting help">
        <Lead>
          The order is always the same: react to what he said, give a bit of value, add a video if
          it fits, and finish with a question. Then ask whether he wants help. Don't skip that
          question. If he hasn't said he wants help, he isn't ready for the call.
        </Lead>
        <ScriptList
          items={[
            {
              ctx: "Value with a video · send the video from Mochi with it",
              text: "this breaks down what setting actually is and how brothers start with zero experience. when you've watched it, tell me what part you're unsure about",
            },
            {
              ctx: "Does he want help?",
              text: "are you trying to figure this out on your own, or is it something you'd want help with?",
            },
            {
              ctx: "Is he serious about starting?",
              text: "is this something you want to start on soon, or are you just looking at options for now?",
            },
            {
              ctx: "He isn't ready. Lean out.",
              text: "all good akhi, sounds like you've got a plan. if you ever want help with the remote side, message me 🤝",
            },
          ]}
        />
        <Tip title="Leaning out works.">
          Brothers you leave alone with a kind line often come back weeks later ready to talk,
          because nobody chased them.
        </Tip>
      </Section>

      <Section id="pb-checks" no="09" title="The checks">
        <Lead>You'll know most of these by now. Only ask what's missing.</Lead>
        <div className="mt-5 border-t border-border">
          <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3.5 border-b border-border py-4">
            <CheckNo n={1} />
            <div>
              <p className="font-semibold">He lives in one of our countries</p>
              <p className="mt-1 text-body text-foreground/80">
                Where he lives now. Not where he or his family is from.
              </p>
              <div className="mt-3.5 grid gap-2.5">
                {COUNTRY_REGIONS.map((r) => (
                  <div
                    key={r.label}
                    className="grid gap-1 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-2.5"
                  >
                    <span className="pt-0 font-mono text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground sm:pt-2">
                      {r.label}
                    </span>
                    <Chips items={r.items} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-body text-foreground/80">
                Anywhere else is “not our region” for now. Only your manager can make an exception.
              </p>
            </div>
          </div>
          {[
            {
              n: 2,
              title: "He's 18 or older",
              text: "Under 18 is a hard no. Only ask if it isn't obvious.",
            },
            {
              n: 3,
              title: "He has a laptop and stable internet",
              text: "A phone alone isn't enough to train and take calls. “you got a laptop you can train and take calls on?”",
            },
            {
              n: 4,
              title: "He wants a skill, not quick cash",
              text: "If he needs money this week, it isn't for him yet.",
            },
          ].map((c) => (
            <div
              key={c.n}
              className="grid grid-cols-[36px_minmax(0,1fr)] gap-3.5 border-b border-border py-4"
            >
              <CheckNo n={c.n} />
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="mt-1 text-body text-foreground/80">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        <Box title="Where he lives. Never where he's from.">
          We check where a brother lives and, later, whether he can invest. Nothing else. Never
          judge a lead by his name, profile picture, accent or family background. A brother from a
          Pakistani or Indian family who lives in Birmingham, Toronto or Dubai goes through the same
          checks as everyone else.
        </Box>
        <Box title="Money stays out of the DMs" warn>
          No prices, no “how much can you invest”, no questions about savings, income, loans or
          finance in the Instagram DMs. Meta flags it and the account can get banned. The booking
          form asks the money questions, the link message on WhatsApp tells him it's paid, and
          triage and the closer handle the rest.
        </Box>
        <Sub>Listen for what he tells you himself</Sub>
        <SubNote>
          You never ask, but brothers often say it anyway. It decides which link he gets.
        </SubNote>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Rail tone="green" className="px-4 py-3.5">
            <p className="text-body font-semibold">He shows he can do it (soft link)</p>
            <ul className="mt-2 grid gap-1.5 text-body text-foreground/80">
              <li>“been saving for the move”</li>
              <li>works full-time and says money isn't the problem</li>
              <li>says he's ready to invest in himself</li>
            </ul>
          </Rail>
          <Rail tone="red" className="px-4 py-3.5">
            <p className="text-body font-semibold">Warning signs (hard link, or not a fit)</p>
            <ul className="mt-2 grid gap-1.5 text-body text-foreground/80">
              <li>“i'd have to borrow it”</li>
              <li>“i'm on my last £200”</li>
              <li>“i need money this week”</li>
              <li>won't say anything about his situation</li>
            </ul>
          </Rail>
        </div>
      </Section>

      <Section id="pb-pitch" no="10" title="Pitch and number">
        <Lead>Use his goal in his words. The same pitch sent to everyone books fewer calls.</Lead>
        <ScriptList
          items={[
            {
              ctx: "Standard",
              text: "best next step is a call with one of our guys. he'll look at [your hijra plan / getting out of retail], tell you honestly if it fits and go through how it all works. drop your whatsapp and i'll send you the link there",
            },
            {
              ctx: "He's keen",
              text: "let's get you on a call then. what's your whatsapp? i'll send the link there",
            },
            {
              ctx: "He's half in · send the video from Mochi",
              text: "if you're serious about [his goal], the call is the next step. if you'd rather look into it more first, no stress, i'll send you a video in the meantime",
            },
            {
              ctx: "He asks a lot of questions",
              text: "if everything made sense on the call, is there anything that would stop you from moving forward?",
            },
            {
              ctx: "He hesitates on his number",
              text: "it's only so we can confirm your time and remind you. no spam",
            },
            {
              ctx: "He won't give it",
              text: "no stress, here's the link: [hard link]\nthe form asks for a number, that's where the reminders go",
            },
          ]}
        />
      </Section>

      <Section id="pb-links" no="11" title="The two links">
        <Lead>
          Both links book the same consultation call on the closer's calendar. The difference is how
          much the form asks. The forms can ask about money because they aren't on Instagram. When
          in doubt, use the hard link.
        </Lead>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <LinkCard
            tone="green"
            pill="Soft link"
            title="Consultation call"
            use="all four checks are yes, he said he wants help, and he's told you himself that money isn't the problem."
            questions={[
              "WhatsApp number, with country code",
              "Instagram handle",
              "Where do you live right now? · UK or Ireland · USA or Canada · Western Europe · Australia or NZ · the Gulf · somewhere else",
              "What do you want to get out of the call?",
              "If it all makes sense on the call, are you in a position to invest in yourself? Yes / Not right now",
            ]}
          />
          <LinkCard
            tone="amber"
            pill="Hard link"
            title="Consultation call, full form"
            use="he hasn't told you anything about money, he's vague, or you're not sure. Most brothers get this one."
            questions={[
              "WhatsApp number, with country code",
              "Instagram handle",
              "Where do you live right now? · same options as the soft link",
              "How old are you?",
              "What do you do right now?",
              "Why remote sales, and why now?",
              "If the call shows it's a fit, how much could you invest in yourself from money you have now, without loans? $0–$1,000 / $1,000–$3,000 / $3,000–$5,000 / $5,000+",
              "Is this your decision?",
              "How sure are you that this is for you? 20% / 40% / 60% / 80% / 100%",
              "I'll be on time, somewhere quiet, with my laptop (tick)",
            ]}
          />
        </div>
        <Sub>Sending it</Sub>
        <ScriptList
          items={[
            {
              tag: "WhatsApp",
              ctx: "From the team WhatsApp",
              text: "salam [name], it's [your name] from ivy on instagram. here's the link for your call: [soft or hard link]\njust so you know before you book, it's a paid mentorship, so the form asks about that too. pick a time you can be somewhere quiet with your laptop for an hour, and message me here once you've booked 🤝",
            },
            {
              ctx: "Then, back in the DM",
              text: "sent it on whatsapp akhi, let me know once you've booked",
            },
          ]}
        />
        <Tip>
          Mark him <b className="font-semibold text-foreground/80">Link sent</b> and write the
          closer note while it's fresh. The template is in Your day.
        </Tip>
      </Section>

      <Section id="pb-examples" no="12" title="Full conversations">
        <Lead>
          This is roughly how it goes. Real leads type fast, skip words and go quiet for hours. You
          keep it short, react first, and ask one thing at a time.
        </Lead>
        <div className="mt-6 grid gap-12">
          <Example
            title="A · He wants to make hijra"
            pill={<StatusPill tone="success">Soft link</StatusPill>}
          >
            <Convo
              label="Example conversation A"
              lines={[
                { he: "salam PATH" },
                {
                  you: "wa alaykum salam akhi 🤝 here's the breakdown from the post. what made you reach out?",
                },
                { note: "Keyword · give him what the post promised first" },
                {
                  he: "saw ur reel. tryna make hijra from the uk but need an income i can take with me",
                },
                { note: "Goal · hijra · Check 1 · lives in the UK" },
                { you: "that's why most brothers message us tbh. where you looking to move?" },
                { he: "egypt inshallah. me and the wife been planning it like 2 years" },
                {
                  you: "may Allah make it easy for you both. what's the plan for income once you're out there?",
                },
                { he: "honestly thats the problem lol. i do nights at amazon rn" },
                { note: "Problem · no income he can take with him" },
                {
                  you: "nights are rough. so you'd want something remote sorted first, then move once it's stable?",
                },
                { he: "yeah exactly" },
                { you: "makes sense. have you tried anything online before?" },
                { he: "dropshipping last year, didnt work out" },
                {
                  you: "that happens a lot. setting is different, you work for a business and get paid on results, you're not buying stock or running ads. are you trying to figure this out on your own, or is it something you'd want help with?",
                },
                { he: "help deffo. wouldnt know where to start" },
                { note: "Wants help" },
                { you: "fair. you got a laptop you can train and take calls on?" },
                { he: "ye" },
                { note: "Check 3 · laptop · Age: married with plans, clearly an adult, not asked" },
                {
                  you: "then the next step is a call with one of our guys. he'll look at your situation and your hijra timeline and tell you honestly if it fits",
                },
                { he: "ye sounds good. been saving for the move anyway so" },
                { note: "He said it himself · savings · soft link" },
                { you: "perfect. what's your whatsapp? i'll send the link there" },
                { he: "07700 900123" },
                { you: "sent it akhi, let me know once you've booked" },
              ]}
            />
          </Example>
          <Example
            title="B · Stuck in retail, vague at first"
            pill={<StatusPill tone="warning">Hard link</StatusPill>}
          >
            <Convo
              label="Example conversation B"
              lines={[
                { he: "PATH" },
                { note: "The automation already sent him the video" },
                { you: "salam akhi 🤝 did the video come through? what made you reach out?" },
                { he: "ye. wanna make money online" },
                { you: "fair enough. what are you doing at the moment, working or studying?" },
                { he: "working" },
                { you: "what do you do?" },
                { he: "retail. sports direct" },
                { you: "how long you been there?" },
                { he: "3 years. i hate it lol" },
                {
                  you: "3 years is a long time in a job you hate. is it more the money, the hours, or you just want out?",
                },
                { he: "all of it tbh. want something i can actually grow in" },
                { note: "Problem · stuck, wants a skill with a future" },
                { you: "that's a good reason. where you based bro?" },
                { he: "leicester" },
                { you: "and have you done any sales before or would this be new?" },
                { he: "new" },
                {
                  you: "most brothers who start with us have never sold anything. you learn it on real conversations and get feedback on them. is this something you want to start on soon, or are you just looking at options for now?",
                },
                { he: "soon if its legit" },
                { note: "Wants help · nothing said about money · hard link", warn: true },
                {
                  you: "fair, check everything properly. best next step is a call with one of our guys, you can ask him anything and he'll tell you honestly if it fits. drop your whatsapp and i'll send you the link there",
                },
                { he: "ok 07700 900456" },
                {
                  you: "sent. fill the form in properly, it makes the call actually useful for you",
                },
              ]}
            />
            <Tip>
              Laptop wasn't asked in the DMs. The form's last question covers it, and the closer
              checks it on the call.
            </Tip>
          </Example>
          <Example
            title="C · Asks the price first"
            pill={<StatusPill tone="warning">Hard link</StatusPill>}
          >
            <Convo
              label="Example conversation C"
              lines={[
                { he: "how much is it" },
                {
                  you: "salam akhi. it depends on what fits you, the guy on the call goes through all of it properly. what's your situation at the moment, you working?",
                },
                { note: "No numbers in the DMs", warn: true },
                { he: "ye full time, electrician" },
                { you: "good trade masha'Allah. what's got you looking at remote sales then?" },
                { he: "want to move to dubai eventually, not be on site forever" },
                { you: "makes sense. where you based at the moment?" },
                { he: "manchester. but just tell me the price bro" },
                {
                  you: "i get it. drop your whatsapp and i'll go through it with you there, and send you the link for the call",
                },
                { note: "Money moves off Instagram" },
                { he: "+44 7700 900789" },
                { you: "sent akhi, check whatsapp 🤝" },
              ]}
            />
            <Tip>
              On WhatsApp you can be straight with him: it's a paid mentorship, a four-figure
              investment, no finance, and the closer gives the exact number. He gets the hard link,
              because he hasn't shown he can do it yet. The form covers age and laptop.
            </Tip>
          </Example>
          <Example
            title="D · Lives outside our countries"
            pill={<StatusPill tone="danger">Not a fit</StatusPill>}
          >
            <Convo
              label="Example conversation D"
              lines={[
                { he: "salam PATH" },
                {
                  you: "wa alaykum salam akhi 🤝 here's the breakdown from the post. what made you reach out?",
                },
                { he: "i want to learn appointment setting and work online" },
                { you: "good choice. where you based?" },
                { he: "cairo" },
                {
                  you: "appreciate you telling me akhi. right now we only take on brothers living in the uk and ireland, the us and canada, western europe, australia and nz, and the gulf, so i can't book you in yet. keep the video from the post, it covers the basics. if you move, message me",
                },
                { he: "ok jazakAllah" },
                { you: "wa iyyak akhi" },
              ]}
            />
          </Example>
        </div>
      </Section>

      <Section id="pb-nofit" no="13" title="Not a fit">
        <Lead>
          A brother who isn't a fit today can still become a follower, a referral or a buyer later.
          Tag him Not a fit with the reason. Don't argue. Only block someone who's abusive.
        </Lead>
        <ScriptList
          items={[
            {
              ctx: "Lives outside our countries · send the free video from Mochi",
              text: "appreciate you telling me akhi. right now we only take on brothers living in the uk and ireland, the us and canada, western europe, australia and nz, and the gulf, so i can't book you in yet. i'll send you a free video that covers how setting works. if you move, message me 🤝",
            },
            {
              ctx: "He asks why",
              text: "it's about where you live right now, not where you're from. it's where we're focused at the moment",
            },
            {
              ctx: "Under 18",
              text: "you're a bit early for the mentorship akhi, it's 18+. use the free content to build your skills and message me once you're 18 insha'Allah",
            },
            {
              ctx: "No laptop · send the free video from Mochi",
              text: "you'll need a laptop and stable internet to train and take calls. once that's sorted message me and i'll get you booked. i'll send you a free video to start with in the meantime",
            },
            {
              ctx: "Wants quick cash",
              text: "i'll be straight with you, this is a skill that takes a few months to build. if you need something this month, this isn't it. if you want the long-term skill, i'm here",
            },
            {
              ctx: "He tells you he can't afford it right now · send the free video from Mochi",
              text: "appreciate you being honest akhi, no rush at all. i'll send you a free video to start with. when the timing's better, message me and we'll pick it up",
            },
            {
              ctx: "A sister messages",
              text: "salam sister, thank you for reaching out. the mentorship is for brothers only right now, but the free content on the page is for everyone",
            },
          ]}
        />
      </Section>

      <Part no="Part 3" title="After he books" />

      <Section id="pb-review" no="14" title="Review and warm-up">
        <Lead>
          Check the form within 2 hours of a booking, or first thing next shift if it came in
          overnight.
        </Lead>
        <div className="mt-4 grid gap-2.5">
          {[
            {
              tone: "red" as const,
              when: "Lives somewhere else, or under 18",
              act: "Cancel in Calendly and send the matching message from Not a fit.",
            },
            {
              tone: "amber" as const,
              when: "$0–$1,000 · “Not right now” · his number's country code doesn't match where he lives · answers missing",
              act: "Confirm the booking and put him on the triage list for the day before his call.",
            },
            {
              tone: "amber" as const,
              when: "20% or 40% sure",
              act: "Confirm, then send the pre-handle message below today.",
            },
            {
              tone: "green" as const,
              when: "Everything else",
              act: "Confirm, and send the pre-call video from Mochi.",
            },
          ].map((d) => (
            <Rail
              key={d.when}
              tone={d.tone}
              className="grid gap-1 px-4 py-3.5 text-body md:grid-cols-2 md:gap-5"
            >
              <p className="font-semibold">{d.when}</p>
              <p className="text-foreground/80">{d.act}</p>
            </Rail>
          ))}
        </div>
        <ScriptList
          items={[
            {
              tag: "WhatsApp",
              ctx: "Confirmation, right after he books · send the pre-call video from Mochi too",
              text: "locked in akhi ✅ [day] at [time] your time. i've sent you a short video on instagram, watch it before the call, it'll make it way more useful for you. and add the invite from your email to your calendar so it doesn't slip",
            },
            {
              tag: "WhatsApp",
              ctx: "Pre-handle: 20% or 40% sure",
              text: "saw on the form you're about [40]% sure. just so we don't waste your time, what would you need to be clearer on before the call?",
            },
            {
              tag: "WhatsApp",
              ctx: "He expected someone else on the call",
              text: "the call's with [closer], one of our guys who does this every day. you'll be in good hands. if you'd rather not, no stress, i can cancel it",
            },
          ]}
        />
        <Tip title="Tie the video to his goal if you can.">
          One line like “this one's worth it before the call, it's about getting income sorted
          before a move” lands better than “watch this”.
        </Tip>
        <Sub>Keep him warm until the call</Sub>
        <SubNote>
          Brothers who feel they know you before the call show up. Brothers who only get an
          automatic reminder forget.
        </SubNote>
        <Ticks
          kind="dot"
          items={[
            <>
              <b className="font-semibold text-foreground">Booked 3+ days out?</b> A light touch on
              WhatsApp every couple of days: something useful, or a short voice note about what he
              told you. Never “are you still good?” every day.
            </>,
            <>
              <b className="font-semibold text-foreground">Send the closer a note</b> as soon as he
              books (template in Your day). For a hot lead, a quick voice note with the context too.
            </>,
            <>
              <b className="font-semibold text-foreground">If the closer has an earlier slot,</b>{" "}
              offer it: “i know you booked for friday, but [closer] is free tomorrow afternoon if
              that suits you better?”
            </>,
          ]}
        />
      </Section>

      <Section id="pb-triage" no="15" title="Triage call">
        <Lead>
          Only for the triage list. The day before his call, between 10:00 and 20:00 his time. Two
          call attempts at least two hours apart, then one WhatsApp message.
        </Lead>
        <div className="mt-4 rounded-xl border border-border bg-card px-4 sm:px-5">
          {[
            {
              who: "Open",
              say: "“salam [name], it's [your name] from ivy. you booked a call for tomorrow at [time], i'm calling to make sure it's worth your time. you got two minutes?”",
            },
            {
              who: "Money",
              say: "“on the form you picked [$0 to $1,000 / not right now]. the mentorship is paid and we don't do loans or finance. if tomorrow shows it's the right fit, do you have at least $1,000 set aside that you could put in without borrowing?”",
            },
            {
              who: "Location",
              cond: "Only if his number was the flag",
              say: "“quick one, your number's from a different country than the one on the form. where are you based right now?”",
            },
          ].map((l) => (
            <div
              key={l.who}
              className="grid gap-1 border-b border-border py-3.5 last:border-b-0 sm:grid-cols-[84px_minmax(0,1fr)] sm:gap-3.5"
            >
              <span className="pt-1 font-mono text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {l.who}
              </span>
              <p className="text-body leading-6">
                {l.cond && (
                  <span className="mb-0.5 block text-caption text-muted-foreground">{l.cond}</span>
                )}
                <Rich text={l.say} />
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2.5 md:grid-cols-2">
          <Rail tone="green" className="flex flex-col gap-2 px-4 py-4">
            <p className="font-semibold">Keep him on the calendar</p>
            <p className="text-body text-foreground/80">
              He has $1,000 or more without borrowing, and he lives in one of our countries.
            </p>
            <p className="rounded-[10px] bg-muted/60 px-3 py-2.5 text-body leading-6">
              <Rich text="“perfect, you're all set for tomorrow at [time]. is it your decision, or should anyone join you?”" />
            </p>
            <p className="text-caption text-muted-foreground">
              Mark him Kept and add what he told you to the closer note.
            </p>
          </Rail>
          <Rail tone="red" className="flex flex-col gap-2 px-4 py-4">
            <p className="font-semibold">Free the slot</p>
            <p className="text-body text-foreground/80">
              He doesn't have it, or he'd need to borrow.
            </p>
            <p className="rounded-[10px] bg-muted/60 px-3 py-2.5 text-body leading-6">
              “appreciate you being honest akhi. then tomorrow would be too early and i don't want
              to waste your time, so i'll free up the slot. i'll send you a free video to start
              with, and when you've got it set aside, message me and i'll book you straight back in”
            </p>
            <p className="text-caption text-muted-foreground">
              Cancel in Calendly, send the free video from Mochi, mark him Cancelled at triage.
              Lives outside our countries? Cancel and send the “not our region” message.
            </p>
          </Rail>
        </div>
        <ScriptList
          items={[
            {
              tag: "WhatsApp",
              ctx: "After two missed calls",
              text: "salam [name], tried calling about your call tomorrow. i need two minutes with you before then, when's good?",
            },
            {
              tag: "WhatsApp",
              ctx: "No reply by 20:00 his time: cancel, then send",
              text: "couldn't reach you so i've freed up tomorrow's slot. when you're ready, message me and we'll find a new time 🤝",
            },
          ]}
        />
      </Section>

      <Section id="pb-noshow" no="16" title="Reminders and no-shows">
        <ScriptList
          items={[
            {
              tag: "WhatsApp",
              ctx: "Day before (not on the triage list)",
              text: "salam [name], all set for tomorrow at [time] your time?",
            },
            {
              tag: "WhatsApp",
              ctx: "One hour before",
              text: "see you in an hour akhi, the link's in your email",
            },
            {
              tag: "WhatsApp",
              ctx: "No-show: 5 minutes after the start, plus one call",
              text: "salam [name], [closer]'s on the call waiting for you. everything good?",
            },
            {
              tag: "WhatsApp",
              ctx: "No-show: after the slot",
              text: "everything alright akhi? saw you couldn't make it. if you're still serious, tell me what happened and we'll find a new time",
            },
            {
              tag: "WhatsApp",
              ctx: "No-show: next day, still nothing",
              text: "you've gone quiet on me akhi. is this still something you want, or should i leave it for now? either's fine",
            },
            {
              tag: "WhatsApp",
              ctx: "He cancelled",
              text: "no stress akhi, everything alright? want me to find you another time?",
            },
          ]}
        />
        <Tip>
          One reschedule per brother. A second no-show needs your manager's OK before he's booked
          again. No-shows and cancellations are the first follow-ups you do every day. They already
          wanted help once.
        </Tip>
      </Section>

      <Section id="pb-aftercall" no="17" title="After the call">
        <Lead>
          Ask the closer for one line on every call you booked: did he join, was he qualified, what
          came up. That's how you get better at picking who to book.
        </Lead>
        <ScriptList
          items={[
            {
              tag: "WhatsApp",
              ctx: "He joined",
              text: "welcome in akhi, proud of you for taking the step 🤝 the team will send your onboarding details. if anything's unclear, message me",
            },
            {
              tag: "WhatsApp",
              ctx: "He's thinking it over or booked a follow-up",
              text: "good speaking to you through all this akhi. take your time with it, and if anything comes up before your next call, i'm here",
            },
          ]}
        />
        <Ticks
          kind="dot"
          items={[
            <>
              <b className="font-semibold text-foreground">Didn't join:</b> tag the reason the
              closer gives you and move him to Nurture. Check in on WhatsApp about once a month with
              something useful.
            </>,
            <>
              <b className="font-semibold text-foreground">Tell your manager what you hear:</b> new
              objections, which posts brothers mention, questions you can't answer. You see the
              market before anyone else.
            </>,
          ]}
        />
      </Section>

      <Part no="Part 4" title="Keeping leads alive" />

      <Section id="pb-followups" no="18" title="Follow-ups">
        <Lead>
          Most bookings come from the second or third touch. But chasing makes you look desperate,
          and brothers want to decide in their own time. Three touches, spaced out, then let the
          content do the work.
        </Lead>
        <Box title="The 7-day window" warn>
          Mochi can only message a brother within 7 days of his last message. That's Instagram's
          rule, not a bug. So all your DM follow-ups happen inside that week. After that, use
          WhatsApp if you have his number. If you don't, tag him Nurture and let the content bring
          him back.
        </Box>
        <Sub>He went quiet mid-conversation</Sub>
        <SubNote>Wait at least 6 to 12 hours before the first touch. Not an hour.</SubNote>
        <ScriptList
          items={[
            {
              tag: "Touch 1",
              ctx: "6 to 24 hours · one light line about what you were talking about",
              text: "how'd the night shift go?",
            },
            {
              tag: "Touch 2",
              ctx: "1 to 3 days later · a bit of humour",
              text: "if you're leaving me on seen i'm guessing you're busy winning 😂",
            },
            {
              tag: "Touch 3",
              ctx: "4 to 6 days later, before the window closes · direct",
              text: "no stress if the timing's off akhi. just let me know if there's anything you need more clarity on, or if i should leave it for now",
            },
          ]}
        />
        <Sub>Link sent, not booked</Sub>
        <ScriptList
          items={[
            {
              tag: "WhatsApp",
              ctx: "12 to 24 hours",
              text: "not sure if you managed to find a time yet. let me know if anything's unclear",
            },
            {
              tag: "WhatsApp",
              ctx: "2 to 3 days",
              text: "do you need more clarity on anything before the call, or is it not for you right now? either's fine",
            },
          ]}
        />
        <Sub>Two weeks to a month later</Sub>
        <SubNote>Only on WhatsApp, for brothers who gave you their number.</SubNote>
        <ScriptList
          items={[
            {
              tag: "WhatsApp",
              ctx: "Fresh start",
              text: "salam akhi, how's everything been since we last spoke?",
            },
            {
              tag: "WhatsApp",
              ctx: "With something useful · add the video or post it's about",
              text: "saw this and thought of what you said about [his goal]",
            },
          ]}
        />
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-semibold">Follow up first</p>
            <Ticks
              kind="yes"
              items={[
                "No-shows and cancellations",
                "Call pitched or link sent, not booked",
                "Hot leads quiet for 18 to 24 hours",
                "DM chats where the 7-day window is about to close",
              ]}
            />
          </div>
          <div>
            <p className="font-semibold">Never send</p>
            <Ticks
              kind="no"
              items={[
                "“just checking in”",
                "“just following up”",
                "“did you see my message?”",
                "More than 3 touches in a week",
              ]}
            />
          </div>
        </div>
        <Tip title="Voice notes restart cold chats.">
          A short, personal voice note about what he told you often gets a reply when texts don't.
          Use your own voice and say who you are.
        </Tip>
      </Section>

      <Section id="pb-objections" no="19" title="Questions and objections">
        <Lead>
          Answer honestly in one or two lines, then ask one thing back. Never argue, never promise,
          never put a number in the DMs.
        </Lead>
        <div className="mt-4 border-t border-border">
          {OBJECTIONS.map((o) => (
            <div
              key={o.q}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 border-b border-border py-4 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto]"
            >
              <Bubble
                kind="them"
                text={o.q}
                className="col-span-2 justify-self-start md:col-span-1"
              />
              <div className="grid min-w-0 gap-1.5">
                <Bubble kind="me" text={o.a} className="justify-self-start" />
                {o.then && <p className="text-caption leading-5 text-muted-foreground">{o.then}</p>}
              </div>
              <CopyButton text={o.a} />
            </div>
          ))}
        </div>
      </Section>

      <Part no="Part 5" title="How you work" />

      <Section id="pb-rules" no="20" title="Rules">
        <div className="mt-4 grid gap-10">
          <div>
            <p className="font-semibold">How you write</p>
            <Ticks
              kind="dot"
              items={[
                "lowercase, short, like texting a brother. “i”, not “I”",
                "one idea and one question per message, one to three sentences",
                "react to what he said before you ask anything, and use his words back",
                "match his length and energy. never answer a one-liner with a paragraph",
                "commas and “and” for breaks. no long dashes, no semicolons",
                "one or two emojis per conversation, one exclamation mark at most",
                "“wa alaykum salam” when he greets you. insha'Allah, masha'Allah and jazakAllah khair where they're natural",
                "read it out loud before you send. if it sounds like an email, rewrite it",
              ]}
            />
          </div>
          <div>
            <p className="font-semibold">Never. Break one and you're off the team.</p>
            <Ticks
              kind="no"
              items={[
                "Promise income, a job or results",
                "Make up proof, deadlines, discounts or “last spots”",
                "Talk price, money, savings or loans in the Instagram DMs",
                "Push anyone to borrow, use credit or skip bills",
                "Use the deen to pressure anyone",
                "Book someone who failed a check to hit your numbers",
                "Judge a lead by his name, face, accent or background",
                "Pretend to be someone you're not. If he asks, you're on the Ivy team",
              ]}
            />
          </div>
          <div>
            <p className="font-semibold">Protect the account. We just got it back.</p>
            <Ticks
              kind="dot"
              items={[
                <>
                  <b className="font-semibold text-foreground">No money talk in the DMs.</b> Meta
                  flags it. The form, WhatsApp and the calls handle money.
                </>,
                <>
                  <b className="font-semibold text-foreground">You work in Mochi only.</b> You're
                  never logged into Instagram itself, on any phone or computer.
                </>,
                <>
                  <b className="font-semibold text-foreground">Outbound is paused.</b> Only talk to
                  brothers who messaged us first, unless your manager approves it (section 24).
                </>,
                "Never send the same message word for word to lots of people. Change a real detail each time.",
                "The booking link goes on WhatsApp. Only send it in the DM if he won't give his number, and never in a first message.",
                "No tools your manager didn't set up.",
                "Mochi shows a warning or an error you don't recognise? Stop and tell your manager straight away.",
              ]}
            />
          </div>
        </div>
      </Section>

      <Section id="pb-day" no="21" title="Your day">
        <p className="mt-4 font-semibold">Work in this order</p>
        <Numbered
          items={[
            <>
              <b className="font-semibold text-foreground">Keyword replies and hot replies,</b>{" "}
              newest first.
            </>,
            <>
              <b className="font-semibold text-foreground">Today's calls.</b> Reminders sent, closer
              notes done.
            </>,
            <b className="font-semibold text-foreground">Unread messages.</b>,
            <>
              <b className="font-semibold text-foreground">Follow-ups,</b> in the order from section
              18. Chats about to hit the 7-day window first.
            </>,
            <>
              <b className="font-semibold text-foreground">Triage calls,</b> ideally 17:00 to 20:00
              his time.
            </>,
            <b className="font-semibold text-foreground">Back through unreads.</b>,
            <>
              <b className="font-semibold text-foreground">Tracker and EOD</b> before you log off.
            </>,
          ]}
        />
        <Sub>Every week</Sub>
        <ul className="mt-3 border-t border-border">
          {[
            ["Role-plays", "2 calls", "With your manager. One easy lead, one hard one."],
            [
              "Work session",
              "1 session",
              "Camera on, mic off, working together. Your manager sets the times.",
            ],
            [
              "Chat review",
              "3–5 chats",
              "Pick one that booked, one that stalled, one that died. Write what you'd change first, then go through it with your manager.",
            ],
            [
              "WhatsApp revival",
              "1 hour",
              "One fresh, personal message to brothers who gave you their number and went quiet in the last month.",
            ],
          ].map(([blk, len, what]) => (
            <li
              key={blk}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-border py-3 text-body sm:grid-cols-[130px_110px_minmax(0,1fr)]"
            >
              <span className="font-semibold">{blk}</span>
              <span className="pt-0.5 font-mono text-caption text-muted-foreground">{len}</span>
              <span className="col-span-2 text-foreground/80 sm:col-span-1">{what}</span>
            </li>
          ))}
        </ul>
        <Sub>Stages and tags in Mochi</Sub>
        <SubNote>
          Every lead sits in one stage. Tags help you find the hot ones and stop two setters
          messaging the same brother.
        </SubNote>
        <ul className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Stages in order">
          {["New", "Talking", "Call pitched", "Link sent", "Booked", "Showed", "Joined"].map(
            (s, i) => (
              <Fragment key={s}>
                {i > 0 && (
                  <li aria-hidden="true" className="px-0.5 text-muted-foreground">
                    →
                  </li>
                )}
                <li className="rounded-full border border-border bg-card px-2.5 py-1.5 text-caption leading-none">
                  {s}
                </li>
              </Fragment>
            ),
          )}
        </ul>
        <div className="mt-2.5">
          <Chips
            muted
            items={[
              "Keyword",
              "Hot",
              "Wants help",
              "Money signal",
              "Triage",
              "Nurture",
              "Not a fit, with reason",
              "Follow up, with date",
            ]}
          />
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Template
            title="Closer note, when he books"
            body={`@handle · name
came in through: keyword (which post) / story reply
lives in:
does now:
wants (his words):
what's stopping him:
what he said about money (if anything):
link used: soft / hard
vibe: hot / cautious / skeptical
anything he's worried about:`}
          />
          <Template
            title="EOD, before you log off"
            body={`EOD · name · date
new conversations (keyword / story reply):
replied to your first message:
follow-ups sent:
calls pitched:
links sent (soft / hard):
calls booked:
triage, kept / cancelled / unreachable:
calls today, showed / no-show:
not a fit, and why:
where i need help:`}
          />
        </div>
        <Sub>When a lead sends a long message</Sub>
        <SubNote>
          Don't answer a heartfelt paragraph with “easier on a call, want the link?” Take ten
          minutes.
        </SubNote>
        <Numbered
          items={[
            "Copy the conversation, and the Mochi summary if there is one.",
            "Paste it into Claude with this playbook and ask for help replying to him.",
            "Rewrite the answer in your own words, cut it into short messages, and delete anything salesy, untrue or about money. Never paste AI text straight into the DMs.",
          ]}
        />
      </Section>

      <Section id="pb-numbers" no="22" title="Your numbers">
        <Lead>
          Targets once you're up to speed. If a number is low, the list below tells you where to
          look.
        </Lead>
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {[
            ["30 min", "Reply time for keyword replies and hot leads on shift"],
            ["40%+", "Of new leads reply to your first message"],
            ["20%+", "Of real conversations get a call pitched"],
            ["60%+", "Of links sent turn into bookings"],
            ["75%+", "Of kept bookings show up"],
            ["3", "Kept bookings a day, still on the calendar after review and triage"],
          ].map(([v, l]) => (
            <div key={l} className="bg-card p-4">
              <p className="text-metric tabular-nums">{v}</p>
              <p className="mt-2 text-caption leading-snug text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
        <Sub>Work it backwards</Sub>
        <SubNote>
          Roughly one in five real conversations gets a call pitched, and about half of those book.
          So three bookings a day looks like this:
        </SubNote>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-body">
          <span className="rounded-[10px] border border-border bg-card px-3 py-2 tabular-nums">
            <b className="font-semibold">30</b> real conversations
          </span>
          <span className="font-mono text-caption text-muted-foreground">→ 20%</span>
          <span className="rounded-[10px] border border-border bg-card px-3 py-2 tabular-nums">
            <b className="font-semibold">6</b> calls pitched
          </span>
          <span className="font-mono text-caption text-muted-foreground">→ 50%</span>
          <span className="rounded-[10px] border border-border bg-card px-3 py-2 tabular-nums">
            <b className="font-semibold">3</b> booked
          </span>
        </div>
        <Tip>
          Tell your manager your income goal. You'll work back from it together to the daily numbers
          that get you there.
        </Tip>
        <Sub>Where it breaks, and what to fix</Sub>
        <ul className="mt-3 border-t border-border">
          {[
            [
              "Few replies to your first message",
              "You didn't give him what the post promised, or it read salesy or copy-pasted. Deliver first, then one easy question.",
            ],
            [
              "Lots of chats, few calls pitched",
              "Stuck in small talk or asking lazy questions. Find the problem, then ask if he wants help.",
            ],
            [
              "Pitched, but no booking",
              "The pitch wasn't about his goal, or he didn't trust it yet. Add value and a video, then pitch again.",
            ],
            [
              "Lots cancelled at review or triage",
              "Qualifying too loosely, or the soft link used too often. Hard link when you're unsure.",
            ],
            [
              "Booked, but no-shows",
              "No warm-up after booking, booked too far out, or weak reminders.",
            ],
            [
              "Showing up, but not joining",
              "Tell your manager. It's either the leads you're booking or something upstream, and the closer's notes will show which.",
            ],
          ].map(([sym, fix]) => (
            <li
              key={sym}
              className="grid gap-1 border-b border-border py-3.5 text-body sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] sm:gap-5"
            >
              <span className="font-semibold">{sym}</span>
              <span className="text-foreground/80">{fix}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="pb-dayone" no="23" title="Day one">
        <Lead>Tick things off as you go. Your ticks and answers stay on this device only.</Lead>
        <Checklist items={DAY_ONE} ticks={ticks.value} onTick={ticks.update} />
        <Sub>The check</Sub>
        <SubNote>Pick an answer and you'll see right away if it's right and why.</SubNote>
        <Quiz />
      </Section>

      <Part no="Paused" title="Only with approval" />

      <Section id="pb-outbound" no="24" title="Outbound (paused)">
        <div className="mt-4 flex max-w-[70ch] flex-wrap items-baseline gap-x-3 gap-y-2 rounded-xl border border-border bg-card px-4 py-3.5 text-body shadow-[inset_2px_0_0_0_var(--warning)]">
          <StatusPill tone="warning">Paused</StatusPill>
          <span>
            Don't do any of this unless your manager approves it. Meta can flag outreach, and the
            account was banned once already.
          </span>
        </div>
        <div className="opacity-80">
          <Lead>
            Outbound means messaging brothers who haven't messaged us first: new followers, people
            who liked or commented. If it's switched back on, this is how it works.
          </Lead>
          <Ticks
            kind="dot"
            items={[
              "It needs Instagram access your manager gives you for it. You never log in on your own.",
              "Start at 20 to 30 messages a day for the whole account, split into morning, midday and evening.",
              "Only message brothers who look like our leads and live in one of our countries.",
              "Never the same message twice. No links, no pitch, no money in the first message.",
              "Instagram shows a warning or blocks an action? Stop for the day and tell your manager.",
            ]}
          />
          <ScriptList
            items={[
              {
                tag: "Approval only",
                ctx: "New follower",
                text: "salam akhi, you already working online or just looking into it?",
              },
            ]}
          />
        </div>
        <p className="mt-10 max-w-[62ch] text-caption text-muted-foreground">
          If something here doesn't match what's happening in the DMs, tell your manager so the
          playbook gets updated.
        </p>
      </Section>
    </>
  );
}

/* ───────────────────────────── small pieces ───────────────────────────── */

function CheckNo({ n }: { n: number }) {
  return (
    <span className="mt-0.5 grid h-[26px] w-[26px] place-items-center rounded-full bg-muted font-mono text-caption font-semibold text-foreground">
      {n}
    </span>
  );
}

function Numbered({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-3 border-t border-border">
      {items.map((item, i) => (
        <li
          key={i}
          className="grid grid-cols-[34px_minmax(0,1fr)] gap-2.5 border-b border-border py-3 text-body leading-6 text-foreground/85"
        >
          <span className="pt-0.5 font-mono text-caption text-muted-foreground">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function LinkCard({
  tone,
  pill,
  title,
  use,
  questions,
}: {
  tone: "green" | "amber";
  pill: string;
  title: string;
  use: string;
  questions: string[];
}) {
  return (
    <Rail tone={tone} className="p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <StatusPill tone={tone === "green" ? "success" : "warning"}>{pill}</StatusPill>
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-2.5 text-body text-foreground/80">
        <b className="font-semibold text-foreground">Use it when:</b> {use}
      </p>
      <ol className="mt-3.5 grid gap-2">
        {questions.map((q, i) => (
          <li
            key={q}
            className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-body leading-snug text-foreground/80"
          >
            <span className="pt-0.5 font-mono text-micro text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{q}</span>
          </li>
        ))}
      </ol>
    </Rail>
  );
}

function Example({
  title,
  pill,
  children,
}: {
  title: string;
  pill: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-semibold">{title}</p>
        {pill}
      </div>
      {children}
    </div>
  );
}

function Template({ title, body }: { title: string; body: string }) {
  return (
    <div className="relative min-w-0 rounded-xl border border-border bg-card p-4">
      <p className="pr-20 text-body font-semibold">{title}</p>
      <pre className="mt-2.5 whitespace-pre-wrap font-mono text-caption leading-5 text-foreground/80">
        {body}
      </pre>
      <div className="absolute right-2.5 top-2.5">
        <CopyButton text={body} />
      </div>
    </div>
  );
}

function Quiz() {
  const store = useStoredRecord<number>(QUIZ_KEY);
  const answers = store.value;
  const answered = QUIZ.filter((_, i) => answers[`q${i}`] !== undefined).length;
  const correct = QUIZ.filter((q, i) => answers[`q${i}`] === q.answer).length;
  const done = answered === QUIZ.length;
  const passed = done && correct >= PASS_MARK;

  return (
    <form className="mt-4 grid gap-3.5" onSubmit={(e) => e.preventDefault()} noValidate>
      {QUIZ.map((item, qi) => {
        const chosen = answers[`q${qi}`];
        const isAnswered = chosen !== undefined;
        const right = chosen === item.answer;
        return (
          <fieldset
            key={item.q}
            className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5"
          >
            <legend className="float-left mb-3 w-full text-body font-medium leading-snug">
              <span className="mr-2 font-mono text-caption text-muted-foreground">
                {String(qi + 1).padStart(2, "0")}
              </span>
              {item.q}
            </legend>
            <div className="clear-both grid gap-1">
              {item.options.map((opt, oi) => {
                const id = `pb-q${qi}-${oi}`;
                const isCorrect = isAnswered && oi === item.answer;
                const isWrongPick = isAnswered && oi === chosen && !right;
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    className={cn(
                      "grid cursor-pointer grid-cols-[18px_minmax(0,1fr)] gap-3 rounded-[10px] px-3 py-2.5 text-body leading-6 text-foreground/85 transition-colors hover:bg-muted/60",
                      isCorrect &&
                        "rounded-l-none bg-muted text-foreground shadow-[inset_2px_0_0_0_var(--success)] hover:bg-muted",
                      isWrongPick &&
                        "rounded-l-none bg-muted text-foreground shadow-[inset_2px_0_0_0_var(--danger)] hover:bg-muted",
                    )}
                  >
                    <input
                      id={id}
                      type="radio"
                      name={`pb-q${qi}`}
                      checked={chosen === oi}
                      onChange={() => store.update(`q${qi}`, oi)}
                      className="mt-1 h-4 w-4 accent-[var(--primary)]"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
            {isAnswered && (
              <p className="mt-2.5 px-3 text-body leading-6 text-foreground/80">
                <b
                  className={cn("mr-1 font-semibold", right ? "text-success-fg" : "text-danger-fg")}
                >
                  {right ? "Right." : "Not quite."}
                </b>
                {item.why}
              </p>
            )}
          </fieldset>
        );
      })}
      <div
        aria-live="polite"
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4",
          done &&
            (passed
              ? "shadow-[inset_2px_0_0_0_var(--success)]"
              : "shadow-[inset_2px_0_0_0_var(--danger)]"),
        )}
      >
        <p className="max-w-[52ch] text-body">
          {!done ? (
            <>
              {answered} of {QUIZ.length} answered, {correct} right. You need {PASS_MARK} right to
              pass.
            </>
          ) : passed ? (
            <>
              <b className="font-semibold text-success-fg">
                Passed, {correct} out of {QUIZ.length}.
              </b>{" "}
              Screenshot this and send it to your manager.
            </>
          ) : (
            <>
              <b className="font-semibold text-danger-fg">
                {correct} out of {QUIZ.length}.
              </b>{" "}
              You need {PASS_MARK}. Read the explanations, reset and go again.
            </>
          )}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={store.reset}>
          Reset the check
        </Button>
      </div>
    </form>
  );
}
