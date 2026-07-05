import type { Section } from "./content";

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[13px] leading-relaxed text-foreground/90">{children}</p>
);
const Q = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[13px] leading-relaxed italic text-foreground/80">“{children}”</p>
);
const H = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px] font-semibold uppercase tracking-wide text-foreground mt-3 first:mt-0">{children}</p>
);
const UL = ({ items }: { items: string[] }) => (
  <ul className="list-disc pl-5 space-y-1 text-[13px] text-foreground/90">
    {items.map((i, k) => <li key={k}>{i}</li>)}
  </ul>
);

const NumStep = ({ n, title, sub }: { n: number; title: string; sub: string }) => (
  <div className="flex gap-3 items-start">
    <div className="w-6 h-6 rounded-full bg-[color:var(--tab-stages)] text-white text-[12px] font-semibold flex items-center justify-center flex-shrink-0">{n}</div>
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
        subtitle: "10-18 messages, same-day target",
        body: (
          <div className="space-y-3">
            <NumStep n={1} title="Profile Research" sub="30 sec: followers, content, bio, niche, stage" />
            <NumStep n={2} title="Personalized Opener" sub="Reference something specific. End with open question." />
            <NumStep n={3} title="Problem Identification" sub="Find REAL problem, not surface complaint" />
            <NumStep n={4} title="Situation Deep-Dive" sub="Concrete numbers: revenue, clients, what they've tried" />
            <NumStep n={5} title="Constraint Qualification" sub="Primary constraint: Money, Time, or Clarity" />
            <NumStep n={6} title="Support Level Routing" sub="DIY vs DWY vs DFY → route to right offer" />
            <NumStep n={7} title="Recommendation + Positioning" sub="Frame solution based on everything shared" />
            <NumStep n={8} title="Close to Call" sub="Book Calendly, send testimonial, confirm" />
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
              "Follower count + content volume/quality",
              "Bio clarity + link in bio",
              "Engagement quality + niche",
              "Recent stories",
              "Any obvious wins or proof",
            ]} />
            <H>Categorize immediately:</H>
            <P><b>EARLY</b> — Under 2K, little content, just starting</P>
            <P><b>BUILDING</b> — 2K-10K, posts semi-consistently, has an offer</P>
            <P><b>GROWING</b> — 10K-50K, has clients but inconsistent revenue</P>
            <P><b>ESTABLISHED</b> — 50K+, established brand, solid revenue</P>
          </div>
        ),
      },
      {
        title: "Stage 2: Personalized Openers",
        subtitle: "By lead type",
        body: (
          <div className="space-y-2">
            <H>Early-stage:</H>
            <Q>i see you're just getting started with content, you planning on launching an info offer or you already have something?</Q>
            <H>Building:</H>
            <Q>i see you're doing solid with content, you have any traffic issues?</Q>
            <Q>your content looks clean, how's the conversion side going — people reaching out or mostly just engaging?</Q>
            <H>Growing:</H>
            <Q>love what you're doing! i see you've got lots of followers — converting them into buyers is the main constraint, or am i completely wrong?</Q>
            <H>Established:</H>
            <Q>your brand is strong, what's the main thing you'd want to change or optimize right now?</Q>
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
                  <th className="pb-1">YOUR FOLLOW-UP</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {[
                  ["“Not enough views”", "Traffic problem", "“what are you doing to get new eyes on your profile?”"],
                  ["“Views but no sales”", "Conversion problem", "“what do you do to convert people who watch?”"],
                  ["“Only 1-2 clients”", "No repeatable process", "“how did they find you and what made them buy?”"],
                  ["“Lowering price”", "Positioning problem", "“what makes you feel price is the issue vs how you sell?”"],
                  ["“Need more followers”", "Belief problem", "“how many followers have you actually talked to?”"],
                  ["“Tried everything”", "Order problem", "“what have you tried specifically?”"],
                ].map((r, i) => (
                  <tr key={i} className="border-t border-border/70">
                    <td className="py-1 pr-2">{r[0]}</td>
                    <td className="py-1 pr-2">{r[1]}</td>
                    <td className="py-1 italic text-foreground/80">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <P><b>Key empathy:</b> “i see,” “i feel you,” “it's frustrating when...,” “had the same problem”</P>
          </div>
        ),
      },
      {
        title: "Stage 4: Situation Deep-Dive",
        subtitle: "Become a consultant",
        body: (
          <div className="space-y-2">
            <H>Revenue/clients:</H>
            <Q>how many clients right now? / high-ticket or lower-priced? / typical month revenue-wise?</Q>
            <H>What they've tried:</H>
            <Q>what have you invested in before? / what worked and what didn't?</Q>
            <H>Current approach:</H>
            <Q>daily routine for content and outreach? / running ads or organic? / team or solo?</Q>
            <H>Their offer:</H>
            <Q>what's your current offer and what do you charge? / how long have you had it?</Q>
            <H>Red flags:</H>
            <UL items={[
              "“Spent $X on courses” — skeptical, needs more trust",
              "“Don't have money” — qualify financially soon",
              "“Friend needs to approve” — not sole decision maker",
              "“Just want the price” — comparing, slow them down",
            ]} />
          </div>
        ),
      },
      {
        title: "Stage 5: Constraint Qualification",
        subtitle: "Money, Time, or Clarity",
        body: (
          <div className="space-y-2">
            <H>MONEY constraint:</H>
            <P>They mention savings, budget, payment plans</P>
            <P><b>Frame: VALUE</b> — “make this your last investment”</P>
            <Q>it will help me a lot if you're comfortable sharing how much you have available to invest, so i can explain more about the direction you should take...</Q>
            <H>TIME constraint:</H>
            <P>Busy, stretched thin, running another business</P>
            <P><b>Frame: SPEED</b> — “compress 6-12 months into weeks”</P>
            <Q>knowing your current time constraint would you say it's important to have information with support, or you really want to move quick having 1-on-1's?</Q>
            <H>CLARITY constraint:</H>
            <P>“Tried everything” / overwhelmed / everyone says different things</P>
            <P><b>Frame: ORDER</b> — “you have the pieces, not the sequence”</P>
            <Q>first thing we need is a full business audit to give your mind peace of clarity</Q>
          </div>
        ),
      },
      {
        title: "Stage 6: Support Level Routing",
        subtitle: "The routing question",
        body: (
          <div className="space-y-2">
            <Q>what is the level of support that you expect.. more like we give you everything needed and you do it yourself? or you want us to do everything for you. where would you draw the line?</Q>
            <H>For busy leads (reframe as speed):</H>
            <Q>knowing your current time constraint would you say it's important to get the information with support, or you really want to move quick having 1 on 1's?</Q>
            <UL items={[
              "“Just info” → DIY → Lower-tier offer",
              "“Show me + I'll execute” → Done-with-you",
              "“Need hands-on” → Heavy support tier",
              "“Do it all” → DFY / premium 1-on-1",
            ]} />
            <P>Always ask “expect” not “need.” “Need” undermines. “Expect” makes them feel premium.</P>
          </div>
        ),
      },
      {
        title: "Stage 7: Recommendation",
        subtitle: "Framework for positioning",
        body: (
          <div className="space-y-2">
            <P><b>Framework:</b> Acknowledge → Honest opinion → Explain why → Frame transformation → Transition</P>
            <H>For early-stage leads:</H>
            <Q>based on your situation, get foundations right first. you need clarity, a gameplan and the right information & support. the goal: we'll make sure this becomes your last investment needed</Q>
            <H>For established leads:</H>
            <Q>you're in an extremely luxurious position. the marketing angle based on your track record gives us all the leverage. no reason to drop what's working, we build alongside</Q>
            <H>For scaling leads:</H>
            <Q>you've proven the model works. at your level it's about systems that let you scale without being the bottleneck</Q>
            <P><b>Handling “how much?”:</b> Never specific. “programs range from a few hundred to mid five-figures. the call sorts out which fits.”</P>
          </div>
        ),
      },
      {
        title: "Stage 8: Close to Call",
        subtitle: "Permission-based close",
        body: (
          <div className="space-y-2">
            <Q>let's have a chat so i can get more clarity on your business and show you how efficient we can be. if you give me permission to shoot over the calendly, i'll do it!</Q>
            <Q>Here's our calendar: [calendly link] — ping me when booked so i can confirm on my end.</Q>
            <Q>perfect, you're locked in! come prepared with questions. talk soon!</Q>
            <H>Follow-up if silent:</H>
            <P>24h: “hey did you get a chance to check the calendar?”</P>
            <P>48h: “just checking in — any time work this week?”</P>
            <P>After: Move to story nurture. Stop chasing beyond 3 attempts.</P>
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
        subtitle: "INFO / keyword / question → Booked",
        body: (
          <div className="space-y-3">
            {[
              ["Profile Research", "30 seconds: content, followers, offer, stage, wins"],
              ["Personalized Opener", "Reference something real from their page"],
              ["Problem Identification", "Validate + dig deeper into their situation"],
              ["Deep-Dive", "Woven into conversation, not standalone questions"],
              ["Constraint Qualification", "Money, time, or clarity"],
              ["Support Level Routing", "Self-serve vs done-with-you vs 1-on-1"],
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
            <H>They ask for a document from a video:</H>
            <Q>Hey man, appreciate it. We're not sharing that document separately right now since it contains a lot of our core frameworks. But if you're serious about it, tell me where you're at and I'll point you in the right direction</Q>
            <H>They ask for offer/price/guarantees:</H>
            <Q>i could throw numbers at you but honestly that won't help without context on your situation. the real question is what you're currently doing and what's missing</Q>
            <H>“How do you work with people?”:</H>
            <Q>depends on the level of access you need and your situation, we have different options. what's your current situation, what are you looking to solve?</Q>
            <H>They're already sold (“I already know I want to work with you”):</H>
            <Q>love to hear that! i see you're doing [something from profile], just so i can point you in the right direction, what's the main thing you'd want us to help with?</Q>
          </div>
        ),
      },
      {
        title: "Problem ID Responses",
        subtitle: "Match their specific situation",
        body: (
          <div className="space-y-2">
            <H>Views but no sales:</H>
            <Q>views without conversion usually comes down to positioning and how the content is structured to move people toward a next step</Q>
            <H>Lost direction / don't know what to post:</H>
            <Q>posting without purpose also makes it way harder to do it consistently and takes the fun away from it. getting clarity now is key</Q>
            <H>Thinking about lowering price:</H>
            <Q>what makes you feel the price is the issue vs the way you're selling it?</Q>
            <H>Tried everything / too many coaches:</H>
            <Q>it seems like you're doing stuff all over the place which is highly unprofitable. Our first job would be implementing acquisition and building a streamlined system</Q>
            <H>Has audience but doesn't monetize:</H>
            <Q>[X]k followers but not even using the platform for conversions, that hurts my heart ;(</Q>
            <H>Already has a business:</H>
            <Q>even better position. we don't touch what's working, we add what's missing. no reason to drop the [business]</Q>
            <H>Need more followers first:</H>
            <Q>it has nothing to do with the amount of followers, it's the way in which we acquire clients that makes it important</Q>
          </div>
        ),
      },
      {
        title: "Budget Questions",
        subtitle: "The organic ask",
        body: (
          <div className="space-y-2">
            <Q>it will help me a lot if you're comfortable sharing how much you have available to invest, so i can explain more about the direction you should take...</Q>
            <Q>it will help me a lot if you're comfortable sharing how much savings you have, so i can explain more about the direction you should take...</Q>
            <P>You've earned the right to ask. “If you're comfortable sharing” (respectful) + “so I can guide you” (they want direction). Direction in exchange for transparency.</P>
          </div>
        ),
      },
      {
        title: "Permission Close",
        subtitle: "Always ask permission",
        body: (
          <div className="space-y-2">
            <Q>Let's have a chat tomorrow so i can get more clarity on your current business situation and show you exactly how efficient we can be. If you give me permission to shoot over the calendly, i'll do it!</Q>
            <Q>Thanks for being super straight forward, helps a lot! If you give me permission i'll shoot you over my calendar.</Q>
            <H>After they agree:</H>
            <Q>Ping me when booked, so i can confirm everything on my end, if there's anything else you need don't hesitate to ask please ;)</Q>
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
            <P><b>Make them reply. That's it.</b></P>
            <P>No qualifying, no pitching, no diagnosing their business. Start a conversation that feels so natural or curiosity-inducing that they HAVE to respond.</P>
            <P>Once they reply → transition into Outbound Conversational Flow.</P>
          </div>
        ),
      },
      {
        title: "Approved Openers",
        subtitle: "The only formats allowed",
        body: (
          <div className="space-y-2">
            <H>Pure Curiosity:</H>
            <Q>yoo</Q>
            <H>Assumption — Value/Pricing:</H>
            <Q>you're def undercharging, i can tell just from your page</Q>
            <Q>you're overdelivering and undercharging, your page makes that obvious</Q>
            <H>Assumption — Content/Brand:</H>
            <Q>you're playing it way too safe with your content</Q>
            <H>Aspirational Gap (“if your...”):</H>
            <Q>if your brand matched what you actually know this page would blow up</Q>
            <Q>if your content strategy matched your actual knowledge this page would be dangerous</Q>
            <Q>if your positioning matched your skill level you'd own your niche</Q>
            <Q>if your brand told the story your results already tell you'd have people lining up</Q>
            <H>Self-Awareness:</H>
            <Q>i think you already know what's missing you're just not doing it yet</Q>
            <Q>you're closer than you think, you're just in your own way rn</Q>
          </div>
        ),
      },
      {
        title: "Never Say",
        subtitle: "Instant credibility kill",
        body: <UL items={[
          "“hey” / “hi” / “hello”",
          "“thanks for the follow”",
          "“I checked your page”",
          "“what's been holding you back?”",
          "“how is [their business] going?”",
          "“we can help you with...”",
          "“I'd love to connect”",
          "Any qualifying question",
          "Anything longer than 2 sentences",
          "Calling out lurking behavior",
          "Diagnosing before conversation",
          "Forced humor",
        ]} />,
      },
      {
        title: "After They Reply",
        subtitle: "Route based on response",
        body: (
          <div className="space-y-2">
            <H>Reply with curiosity (“what do you mean?”):</H>
            <P>Share your observation about their specific situation. Still don't pitch. → Outbound Conv. Flow</P>
            <H>Reply with their situation:</H>
            <P>Warm outbound conversation. → Outbound Conv. Flow</P>
            <H>Reply defensively (“who are you?”):</H>
            <Q>lol didn't mean it in a bad way, genuinely think you have something.</Q>
            <P>If still hostile → move on.</P>
            <H>No reply:</H>
            <P>Engage stories for a week. Try again 2-3 weeks later with completely different opener.</P>
          </div>
        ),
      },
      {
        title: "Who to DM",
        subtitle: "Targeting rules",
        body: (
          <div className="space-y-2">
            <H>DM Today:</H>
            <P>Liked/commented in last 24h. New follow with clear business in bio.</P>
            <H>DM This Week:</H>
            <P>Followed in last 7 days with business profile. Engaged 2+ times.</P>
            <H>Don't DM:</H>
            <P>Personal accounts. Under 100 followers with no bio. Said no previously (wait 30+ days). Competitors.</P>
          </div>
        ),
      },
      {
        title: "Good Leads vs Bad Leads",
        subtitle: "30 seconds to decide",
        body: (
          <div className="space-y-2">
            <H>Instantly deprioritize/remove:</H>
            <UL items={[
              "2-12 followers, no picture, no content",
              "Repost/meme accounts",
              "Random motivational quote pages",
              "Clearly not business owners",
              "Spam/bot accounts",
            ]} />
            <H>BAD LEAD vs CAN'T BUY YET:</H>
            <P>Massive difference. Bad leads get removed. People who can't buy yet get treated as friends. Be kind, stay engaged, follow up in months. They WILL come back.</P>
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
        subtitle: "Every reply must...",
        body: (
          <div className="space-y-2">
            <H>Must:</H>
            <UL items={[
              "React to the SPECIFIC thing they posted",
              "Have a take or opinion on it",
              "Create natural reason to reply back",
              "Feel like a sharp friend, not a setter",
            ]} />
            <H>Must NOT:</H>
            <UL items={[
              "Pitch anything",
              "Mention the offer",
              "Ask qualifying questions",
              "Be overly positive cheerleading",
              "Sound like a template",
            ]} />
          </div>
        ),
      },
      {
        title: "Struggle / Frustration",
        subtitle: "They post about a problem",
        body: (
          <div className="space-y-2">
            <Q>this is the best problem to have and the worst at the same time lol, you charging enough for this?</Q>
            <Q>the honesty is refreshing lol, most people pretend they have it figured out. the ones who admit they don't are usually 2 months away from cracking it</Q>
            <Q>i feel you on this one, had the same thing for a while. what's the main bottleneck rn?</Q>
            <Q>most people try to solve this with more effort, when it's actually a strategy issue. what have you tried?</Q>
          </div>
        ),
      },
      {
        title: "Win / Achievement",
        subtitle: "They post a result",
        body: (
          <div className="space-y-2">
            <Q>this is fire, most people won't post their wins because they're scared of judgment. respect 🤝</Q>
            <Q>lol imagine where this goes when you actually dial in the [thing they're missing]</Q>
            <Q>congrats! how repeatable is this though? one-off or you cracked the system?</Q>
            <Q>love this. you doing this consistently or was this a standout month?</Q>
          </div>
        ),
      },
      {
        title: "Content / Behind-the-Scenes",
        subtitle: "They post about their work",
        body: (
          <div className="space-y-2">
            <Q>this type of content is what makes people buy, most people don't understand that yet</Q>
            <Q>i can tell you know what you're doing, just need to let more people see it</Q>
            <Q>production value is clean. how's this converting for you?</Q>
          </div>
        ),
      },
      {
        title: "Lifestyle / Personal",
        subtitle: "They post gym, travel, food",
        body: (
          <div className="space-y-2">
            <Q>this is the stuff that builds a personal brand, most people only post business and wonder why nobody connects with them</Q>
            <Q>hard disagree on [food/place/opinion] lol but respect it</Q>
            <Q>ngl that looks insane. where is this?</Q>
          </div>
        ),
      },
      {
        title: "Asking for Help / Advice",
        subtitle: "They post a question",
        body: (
          <div className="space-y-2">
            <Q>honestly? [give your direct opinion]. most people will sugarcoat this</Q>
            <Q>depends on what you're optimizing for. growth vs revenue are different games rn</Q>
            <Q>this is the right question to be asking. the answer is simpler than you think</Q>
          </div>
        ),
      },
      {
        title: "Quote / Motivation",
        subtitle: "They repost a quote or mindset content",
        body: (
          <div className="space-y-2">
            <Q>facts. most people read this and do nothing with it though lol, you applying this?</Q>
            <Q>real. the gap between knowing and doing is where most businesses die</Q>
            <Q>most people try to do everything themselves until they burn out. this is the smarter play</Q>
          </div>
        ),
      },
      {
        title: "After They Reply",
        subtitle: "What to do next",
        body: (
          <div className="space-y-2">
            <H>Casual reply (“thanks”, “haha”):</H>
            <P>Keep it warm, don't pitch. React to their next stories.</P>
            <H>Opens conversation (asks question, goes deeper):</H>
            <P>NOW start a natural conversation. Still don't pitch → Outbound Conv. Flow</P>
            <H>No reply:</H>
            <P>Fine. React to their next story in 2-3 days. Some take 5-10 story interactions.</P>
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
        subtitle: "After they reply to opener/story",
        body: (
          <div className="space-y-3">
            {[
              ["Genuine Conversation", "Chit-chat, learn about them, be human"],
              ["Value Drops", "YouTube videos, strategic advice, celebrate wins"],
              ["They Self-Identify Problem", "Wait for THEM to tell you what's missing"],
              ["Agree, Expand + Qualify", "Validate, add context, weave in qualifying"],
              ["Route + Close", "Support level, permission close, calendly"],
              ["Post-Close Nurture", "Pre-call video, story engagement, keep value"],
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
        subtitle: "Key difference from inbound",
        body: (
          <div className="space-y-2">
            <H>Inbound:</H>
            <P>They came to you. Already interested. Qualify faster, book same-day.</P>
            <H>Outbound:</H>
            <P>You came to them. Haven't earned anything. Build trust through conversation, strategic value, YouTube drops. Let THEM identify their problem. Some close in a day, some a week.</P>
            <P>In inbound you qualify message 2-3. In outbound, qualifying before trust is built kills the conversation.</P>
          </div>
        ),
      },
      {
        title: "Phase 1: Genuine Conversation",
        subtitle: "Can last 2 messages or 2 days",
        body: (
          <div className="space-y-2">
            <H>The rules:</H>
            <UL items={[
              "React genuinely, not strategically",
              "Learn through curiosity, not qualification",
              "Have opinions on what they share",
              "Share about yourself if natural",
              "React to their photos / personal stuff",
            ]} />
            <H>What NOT to do:</H>
            <UL items={[
              "Don't ask “what's your biggest challenge?” yet",
              "Don't ask about revenue, clients, budget",
              "Don't steer toward your offer",
              "Don't skip this phase for hot leads",
            ]} />
          </div>
        ),
      },
      {
        title: "Phase 2: Value Drops",
        subtitle: "Earn the right to qualify",
        body: (
          <div className="space-y-2">
            <H>YouTube drops:</H>
            <Q>I'd feel bad not sending over, talks about how to be effective in content communicating your exact message to get customers..</Q>
            <Q>this one will add the 10% you need. shows everything about how to structure profile, your content & actually convert</Q>
            <Q>full gameplan you can follow. imma put you on so much stuff haha</Q>
            <H>Strategic advice (when they share a problem):</H>
            <Q>a creative director/editor will allow you to focus on the highest money making activities</Q>
            <Q>sometimes the smarter play is learning how to solve this yourself with the right guidance instead of outsourcing it</Q>
            <Q>don't spin this in your head too much, the most important thing is output</Q>
            <P><b>Story engagement between DMs:</b> Reply to personal stories with free advice on their content.</P>
          </div>
        ),
      },
      {
        title: "Phase 3: Self-Identify Problem",
        subtitle: "The critical moment — don't rush",
        body: (
          <div className="space-y-2">
            <H>Wait for them to say things like:</H>
            <Q>I have to work Definitely on My Personal Brand</Q>
            <Q>I lost my own plot, I feel like... I just don't sell it</Q>
            <Q>the pain point is more lead volume and better quality</Q>
            <Q>I think content is lacking in terms of my own positioning</Q>
            <H>If not ready yet, probe with either/or:</H>
            <Q>what are you not sure about, mainly what to say in your content, or mostly just ideation/production?</Q>
            <Q>do you have a system for content at all, or is it just fully random?</Q>
            <P>If still not ready: keep engaging stories, drop another video in a few days. Some leads take 5-10 interactions.</P>
          </div>
        ),
      },
      {
        title: "Phase 4: Agree + Expand + Qualify",
        subtitle: "Use their exact words",
        body: (
          <div className="space-y-2">
            <H>Agree using their words, then qualify woven in:</H>
            <Q>Absolutely, we need to make sure there's a perfect balance and clear messaging.. so buyers don't get confused</Q>
            <Q>from what you shared, the core issue isn't ads, it's refining the inbound flow so volume and quality scale together. if i'm honest, this is exactly where we help most</Q>
            <H>Never standalone qualifying — always woven:</H>
            <P>“how many clients do you have?”</P>
            <Q>→ you have lots of customers for the consulting offer, meaning it's hard for you to manage more?</Q>
            <P>“what's your current offer?”</P>
            <Q>→ i assume it will be in the direction of helping other ecom brands scale?</Q>
            <P>“what are you charging?”</P>
            <Q>→ these current 2 clients are they high-ticket or all on payment plans for only like $2k/mo?</Q>
            <P><b>The pattern:</b> React to what they said → add insight → ask ONE thing tied to what they shared.</P>
          </div>
        ),
      },
      {
        title: "Phase 5: Route + Close",
        subtitle: "Permission close",
        body: (
          <div className="space-y-2">
            <H>Routing question:</H>
            <Q>knowing your current problems... you looking for someone to support you build a gameplan and execute on it. or you just need the right information and steps so you can execute yourself?</Q>
            <H>Close:</H>
            <Q>You'd be down to have a quick chat tomorrow, i'll give you more clarity on how to fix your [specific problem].. if i have your permission, i'll shoot over the calendly.</Q>
            <H>If they bring up price before booking:</H>
            <Q>Hey [Name]! can you please tell me what price you saw, so i understand which offer you're talking about</Q>
          </div>
        ),
      },
      {
        title: "Phase 6: Post-Close Nurture",
        subtitle: "Reduce no-shows",
        body: (
          <div className="space-y-2">
            <H>After booking:</H>
            <Q>I see the call is scheduled, we're excited to speak with you. Could you please watch the video below in advance?</Q>
            <H>Personal touch:</H>
            <Q>thanks for having a great and clear conversation [Name]!</Q>
            <H>Day before:</H>
            <Q>All set for the call tomorrow?</Q>
            <H>If haven't booked:</H>
            <P>24h: “hey, did you get a chance to check the calendar?”</P>
            <P>48h: “[Name]! just curious if you had the chance...”</P>
            <P>72h+: Stop chasing. Story engagement only.</P>
            <P>Keep engaging their stories even after booking. The goal: they feel like they know you before the call.</P>
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
        subtitle: "Prospect is qualified + ready",
        body: (
          <div className="space-y-3">
            {[
              ["Commitment Test", "Confirm they're serious before pricing"],
              ["Present Offer", "Matched to their situation"],
              ["Share Pricing", "Always paired with context"],
              ["Handle Objections", "Validate → reframe → path forward"],
              ["Next Steps / Payment", "Move fast, remove friction"],
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
        subtitle: "Trigger = readiness, not price",
        body: (
          <div className="space-y-2">
            <H>DM close when:</H>
            <UL items={[
              "Self-qualified (offer, revenue, problem, budget clear)",
              "Asking “how much?” / “what are the next steps?”",
              "You know what offer fits, call would be formality",
              "They explicitly don't want a sales call",
              "Budget-constrained: route to right offer without call",
            ]} />
            <H>Don't DM close when:</H>
            <UL items={[
              "Haven't been qualified yet",
              "Still asking basic questions",
              "Need to hear from the closer",
              "Confusion about what offer fits",
            ]} />
          </div>
        ),
      },
      {
        title: "Step 1: Commitment Test",
        subtitle: "Non-negotiable before pricing",
        body: (
          <div className="space-y-2">
            <Q>how serious are you about getting started? I can check in with my COO to see what might be possible for you, but I do need to be sure that you're genuinely ready to start right away</Q>
            <P>If they prove urgency (“dead serious”, “willing to pay right now”): → Proceed to Step 2</P>
            <P>If they hesitate (“depends on the price”): → Build more value or book Calendly call</P>
            <P>If they skip it themselves (“how much?”): → Move faster, but still gauge seriousness before special pricing</P>
          </div>
        ),
      },
      {
        title: "Step 2: Present Offer",
        subtitle: "Only share what's relevant",
        body: (
          <div className="space-y-2">
            <H>Low-tier (self-paced):</H>
            <Q>we guide you step-by-step through everything from A to Z, showing you how to apply it all so you have a framework you can keep using long-term</Q>
            <H>Mid-tier (group/coaching):</H>
            <Q>weekly calls, access to all modules, surrounded by people at your level. starts with understanding your situation, offer, content, profile</Q>
            <H>High-tier (1-on-1):</H>
            <Q>starts with 1-on-1 business audit so we can form a proper gameplan. weekly 1-on-1's, personalized support daily. very heavy on support & accountability.</Q>
            <H>Premium (inner circle):</H>
            <Q>Custom audit + 12mo plan, bi-weekly 1-on-1, private mastermind, events, 24/7 chat, executive team access, all modules.</Q>
          </div>
        ),
      },
      {
        title: "Step 3: Share Pricing",
        subtitle: "Never drop a number alone",
        body: (
          <div className="space-y-2">
            <H>Technique 1: Anchor high, route down</H>
            <Q>talked with my coo and we can give you a special offer. normally our price is mid 5-figure... i can get you on for [lower amount] now, [lower amount] in 30 days. you tell me which works</Q>
            <H>Technique 2: Price + vision</H>
            <Q>it's [price]. within [timeframe], the brand will be at [level] within your own niche.</Q>
            <H>Technique 3: Honest routing</H>
            <Q>based on everything you told me, [offer] at [price] for [timeframe]. fits within what you mentioned</Q>
          </div>
        ),
      },
      {
        title: "Step 5: Next Steps",
        subtitle: "Move fast after yes",
        body: (
          <div className="space-y-2">
            <H>Mid-ticket:</H>
            <Q>let's do it. i'll send over the payment link now</Q>
            <H>High-ticket:</H>
            <Q>We will finalize payment, and i will get you scheduled in immediately for your gameplan call.</Q>
            <H>Onboarding sequence:</H>
            <ol className="list-decimal pl-5 text-[13px] space-y-1">
              <li>Contract</li>
              <li>Payment link</li>
              <li>Schedule gameplan call</li>
              <li>Community access</li>
              <li>Direct messaging exchange</li>
            </ol>
          </div>
        ),
      },
      {
        title: "Setter-to-Closer Handoff",
        subtitle: "VIP experience for high-ticket",
        body: (
          <div className="space-y-2">
            <P><b>1. Confirm difference:</b></P>
            <Q>working 1 on 1 is different, more personalized, not systematized like the normal offer</Q>
            <P><b>2. Collect everything:</b></P>
            <Q>please give me max a couple hours to get back to you! any other information i can provide?</Q>
            <P><b>3. Set timing:</b></P>
            <Q>you'll have a response within 30 minutes..</Q>
            <P><b>4.</b> Closer messages personally + sends voice notes</P>
            <P><b>5.</b> Setter handles remaining logistics (pricing, objections, contracts, payment, scheduling)</P>
          </div>
        ),
      },
    ],
  },

  // ===== OBJECTIONS =====
  {
    id: "objections",
    heading: "Objection Handling — Complete Library",
    color: "var(--tab-objections)",
    cards: [
      {
        title: "The Principle",
        subtitle: "Every objection is a buying signal",
        body: (
          <div className="space-y-2">
            <H>Structure is always:</H>
            <ol className="list-decimal pl-5 text-[13px] space-y-1">
              <li>Validate what they said</li>
              <li>Reframe using THEIR situation, numbers, words</li>
              <li>Present a path forward</li>
            </ol>
            <P>They're not saying no — they're asking you to give them a reason to say yes. Never generic reassurance.</P>
          </div>
        ),
      },
      {
        title: "“It's risky” / “Not sure about ROI”",
        subtitle: "ROI math framework",
        body: (
          <div className="space-y-2">
            <H>Structure:</H>
            <ol className="list-decimal pl-5 text-[13px] space-y-1">
              <li>Validate their concern</li>
              <li>“We wouldn't take you on if we didn't think this will work out”</li>
              <li>Calculate ROI with THEIR numbers: [investment ÷ their offer price = clients needed]</li>
              <li>Show 2x and aspirational number</li>
              <li>Worst case: “you learned an insane amount, got mind-blowing insight, still have lifetime access”</li>
            </ol>
            <P><b>€5k/mo clients:</b> “only 2 clients in 2 months to make ROI... only 4 to afford next months.. imagine 10.. pretty simple math”</P>
            <P><b>$3k offer:</b> “only 3 clients to make ROI... 5 clients and you're profitable. imagine what 10+ looks like”</P>
            <P>The math ALWAYS uses THEIR numbers. Never generic.</P>
          </div>
        ),
      },
      {
        title: "“Can only afford X months”",
        subtitle: "Decision-maker framework",
        body: (
          <div className="space-y-2">
            <P>Never say “yes we can do that.” Always check with the team.</P>
            <ol className="list-decimal pl-5 text-[13px] space-y-1">
              <li>“i'll talk to the team and see if we can take you on for [their timeframe]”</li>
              <li>Tie continuation to results: “if we can make you an extra $[number] would you continue”</li>
              <li>“we don't like to work with people short term for this offer”</li>
              <li>“these offers normally start slower and compound hard overtime”</li>
            </ol>
          </div>
        ),
      },
      {
        title: "“What if I can't pay next month?”",
        subtitle: "Firm boundary framework",
        body: (
          <ol className="list-decimal pl-5 text-[13px] space-y-1">
            <li>“if we don't think you'll be paying with ease we wouldn't take you on”</li>
            <li>Align on long-term vision</li>
            <li>“we agreed to [X] months, meaning you need to commit to [amount]”</li>
            <li>“I doubt we could stretch further because we already gave [X]% flexibility. You see where i am coming from?”</li>
          </ol>
        ),
      },
      {
        title: "“I don't want a sales call”",
        subtitle: "Two-step reframe",
        body: (
          <div className="space-y-2">
            <H>Step 1 — Reframe as strategy:</H>
            <Q>Totally get not wanting another sales call. These are strategy-based, no pressure at all.</Q>
            <H>Step 2 — If pushback, pivot to DM close:</H>
            <Q>Nahh completely get you! No need for a call, let me get clarity... i assume you're looking for 1 on 1 support, instead of just information?</Q>
          </div>
        ),
      },
      {
        title: "Financial Pressure",
        subtitle: "They mention specific expenses",
        body: (
          <div className="space-y-2">
            <Q>Exactly, agreed. That's why we need to make it work. simple. On the business-audit we play into this urgency to build a plan around how to attack it.</Q>
            <Q>Every client has a custom plan, some have a direct approach, some have an in-direct approach. We do what's needed and is best for that customer.</Q>
            <P>Don't ignore their pressure. Flip it into the reason the plan needs to work.</P>
          </div>
        ),
      },
      {
        title: "Quick Objection Library",
        subtitle: "All responses at a glance",
        body: (
          <div className="space-y-2">
            {[
              ["“I need to think about it”", "“100%, take your time. what's the main thing you're weighing up? sometimes talking it through helps”"],
              ["“I've been burned before”", "“we are very heavy on support & accountability, designed so you can't fall through the cracks. we want to upsell after great results, no reason to provide value for a couple grand if there's no longevity”"],
              ["“Is it worth it at my level?”", "“that's exactly why the business-audit comes first, we see exactly where you are and build the plan around your specific situation”"],
              ["“What makes you different?”", "“we install the system with you, not just teach. weekly 1-on-1s, daily support, full team. no coaches, you work with people running the business”"],
              ["“Need more followers first”", "“it has nothing to do with followers, some of our best clients started under 5k and hit $10k+ months. the system creates results, not the number”"],
              ["“Already working with someone”", "“respect that 100%. how's that going, are they delivering or still figuring it out?”"],
              ["“Don't have time”", "“that's exactly why 1-on-1's, we compress months into weeks of focused execution”"],
              ["“Don't have money”", "“appreciate the honesty. based on your situation, [route to lower offer]. best way is still a quick call, no pressure”"],
              ["“Not a content creator”", "“you don't need to be. content system is built around your expertise, not becoming an influencer. strategic positioning that attracts buyers”"],
              ["“Keep business AND launch info?”", "“smartest play. we build info alongside. no reason to drop what's working — we do that when info prints enough to replace it”"],
              ["“Can you just tell me the price?”", "“i could throw numbers but that won't help without context. the real question is what you're doing and what's missing”"],
              ["“Can I see testimonials?”", "“check the highlights. but results depend on YOUR situation — that's why the call matters”"],
              ["“How much on a payment plan?”", "“we have different payment options — the call goes over that based on which program fits. want me to send the calendly?”"],
              ["“Want to learn ads”", "“we teach that — traffic is core. but first foundation must be right: offer, content, conversion. no point driving traffic to something that doesn't convert”"],
            ].map(([q, a], i) => (
              <div key={i} className="border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                <div className="text-[12px] font-semibold">{q}</div>
                <div className="text-[13px] italic text-foreground/80">{a}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "Binary Re-Engagement",
        subtitle: "Qualified prospects who go quiet",
        body: (
          <div className="space-y-2">
            <Q>hey, thanks for your patience ready for our qualified call to see if you are a fit? or not ready to move forward now.</Q>
            <P>Two options. Both move the conversation. Even “not ready” opens a follow-up dialogue.</P>
          </div>
        ),
      },
    ],
  },

  // ===== PSYCHOLOGY =====
  {
    id: "psych",
    heading: "The Psychology Behind Every Message",
    color: "var(--tab-psych)",
    cards: (
      [
        ["Principle 1", "Reference their words", "Every message references something they said. Never introduce new topics. Read their message, identify key pain points, respond to THOSE specifically. They trust you more when they hear their own language reflected back."],
        ["Principle 2", "Confirm beliefs, don't challenge", "When a prospect says something, confirm it. “You're probably right about doing stuff all over the place.” They think: “This person understands me.” Find the truth in what they're saying and build on it."],
        ["Principle 3", "Ask questions you know the answer to", "When you ask “are these clients high-ticket or payment plans?” and you already know they charge $3K, you're not asking to learn. You're asking so THEY say it out loud. When they admit it, that admission becomes a pain point they want to fix."],
        ["Principle 4", "Long inputs = long outputs", "Thoughtful, multi-sentence messages that show you understood their situation produce paragraphs in return. More information = better qualification = easier close."],
        ["Principle 5", "“Expect” vs “Need”", "Always ask “what do you expect?” never “what do you need?” “Need” implies they don't know. “Expect” puts them in a premium position — like a luxury hotel asking “What do you expect from your stay?”"],
        ["Principle 6", "Authoritative yet humble", "You are the expert (diagnose problems, have the solution) but also respectful and never pushy. “If you give me permission to send the calendar link” — Power + humility = impossible to refuse."],
        ["Principle 7", "Turn background into advantage", "If someone does copywriting on the side, say their ads will be much easier. Find anything in their background you can reframe as a head start. This lowers resistance to buying."],
        ["Principle 8", "Never answer questions directly", "When they ask “What do you guys help with?” do NOT answer with a list of services. Ask about their situation instead. The person asking questions controls the conversation."],
        ["Principle 9", "Setting is an emotional rollercoaster", "You take prospects from curiosity to vulnerability to trust to excitement. Beginning: analytical. Middle: empathetic. End: authoritative. This range separates a $50K setter from a $5K setter."],
      ] as const
    ).map(([t, s, b]) => ({ title: t, subtitle: s, body: <P>{b}</P> })),
  },

  // ===== ENGAGE =====
  {
    id: "engage",
    heading: "Lead Engagement System",
    color: "var(--tab-engage)",
    cards: [
      {
        title: "Why Engagement Matters",
        subtitle: "The deciding factor",
        body: (
          <div className="space-y-2">
            <P>Prospects often decide between you and a competitor. Strong content may draw attention, but the setter who's always on their stories, always engaging, always present — that persistence tips the scale.</P>
            <P><b>Engagement is what turns a maybe into a yes.</b></P>
          </div>
        ),
      },
      {
        title: "The Friend Mindset",
        subtitle: "Stop seeing leads as numbers",
        body: (
          <div className="space-y-2">
            <P><b>Hot Leads</b> = Friends you talk to DAILY. Active convos, story replies, always in their DMs.</P>
            <P><b>Warm Leads</b> = Friends you catch up with MONTHLY. INFO'd but not booked, called but not closed. Check-ins + story reactions.</P>
            <P><b>Cold Leads</b> = Friends you see YEARLY. Interested but not ready yet. Nurture through stories, re-engage in months.</P>
            <P>The key: you maintain ALL these relationships. Never burn a bridge with a qualified lead who just needs time. They WILL come back.</P>
          </div>
        ),
      },
      {
        title: "Daily Story Engagement",
        subtitle: "15-20 min/day",
        body: (
          <ol className="list-decimal pl-5 text-[13px] space-y-1">
            <li>Reply to prospect stories (priority leads first) — genuine, no pitch</li>
            <li>React to warm lead stories (INFO'd but not booked, called but not closed)</li>
            <li>Use your brand's stories as leverage: “did you see this? thought of you”</li>
          </ol>
        ),
      },
      {
        title: "Story Re-Engagement Templates",
        subtitle: "Match what they post",
        body: (
          <div className="space-y-2">
            <H>They post content:</H>
            <Q>your content is looking better, how's the business side going?</Q>
            <H>They post a struggle:</H>
            <Q>i feel you on this. you still thinking about getting help with it?</Q>
            <H>They post a win:</H>
            <Q>love to see it! imagine what happens with a proper system behind this</Q>
            <H>They post about courses:</H>
            <Q>how's that working out? sometimes too many sources is the problem</Q>
          </div>
        ),
      },
      {
        title: "Cold Lead Nurture Sequence",
        subtitle: "Warm them over time",
        body: (
          <div className="space-y-1 text-[13px]">
            <P><b>Day 1:</b> React to story, no pitch</P>
            <P><b>Day 3:</b> Reply to story with genuine comment</P>
            <P><b>Day 7:</b> Send relevant content: “saw this and thought of your situation”</P>
            <P><b>Day 14:</b> Direct check-in: “hey, how's things going with [their problem]?”</P>
            <P><b>Day 30:</b> If offer running: “we have something that might be perfect”</P>
          </div>
        ),
      },
      {
        title: "Sunday Re-Engagement System",
        subtitle: "3-4 hours every Sunday",
        body: (
          <div className="space-y-1 text-[13px]">
            <P>Start with ~100 leads from the week</P>
            <P>→ Send 80 a personalized follow-up</P>
            <P>→ 40 re-engage → book ~7 calls</P>
            <P>→ Two weeks later, refresh remaining ~33 → 4 more calls</P>
            <P>→ Two weeks after → 3 more calls</P>
            <P>Over time: pipeline of 300+ qualified leads you're constantly nurturing.</P>
          </div>
        ),
      },
      {
        title: "Testimonials",
        subtitle: "Send after every booking",
        body: (
          <div className="space-y-2">
            <H>Match testimonial to prospect:</H>
            <UL items={[
              "Best overall → send after every booked call",
              "Best for sales-focused prospects",
              "Best for specific niche alignment",
            ]} />
            <Q>bro, you're in a similar niche. check what [client] did.</Q>
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
        subtitle: "Your day breakdown",
        body: (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1 pr-2">Time</th><th className="pb-1 pr-2">Activity</th><th className="pb-1">Duration</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {[
                ["Morning", "Outbound + Story Replies", "30 min"],
                ["Midday", "Active Conversations", "3-4 hrs"],
                ["Afternoon", "Follow-ups + Testimonials", "1-2 hrs"],
                ["End of Day", "Tracking + Report", "30 min"],
                ["Sunday", "Lead Refresh", "3-4 hrs"],
              ].map((r, i) => (
                <tr key={i} className="border-t border-border/70">
                  <td className="py-1 pr-2">{r[0]}</td><td className="py-1 pr-2">{r[1]}</td><td className="py-1">{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ),
      },
      {
        title: "Daily Tracking Template",
        subtitle: "Fill every day",
        body: (
          <div className="space-y-2">
            <H>New Leads:</H>
            <P>INFO messages received ___ | Openers sent ___ | Response rate ___%</P>
            <H>Conversations:</H>
            <P>Active ___ | Advanced to next stage ___ | Stalled ___</P>
            <H>Calls:</H>
            <P>Calendly links sent ___ | Calls booked ___ | Booking rate ___%</P>
            <H>Story Engagement:</H>
            <P>Stories replied ___ | Warm leads engaged ___ | Cold re-engaged ___</P>
          </div>
        ),
      },
      {
        title: "CRM Notes Per Lead",
        subtitle: "Track everything",
        body: <UL items={[
          "Name, handle, niche",
          "Lead type (Early/Building/Growing/Established)",
          "Current stage (1-8)",
          "Revenue, clients",
          "Pain points (their words)",
          "Budget if shared",
          "Primary constraint (Money/Time/Clarity)",
          "Offer tier suited for",
          "Last interaction date",
          "Next follow-up date",
          "Testimonials sent",
          "Call outcome",
        ]} />,
      },
      {
        title: "Key Performance Targets",
        subtitle: "Scale milestones",
        body: (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1 pr-2">Metric</th><th className="pb-1 pr-2">Start</th><th className="pb-1 pr-2">4 weeks</th><th className="pb-1">8 weeks</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {[
                ["Calls booked/day", "1-2", "5", "10"],
                ["Active convos/day", "20-30", "100+", "250"],
                ["Pipeline leads", "—", "50+", "150+"],
                ["Outbound DMs/day", "—", "50", "50"],
                ["Story replies/day", "—", "15-20", "30+"],
              ].map((r, i) => (
                <tr key={i} className="border-t border-border/70">
                  <td className="py-1 pr-2">{r[0]}</td><td className="py-1 pr-2">{r[1]}</td><td className="py-1 pr-2">{r[2]}</td><td className="py-1">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ),
      },
      {
        title: "Pacing Rules",
        subtitle: "How to message",
        body: <UL items={[
          "Let them talk more than you. Your messages should usually be shorter.",
          "One question per message. Never stack questions.",
          "Match their energy. Paragraphs from them = slightly longer from you.",
          "Don't follow a checklist. Read and respond to what they say.",
          "Use their exact words and numbers. Not your own paraphrasing.",
          "Some close in one session, some take a week. Don't force speed.",
        ]} />,
      },
      {
        title: "Personality Rules",
        subtitle: "How to sound",
        body: <UL items={[
          "Have strong opinions. “you're doing stuff all over the place which is highly unprofitable”",
          "Be direct when wrong. Not “have you considered...” → state it clearly",
          "Casual language naturally. “haha”, “lol”, “ngl” when energy fits",
          "Celebrate genuinely. “BOOM! crushing it.” not “congratulations”",
          "Be human. React to photos, joke, talk non-business",
          "Pull back when appropriate. “just thought i'd help, i'll stop annoying you now lol”",
        ]} />,
      },
      {
        title: "Key Empathy Phrases",
        subtitle: "Copy these directly",
        body: (
          <div className="space-y-1 text-[13px] italic text-foreground/85">
            <P>“i see” / “i feel you”</P>
            <P>“it's very frustrating” / “had the same for a long time”</P>
            <P>“i can fully imagine” / “that's super common honestly”</P>
            <P>“thanks for being super straight forward, helps me a lot!”</P>
            <P>“appreciate the honesty” / “transparency just ends up making it easier for both”</P>
          </div>
        ),
      },
      {
        title: "The 10 Non-Negotiables",
        subtitle: "Break these = you're out",
        body: (
          <ol className="list-decimal pl-5 text-[13px] space-y-1">
            <li>Never sound robotic. Every message human. Lowercase, 2-4 sentences max.</li>
            <li>Never mention specific pricing in DMs. All pricing to the call.</li>
            <li>Never send Calendly before Stage 7. Qualify first, always.</li>
            <li>Never waste time on dead leads. Profile check, delete, move on in 10 seconds.</li>
            <li>Always end with a question. Keep conversation moving.</li>
            <li>Always create summary for the closer before a call.</li>
            <li>Always send testimonial after booking. Pre-warm the lead.</li>
            <li>Always send daily tracking report.</li>
            <li>Every Sunday: 3-4 hour lead refresh. No exceptions.</li>
            <li>Every morning: 50 outbound DMs / story replies. Build pipeline before you work it.</li>
          </ol>
        ),
      },
    ],
  },

  // ===== LANGUAGE =====
  {
    id: "lang",
    heading: "Language & Tone Rules",
    color: "var(--tab-lang)",
    cards: [
      {
        title: "How You Sound",
        subtitle: "10 non-negotiable messaging rules",
        body: (
          <ol className="list-decimal pl-5 text-[13px] space-y-1">
            <li>Sound like a human texting a friend. Lowercase. Short. No corporate language.</li>
            <li>Every message must do ONE of: build trust, gather info, or move to next stage.</li>
            <li>Never send walls of text. 2-4 sentences max. If more, break into two messages.</li>
            <li>Always end with an open question or clear next step. Never dead-end.</li>
            <li>Never mention specific pricing in DMs. Push to the call.</li>
            <li>Never send Calendly before Stage 7. Qualify first, always.</li>
            <li>Match the prospect's energy & sophistication. Don't talk down to $30k/mo. Don't overwhelm $0.</li>
            <li>Be direct and honest. If their approach is wrong, say so (kindly).</li>
            <li>Reference their specific situation in every message. Never sound generic.</li>
            <li>Move conversation forward every message. Never stall. Speed kills — in a good way.</li>
          </ol>
        ),
      },
      {
        title: "How You Write",
        subtitle: "8 writing rules — break these = sounds like AI",
        body: (
          <ol className="list-decimal pl-5 text-[13px] space-y-1">
            <li>Never use “that's not just X, it's Y” or any contrastive metaphor. Just state what it IS.</li>
            <li>Never use rhetorical negation. No “not optional — it's required.” Just say what's required.</li>
            <li>Never use rhetorical feints. No “I call it X” buildups. Just make the point.</li>
            <li>Express claims directly. No subjective qualifiers, value judgments, or evaluative fluff.</li>
            <li>No repetitive structural patterns. No “They had X. They wanted Y. They did Z.”</li>
            <li>No poetic parallel structures. No “Presence without performance.” Say it plainly.</li>
            <li>No formulaic X, Y, Z example lists. Integrate examples naturally or pick one.</li>
            <li>Write like a natural conversation. Not copywriting. Not a pitch deck. If it sounds scripted, rewrite.</li>
          </ol>
        ),
      },
      {
        title: "DO / DON'T Quick Reference",
        subtitle: "At a glance",
        body: (
          <div className="space-y-2">
            <H>DO:</H>
            <UL items={[
              "Reply within 1-2 hours max",
              "Research every profile before responding",
              "End every message with open question",
              "Keep messages 2-4 sentences max",
              "Use lowercase, casual tone",
              "Reference their specific situation",
              "Be aggressive about booking the call",
              "Be direct and honest",
              "Move conversation forward every message",
            ]} />
            <H>DON'T:</H>
            <UL items={[
              "Copy-paste same opener to everyone",
              "Send walls of text",
              "Explain full offer in DMs",
              "Give specific pricing in DMs",
              "Let conversation sit more than 24h",
              "Ask more than one question per message",
              "Use excessive emojis",
              "Sound like a bot or script",
              "Chase someone more than 3 times",
            ]} />
          </div>
        ),
      },
      {
        title: "Formatting Rules",
        subtitle: "How to write messages",
        body: <UL items={[
          "Lowercase, casual tone",
          "Use commas and “and” for breaks",
          "Never use dashes (—)",
          "2-4 sentences max per message",
          "Sound like texting a friend",
          "No corporate language",
          "1-2 emojis max per entire conversation",
          "Write like conversation, not copywriting",
        ]} />,
      },
    ],
  },

  // ===== FRAMEWORKS =====
  {
    id: "frame",
    heading: "Key Frameworks",
    color: "var(--tab-frame)",
    cards: [
      {
        title: "The Leverage Angle",
        subtitle: "For established leads — their results ARE the weapon",
        body: (
          <div className="space-y-2">
            <ol className="list-decimal pl-5 text-[13px] space-y-1">
              <li>Extract proof point: “$4M in email revenue,” “scaled 50 brands,” “12 years experience”</li>
              <li>Reflect it back: “the marketing angle based on your track record gives us all the leverage”</li>
              <li>Frame as unfair advantage: “most people build credibility from scratch. you already have it”</li>
              <li>Address imposter syndrome: “you don't need to become an influencer, your results speak for themselves”</li>
            </ol>
            <H>Full example flow:</H>
            <Q>the marketing angle that we can use based on your track record will instantly give us all the leverage we need to crush it from the start</Q>
            <Q>most people launching info build credibility from scratch. you already have it. your $4M in email revenue IS the content</Q>
            <Q>you don't need to become an influencer, your results speak for themselves. we just build the system around it</Q>
          </div>
        ),
      },
      {
        title: "“Keep What's Working” Framework",
        subtitle: "For owners scared of dropping income",
        body: (
          <div className="space-y-2">
            <ol className="list-decimal pl-5 text-[13px] space-y-1">
              <li>Kill the fear: “no reason to drop what's working”</li>
              <li>Give timeline: “we do that when the new thing is printing enough”</li>
              <li>Show parallel path: “we build alongside, current biz keeps cashflowing”</li>
              <li>Frame current biz as asset: “your cashflow means you invest without pressure”</li>
              <li>Future pace: “your track record means this goes 10x faster than average”</li>
            </ol>
            <Q>no reason to drop the agency, we'll do that at the point the info is printing $100k months</Q>
          </div>
        ),
      },
      {
        title: "Offer Routing Decision Tree",
        subtitle: "Revenue × Budget → Right offer",
        body: (
          <div className="space-y-2">
            <H>Under $1K/mo revenue:</H>
            <P>Budget under $500 → Book ($49) + Story Sequence Funnel ($197)</P>
            <P>Budget $500-$3K → Course or Mochi on payment plan</P>
            <P>Budget $3K+ → Group Coaching</P>
            <H>$1K-$10K/mo revenue:</H>
            <P>Needs just info → Course</P>
            <P>Needs guidance + accountability → Mochi or Group</P>
            <P>Needs hands-on implementation → Group or 1-on-1 E.T.</P>
            <H>$10K-$50K/mo revenue:</H>
            <P>Has systems, needs optimization → 1-on-1 E.T.</P>
            <P>No systems, needs full build → 1-on-1 E.T. or Nik 1-on-1</P>
            <H>$50K+/mo revenue:</H>
            <P>Wants strategy + team → Nik 1-on-1</P>
            <P>Wants specific system → 1-on-1 E.T.</P>
          </div>
        ),
      },
      {
        title: "Using AI as Co-Pilot",
        subtitle: "Step-by-step process",
        body: (
          <div className="space-y-2">
            <ol className="list-decimal pl-5 text-[13px] space-y-1">
              <li>Screenshot the lead's profile — bio, follower count, content, highlights</li>
              <li>Open AI assistant with setter playbook loaded</li>
              <li>Upload profile screenshots + DM conversation so far</li>
              <li>Type: “She DM'd info. What is my response?”</li>
              <li>AI returns: exact reply (copy-paste ready) + strategy note</li>
              <li>Review, adjust if needed, remove any markdown formatting, send</li>
            </ol>
            <H>Strategy note includes:</H>
            <UL items={[
              "Lead type identified (Early/Building/Growing/Established)",
              "Current stage (1-8)",
              "Next move to steer toward",
              "Tactical note on why this response works",
            ]} />
            <P>This is a TOOL, not a crutch. Use it to learn the patterns. Within a few weeks, you should freestyle any conversation from core principles. That's the elite level.</P>
            <P>Use AI for summaries too: after a long DM thread, paste the entire conversation and ask for a summary for the closer. Lets them prepare in 2 min instead of 15.</P>
          </div>
        ),
      },
      {
        title: "Core Setting Principles",
        subtitle: "9 non-negotiable principles",
        body: (
          <ol className="list-decimal pl-5 text-[13px] space-y-1">
            <li>Empathy first. Before you qualify, show you hear them.</li>
            <li>Every response ends with a question. Never dead-end.</li>
            <li>Your response length drives theirs. Long = long.</li>
            <li>Never answer their question directly. Acknowledge, then redirect.</li>
            <li>Reconfirm their beliefs. Use their words back.</li>
            <li>Extract info organically. Never cold ask “how much do you make?”</li>
            <li>Frame support level, not price. “What do you expect?”</li>
            <li>Pre-sell the offer tier through framing before the call.</li>
            <li>Create a summary for the closer: pain points, budget, lead type, offer tier.</li>
          </ol>
        ),
      },
      {
        title: "Quick Responses",
        subtitle: "When you need it fast",
        body: (
          <div className="space-y-2">
            {[
              ["“INFO”", "[Research profile 30 sec → personalized opener]"],
              ["“How much is it?”", "“depends on direction — let's hop on a call”"],
              ["“Burned before”", "“heavy on support & accountability, not just info”"],
              ["“No money”", "“appreciate honesty, let me point you to what makes sense” → low ticket"],
              ["“Let me think”", "“100%, call gives clarity. worst case = free gameplan”"],
              ["“Just send info”", "“i could but won't help without context. 15 min call is worth way more”"],
              ["“Need more followers”", "“#1 mistake, system matters more than number”"],
              ["“What makes you different?”", "“we install the system with you. call is best way to see it”"],
              ["“I'm busy”", "“no worries, when works better this week?”"],
              ["“Send me the link”", "[Send calendly immediately] “ping me when booked!”"],
              ["“Testimonials?”", "“check the highlights. call shows what's realistic for YOU”"],
              ["“Have another business”", "“even better — we build alongside, don't drop anything”"],
              ["[Goes silent after calendly]", "24h: “hey did you check the calendar?”"],
              ["[Still silent]", "48h: “just checking in — any time this week?”"],
              ["[Still still silent]", "Story nurture. Stop chasing in DMs."],
            ].map(([q, a], i) => (
              <div key={i} className="border-t border-border/60 pt-1.5 first:border-t-0 first:pt-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
                <div className="text-[12px] font-semibold">{q}</div>
                <div className="text-[12px] italic text-foreground/80">{a}</div>
              </div>
            ))}
          </div>
        ),
      },
    ],
  },
];
