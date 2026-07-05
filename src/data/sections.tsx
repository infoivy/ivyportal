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
const UL = ({ items }: { items: string[] }) => (
  <ul className="list-disc pl-5 space-y-1 text-[13px] text-foreground/90">
    {items.map((i, k) => <li key={k}>{i}</li>)}
  </ul>
);


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
        title: "The 8 Stages",
        subtitle: "10–20 messages, same-day to 48h target",
        body: (
          <div className="space-y-3">
            <NumStep n={1} title="Profile Research" sub="30 sec: age, location, bio, employment, content" />
            <NumStep n={2} title="Personalized Opener" sub="Reference something specific. End with open question." />
            <NumStep n={3} title="Problem Identification" sub="Find the REAL problem, not the surface complaint" />
            <NumStep n={4} title="Situation Deep-Dive" sub="Concrete facts: income, savings, hours, what they've tried" />
            <NumStep n={5} title="Constraint Qualification" sub="Primary constraint: Money, Time, or Belief" />
            <NumStep n={6} title="Support Level Routing" sub="Free community vs full mentorship" />
            <NumStep n={7} title="Recommendation + Positioning" sub="Frame the path based on everything shared" />
            <NumStep n={8} title="Close to Call" sub="Book Calendly, send student proof, confirm" />
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
              "Prior attempts (dropshipping, trading, crypto pages)",
            ]} />
            <H>Categorize immediately:</H>
            <P><b>DREAMER</b> — vague “want money online” energy, low-effort messages</P>
            <P><b>STUCK</b> — has 9-5, hates it, wants out, no exit skill</P>
            <P><b>COMMITTED</b> — actively learning, consumes real content</P>
            <P><b>READY</b> — has income/savings, clear hijrah or exit timeline</P>
          </div>
        ),
      },
      {
        title: "Stage 2: Personalized Openers",
        subtitle: "By lead type",
        body: (
          <div className="space-y-2">
            <H>Dreamer:</H>
            <Q>i see you're looking into remote income, you actually started learning anything yet or still figuring out where to even begin?</Q>
            <H>Stuck:</H>
            <Q>i can tell the 9-5 is wearing on you lol. you got an actual exit plan or just pushing through for now?</Q>
            <Q>how long you been thinking about making the move, and what's kept you where you are?</Q>
            <H>Committed:</H>
            <Q>i see you're taking this seriously, respect. you getting real practice anywhere or mostly consuming content right now?</Q>
            <H>Ready:</H>
            <Q>you seem further along than most guys who message us. what's the actual timeline you're working with?</Q>
          </div>
        ),
      },
      {
        title: "Stage 3: Problem Identification",
        subtitle: "Surface → Real Problem",
        body: (
          <div className="space-y-2">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 pr-2">THEY SAY</th>
                  <th className="pb-1 pr-2">REAL PROBLEM</th>
                  <th className="pb-1">FOLLOW-UP</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {[
                  ["“I hate my job”", "No exit skill", "“what have you actually tried to build income outside of it?”"],
                  ["“I want to make hijrah”", "No income plan for after", "“what's the income plan once you're there?”"],
                  ["“I need money fast”", "Urgency without a skill", "“what's making it urgent right now?”"],
                  ["“Tried dropshipping/crypto”", "Chasing models, not skills", "“what made you stop each one?”"],
                  ["“I'm not ready yet”", "Fear dressed as humility", "“what would ready actually look like for you?”"],
                  ["“Fix myself first”", "Avoidance", "“what does fixed look like, and why can't both happen at the same time?”"],
                ].map((r, i) => (
                  <tr key={i} className="border-t border-border/70">
                    <td className="py-1 pr-2">{r[0]}</td>
                    <td className="py-1 pr-2">{r[1]}</td>
                    <td className="py-1 italic text-foreground/80">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <P><b>Empathy:</b> “i see,” “i feel you,” “it's frustrating when...,” “i was in the same spot,” “that's more common than you think”</P>
          </div>
        ),
      },
      {
        title: "Stage 4: Situation Deep-Dive",
        subtitle: "Become a consultant",
        body: (
          <div className="space-y-2">
            <H>Income & stability:</H>
            <Q>you working right now? / roughly what's coming in monthly? / any savings set aside or living paycheck to paycheck?</Q>
            <H>What they've tried:</H>
            <Q>what have you put money or time into before? / what worked and what didn't?</Q>
            <H>Time available:</H>
            <Q>how many hours a week could you realistically put into this? / what does your day look like?</Q>
            <H>Family situation:</H>
            <Q>you supporting anyone right now? / are your parents or wife aware you're looking at this?</Q>
            <H>Hijrah & goals:</H>
            <Q>is the move a real timeline or more of a someday thing? / where are you looking to go?</Q>
            <H>Red flags:</H>
            <UL items={[
              "“how do I become a millionaire” — not serious",
              "“I have zero money” — route to free community",
              "“my parents control my money” — not decision maker",
              "“just send me the price” — comparing, slow them down",
              "Asks for guarantees before sharing anything — needs nurture",
            ]} />
          </div>
        ),
      },
      {
        title: "Stage 5: Constraint Qualification",
        subtitle: "Money, Time, or Belief",
        body: (
          <div className="space-y-2">
            <H>MONEY:</H>
            <P>Frame <b>VALUE</b> and rizq. A skill comes with you everywhere, including after hijrah.</P>
            <Q>it will help me a lot if you're comfortable sharing what you're working with right now, income and savings wise, so i can point you to the right path instead of guessing...</Q>
            <H>TIME:</H>
            <P>Frame <b>SPEED</b> — compress 6–12 months of trial and error into weeks.</P>
            <Q>knowing your schedule, would you say you want the full roadmap to work through yourself, or you want to move quick with someone reviewing your actual reps every week?</Q>
            <H>BELIEF:</H>
            <P>Frame <b>REPS</b> and accountability. Confidence is built by doing, not before doing.</P>
            <Q>you don't need to feel ready to start. you build that by doing reps with someone watching your back. what's the part you doubt most, the skill or yourself?</Q>
          </div>
        ),
      },
      {
        title: "Stage 6: Support Level Routing",
        subtitle: "The routing question",
        body: (
          <div className="space-y-2">
            <Q>what's the level of support you expect.. more like you get the full roadmap and work through it yourself, or you want someone on calls with you every week reviewing your actual conversations and roleplays. where would you draw the line?</Q>
            <H>For busy leads (reframe as speed):</H>
            <Q>knowing your schedule, would you say it's important to have the information to work through on your own time, or you really want to move quick with 1-on-1's?</Q>
            <UL items={[
              "“Just the roadmap” → free Skool community, long-term nurture",
              "“Roadmap + some feedback” → free community, revisit in 30 days",
              "“Real reps and feedback” → mentorship call",
              "“Someone on this with me weekly” → mentorship call, priority",
            ]} />
            <P>Always <b>“expect”</b> not “need.” “Need” undermines. “Expect” treats him like a serious man making a serious decision.</P>
          </div>
        ),
      },
      {
        title: "Stage 7: Recommendation",
        subtitle: "Framework for positioning",
        body: (
          <div className="space-y-2">
            <P><b>Framework:</b> Acknowledge → Honest opinion → Explain why → Frame transformation → Transition.</P>
            <H>Dreamer:</H>
            <Q>honestly, based on where you're at, you're not ready for the mentorship yet and i'd rather be straight with you than take your money. start in the free community, build some consistency, and message me in a month.</Q>
            <H>Stuck:</H>
            <Q>you're actually in a stronger position than you think. you have income, which means you can invest in a skill without desperation. the goal is simple, build the skill before you quit, not after.</Q>
            <H>Committed:</H>
            <Q>you've done the hard part, you're already moving. what's missing is structure and reps with feedback. that's the difference between 6 months of guessing and 6 weeks of building.</Q>
            <H>Ready:</H>
            <Q>you have the means and the timeline. at your stage it's purely about speed and not wasting months on trial and error. this is exactly the situation the mentorship was built for.</Q>
            <P><b>“How much?”:</b> Never specific. “the investment depends on where you're starting from and the level of support. the call sorts out whether it even makes sense for you first.”</P>
          </div>
        ),
      },
      {
        title: "Stage 8: Close to Call",
        subtitle: "Permission-based close",
        body: (
          <div className="space-y-2">
            <Q>let's have a proper chat so i can understand your full situation and show you exactly what the path looks like from where you're standing. if you give me permission to shoot over the calendly, i'll do it!</Q>
            <Q>here's the calendar: [calendly link]. ping me when booked so i can confirm on my end.</Q>
            <Q>perfect, you're locked in! come with your real questions, bring the doubts too. talk soon insha'Allah.</Q>
            <H>Follow-ups:</H>
            <P>24h: “hey did you get a chance to check the calendar?”</P>
            <P>48h: “just checking in, any time work this week?”</P>
            <P>After: story nurture, stop chasing beyond 3 attempts.</P>
            <P className="pt-1"><b>“If you give me permission” = power + humility. Impossible to refuse.</b></P>
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
        subtitle: "“path” / keyword / question → Booked",
        body: (
          <div className="space-y-3">
            {[
              ["Profile Research", "30 sec: bio, location, job, effort in message"],
              ["Personalized Opener", "Reference something real from their page/message"],
              ["Problem Identification", "Validate + dig into why they're here"],
              ["Deep-Dive", "Woven into conversation, not interrogation"],
              ["Constraint Qualification", "Money, time, or belief"],
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
        title: "Common Inbound Situations",
        subtitle: "Handle specific triggers",
        body: (
          <div className="space-y-2">
            <H>They DM “path” with nothing else:</H>
            <Q>glad you reached out man. before i send anything over, tell me where you're at right now, working, studying, or in between? i'll point you in the right direction from there</Q>
            <H>Ask for a free resource from a video:</H>
            <Q>of course, sending it now. quick one though, are you just collecting info or actually planning to move on this? asking because the next step depends on your answer</Q>
            <H>Ask offer/price/guarantees:</H>
            <Q>i could throw numbers at you but honestly that won't mean anything without context on your situation. the real question is what you're doing right now and what's missing</Q>
            <H>“Is this halal?”:</H>
            <Q>fair question and i respect that you asked. remote sales is selling real programs and services people actually want, no interest, no gambling, no deception. we only work with offers we'd stand behind. what made you ask, past experience with something shady?</Q>
            <H>Already sold (“I want in”):</H>
            <Q>love the energy! just so i point you to the right path, what's your situation right now, working, studying, or in between? and is the goal income here or income you can take with you somewhere?</Q>
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
            <P>“If you're comfortable sharing” (respectful) + “so i can point you to the right path” (they want direction). Direction in exchange for transparency. If they can't invest, no shame — route to the free community warmly. Those men come back.</P>
          </div>
        ),
      },
      {
        title: "Permission Close",
        subtitle: "Always ask permission",
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
        subtitle: "One job only",
        body: (
          <div className="space-y-2">
            <P><b>Make them reply. That's it.</b> No qualifying, no pitching, no diagnosing. Start a conversation that feels so natural or curiosity-inducing that they HAVE to respond. Once they reply → transition into Outbound Conversational Flow.</P>
            <P>Remember who you're talking to: a guy scrolling at his job or in bed after Fajr, tired of his situation, skeptical of everything online. <b>Sound like a brother, not a marketer.</b></P>
          </div>
        ),
      },
      {
        title: "Approved Openers",
        subtitle: "By angle",
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
            <Q>if your income matched your ambition you'd already be out there</Q>
            <H>Self-awareness:</H>
            <Q>i think you already know what you need to do, you're just not doing it yet</Q>
            <Q>you're closer than you think, you're just in your own way rn</Q>
          </div>
        ),
      },
      {
        title: "Never Say",
        subtitle: "Instant conversation killers",
        body: (
          <UL items={[
            "“hey” / “hi” / “hello” / “thanks for the follow”",
            "“I checked your page”",
            "“what's been holding you back?”",
            "“do you want to make money online?”",
            "“we can help you with...”",
            "“I'd love to connect”",
            "“akhi” spam to force familiarity",
            "Any qualifying question",
            "Anything longer than 2 sentences",
            "Calling out lurking",
            "Diagnosing before conversation",
            "Preaching or quoting ayat at strangers",
            "Forced humor",
          ]} />
        ),
      },
      {
        title: "After They Reply",
        subtitle: "Transition by their response",
        body: (
          <div className="space-y-2">
            <H>Curiosity (“what do you mean?”):</H>
            <P>Share your observation about their specific situation. Don't pitch. → Outbound Conv. Flow</P>
            <H>Reply with their situation:</H>
            <P>Warm outbound conversation → Outbound Conv. Flow</P>
            <H>Defensive (“who are you?” / “scam?”):</H>
            <Q>lol fair, everyone's been burned by something online. no pitch here, genuinely thought you had potential from your page.</Q>
            <P>If still hostile, move on.</P>
            <H>No reply:</H>
            <P>Engage stories for a week. Try again 2–3 weeks later with a completely different opener.</P>
          </div>
        ),
      },
      {
        title: "Who to DM",
        subtitle: "Targeting priorities",
        body: (
          <div className="space-y-2">
            <H>Today:</H>
            <UL items={[
              "Liked/commented on ISA content in last 24h",
              "New follow whose bio signals job, gym, deen, or ambition",
            ]} />
            <H>This week:</H>
            <UL items={[
              "Followed in last 7 days + engaged 2+ times",
              "Members active in free Skool community who haven't taken a step",
            ]} />
            <H>Don't:</H>
            <UL items={[
              "Women's accounts (out of ICP, period)",
              "Under 100 followers with no bio or picture",
              "Said no before (wait 30+ days)",
              "Anyone under 18 or appearing to be",
              "Competitors and other coaches",
            ]} />
          </div>
        ),
      },
      {
        title: "Good Leads vs Bad Leads",
        subtitle: "Filter early, save hours",
        body: (
          <div className="space-y-2">
            <H>Deprioritize / remove:</H>
            <UL items={[
              "“Make me a millionaire” energy",
              "Asks for free money/coaching in message 1",
              "No job, no savings, no willingness to change",
              "Repost/meme accounts",
              "Spam and bot accounts",
              "Anyone disrespectful",
            ]} />
            <P>Qualify on <b>situation, not location.</b> A stuck lead with a job and savings is a lead wherever he lives. Financial questions in Stage 4–5 do the filtering — ask early when signals are weak.</P>
            <P><b>BAD LEAD vs CAN'T BUY YET:</b> massive difference. Bad leads get removed. Men who can't buy yet get routed to the free community and treated as brothers. Be kind, stay engaged, follow up in months. They WILL come back — and they remember who was good to them when they were broke.</P>
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
        subtitle: "Sharp friend, not a setter",
        body: (
          <div className="space-y-2">
            <H>Must:</H>
            <UL items={[
              "React to the SPECIFIC thing they posted",
              "Have a take or opinion",
              "Create a natural reason to reply back",
              "Feel like a sharp friend, not a setter",
            ]} />
            <H>Must NOT:</H>
            <UL items={[
              "Pitch anything",
              "Mention the offer",
              "Ask qualifying questions",
              "Cheerlead overly positive",
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
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Q>this is fire, most guys won't post wins because they're scared of the evil eye or judgment. respect 🤝</Q>
            <Q>mabrook man. now imagine this discipline pointed at something that pays you properly</Q>
            <Q>love this. one-off or you building a system behind it?</Q>
            <Q>BOOM. this is the kind of consistency that transfers to anything you touch</Q>
          </div>
        ),
      },
      {
        title: "Deen / Gym / Discipline",
        subtitle: "Point the discipline",
        body: (
          <div className="space-y-2">
            <Q>this is the part most guys skip, then wonder why nothing else in their life holds together</Q>
            <Q>the discipline is clearly there. the only question is what you're pointing it at</Q>
            <Q>you already live harder than most jobs would ever ask of you lol, that's the raw material right there</Q>
          </div>
        ),
      },
      {
        title: "Lifestyle / Personal",
        subtitle: "Travel, food, family, city shots",
        body: (
          <div className="space-y-2">
            <Q>ngl that looks insane. where is this?</Q>
            <Q>hard disagree on [food/place/opinion] lol but respect it</Q>
            <Q>this the kind of life you're trying to make permanent or just a break from the grind?</Q>
          </div>
        ),
      },
      {
        title: "Asking for Help / Advice",
        subtitle: "Direct opinions win",
        body: (
          <div className="space-y-2">
            <Q>honestly? [give your direct opinion]. most people will sugarcoat this</Q>
            <Q>depends what you're optimizing for. quick cash and a real skill are different games rn</Q>
            <Q>this is the right question to be asking. the answer is simpler than you think</Q>
          </div>
        ),
      },
      {
        title: "Quote / Motivation",
        subtitle: "Hustle, hijrah, rizq",
        body: (
          <div className="space-y-2">
            <Q>facts. most people read this and change nothing though lol, what are you doing with it?</Q>
            <Q>real. the gap between knowing and doing is where most guys stay stuck for years</Q>
            <Q>rizq is written but the walking is on you. what's the next step you're taking?</Q>
          </div>
        ),
      },
      {
        title: "After They Reply",
        subtitle: "How to transition",
        body: (
          <div className="space-y-2">
            <H>Casual (“thanks”, “haha”):</H>
            <P>Keep it warm, no pitch. React to their next stories.</P>
            <H>Opens conversation:</H>
            <P>Start natural conversation, still don't pitch → Outbound Conv. Flow</P>
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
        subtitle: "6 phases, trust-first",
        body: (
          <div className="space-y-3">
            {[
              ["Genuine Conversation", "Chit-chat, learn about them, brother first"],
              ["Value Drops", "YouTube videos, free community, real advice"],
              ["They Self-Identify Problem", "Wait for THEM to say what's missing"],
              ["Agree, Expand + Qualify", "Validate, add context, weave qualifying"],
              ["Route + Close", "Support level, permission close, calendly"],
              ["Post-Close Nurture", "Pre-call video, story engagement"],
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
        subtitle: "Trust before qualification",
        body: (
          <div className="space-y-2">
            <H>Inbound:</H>
            <P>They DM'd “path”. Already interested. Qualify faster, book same-day where possible.</P>
            <H>Outbound:</H>
            <P>You came to them. They haven't asked for anything and they're skeptical of everyone online. Build trust through real conversation, value drops, and the free community. Let THEM identify their problem. Some close in days, most take 1–2 weeks of presence.</P>
            <P>In inbound you qualify by message 2–3. In outbound, <b>qualifying before trust is built kills the conversation instantly.</b> These are not business owners used to sales conversations — most have never been sold to properly in their life.</P>
          </div>
        ),
      },
      {
        title: "Phase 1: Genuine Conversation",
        subtitle: "Be a brother, not a salesman",
        body: (
          <div className="space-y-2">
            <H>Rules:</H>
            <UL items={[
              "React genuinely, not strategically",
              "Learn through curiosity, not qualification",
              "Have opinions on what they share",
              "Share about yourself, your own path in, if natural",
              "React to gym posts, photos, personal stuff",
            ]} />
            <H>Not to do:</H>
            <UL items={[
              "Don't ask “what's your biggest challenge?” yet",
              "Don't ask about income, savings, budget",
              "Don't steer toward the offer",
              "Don't skip this phase for hot leads",
              "Don't lecture about deen or hijrah — they get enough of that",
            ]} />
          </div>
        ),
      },
      {
        title: "Phase 2: Value Drops",
        subtitle: "Earn trust through value",
        body: (
          <div className="space-y-2">
            <H>YouTube / content drops:</H>
            <Q>i'd feel bad not sending this over, it breaks down exactly how guys with zero experience get their first setter role</Q>
            <Q>this one will answer half the questions in your head rn. watch it before you spiral lol</Q>
            <H>Free community invite (soft):</H>
            <Q>there's a free community where a bunch of guys in your exact situation hang out, some already placed in roles. no catch, i'll send the link if you want</Q>
            <H>Strategic advice:</H>
            <Q>don't overthink the niche stuff, the skill is the same everywhere. output beats planning</Q>
            <Q>sometimes the smarter play is learning to do this yourself with proper guidance instead of jumping between free videos</Q>
            <P>Between DMs: reply to their stories with genuine reactions and free advice.</P>
          </div>
        ),
      },
      {
        title: "Phase 3: Self-Identify Problem",
        subtitle: "Wait for THEM to say it",
        body: (
          <div className="space-y-2">
            <H>Wait for them to say:</H>
            <UL items={[
              "“I just don't know where to start”",
              "“I've been meaning to do something for a year”",
              "“my job is killing me but I can't just quit”",
              "“I keep starting things and not finishing”",
              "“I want to move but the money isn't there”",
            ]} />
            <H>If not ready, either/or probe:</H>
            <Q>what's the bigger blocker for you rn, not knowing the path or not trusting yourself to follow it?</Q>
            <Q>is it a money thing, a time thing, or a you thing? be honest lol</Q>
            <P>If still not ready: keep engaging stories, drop another video in a few days. Some leads take 5–10 interactions. The free community warms them for you.</P>
          </div>
        ),
      },
      {
        title: "Phase 4: Agree + Expand + Qualify",
        subtitle: "Weave, never standalone",
        body: (
          <div className="space-y-2">
            <H>Agree using their words, then qualify woven in:</H>
            <Q>exactly, and that's the trap. staying busy at the job feels productive but nothing compounds. quick one, how many hours a week could you realistically carve out?</Q>
            <Q>from what you're saying the real issue isn't motivation, it's that there's no structure and nobody checking your work. honestly this is exactly what we built the mentorship around</Q>
            <H>Never standalone — always woven:</H>
            <P><b>“What's your income?”</b> → “the job you're at now, is it at least giving you room to save or is it paycheck to paycheck?”</P>
            <P><b>“Do you have savings?”</b> → “if the right path was in front of you tomorrow, is investing in it even on the table right now or would that be a stretch?”</P>
            <P><b>“Family buy-in?”</b> → “are your parents or your wife in the loop on this, or is it something you're building quietly first?”</P>
            <P>Pattern: <b>react to what they said → add insight → ask ONE thing tied to what they shared.</b></P>
          </div>
        ),
      },
      {
        title: "Phase 5: Route + Close",
        subtitle: "Support level → calendar",
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
        subtitle: "They arrive already knowing you",
        body: (
          <div className="space-y-2">
            <H>After booking:</H>
            <Q>i see the call is scheduled, looking forward to it man. could you watch the video below before we talk? it'll make the call 10x more useful</Q>
            <H>Personal touch:</H>
            <Q>appreciate how straight up you were in this convo [Name], makes everything easier</Q>
            <H>Day before:</H>
            <Q>all set for tomorrow insha'Allah?</Q>
            <H>If not booked:</H>
            <P>24h: “hey, did you get a chance to check the calendar?”</P>
            <P>48h: “[Name]! just curious if you found a time that works”</P>
            <P>72h+: stop chasing, story engagement only.</P>
            <P>Keep engaging their stories even after booking. Goal: they feel like they already know you before the call.</P>
          </div>
        ),
      },
    ],
  },

  // ===== DM CLOSE + OBJECTIONS =====
  {
    id: "dmclose",
    heading: "DM Close & Objections Playbook",
    color: "var(--tab-dmclose)",
    cards: [
      {
        title: "The DM Close Flow",
        subtitle: "5 phases",
        body: (
          <div className="space-y-3">
            {[
              ["Commitment Test", "Confirm serious before offer talk"],
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
        subtitle: "Green lights & red lights",
        body: (
          <div className="space-y-2">
            <H>DM close when:</H>
            <UL items={[
              "Self-qualified (income, savings, time, problem clear)",
              "Asking “what are the next steps?”",
              "Mentorship clearly fits, call would be a formality",
              "Explicitly hates calls (rare)",
              "Budget-constrained: route to free community, no call",
            ]} />
            <H>Don't DM close when:</H>
            <UL items={[
              "Not qualified yet",
              "Still asking basic questions",
              "Hasn't shared financial situation",
              "Family or spouse conversation hasn't happened",
              "Confusion about what the mentorship actually is",
            ]} />
          </div>
        ),
      },
      {
        title: "Time & Trust Objections",
        subtitle: "Think about it / istikhara / halal / scammed",
        body: (
          <div className="space-y-2">
            <H>“I need to think about it”:</H>
            <Q>100%, take your time. what's the main thing you're weighing up? sometimes saying it out loud sorts it faster than a week of thinking</Q>
            <H>“I need to pray istikhara”:</H>
            <Q>that's exactly the right move and i'd never rush that. when should i check back in with you?</Q>
            <H>“Is this halal?”:</H>
            <Q>fair question. you're selling real programs people asked for, no interest, no deception, no gambling. and we're picky about which offers our guys work with. what made you ask, seen something shady before?</Q>
            <H>“I've been scammed before”:</H>
            <Q>i hear that a lot and honestly it's why we run things the way we do, heavy support, real accountability, nobody falls through the cracks. what happened with the last thing, so i know what NOT to repeat with you?</Q>
          </div>
        ),
      },
      {
        title: "Family Objections",
        subtitle: "Parents / wife / approval",
        body: (
          <div className="space-y-2">
            <H>“My parents won't approve”:</H>
            <Q>makes sense, parents want security, not risk. but ask what they actually want for you long term.. it's usually the same thing you want, just through a road they recognize. want something you can show them so they see exactly what this is?</Q>
            <H>“I need to talk to my wife”:</H>
            <Q>you should, that's the right move and honestly a green flag. want me to send something you can walk her through so she's not hearing it secondhand?</Q>
            <H>“What will people think”:</H>
            <Q>the same people will have opinions whether you stay stuck or move forward. one of those versions of you can afford to not care lol</Q>
          </div>
        ),
      },
      {
        title: "Mindset Objections",
        subtitle: "Deen / not ready / haven't earned it",
        body: (
          <div className="space-y-2">
            <H>“I need to fix my deen first”:</H>
            <Q>who told you income and deen are opposites? earning halal and providing is part of it, not a distraction from it. both can be worked on at the same time, most of our best guys did exactly that</Q>
            <H>“I'm not ready”:</H>
            <Q>ready isn't a feeling man, it's a decision. nobody feels ready before their first real rep. what would ready look like, specifically? because if you can't define it, it's fear wearing a costume</Q>
            <H>“I haven't earned it yet”:</H>
            <Q>you don't earn the right to learn a skill, you earn results BY learning it. that belief is the exact thing keeping guys stuck for years</Q>
            <H>“I'll try on my own first”:</H>
            <Q>respect that, genuinely. how long are you giving yourself before you look back at this message? put a date on it and i'll check in then</Q>
          </div>
        ),
      },
      {
        title: "Money & Price Objections",
        subtitle: "No money / just tell me / proof / payments",
        body: (
          <div className="space-y-2">
            <H>“I don't have money”:</H>
            <Q>appreciate the honesty, no shame in it. start in the free community, it costs nothing and the guys in there are on the same path. build from there and message me when things shift</Q>
            <H>“Can you just tell me the price?”:</H>
            <Q>i could throw a number but without context it'll just scare you or mislead you. the call figures out if this even makes sense for you first</Q>
            <H>“Can I see proof it works?”:</H>
            <Q>check the highlights and the community, real guys, real placements. but results depend on YOUR situation, which is exactly why the call exists</Q>
            <H>“Is there a payment plan?”:</H>
            <Q>there are different options, the call goes over all of that once we know the path fits</Q>
          </div>
        ),
      },
      {
        title: "Binary Re-Engagement",
        subtitle: "Both options move the convo",
        body: (
          <div className="space-y-2">
            <Q>hey, thanks for your patience. ready to book the call and see if the path fits? or not ready to move forward right now, which is also completely fine.</Q>
            <P>Two options. Both move the conversation. Even “not ready” opens a follow-up dialogue and a date to check back in.</P>
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
      { title: "1. Reference Their Words", subtitle: "Never introduce new topics", body: <P>Every message references something they said. They trust you more when they hear their own language reflected back.</P> },
      { title: "2. Confirm Beliefs", subtitle: "Don't challenge them", body: <P>Even mindset objections get validated first. <b>“You're right that it's a risk.”</b> Find the truth in what they said, THEN reframe. Arguing with a man's fear makes it stronger.</P> },
      { title: "3. Ask Questions You Know", subtitle: "Get HIM to say it", body: <div className="space-y-1"><Q>so the job isn't going to fund the hijrah on its own, right?</Q><P>You already know. You're asking so HE says it out loud. His own admission becomes the pain point.</P></div> },
      { title: "4. Long In → Long Out", subtitle: "Depth breeds depth", body: <P>Thoughtful, multi-sentence messages that show you understood his situation produce paragraphs in return.</P> },
      { title: "5. Expect, Not Need", subtitle: "Position him as a serious man", body: <P>Always “what do you <b>expect</b>?” — never “what do you <b>need</b>?” “Need” implies he doesn't know. “Expect” treats him like a serious man making a serious decision.</P> },
      { title: "6. Authoritative Yet Humble", subtitle: "Big brother energy", body: <P>Someone who's walked the path, diagnoses honestly, never pushes. <b>“If you give me permission to send the calendar”</b> = power + humility.</P> },
      { title: "7. Background = Advantage", subtitle: "Reframe their strengths", body: <P>Gym discipline, memorizing Quran, hard job, English as a second language. Reframe anything as proof he can do hard things. Lowers resistance, builds belief.</P> },
      { title: "8. Never Answer Directly", subtitle: "Questioner controls the frame", body: <div className="space-y-1"><P><b>“What exactly do you guys do?”</b> doesn't get a service list. It gets:</P><Q>depends where you're starting from, what's your situation rn?</Q><P>The person asking questions controls the conversation.</P></div> },
      { title: "9. Emotional Rollercoaster", subtitle: "More than B2B", body: <P>Curiosity → fear → hope → doubt → trust → decision. Beginning: curious brother. Middle: empathetic listener. End: calm authority. The biggest enemy isn't a competitor — it's his own hesitation.</P> },
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
        subtitle: "Presence converts hesitation",
        body: <P>These prospects aren't deciding between you and a competitor — they're deciding between you and doing nothing. Doing nothing always feels safer. The setter who's always on their stories, always present, always genuinely engaged is the one who's there the day the frustration finally outweighs the fear.</P>,
      },
      {
        title: "The Friend Mindset",
        subtitle: "Warm > Cold, always",
        body: (
          <div className="space-y-2">
            <P><b>Hot leads</b> = brothers you talk to DAILY. Active convos, story replies.</P>
            <P><b>Warm leads</b> = brothers you catch up with WEEKLY to MONTHLY. Sent “path” but didn't book, called but didn't join, in free community but quiet.</P>
            <P><b>Cold leads</b> = brothers you check on every FEW MONTHS. Interested but not ready, usually money or family reasons.</P>
            <P>Never burn a bridge with a qualified man who needs time. Life changes fast — a raise, a bonus, a breaking point. When it does, he messages the person who treated him well when he had nothing to give.</P>
          </div>
        ),
      },
      {
        title: "Daily Story Engagement",
        subtitle: "15–20 min/day",
        body: (
          <UL items={[
            "Reply to hot lead stories (priority) — genuine, no pitch",
            "React to warm lead stories (sent path but not booked, called but not closed)",
            "Use ISA's own stories as leverage: “did you see this one? thought of you”",
          ]} />
        ),
      },
      {
        title: "Story Re-Engagement Templates",
        subtitle: "By what they posted",
        body: (
          <div className="space-y-2">
            <H>Gym / discipline content:</H>
            <Q>the consistency is there man. how's the income side coming along?</Q>
            <H>Struggle post:</H>
            <Q>i feel you on this. you still thinking about making the move on that thing we talked about?</Q>
            <H>Win post:</H>
            <Q>mabrook! imagine this energy with a real system behind it</Q>
            <H>Course/guru content:</H>
            <Q>how's that working out? sometimes too many sources is the actual problem</Q>
          </div>
        ),
      },
      {
        title: "Cold Lead Nurture Sequence",
        subtitle: "30-day rhythm",
        body: (
          <div className="space-y-1 text-[13px]">
            <P><b>Day 1:</b> React to story, no pitch</P>
            <P><b>Day 3:</b> Reply to story with a genuine comment</P>
            <P><b>Day 7:</b> Send relevant content: “saw this and thought of your situation”</P>
            <P><b>Day 14:</b> Direct check-in: “hey, how's things going with [situation]?”</P>
            <P><b>Day 30:</b> If timing fits: “things have moved on our end, might be worth a conversation now”</P>
          </div>
        ),
      },
      {
        title: "Sunday Re-Engagement System",
        subtitle: "3–4 hrs weekly",
        body: (
          <div className="space-y-2">
            <P>Start with ~100 leads from the week → send 80 personalized follow-ups → 40 re-engage → book ~7 calls → 2 weeks later refresh remaining ~33 → 4 more calls → 2 weeks after → 3 more calls.</P>
            <P>Pipeline of 300+ qualified leads constantly nurturing. <b>B2C leads go quiet more often than B2B — the refresh matters MORE here, not less.</b></P>
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
          </div>
        ),
      },
    ],
  },

  // ===== PACING & OPS =====
  {
    id: "pacing",
    heading: "Tracking & Operations",
    color: "var(--tab-pacing)",
    cards: [
      {
        title: "Daily Schedule",
        subtitle: "Time blocking",
        body: (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground"><th className="pb-1 pr-2">TIME</th><th className="pb-1 pr-2">ACTIVITY</th><th className="pb-1">DURATION</th></tr>
            </thead>
            <tbody className="align-top">
              {[
                ["Morning", "Outbound + Story Replies", "30 min"],
                ["Midday", "Active Conversations", "3–4 hrs"],
                ["Afternoon", "Follow-ups + Proof Sends", "1–2 hrs"],
                ["End of Day", "Tracking + Report", "30 min"],
                ["Sunday", "Lead Refresh", "3–4 hrs"],
              ].map((r, i) => (
                <tr key={i} className="border-t border-border/70"><td className="py-1 pr-2">{r[0]}</td><td className="py-1 pr-2">{r[1]}</td><td className="py-1">{r[2]}</td></tr>
              ))}
            </tbody>
          </table>
        ),
      },
      {
        title: "Daily Tracking Template",
        subtitle: "End of day report",
        body: (
          <div className="space-y-2">
            <H>New leads:</H>
            <P>“path” messages received ___ | Openers sent ___ | Response rate ___%</P>
            <H>Conversations:</H>
            <P>Active ___ | Advanced ___ | Stalled ___</P>
            <H>Calls:</H>
            <P>Calendly links sent ___ | Calls booked ___ | Booking rate ___%</P>
            <H>Routing:</H>
            <P>Free community ___ | Disqualified ___</P>
            <H>Story engagement:</H>
            <P>Stories replied ___ | Warm engaged ___ | Cold re-engaged ___</P>
          </div>
        ),
      },
      {
        title: "CRM Notes Per Lead",
        subtitle: "Every field, every time",
        body: (
          <UL items={[
            "Name/handle, age range, location",
            "Employment: job / student / in between",
            "Income & savings if shared",
            "Hours available per week",
            "Family: parents aware, spouse aware, supporting anyone",
            "Hijrah timeline",
            "Lead type: Dreamer / Stuck / Committed / Ready",
            "Current stage (1–8)",
            "Primary constraint: Money / Time / Belief",
            "Pain points in HIS words",
            "Routed to: community / call",
            "Last interaction date + next follow-up date",
            "Proof sent, call outcome",
          ]} />
        ),
      },
      {
        title: "Key Performance Targets",
        subtitle: "Ramp curve",
        body: (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground"><th className="pb-1 pr-2">METRIC</th><th className="pb-1 pr-2">START</th><th className="pb-1 pr-2">4 WK</th><th className="pb-1">8 WK</th></tr>
            </thead>
            <tbody>
              {[
                ["Calls booked/day", "1–2", "4", "8"],
                ["Active convos/day", "20–30", "80+", "200"],
                ["Pipeline leads", "—", "50+", "150+"],
                ["Outbound DMs/day", "—", "50", "50"],
                ["Story replies/day", "—", "15–20", "30+"],
                ["Community routes/week", "—", "10+", "25+"],
              ].map((r, i) => (
                <tr key={i} className="border-t border-border/70"><td className="py-1 pr-2">{r[0]}</td><td className="py-1 pr-2">{r[1]}</td><td className="py-1 pr-2">{r[2]}</td><td className="py-1">{r[3]}</td></tr>
              ))}
            </tbody>
          </table>
        ),
      },
      {
        title: "Pacing Rules",
        subtitle: "Read and respond",
        body: (
          <UL items={[
            "Let him talk more than you. Your messages usually shorter.",
            "One question per message. Never stack.",
            "Match his energy — paragraphs from him = longer from you.",
            "Don't follow a checklist. Read and respond.",
            "Use his exact words and numbers.",
            "Mindset objections need more space than money objections.",
            "Some close in one session, most take a week+. Don't force speed.",
          ]} />
        ),
      },
      {
        title: "Personality Rules",
        subtitle: "Human, not template",
        body: (
          <div className="space-y-2">
            <UL items={[
              "Have strong opinions",
              "Be direct when he's wrong — clearly, with warmth",
              "Casual language: “haha”, “lol”, “ngl” when it fits",
              "Islamic expressions naturally, never performatively",
              "Celebrate genuinely: “BOOM! mabrook man” not “congratulations”",
              "React to photos, joke, talk gym, food, football",
              "Pull back when appropriate: “just thought i'd share, i'll stop bothering you now lol”",
            ]} />
            <Q>you've been researching for a year, that's not caution anymore, that's hiding</Q>
          </div>
        ),
      },
      {
        title: "Key Empathy Phrases",
        subtitle: "Copy-ready lines",
        body: (
          <UL items={[
            "“i see” / “i feel you”",
            "“it's very frustrating”",
            "“i was in the same spot for a long time”",
            "“i can fully imagine”",
            "“that's way more common than you think”",
            "“thanks for being straight with me, helps a lot!”",
            "“appreciate the honesty”",
            "“no shame in that at all”",
            "“transparency just makes it easier for both of us”",
          ]} />
        ),
      },
      {
        title: "The 10 Non-Negotiables",
        subtitle: "Never break these",
        body: (
          <ol className="list-decimal pl-5 space-y-1 text-[13px] text-foreground/90">
            <li>Never sound robotic. Human. Lowercase, 2–4 sentences max.</li>
            <li>Never mention specific pricing in DMs. All pricing to the call.</li>
            <li>Never send Calendly before Stage 7. Qualify first.</li>
            <li>Never argue deen with a lead. Validate, reframe once, move on. You're a setter, not a mufti.</li>
            <li>Route unqualified leads to the free community kindly within the first few messages.</li>
            <li>Always end with a question. Keep the conversation moving.</li>
            <li>Always create a summary for the closer: situation, constraint, family, objections.</li>
            <li>Always send student proof after booking.</li>
            <li>Always send the daily tracking report.</li>
            <li>Sunday: 3–4 hour lead refresh. Every morning: 50 outbound DMs + story replies.</li>
          </ol>
        ),
      },
    ],
  },
];
