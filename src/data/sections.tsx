import type { Section } from "./content";

const P = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-[13px] leading-relaxed text-foreground/90 ${className}`}>{children}</p>
);

// Script block — subtle shaded background flags this as copy-pasteable
export const Q = ({ children, label }: { children: React.ReactNode; label?: string }) => {
  const copy = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = (e.currentTarget.parentElement?.querySelector("[data-quote]") as HTMLElement | null);
    const txt = el?.innerText || (typeof children === "string" ? children : String(children));
    navigator.clipboard?.writeText(txt);
    const btn = e.currentTarget;
    const prev = btn.innerText;
    btn.innerText = "Copied";
    setTimeout(() => { btn.innerText = prev; }, 1200);
  };
  return (
    <div className="script-block my-1.5 relative rounded-md border-l-2 pl-3 pr-14 py-1.5" data-script>
      {label && <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mr-1.5 align-middle">{label}</span>}
      <span data-quote className="text-[13px] leading-relaxed text-foreground/85">{children}</span>
      <button onClick={copy} className="absolute right-1 top-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/60 bg-background/70 opacity-70 hover:opacity-100 transition" title="Copy script">Copy</button>
    </div>
  );
};

const H = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px] font-semibold uppercase tracking-wide text-foreground mt-3 first:mt-0">{children}</p>
);
const UL = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="list-disc pl-5 space-y-1 text-[13px] text-foreground/90">
    {items.map((i, k) => <li key={k}>{i}</li>)}
  </ul>
);

const Tag = ({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "green" | "yellow" | "red" | "neutral" }) => {
  const toneCls = {
    green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    yellow: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    red: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    neutral: "bg-muted text-foreground border-border",
  }[tone];
  return <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${toneCls}`}>{children}</span>;
};

const NumStep = ({ n, title, sub, color = "var(--tab-stages)" }: { n: number; title: string; sub: string; color?: string }) => (
  <div className="flex gap-3 items-start">
    <div className="w-6 h-6 rounded-full text-white text-[12px] font-semibold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>{n}</div>
    <div className="min-w-0">
      <div className="text-[13px] font-semibold text-foreground">{title}</div>
      <div className="text-[12px] text-muted-foreground leading-snug">{sub}</div>
    </div>
  </div>
);

export const SECTIONS: Section[] = [
  // ===== STAGES =====
  {
    id: "stages",
    heading: "The 8-Stage Setting Process",
    color: "var(--tab-stages)",
    cards: [
      {
        title: "The Setter's Identity",
        subtitle: "New — read before every shift",
        body: (
          <div className="space-y-2">
            <P>Consultant, not salesperson. You diagnose, you don't pitch.</P>
            <P>The frame in every conversation: <i>"i'm figuring out if we can even take you on"</i> — not <i>"let me convince you to book."</i></P>
            <H>Before every shift:</H>
            <Q>my job is to find the right men, not convince the wrong ones.</Q>
            <P>Care about his outcome, stay detached from whether he books. The setter who NEEDS the booking pushes too hard and reads as desperate. The setter who genuinely wants the best for him but is fine either way creates the exact energy that makes men book.</P>
          </div>
        ),
      },
      {
        title: "The 8 Stages",
        subtitle: "10–20 messages, same-day to 48h target",
        body: (
          <div className="space-y-3">
            <NumStep n={1} title="Profile Research" sub="30 sec: age, location, bio, employment, effort" />
            <NumStep n={2} title="Personalized Opener" sub="Reference something specific. End with open question." />
            <NumStep n={3} title="Problem Identification" sub="Find the REAL problem, not the surface complaint" />
            <NumStep n={4} title="Situation Deep-Dive" sub="Income, savings, hours, family, what they've tried" />
            <NumStep n={5} title="Constraint Qualification" sub="Money, Time, or Belief — plus Readiness" />
            <NumStep n={6} title="Support Level Routing" sub="Free community vs full mentorship" />
            <NumStep n={7} title="Recommendation + Positioning" sub="Frame the path based on everything shared" />
            <NumStep n={8} title="Close to Call" sub="Permission close, Calendly, student proof, confirm" />
            <P className="pt-2"><b>4 boxes before any close:</b> Situation, Problem, Constraint, Readiness. Any box blank = you haven't qualified enough to send a link.</P>
          </div>
        ),
      },
      {
        title: "ICP Quick-Check",
        subtitle: "New — keep this open every session",
        body: (
          <div className="space-y-2">
            <P>Conversation stays human. This list stays strict.</P>
            <H><Tag tone="green">Qualified</Tag></H>
            <UL items={[
              "Age 18–35",
              "Employed or earning consistently, min $1,000/mo",
              "Min $1,500 accessible savings",
              "Can dedicate 4–5+ hours daily",
              "Comfortable with computer, Zoom, docs, sheets",
              "Wants a career skill, not a 2-week side hustle",
              "Makes his own financial decisions",
            ]} />
            <H><Tag tone="red">DM-Stage Disqualify</Tag></H>
            <UL items={[
              "Under 18 → hard disqualify in DMs (closer can requalify on call if parents will fund)",
              "Needs parental permission to pay → same rule: DM disqualify, closer handles it live",
              "No income AND no savings AND no plan",
              "Cannot commit 4 hours daily",
              "No computer or unwilling to learn basic software",
              "\"make me a millionaire\" energy",
              "Doesn't control his own money",
            ]} />
            <P className="pt-1"><b>Disqualified ≠ discarded.</b> Route warmly to the free community. Over 35 with everything else strong = judgment call, flag to Abdulrahman. Parental-funded under-18s: only the closer books them, never the setter.</P>

          </div>
        ),
      },
      {
        title: "Stage 1: Profile Research",
        subtitle: "30 seconds before replying",
        body: (
          <div className="space-y-2">
            <H>Check:</H>
            <UL items={[
              "Bio + location signals",
              "Age range if visible",
              "Job or study hints",
              "What content they follow / comment on",
              "Effort level in their first message",
              "Prior attempts (dropshipping, trading, agency pages)",
            ]} />
            <H>Categorize immediately:</H>
            <P><b>EXPLORING</b> — just researching, vague "want to make money online" energy, hasn't started anything</P>
            <P><b>STUCK</b> — 9-5 or steady work, hates it, wants out, income but no exit skill</P>
            <P><b>LEARNING</b> — consuming real content, practicing, hasn't landed a first offer yet</P>
            <P><b>IN THE GAME</b> — already setting or closing somewhere, wants better placement</P>
          </div>
        ),
      },
      {
        title: "Stage 2: Personalized Openers",
        subtitle: "By lead type",
        body: (
          <div className="space-y-2">
            <H>Exploring:</H>
            <Q>i see you're looking into remote income, you actually started learning anything yet or still figuring out where to even begin?</Q>
            <H>Stuck:</H>
            <Q>i can tell the 9-5 is wearing on you lol. you got an actual exit plan or just pushing through for now?</Q>
            <H>Learning:</H>
            <Q>i see you're taking this seriously, respect. you getting real reps anywhere or mostly consuming content right now?</Q>
            <H>In the game:</H>
            <Q>you're further along than most guys who message us. what's the main bottleneck rn, landing a better offer or converting the convos you already have?</Q>
            <H>New follower (inbound):</H>
            <Q>as-salamu alaykum, appreciate the follow. out of curiosity, what made you hit follow?</Q>
            <Q>where are you at rn, just researching, trying to land your first offer, or already setting somewhere?</Q>
          </div>
        ),
      },
      {
        title: "Stage 3: Problem Identification",
        subtitle: "Surface → Real Problem",
        body: (
          <div className="space-y-3">
            {[
              ["\"I hate my job\"", "No exit skill", "what have you actually tried to build income outside of it?"],
              ["\"I want to make hijrah\"", "No income plan for after", "what's the income plan once you're there?"],
              ["\"I need money fast\"", "Urgency without a skill", "what's making it urgent right now?"],
              ["\"Tried dropshipping/crypto\"", "Chasing models, not skills", "what made you stop each one?"],
              ["\"I'm not ready yet\"", "Fear dressed as humility", "what would ready actually look like?"],
              ["\"Fix myself first\"", "Avoidance", "why can't both happen at the same time?"],
              ["\"Can't land an offer\"", "No reps or no proof", "how many real conversations or roleplays have you actually done?"],
            ].map(([say, real, follow], i) => (
              <div key={i} className="border-t border-border/70 pt-2 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] mb-1">
                  <span className="text-foreground/90"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mr-1">They say</span>{say}</span>
                  <span className="text-foreground/90"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Real problem</span>{real}</span>
                </div>
                <Q label="Follow-up">{follow}</Q>
              </div>
            ))}
            <P><b>Empathy:</b> "i see," "i feel you," "it's frustrating when...," "i was in the same spot," "that's more common than you think"</P>
          </div>
        ),
      },
      {
        title: "Stage 4: Situation Deep-Dive",
        subtitle: "Consultant, never interrogator",
        body: (
          <div className="space-y-2">
            <H>Income & stability:</H>
            <Q>you working right now? / roughly what's coming in monthly? / anything set aside or is it paycheck to paycheck?</Q>
            <H>Time:</H>
            <Q>how many hours a day could you realistically put in? this needs 4 to 5, be honest with me</Q>
            <H>What they've tried:</H>
            <Q>what have you put money or time into before? / what worked and what didn't?</Q>
            <H>Family:</H>
            <Q>you supporting anyone right now? / are your parents or wife in the loop on this?</Q>
            <H>Seriousness test (once trust exists):</H>
            <Q>is this something you actually want to make a career over the next 6 to 12 months, or are you more just exploring your options?</Q>
            <H><Tag tone="red">Red flags</Tag></H>
            <UL items={[
              "Needs parental permission to pay",
              "\"i have zero money\" → free community",
              "Dodges every direct question",
              "\"just send me the price\" → comparing, slow down",
              "Demands guarantees before sharing anything",
            ]} />
          </div>
        ),
      },
      {
        title: "Stage 5: Constraint Qualification",
        subtitle: "Money, Time, or Belief + Readiness",
        body: (
          <div className="space-y-2">
            <H>MONEY — frame VALUE and rizq:</H>
            <P>A skill comes with you everywhere, including after hijrah.</P>
            <Q>it will help me a lot if you're comfortable sharing what you're working with right now, income and savings wise, so i can point you to the right path instead of guessing...</Q>
            <H>TIME — frame SPEED:</H>
            <P>Compress 6–12 months of trial and error into weeks.</P>
            <Q>knowing your schedule, would you say you want the full roadmap to work through yourself, or you want to move quick with someone reviewing your actual reps every week?</Q>
            <H>BELIEF — frame REPS + accountability:</H>
            <Q>you don't need to feel ready to start. you build that by doing reps with someone watching your back. what's the part you doubt most, the skill or yourself?</Q>
            <H>READINESS (the 4th box):</H>
            <Q>if the path was clear and it made sense, is this something you'd move on this month, or is it more of a next-year thing?</Q>
            <P>Exploring is fine — it just routes to nurture instead of a call.</P>
          </div>
        ),
      },
      {
        title: "Stage 6: Support Level Routing",
        subtitle: "The routing question",
        body: (
          <div className="space-y-2">
            <Q>what's the level of support you expect.. more like you get the full roadmap and work through it yourself, or you want someone on calls with you every week reviewing your actual conversations and roleplays. where would you draw the line?</Q>
            <UL items={[
              "\"Just the roadmap\" → free Skool community, long-term nurture",
              "\"Roadmap + some feedback\" → free community, revisit in 30 days",
              "\"Real reps and feedback\" → mentorship call",
              "\"Someone on this with me weekly\" → mentorship call, priority",
            ]} />
            <P>Always <b>"expect"</b>, never "need." "Need" undermines. "Expect" treats him like a serious man making a serious decision.</P>
          </div>
        ),
      },
      {
        title: "Stage 7: Recommendation",
        subtitle: "Sell the destination, not the flight",
        body: (
          <div className="space-y-2">
            <P><b>Framework:</b> Acknowledge → Honest opinion → Explain why → Frame the destination → Transition.</P>
            <P>The destination is his life 6 months out: income that travels, an exit date from the job, hijrah that funds itself. Never the curriculum.</P>
            <H>Exploring:</H>
            <Q>honestly, based on where you're at, you're not ready for the mentorship yet and i'd rather be straight with you than take your money. start in the free community, build some consistency, message me in a month.</Q>
            <H>Stuck:</H>
            <Q>you're in a stronger position than you think. you have income, which means you can build the skill without desperation. the goal is simple, build it before you quit, not after.</Q>
            <H>Learning:</H>
            <Q>you've done the hard part, you're already moving. what's missing is reps with someone correcting you in real time. that's the difference between 6 months of guessing and 6 weeks of building.</Q>
            <H>In the game:</H>
            <Q>you've proven you can do the work. at your stage it's about better positioning and a real system so the results become repeatable.</Q>
            <H>"How much?":</H>
            <Q>the investment depends on where you're starting from and the level of support. the call sorts out whether it even makes sense for you first.</Q>
          </div>
        ),
      },
      {
        title: "Stage 8: Close to Call",
        subtitle: "Permission-based close, three flavors",
        body: (
          <div className="space-y-2">
            <H>Default (permission close):</H>
            <Q>let's have a proper chat so i can understand your full situation and show you exactly what the path looks like from where you're standing. if you give me permission to shoot over the calendly, i'll do it!</Q>
            <H>Casual (hot convo):</H>
            <Q>this convo is getting good man, easier to sort on a quick call than typing novels back and forth lol. want me to send the calendar?</Q>
            <H>Value-focused (problem-heavy convo):</H>
            <Q>i've got a clear picture of your [specific situation] now. on the call we'll map the exact path to fix it, and worst case you leave with a free gameplan. want the link?</Q>
            <H>After they agree:</H>
            <Q>[calendly link], ping me when booked so i can confirm on my end.</Q>
            <H>Confirmed:</H>
            <Q>perfect, you're locked in! come with your real questions, bring the doubts too. talk soon insha'Allah.</Q>
            <P className="pt-1"><b>"If you give me permission"</b> = power + humility. Impossible to refuse.</P>
          </div>
        ),
      },
    ],
  },

  // ===== INBOUND =====
  {
    id: "inbound",
    heading: "Inbound Conversation Flow",
    color: "var(--tab-inbound)",
    cards: [
      {
        title: "The Inbound Flow",
        subtitle: "\"path\" / keyword / question → Booked",
        body: (
          <div className="space-y-3">
            {[
              ["Profile Research", "30 sec: bio, location, job, effort in message"],
              ["Personalized Opener", "Reference something real from their page/message"],
              ["Problem Identification", "Validate + dig into why they're really here"],
              ["Deep-Dive", "Woven into conversation, not interrogation"],
              ["Constraint Qualification", "Money, time, or belief — plus readiness"],
              ["Support Level Routing", "Free community vs mentorship"],
              ["Recommendation + Positioning", "Tailored to their level"],
              ["Close to Call", "Permission close or transition to DM Close"],
            ].map(([t, s], i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-[color:var(--tab-inbound)] text-white text-[12px] font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                <div><div className="text-[13px] font-semibold">{t}</div><div className="text-[12px] text-muted-foreground">{s}</div></div>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "The 5-Minute Rule",
        subtitle: "New — inbound is the hottest a lead gets",
        body: (
          <div className="space-y-2">
            <P>An inbound "path" DM is the hottest a lead will ever be. Odds of qualifying drop hard after the first minutes pass.</P>
            <UL items={[
              "Target: first reply within 5 minutes during setting windows",
              "Message request notifications ON at all times",
              "Inbound ALWAYS beats outbound — drop outbound mid-task if a \"path\" message lands",
            ]} />
            <H>If you were away:</H>
            <Q>as-salamu alaykum, sorry for the wait man, was on calls. glad you reached out. where are you at right now, working, studying, or in between?</Q>
          </div>
        ),
      },
      {
        title: "Common Inbound Situations",
        subtitle: "Handle specific triggers",
        body: (
          <div className="space-y-2">
            <H>DM "path" with nothing else:</H>
            <Q>glad you reached out man. before i send anything over, tell me where you're at right now, working, studying, or in between? i'll point you in the right direction from there</Q>
            <H>New follower engages:</H>
            <Q>as-salamu alaykum, appreciate the follow. out of curiosity, what made you hit follow?</Q>
            <Q>where are you at rn, just researching, trying to land your first offer, or already setting somewhere?</Q>
            <H>Ask for free resource from a video:</H>
            <Q>of course, sending it now. quick one though, are you just collecting info or actually planning to move on this? asking because the next step depends on your answer</Q>
            <H>Ask offer/price/guarantees:</H>
            <Q>i could throw numbers at you but honestly that won't mean anything without context on your situation. the real question is what you're doing right now and what's missing</Q>
            <H>"Is this halal?":</H>
            <Q>fair question and i respect that you asked. remote sales is selling real programs people actually want, no interest, no gambling, no deception. and we're picky about which offers our guys work with. what made you ask, seen something shady before?</Q>
            <H>Already sold ("I want in"):</H>
            <Q>love the energy! just so i point you to the right path, what's your situation right now, working, studying, or in between?</Q>
          </div>
        ),
      },
      {
        title: "Problem ID Responses",
        subtitle: "Match their specific situation",
        body: (
          <div className="space-y-2">
            <H>Hates the 9-5:</H>
            <Q>the job isn't really the problem, it's that there's no exit skill yet. once the skill exists, the job becomes a funding source instead of a prison</Q>
            <H>Wants hijrah but stuck:</H>
            <Q>the guys who make the move successfully all did the same thing, built the income BEFORE the flight, not after. doing it in reverse is how people end up coming back</Q>
            <H>Tried everything:</H>
            <Q>notice all of those are business models, not skills. models die, skills don't. sales is the one thing that works inside every model you just listed</Q>
            <H>Wants it fast:</H>
            <Q>i get the urgency, but fast without a skill is how people get burned. the fastest legit path is still a skill plus reps plus someone correcting you in real time</Q>
            <H>Feels behind everyone:</H>
            <Q>comparison is a thief man. the guys you see winning started exactly where you are, most of them later than you. the only real question is what you do with the next 90 days</Q>
            <H>No confidence:</H>
            <Q>confidence isn't a requirement to start, it's a result of starting. nobody feels ready before their first real conversation</Q>
            <H>Waiting for the right time:</H>
            <Q>there's no version of your calendar where a perfect month shows up. rizq is written but you still have to walk toward it</Q>
          </div>
        ),
      },
      {
        title: "Budget Questions",
        subtitle: "The organic ask",
        body: (
          <div className="space-y-2">
            <Q>it will help me a lot if you're comfortable sharing what you're working with right now, income and savings wise, so i can point you to the right path instead of guessing...</Q>
            <Q>it will help me a lot if you're comfortable sharing how much you have set aside to invest in yourself, so i can be straight with you about which direction makes sense...</Q>
            <P><b>Structure:</b> "If you're comfortable sharing" (respectful) + "so i can point you to the right path" (direction in exchange for transparency).</P>
            <P>Can't invest? No shame. Route to the free community warmly. Those men come back.</P>
          </div>
        ),
      },
      {
        title: "Permission Close",
        subtitle: "The signature move",
        body: (
          <div className="space-y-2">
            <Q>let's have a chat tomorrow so i can understand your full situation and show you exactly what the path looks like from where you're standing. if you give me permission to shoot over the calendly, i'll do it!</Q>
            <Q>thanks for being straight with me, it makes this way easier. if you give me permission i'll shoot you over the calendar.</Q>
            <H>After they agree:</H>
            <Q>ping me when booked so i can confirm everything on my end. if there's anything you need before the call, don't hesitate to ask ;)</Q>
          </div>
        ),
      },
    ],
  },

  // ===== OUTBOUND OPENERS =====
  {
    id: "outbound",
    heading: "Outbound Direct DM Openers",
    color: "var(--tab-outbound)",
    cards: [
      {
        title: "The Goal",
        subtitle: "Make them reply. That's it.",
        body: (
          <div className="space-y-2">
            <P>No qualifying, no pitching, no diagnosing. Under 15 words. Must make him feel seen or curious, never defensive.</P>
            <P>Once he replies → <b>Outbound Conversational Flow</b>.</P>
            <P>Remember who you're talking to: a guy scrolling at his job or after Fajr, tired of his situation, skeptical of everything online. Sound like a brother, not a marketer.</P>
          </div>
        ),
      },
      {
        title: "Approved Openers",
        subtitle: "Under 15 words each",
        body: (
          <div className="space-y-2">
            <H>Pure curiosity:</H>
            <Q>yoo</Q>
            <H>Assumption — situation:</H>
            <Q>you're one of those guys who's fully capable but stuck in the wrong environment, i can tell from your page</Q>
            <Q>you strike me as someone who's done the research but hasn't pulled the trigger yet</Q>
            <H>Assumption — deen adjacent (only if page signals it):</H>
            <Q>you're clearly serious about your deen, are you as serious about your income? most guys have one without the other</Q>
            <H>Aspirational gap:</H>
            <Q>if your work ethic matched an actual skill you'd be gone from that job in 6 months</Q>
            <Q>if you put the discipline you have in the gym into a real skill this would be a different conversation</Q>
            <H>Self-awareness:</H>
            <Q>i think you already know what you need to do, you're just not doing it yet</Q>
            <Q>you're closer than you think, you're just in your own way rn</Q>
          </div>
        ),
      },
      {
        title: "Never Say",
        subtitle: "Instant disqualifiers",
        body: (
          <div className="space-y-2">
            <UL items={[
              "\"hey\" / \"hi\" / \"hello\"",
              "\"thanks for the follow\" as a standalone statement (a fresh-follow opener that ENDS WITH A QUESTION is allowed, see Who to DM)",
              "\"I checked your page\"",
              "\"what's been holding you back?\"",
              "\"do you want to make money online?\"",
              "\"we can help you with...\"",
              "\"I'd love to connect\"",
              "\"akhi\" spam to force familiarity",
              "Any qualifying question",
              "Anything longer than 2 sentences",
              "Calling out lurking",
              "Diagnosing before conversation",
              "Preaching or quoting ayat at strangers",
              "Forced humor",
            ]} />
          </div>
        ),
      },
      {
        title: "After They Reply",
        subtitle: "Routing by response type",
        body: (
          <div className="space-y-2">
            <H>Curiosity ("what do you mean?"):</H>
            <P>Share your observation about their specific situation. Don't pitch. → Outbound Conv. Flow</P>
            <H>Reply with their situation:</H>
            <P>Warm outbound conversation. → Outbound Conv. Flow</P>
            <H>Defensive ("who are you?" / "is this a scam?"):</H>
            <Q>lol fair, everyone's been burned by something online. no pitch here, genuinely thought you had potential from your page.</Q>
            <P>If still hostile, move on.</P>
            <H>Stalled mid-convo — pattern interrupts:</H>
            <Q>curious.</Q>
            <Q>interesting take.</Q>
            <Q>you're probably the type who figures things out alone until it stops working, no?</Q>
            <P>One or two words creates curiosity and restarts dead convos.</P>
            <H>No reply:</H>
            <P>Engage stories for a week. Try again 2–3 weeks later with a completely different opener.</P>
          </div>
        ),
      },
      {
        title: "Who to DM",
        subtitle: "Prospecting targets",
        body: (
          <div className="space-y-2">
            <H>NEW FOLLOWER PLAYS:</H>
            <P><b>1. Followed in last 24-48h, no other action:</b> <Q>as-salamu alaykum, appreciate the follow. out of curiosity, what made you hit follow?</Q></P>
            <P><b>2. Older follower, never engaged:</b> do NOT mention the follow. 30-sec profile check, use an approved opener from this section.</P>
            <P><b>3. Follower who engaged (comment, story reply, "path"):</b> switch to Inbound Flow.</P>
            <H>Today:</H>
            <UL items={[
              "Liked/commented on ISA content in last 24h",
              "New follow whose bio/page signals job, gym, deen, or ambition",
            ]} />
            <H>This week:</H>
            <UL items={[
              "Followed in last 7 days, engaged 2+ times",
              "Free Skool community members who haven't taken a step",
            ]} />
            <H><Tag tone="red">Don't</Tag></H>
            <UL items={[
              "Women's accounts (out of ICP, period)",
              "Anyone under 18 or who appears to be",
              "Accounts under 100 followers, no bio, no picture",
              "Said no previously (wait 30+ days)",
              "Competitors and other coaches",
            ]} />
          </div>
        ),
      },
      {
        title: "Good Leads vs Bad Leads",
        subtitle: "Response priority by heat",
        body: (
          <div className="space-y-2">
            <H><Tag tone="green">Green flags — prioritize</Tag></H>
            <UL items={[
              "Employed or earning, mentions savings",
              "Asks specific questions about the skill or process",
              "Transparent about his situation",
              "Reached out inbound",
              "Real timeline (quit date, hijrah plan)",
            ]} />
            <H><Tag tone="yellow">Yellow flags — qualify further</Tag></H>
            <UL items={[
              "Student with some income",
              "Vague on work but high effort in messages",
              "Burned by a course before",
              "Big dreams, no specifics",
            ]} />
            <H><Tag tone="red">Red flags — route out fast</Tag></H>
            <UL items={[
              "\"make me a millionaire\" energy",
              "Asks for free money / free coaching msg 1",
              "No job, no savings, no willingness to change",
              "Needs parental permission to pay",
              "Dodges every direct question",
              "Hostile or disrespectful",
            ]} />
            <H>Response times:</H>
            <UL items={[
              <><Tag tone="red">HOT</Tag> reply within 30 min — qualified, urgency, asked for next steps</>,
              <><Tag tone="yellow">WARM</Tag> within 2 hours — engaged, still qualifying</>,
              <><Tag tone="neutral">COLD</Tag> within 24 hours — early stage, nurture</>,
            ]} />
            <P className="pt-1"><b>BAD LEAD ≠ CAN'T BUY YET.</b> Bad leads get removed. Men who can't buy yet get routed to the free community and treated as brothers. They come back — and they remember.</P>
          </div>
        ),
      },
    ],
  },

  // ===== STORY REPLIES =====
  {
    id: "story",
    heading: "Outbound Story Replies",
    color: "var(--tab-story)",
    cards: [
      {
        title: "DNA of a Good Story Reply",
        subtitle: "The formula",
        body: (
          <div className="space-y-2">
            <H><Tag tone="green">Must</Tag></H>
            <UL items={[
              "React to the SPECIFIC thing they posted",
              "Have a take or opinion",
              "Create a natural reason to reply back",
              "Feel like a sharp friend, not a setter",
            ]} />
            <H><Tag tone="red">Must not</Tag></H>
            <UL items={[
              "Pitch anything",
              "Mention the offer",
              "Ask qualifying questions",
              "Cheerleading positivity",
              "Turn everything into a deen lecture",
              "Sound like a template",
            ]} />
          </div>
        ),
      },
      {
        title: "Struggle / Frustration",
        subtitle: "Job, money, feeling stuck",
        body: (
          <div className="space-y-1.5">
            <Q>i feel you on this one, was in the same spot for a while. what's the main thing keeping you there rn?</Q>
            <Q>the honesty is refreshing lol, most guys pretend they have it figured out. the ones who admit they don't are usually a few months from cracking it</Q>
            <Q>most people try to fix this with more effort at the same job. it's not an effort problem, it's a vehicle problem</Q>
            <Q>this stage is the worst but it's also where every good story starts lol. what have you actually tried so far?</Q>
          </div>
        ),
      },
      {
        title: "Win / Achievement",
        subtitle: "Promotion, PR, first sale, savings",
        body: (
          <div className="space-y-1.5">
            <Q>allahumma baarik akhi 🤲 most guys won't post wins because they're scared of the evil eye or judgment. respect for owning it</Q>
            <Q>allahumma baarik. now imagine this same discipline pointed at something that pays you properly</Q>
            <Q>ma sha Allah, love this. one-off or you building a system behind it?</Q>
            <Q>allahumma baarik — this is the kind of consistency that transfers to anything you touch</Q>
          </div>
        ),
      },
      {
        title: "Deen / Gym / Discipline",
        subtitle: "When discipline is visible",
        body: (
          <div className="space-y-1.5">
            <Q>allahumma baarik, this is the part most guys skip, then wonder why nothing else in their life holds together</Q>
            <Q>ma sha Allah the discipline is clearly there. the only question is what you're pointing it at</Q>
            <Q>you already live harder than most jobs would ever ask of you lol — that's the raw material right there</Q>
          </div>
        ),
      },
      {
        title: "Lifestyle / Personal",
        subtitle: "Travel, food, family, city",
        body: (
          <div className="space-y-1.5">
            <Q>ngl that looks insane. where is this?</Q>
            <Q>hard disagree on [food/place/opinion] lol but respect it</Q>
            <Q>this the kind of life you're trying to make permanent or just a break from the grind?</Q>
          </div>
        ),
      },
      {
        title: "Asking for Help / Advice",
        subtitle: "When he's soliciting input",
        body: (
          <div className="space-y-1.5">
            <Q>honestly? [give your direct opinion]. most people will sugarcoat this</Q>
            <Q>depends what you're optimizing for. quick cash and a real skill are different games rn</Q>
            <Q>this is the right question to be asking. the answer is simpler than you think</Q>
          </div>
        ),
      },
      {
        title: "Quote / Motivation",
        subtitle: "Hustle quotes, hijrah dreams, rizq ayat",
        body: (
          <div className="space-y-1.5">
            <Q>facts. most people read this and change nothing though lol, what are you doing with it?</Q>
            <Q>real. the gap between knowing and doing is where most guys stay stuck for years</Q>
            <Q>rizq is written but the walking is on you. what's the next step you're taking?</Q>
          </div>
        ),
      },
      {
        title: "After They Reply",
        subtitle: "Where to take it",
        body: (
          <div className="space-y-2">
            <H>Casual ("thanks", "haha"):</H>
            <P>Keep it warm, no pitch. React to their next stories.</P>
            <H>Opens conversation:</H>
            <P>Start natural conversation, still don't pitch. → Outbound Conv. Flow</P>
            <H>No reply:</H>
            <P>Fine. React to their next story in 2–3 days. Some guys take 5–10 interactions before they trust you enough to talk.</P>
          </div>
        ),
      },
    ],
  },

  // ===== OUTBOUND CONV FLOW =====
  {
    id: "conv",
    heading: "Outbound Conversational Flow",
    color: "var(--tab-conv)",
    cards: [
      {
        title: "The Outbound Flow",
        subtitle: "6 phases from cold to booked",
        body: (
          <div className="space-y-3">
            {[
              ["Genuine Conversation", "Chit-chat, learn, be a brother first"],
              ["Value Drops", "YouTube videos, free community, case studies"],
              ["They Self-Identify Problem", "Wait for HIM to say what's missing"],
              ["Agree, Expand + Qualify", "Validate, add context, weave in qualifying"],
              ["Route + Close", "Support level, permission close, calendly"],
              ["Post-Close Nurture", "Pre-call video, story engagement, keep value flowing"],
            ].map(([t, s], i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-[color:var(--tab-conv)] text-white text-[12px] font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                <div><div className="text-[13px] font-semibold">{t}</div><div className="text-[12px] text-muted-foreground">{s}</div></div>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "How Outbound Differs",
        subtitle: "Not the same game as inbound",
        body: (
          <div className="space-y-2">
            <P><b>Inbound:</b> they DM'd "path". Already interested. Qualify faster, book same-day where possible.</P>
            <P><b>Outbound:</b> you came to them. They haven't asked for anything and they're skeptical of everyone online. Build trust through real conversation, value drops, and the free community. Let THEM identify their problem.</P>
            <P>Inbound: qualify by msg 2–3. Outbound: qualifying before trust is built kills the conversation instantly. Most have never been sold to properly in their life.</P>
          </div>
        ),
      },
      {
        title: "Phase 1: Genuine Conversation",
        subtitle: "Be a brother first",
        body: (
          <div className="space-y-2">
            <H><Tag tone="green">Rules</Tag></H>
            <UL items={[
              "React genuinely, not strategically",
              "Learn through curiosity, not qualification",
              "Have opinions on what they share",
              "Share your own path into remote sales if natural",
              "React to photos, gym posts, personal stuff",
            ]} />
            <H><Tag tone="red">Not to do</Tag></H>
            <UL items={[
              "Don't ask \"what's your biggest challenge?\" yet",
              "Don't ask about income, savings, or budget",
              "Don't steer toward the offer",
              "Don't skip this phase for hot leads",
              "Don't lecture about deen or hijrah",
            ]} />
          </div>
        ),
      },
      {
        title: "Phase 2: Value Drops",
        subtitle: "Ask permission first — doubles open rate",
        body: (
          <div className="space-y-2">
            <H>Permission-first drop:</H>
            <Q>just remembered there's a video that covers exactly what you're dealing with. want me to send it?</Q>
            <H>YouTube drops:</H>
            <Q>i'd feel bad not sending this over, it breaks down exactly how guys with zero experience land their first setter role</Q>
            <Q>this one will answer half the questions in your head rn. watch it before you spiral lol</Q>
            <H>Case study drop (before → after → timeframe):</H>
            <Q>one of our guys was in almost your exact spot, [before], now he's [after] and it took about [timeframe]. the fix was simpler than you'd think</Q>
            <H>Free community invite (soft):</H>
            <Q>there's a free community where a bunch of guys in your exact situation hang out, some already placed in roles. no catch, i'll send the link if you want</Q>
            <H>Strategic advice:</H>
            <Q>don't overthink the niche stuff, the skill is the same everywhere. output beats planning</Q>
            <P>Between DMs: reply to stories with genuine reactions and free advice.</P>
          </div>
        ),
      },
      {
        title: "Phase 3: Self-Identify Problem",
        subtitle: "Wait for THEM to say it",
        body: (
          <div className="space-y-2">
            <H>Wait for phrases like:</H>
            <UL items={[
              "\"I just don't know where to start\"",
              "\"I've been meaning to do something for a year\"",
              "\"my job is killing me but I can't just quit\"",
              "\"I keep starting things and not finishing\"",
              "\"I want to move but the money isn't there\"",
            ]} />
            <H>If not ready — either/or probe:</H>
            <Q>what's the bigger blocker for you rn, not knowing the path or not trusting yourself to follow it?</Q>
            <Q>is it a money thing, a time thing, or a you thing? be honest lol</Q>
            <P>Still not ready → keep engaging stories, drop another video in a few days. Some leads take 5–10 interactions. The free community warms them for you.</P>
          </div>
        ),
      },
      {
        title: "Phase 4: Agree + Expand + Qualify",
        subtitle: "Never standalone questions",
        body: (
          <div className="space-y-2">
            <H>Agree in their words, then qualify woven in:</H>
            <Q>exactly, and that's the trap. staying busy at the job feels productive but nothing compounds. quick one, how many hours a week could you realistically carve out?</Q>
            <Q>from what you're saying the real issue isn't motivation, it's that there's no structure and nobody checking your work. honestly this is exactly what we built the mentorship around</Q>
            <H>Rewrites — never standalone:</H>
            <P><i>"what's your income?"</i> → </P>
            <Q>the job you're at now, is it at least giving you room to save or is it paycheck to paycheck?</Q>
            <P><i>"do you have savings?"</i> → </P>
            <Q>if the right path was in front of you tomorrow, is investing in it even on the table right now or would that be a stretch?</Q>
            <P><i>"family buy-in?"</i> → </P>
            <Q>are your parents or your wife in the loop on this, or is it something you're building quietly first?</Q>
            <P><b>Pattern:</b> react → add insight → ask ONE thing tied to what they shared.</P>
          </div>
        ),
      },
      {
        title: "Phase 5: Route + Close",
        subtitle: "Support level, then permission",
        body: (
          <div className="space-y-2">
            <H>Routing:</H>
            <Q>knowing everything you've shared.. are you looking for someone to build the plan with you and keep you accountable through the reps, or do you just want the right information so you can run it yourself?</Q>
            <H>Close:</H>
            <Q>you'd be down for a quick call tomorrow? i'll give you real clarity on your [specific situation] either way.. if i have your permission, i'll shoot over the calendly.</Q>
            <H>If price comes up:</H>
            <Q>the investment depends on your situation and the level of support, that's exactly what the call figures out. i'm not going to throw a number at you without context, that's how people get sold instead of guided</Q>
          </div>
        ),
      },
      {
        title: "Phase 6: Post-Close Nurture",
        subtitle: "From booking to showing up",
        body: (
          <div className="space-y-2">
            <H>After booking:</H>
            <Q>i see the call is scheduled, looking forward to it man. could you watch the video below before we talk? it'll make the call 10x more useful</Q>
            <H>Personal touch:</H>
            <Q>appreciate how straight up you were in this convo [Name], makes everything easier</Q>
            <H>Day before:</H>
            <Q>all set for tomorrow insha'Allah?</Q>
            <H>If not booked:</H>
            <Q label="24h">hey, did you get a chance to check the calendar?</Q>
            <Q label="48h">[Name]! just curious if you found a time that works, no worries if not</Q>
            <P>72h+: stop chasing, story engagement only.</P>
            <P>Keep engaging stories even after booking. He should feel he already knows you before the call.</P>
          </div>
        ),
      },
    ],
  },

  // ===== DM CLOSE =====
  {
    id: "dmclose",
    heading: "DM Close Playbook",
    color: "var(--tab-dmclose)",
    cards: [
      {
        title: "The DM Close Flow",
        subtitle: "Only when a call isn't required",
        body: (
          <div className="space-y-3">
            {[
              ["Commitment Test", "Confirm they're serious before any offer talk"],
              ["Present the Path", "Matched to their situation"],
              ["Route to Call", "The call carries pricing, always"],
              ["Handle Objections", "Validate → reframe → path forward"],
              ["Next Steps", "Move fast, remove friction, confirm booking"],
            ].map(([t, s], i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-[color:var(--tab-dmclose)] text-white text-[12px] font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                <div><div className="text-[13px] font-semibold">{t}</div><div className="text-[12px] text-muted-foreground">{s}</div></div>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "When to DM Close",
        subtitle: "Judgement rules",
        body: (
          <div className="space-y-2">
            <H><Tag tone="green">DM close when</Tag></H>
            <UL items={[
              "Self-qualified: Situation, Problem, Constraint, Readiness all clear",
              "Asking \"what are the next steps?\"",
              "The call would be a formality",
              "They explicitly say they hate calls",
              "Budget-constrained → route to free community warmly",
            ]} />
            <H><Tag tone="red">Don't DM close when</Tag></H>
            <UL items={[
              "Not qualified yet",
              "Still asking basic questions",
              "Financial situation not shared",
              "Family/spouse conversation not happened",
              "Investment needs the trust a call builds (almost always for ISA)",
            ]} />
          </div>
        ),
      },
      {
        title: "Objections: Mindset",
        subtitle: "Validate → Reframe → Path",
        body: (
          <div className="space-y-2">
            <H>"I need to think about it":</H>
            <Q>100%, take your time. what's the main thing you're weighing up? sometimes saying it out loud sorts it faster than a week of thinking. worst case the call leaves you with a free gameplan</Q>
            <H>"I need to pray istikhara first":</H>
            <Q>that's exactly the right move and i'd never rush that. when should i check back in with you?</Q>
            <H>"I'm not ready":</H>
            <Q>ready isn't a feeling man, it's a decision. nobody feels ready before their first real rep. what would ready look like, specifically? because if you can't define it, it's fear wearing a costume</Q>
            <H>"I haven't earned it yet":</H>
            <Q>you don't earn the right to learn a skill, you earn results BY learning it. that belief is the exact thing keeping guys stuck for years</Q>
            <H>"I've been scammed before":</H>
            <Q>i hear that a lot and honestly it's why we run things the way we do, heavy support, real accountability, nobody falls through the cracks. what happened with the last thing, so i know what NOT to repeat with you?</Q>
            <H>"I'll try on my own first":</H>
            <Q>respect that, genuinely. how long are you giving yourself before you look back at this message? put a date on it and i'll check in then</Q>
          </div>
        ),
      },
      {
        title: "Objections: Deen & Family",
        subtitle: "The sensitive ones",
        body: (
          <div className="space-y-2">
            <H>"Is this halal?":</H>
            <Q>fair question. you're selling real programs people asked for, no interest, no deception, no gambling. and we're picky about which offers our guys work with. what made you ask, seen something shady before?</Q>
            <H>"My parents won't approve":</H>
            <Q>makes sense, parents want security, not risk. but ask what they actually want for you long term.. it's usually the same thing you want, just through a road they recognize. want something you can show them so they see exactly what this is?</Q>
            <H>"I need to talk to my wife":</H>
            <Q>you should, that's the right move and honestly a green flag. want me to send something you can walk her through so she's not hearing it secondhand?</Q>
            <H>"I need to fix my deen first":</H>
            <Q>who told you income and deen are opposites? earning halal and providing is part of it, not a distraction from it. both can be worked on at the same time, most of our best guys did exactly that</Q>
            <H>"What will people think":</H>
            <Q>the same people will have opinions whether you stay stuck or move forward. one of those versions of you can afford to not care lol</Q>
          </div>
        ),
      },
      {
        title: "Objections: Money & Proof",
        subtitle: "Financial and evidence",
        body: (
          <div className="space-y-2">
            <H>"I don't have money":</H>
            <Q>appreciate the honesty, no shame in it. start in the free community, it costs nothing and the guys in there are on the same path. build from there and message me when things shift</Q>
            <H>"Can you just tell me the price?":</H>
            <Q>i could throw a number but without context it'll just scare you or mislead you. the call figures out if this even makes sense for you first</Q>
            <H>"Can I see proof it works?":</H>
            <Q>check the highlights and the community, real guys, real placements. but results depend on YOUR situation, which is exactly why the call exists</Q>
            <H>"Is there a payment plan?":</H>
            <Q>there are different options, the call goes over all of that once we know the path fits</Q>
          </div>
        ),
      },
      {
        title: "Follow-Up: 3 / 5 / 7 Days",
        subtitle: "New — with the easy out",
        body: (
          <div className="space-y-2">
            <H>Day 3 (no response):</H>
            <Q>hey, still thinking about what you said about [their topic]. did you ever figure out how you're handling [their challenge]?</Q>
            <H>Day 5:</H>
            <Q>just saw something that reminded me of your situation, still dealing with [problem]?</Q>
            <P>Attach the relevant video. Value first, not a nudge.</P>
            <H>Day 7 (final, easy out):</H>
            <Q>i'll close the loop after this. if getting into remote sales is still something you're serious about, happy to point you in the right direction. if the timing isn't right, completely fine too, just let me know either way</Q>
            <P>The easy out is what makes the final message work. Men on the fence often reply to it. After day 7: story nurture only.</P>
          </div>
        ),
      },
      {
        title: "Binary Re-Engagement",
        subtitle: "Force a movement",
        body: (
          <div className="space-y-2">
            <Q>hey, thanks for your patience. ready to book the call and see if the path fits? or not ready to move forward right now, which is also completely fine.</Q>
            <P>Two options. Both move the conversation. Even "not ready" opens a follow-up dialogue and a date to check back in.</P>
          </div>
        ),
      },
    ],
  },

  // ===== PSYCHOLOGY =====
  {
    id: "psych",
    heading: "Psychology — 9 Principles",
    color: "var(--tab-psych)",
    cards: [
      {
        title: "1 — Reference Their Words",
        body: <P>Every message references something they said. Never introduce new topics. They trust you more when they hear their own language reflected back.</P>,
      },
      {
        title: "2 — Confirm Beliefs, Don't Challenge",
        body: (
          <div className="space-y-1.5">
            <P>Even mindset objections get validated first.</P>
            <Q>you're right that it's a risk.</Q>
            <P>Find the truth in what he said, THEN reframe. Arguing with a man's fear makes it stronger.</P>
          </div>
        ),
      },
      {
        title: "3 — Ask Questions You Know the Answer To",
        body: (
          <div className="space-y-1.5">
            <Q>so the job isn't going to fund the hijrah on its own, right?</Q>
            <P>You already know. You're asking so HE says it out loud. His own admission becomes the pain point.</P>
          </div>
        ),
      },
      {
        title: "4 — \"Expect\" vs \"Need\"",
        body: (
          <div className="space-y-1.5">
            <P>Always "what do you <b>expect</b>?" — never "what do you <b>need</b>?"</P>
            <P>"Need" implies he doesn't know. "Expect" treats him like a serious man making a serious decision.</P>
          </div>
        ),
      },
      {
        title: "5 — Abundance Mindset",
        body: <P>You're qualifying men FOR the academy, not chasing them. Your time is valuable, the spots are limited, and it shows in your pacing. The setter who needs nothing is the one people want to work with.</P>,
      },
      {
        title: "6 — Sell the Destination, Not the Flight",
        body: <P>He's not buying calls and roleplays. He's buying the version of himself with income that travels, an exit date, and a hijrah that funds itself. Frame everything as the destination.</P>,
      },
      {
        title: "7 — Turn Background Into Advantage",
        body: <P>Gym discipline, memorizing Quran, working a hard job, learning English as a second language — reframe anything as proof he can do hard things. Lowers resistance, builds belief.</P>,
      },
      {
        title: "8 — Never Answer Questions Directly",
        body: (
          <div className="space-y-1.5">
            <P>"what exactly do you guys do?" doesn't get a service list.</P>
            <Q>depends where you're starting from, what's your situation rn?</Q>
            <P>The person asking questions controls the conversation.</P>
          </div>
        ),
      },
      {
        title: "9 — Setting Is an Emotional Rollercoaster",
        body: (
          <div className="space-y-1.5">
            <P>More than B2B. Curiosity → fear → hope → doubt → trust → decision.</P>
            <UL items={[
              "Beginning: curious brother",
              "Middle: empathetic listener",
              "End: calm authority",
            ]} />
            <P>The biggest enemy isn't a competitor. It's his own hesitation.</P>
          </div>
        ),
      },
    ],
  },

  // ===== ENGAGEMENT =====
  {
    id: "engage",
    heading: "Lead Engagement System",
    color: "var(--tab-engage)",
    cards: [
      {
        title: "Why Engagement Matters",
        subtitle: "They're deciding between you and nothing",
        body: <P>These prospects aren't deciding between you and a competitor — they're deciding between you and doing nothing. Doing nothing always feels safer. The setter who's always on their stories, always present, always genuinely engaged is the one who's there the day the frustration finally outweighs the fear. <b>Presence converts hesitation.</b></P>,
      },
      {
        title: "The Friend Mindset",
        subtitle: "Cadence by lead heat",
        body: (
          <div className="space-y-2">
            <P><Tag tone="red">HOT</Tag> Brothers you talk to <b>DAILY</b>. Active convos, story replies.</P>
            <P><Tag tone="yellow">WARM</Tag> Catch up <b>weekly to monthly</b>. Sent "path" but didn't book, called but didn't join, free community but quiet.</P>
            <P><Tag tone="neutral">COLD</Tag> Check on every <b>few months</b>. Interested but not ready — usually money or family. Nurture through stories and the free community.</P>
            <P className="pt-1">Never burn a bridge with a qualified man who needs time. Life changes fast — raise, bonus, breaking point at work. When it does, he messages the person who treated him well when he had nothing to give.</P>
          </div>
        ),
      },
      {
        title: "Daily Story Engagement",
        subtitle: "15–20 min/day",
        body: (
          <UL items={[
            "Reply to hot lead stories (priority first) — genuine, no pitch",
            "React to warm lead stories (sent \"path\", not booked; called, not closed)",
            "Use ISA's own stories as leverage: \"did you see this one? thought of you\"",
          ]} />
        ),
      },
      {
        title: "Story Re-Engagement Templates",
        subtitle: "By what he just posted",
        body: (
          <div className="space-y-2">
            <H>Gym / discipline content:</H>
            <Q>the consistency is there man. how's the income side coming along?</Q>
            <H>He posts a struggle:</H>
            <Q>i feel you on this. you still thinking about making the move on that thing we talked about?</Q>
            <H>He posts a win:</H>
            <Q>mabrook! imagine what happens with a real system behind this</Q>
            <H>He posts about a course or guru:</H>
            <Q>how's that working out? sometimes too many sources is the actual problem</Q>
          </div>
        ),
      },
      {
        title: "Cold Lead Nurture Sequence",
        subtitle: "30-day arc",
        body: (
          <div className="space-y-1.5">
            <P><b>Day 1:</b> React to story, no pitch</P>
            <P><b>Day 3:</b> Reply to story with a genuine comment</P>
            <P><b>Day 7:</b></P>
            <Q>saw this and thought of your situation</Q>
            <P><b>Day 14:</b></P>
            <Q>hey, how's things going with [their situation]?</Q>
            <P><b>Day 30 (if timing fits):</b></P>
            <Q>things have moved on our end, might be worth a conversation now</Q>
            <P className="pt-1">Never discard a disqualified lead who behaved well. Recycle into the ecosystem. Timing changes, people don't forget who was decent to them.</P>
          </div>
        ),
      },
      {
        title: "Sunday Re-Engagement System",
        subtitle: "3–4 hrs, weekly",
        body: (
          <div className="space-y-1.5">
            <P>Start ~100 leads → 80 personalized follow-ups → 40 re-engage → ~7 calls booked.</P>
            <P>Two weeks later refresh remaining ~33 → 4 more calls → two weeks after → 3 more calls.</P>
            <P>Pipeline of 300+ qualified leads constantly nurturing.</P>
            <P className="pt-1">B2C leads go quiet more often than B2B — the refresh matters <b>more</b> here, not less.</P>
          </div>
        ),
      },
      {
        title: "Student Proof",
        subtitle: "Match proof to prospect",
        body: (
          <div className="space-y-2">
            <UL items={[
              "Best overall transformation (after every booked call)",
              "Best for guys from a 9-5 background",
              "Best for guys who made hijrah",
              "Best for guys who started with heavy doubt",
            ]} />
            <Q>bro, this guy was in almost your exact situation 6 months ago. watch what he did.</Q>
            <P>Case study formula: <b>before → after → timeframe → "the fix was simpler than you'd think."</b></P>
          </div>
        ),
      },
    ],
  },

  // ===== PACING / OPS =====
  {
    id: "pacing",
    heading: "Tracking & Operations",
    color: "var(--tab-pacing)",
    cards: [
      {
        title: "The Daily Setting Flow",
        subtitle: "Windows, not chaos",
        body: (
          <div className="space-y-2">
            <H>Pre-shift (10 min):</H>
            <P>Review active convos, re-read last 3–4 messages each. Prioritize hot → warm → cold. Check new inbound. Scan prospect stories.</P>
            <H>Window 1 (60–90 min, morning):</H>
            <UL items={[
              "All inbound \"path\" first (5-minute rule)",
              "Follow up warm convos",
              "5–10 outbound DMs or story replies",
              "Engage 5–10 prospect stories",
            ]} />
            <H>Mid-day check (15 min):</H>
            <P>Reply to morning responses, quick story round.</P>
            <H>Window 2 (60–90 min, afternoon/evening):</H>
            <UL items={[
              "All pending replies",
              "Chase unbooked calendly links",
              "Another outbound round",
              "Update tracking",
            ]} />
            <H>End of day (10 min):</H>
            <P>Update lead statuses, note tomorrow's follow-ups, log KPIs.</P>
            <P className="pt-1"><b>Flow rules:</b> phone on DND, only Instagram + tracking sheet open, no context switching mid-window. If it's not a DM, it waits.</P>
          </div>
        ),
      },
      {
        title: "Daily Tracking Template",
        subtitle: "What to log",
        body: (
          <div className="space-y-2 text-[12px]">
            <P><b>New leads:</b> "path" received ___ | Openers sent ___ | Response rate ___%</P>
            <P><b>Conversations:</b> Active ___ | Advanced ___ | Stalled ___</P>
            <P><b>Calls:</b> Calendly sent ___ | Booked ___ | Booking rate ___%</P>
            <P><b>Routing:</b> Free community ___ | Disqualified ___</P>
            <P><b>Story engagement:</b> Replied ___ | Warm engaged ___ | Cold re-engaged ___</P>
          </div>
        ),
      },
      {
        title: "Tracking Sheet Per Lead",
        subtitle: "Every column, every window",
        body: (
          <UL items={[
            "Date",
            "Handle + Name",
            "Source (inbound / outbound / story reply)",
            "Age range",
            "Location",
            "Employment (job / student / in between)",
            "Income + savings if shared",
            "Hours available",
            "Family situation (parents / wife / dependants)",
            "Hijrah timeline",
            "Lead type (Exploring / Stuck / Learning / In the Game)",
            "Stage (1–8)",
            "Constraint (Money / Time / Belief)",
            "Readiness",
            "Status (Active / Calendly Sent / Booked / Shown / Closed / Community / Stalled / Cold)",
            "Last contact",
            "Next action",
          ]} />
        ),
      },
      {
        title: "Key Performance Targets",
        subtitle: "8-week ramp",
        body: (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1">Metric</th><th className="pb-1">Start</th><th className="pb-1">4 wk</th><th className="pb-1">8 wk</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Calls booked/day", "1–2", "4", "8"],
                ["Active convos/day", "20–30", "80+", "200"],
                ["Pipeline leads", "/", "50+", "150+"],
                ["Outbound DMs/day", "/", "50", "50"],
                ["Story replies/day", "/", "15–20", "30+"],
                ["Community routes/wk", "/", "10+", "25+"],
              ].map((r, i) => (
                <tr key={i} className="border-t border-border/70">
                  {r.map((c, j) => <td key={j} className="py-1 pr-2">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      },
      {
        title: "Benchmark Stats",
        subtitle: "New — targets, not absolutes",
        body: (
          <div className="space-y-2">
            <P>Expect the lower bands early — this ICP has lower intent than B2B.</P>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 pr-1">Metric</th><th className="pb-1 pr-1">Poor</th><th className="pb-1 pr-1">Avg</th><th className="pb-1 pr-1">Good</th><th className="pb-1">Elite</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Outbound reply", "<5%", "5–10%", "10–20%", "20%+"],
                  ["Inbound → cal sent", "<25%", "25–40%", "40–60%", "60%+"],
                  ["Cal sent → booked", "<40%", "40–60%", "60–80%", "80%+"],
                  ["Show rate", "<50%", "50–65%", "65–80%", "80%+"],
                  ["Msgs to close (inb.)", "25+", "18–25", "10–18", "<10"],
                  ["Hot response time", "2h+", "1–2h", "30–60m", "<30m"],
                ].map((r, i) => (
                  <tr key={i} className="border-t border-border/70">
                    {r.map((c, j) => <td key={j} className="py-1 pr-1">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      },
      {
        title: "The Closer Handoff",
        subtitle: "New — send the moment booking confirms",
        body: (
          <div className="space-y-2">
            <P>A bad handoff wastes everyone's time. The closer gets:</P>
            <UL items={[
              "Name + handle",
              "Lead type + stage",
              "Employment, income, savings shared",
              "Hours available",
              "Family situation + who's in the loop",
              "Hijrah timeline",
              "Primary problem in HIS words",
              "Constraint + Readiness",
              "Objections raised + how handled",
              "Conversation vibe (hot / cautious / skeptical / nervous)",
              "Proof already sent",
            ]} />
            <P className="pt-1">Send it the <b>moment</b> the booking confirms, not the morning of the call.</P>
          </div>
        ),
      },
      {
        title: "Frontline Feedback",
        subtitle: "New — the market intel loop",
        body: (
          <div className="space-y-2">
            <P>The setter talks to more of the market than anyone at ISA. Keep a running market intel doc:</P>
            <UL items={[
              "Common objections + what's working against them",
              "New objections appearing",
              "Competitor and guru mentions",
              "Exact language leads use for their problems",
              "Content pieces driving \"path\" spikes",
            ]} />
            <P>Post observations as they happen in the team channel — one-liners are fine:</P>
            <Q>3 guys this week mentioned [competitor].</Q>
            <P>Weekly 15-min sync with Abdulrahman: lead quality patterns, offer questions, what content to make more of.</P>
          </div>
        ),
      },
      {
        title: "Pacing Rules",
        subtitle: "How every message should feel",
        body: (
          <div className="space-y-2">
            <UL items={[
              "Let him talk more than you. Your messages usually shorter.",
              "One idea per message. One question per message. Never stack.",
              "Match his energy. Paragraphs from him = slightly longer from you.",
              "Don't follow a checklist. Read and respond.",
              "Use his exact words and numbers.",
              "Mindset objections need more space than money objections.",
              "Some close in one session, most take a week+. Don't force speed.",
            ]} />
            <H>Pre-send checklist, every message:</H>
            <UL items={[
              "Did i react to what he just said?",
              "Am i asking more than one question?",
              "Is this longer than his last message?",
              "Does this sound like a human texting a friend?",
              "Does this move the conversation forward?",
            ]} />
          </div>
        ),
      },
      {
        title: "Personality & Tone Rules",
        subtitle: "Sound like a brother, not an email",
        body: (
          <div className="space-y-2">
            <UL items={[
              <>Have strong opinions. <i>"you've been researching for a year, that's not caution anymore, that's hiding"</i></>,
              "Be direct when he's wrong. State it clearly, with warmth.",
              "Lowercase everything. Short sentences. Break long ideas across messages.",
              "Casual language naturally: \"haha\", \"lol\", \"ngl\" when energy fits.",
              "Islamic expressions naturally, never performatively, never 3 per message.",
              "No corporate words. Not \"leverage\", not \"optimize\", not \"synergy\".",
              "One exclamation mark per conversation max. 1–2 emojis per convo max.",
              <>Celebrate genuinely. <i>"BOOM! mabrook man."</i> not <i>"congratulations"</i>.</>,
              "Be human. React to photos, joke, talk gym, food, football, non-business.",
              <>Pull back when appropriate. <i>"just thought i'd share, i'll stop bothering you now lol"</i></>,
            ]} />
            <P className="pt-1">Read every message out loud before sending. If it sounds like an email, rewrite it. The prospect should never be able to tell the setter from Abdulrahman.</P>
          </div>
        ),
      },
      {
        title: "Key Empathy Phrases",
        subtitle: "Rotate, never stack",
        body: (
          <UL items={[
            "\"i see\"",
            "\"i feel you\"",
            "\"it's very frustrating\"",
            "\"i was in the same spot for a long time\"",
            "\"i can fully imagine\"",
            "\"that's way more common than you think\"",
            "\"thanks for being straight with me, helps a lot!\"",
            "\"appreciate the honesty\"",
            "\"no shame in that at all\"",
            "\"transparency just makes it easier for both of us\"",
          ]} />
        ),
      },
      {
        title: "The 10 Non-Negotiables",
        subtitle: "Break one, you're done",
        body: (
          <div className="space-y-1.5">
            <P><b>1.</b> Never sound robotic. Human. Lowercase, 2–4 sentences max.</P>
            <P><b>2.</b> Never mention specific pricing in DMs. All pricing to the call.</P>
            <P><b>3.</b> Never send Calendly before Stage 7. All 4 boxes checked: Situation, Problem, Constraint, Readiness.</P>
            <P><b>4.</b> Never argue deen with a lead. Validate, reframe once, move on. You're a setter, not a mufti.</P>
            <P><b>5.</b> Never book anyone in DMs who needs parental permission to pay (under-18 or otherwise). The closer handles that live on the call. Route unqualified leads to the free community within the first few messages.</P>
            <P><b>6.</b> Inbound "path" messages answered within 5 minutes during setting windows. Always end with a question.</P>
            <P><b>7.</b> Always send the closer handoff the moment a booking confirms. Always send student proof after booking.</P>
            <P><b>8.</b> Always send the daily tracking report. Update the sheet every window, not every day.</P>
            <P><b>9.</b> Never more than 3 follow-ups in DMs. After that, story nurture only.</P>
            <P><b>10.</b> Every Sunday: 3–4 hour lead refresh. Every morning: 50 outbound DMs / story replies. Build the pipeline before you work it.</P>
          </div>
        ),
      },
    ],
  },
];
