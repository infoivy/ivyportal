import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, Section, Steps, Tag, Label, Quote, RouteChip, type Cat } from "@/components/sop-canvas";

// The founder's DM Setting Mastery board, ported 1:1 from their Lovable
// build (2026-07-28). Content is verbatim; only the plumbing changed: portal
// theme drives dark mode, drag works on touch, and the zoom bar links back.

export const Route = createFileRoute("/_authenticated/sops/dm-setting-mastery")({
  head: () => ({
    meta: [
      { title: "DM Setting Mastery · ISA" },
      {
        name: "description",
        content:
          "ICP, conversations, qualification, scripts, objections, follow-up, booking, and closer handoff for Ivy DM setters.",
      },
    ],
  }),
  component: DmSettingMasteryGate,
});

// Staff SOP (admin/setter surface in Knowledge): students never see it.
function DmSettingMasteryGate() {
  const { roles } = useAuth();
  if (roles.length > 0 && roles.every(r => r === "student")) return <Navigate to="/knowledge" replace />;
  return <Board />;
}

const tags: { cat: Cat; label: string }[] = [
  { cat: "openers", label: "ICP & Lead Types" },
  { cat: "qualifying", label: "The 8 Stages" },
  { cat: "scripts", label: "Inbound Flow" },
  { cat: "closing", label: "Outbound Openers" },
  { cat: "objections", label: "Story Replies" },
  { cat: "templates", label: "Outbound Conversation" },
  { cat: "psychology", label: "Light DM Qualification" },
  { cat: "engagement", label: "Off-DM Qualification" },
  { cat: "tracking", label: "Booking & Handoff" },
  { cat: "objections", label: "Objections" },
  { cat: "closing", label: "Follow-up & Nurture" },
  { cat: "frameworks", label: "Language, Deen & Truth" },
  { cat: "frameworks", label: "Pacing & Ops" },
];

function Board() {
  const [zoom, setZoom] = useState(0.55);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setTx(dragRef.current.tx + (e.clientX - dragRef.current.x));
      setTy(dragRef.current.ty + (e.clientY - dragRef.current.y));
    };
    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current || e.touches.length !== 1) return;
      const t = e.touches[0];
      setTx(dragRef.current.tx + (t.clientX - dragRef.current.x));
      setTy(dragRef.current.ty + (t.clientY - dragRef.current.y));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const startDrag = (clientX: number, clientY: number, target: EventTarget | null) => {
    const t = target as HTMLElement;
    if (t.closest("button, a, input, textarea")) return;
    dragRef.current = { x: clientX, y: clientY, tx, ty };
    setDragging(true);
  };

  return (
    <div
      className="fixed inset-0 z-40 overflow-hidden canvas-grid select-none bg-background"
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      onMouseDown={(e) => startDrag(e.clientX, e.clientY, e.target)}
      onTouchStart={(e) => {
        if (e.touches.length !== 1) return;
        startDrag(e.touches[0].clientX, e.touches[0].clientY, e.target);
      }}
    >
      <div
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          transformOrigin: "0px 0px",
        }}
      >
        <div className="p-20" style={{ width: 13000, minHeight: 15000 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg bg-primary text-primary-foreground">
              I
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Ivy Sales Academy — DM Setting Mastery
              </h1>
              <p className="text-xs text-muted-foreground">
                ICP, conversations, qualification, scripts, objections, follow-up, booking, and closer handoff
              </p>
            </div>
          </div>

          <div className="mb-6 text-[11px] text-muted-foreground bg-secondary/40 border rounded-md px-3 py-2 max-w-3xl">
            Scripts are guides, not robotic copy. React to what the lead actually said, ask one connected question, and use the lead's own words. Ivy Portal owns leads, tracking, and live ops — this board is training and reference only.
          </div>

          <div className="flex gap-2 mb-14 flex-wrap max-w-4xl">
            {tags.map((t, i) => (
              <Tag key={i} cat={t.cat}>
                {t.label}
              </Tag>
            ))}
          </div>

          {/* SECTION: ICP & Lead Types */}
          <Section cat="openers" title="ICP & Lead Types">
            <Card cat="openers" width={340} title="Who Ivy Is For" subtitle="The core identity">
              <p>Ivy Sales Academy is an appointment-setting and remote-sales mentorship built for Muslim men who want a real, portable career skill and a more flexible income path.</p>
              <Label>Ideal capacity profile:</Label>
              <ul className="space-y-1 list-disc list-inside">
                <li>Muslim man, usually 18–35</li>
                <li>Earning consistently, ideally $1,000+/mo</li>
                <li>Reliable computer + internet</li>
                <li>Can protect 4–5+ hours daily</li>
                <li>Can make or properly involve his own decision</li>
                <li>Can invest without borrowing or family pressure</li>
                <li>Ready to act this month, not collect info forever</li>
              </ul>
              <p className="mt-2 text-[11px]">Under 18 is a hard paid-program disqualification. Don't auto-reject over 35 if the rest of the fit is strong — route to Manager Review.</p>
            </Card>

            <Card cat="openers" width={340} title="Primary: Active Setter / Closer" subtitle="Already in the game, inconsistent">
              <Label>Current reality:</Label>
              <ul className="space-y-1 list-disc list-inside">
                <li>Already setting or closing (or has been)</li>
                <li>Income is inconsistent</li>
                <li>Weak offer, weak leads, weak coaching</li>
                <li>May have finished a program but lacks skill or access</li>
                <li>Books some calls but can't repeat it</li>
              </ul>
              <Label>Main pains (his own words):</Label>
              <Quote>i can set, but my income is all over the place</Quote>
              <Quote>the offer is bad and the leads are weak</Quote>
              <Quote>i finished a program but still can't find a proper role</Quote>
              <Quote>i do activity but my booking rate is poor</Quote>
              <Label>Desired outcome:</Label>
              <p>Sharper skill, consistent conversations and booking, access to better opportunities, reliable evidence of competence.</p>
            </Card>

            <Card cat="openers" width={340} title="Secondary: Employed Career Switcher" subtitle="Wants a real remote skill">
              <Label>Current reality:</Label>
              <ul className="space-y-1 list-disc list-inside">
                <li>Usually works a normal job, often in the West</li>
                <li>May be a student with steady income</li>
                <li>Wants remote income without a business or degree</li>
                <li>May want to live in a Muslim country eventually</li>
                <li>Knows the job isn't the long-term answer</li>
              </ul>
              <Label>Main pains:</Label>
              <ul className="space-y-1 list-disc list-inside">
                <li>Feels trapped, limited upside</li>
                <li>Overwhelmed by online business models and gurus</li>
                <li>Not sure appointment setting is legitimate</li>
                <li>Fears wasting money on another course</li>
                <li>Wants a path that respects his deen</li>
              </ul>
              <Label>Desired outcome:</Label>
              <p>Learn one marketable skill, become employable, build remote income gradually, gain flexibility around family and deen.</p>
            </Card>

            <Card cat="openers" width={320} title="Qualified Beginner" subtitle="Little knowledge, real capacity">
              <Label>Current reality:</Label>
              <ul className="space-y-1 list-disc list-inside">
                <li>Understands little about appointment setting</li>
                <li>No formal experience or proof</li>
                <li>May have messaged PATH from content</li>
                <li>Has time, equipment, and seriousness</li>
              </ul>
              <Label>Main pains:</Label>
              <Quote>why would anyone hire me without experience?</Quote>
              <Quote>i don't know what to learn first</Quote>
              <Quote>i can't tell a real role from a scam</Quote>
              <Label>Desired outcome:</Label>
              <p>Understand the role, learn the minimum skill stack, practice until useful, build honest proof, land a legitimate first opportunity.</p>
            </Card>

            <Card cat="openers" width={340} title="Lead Stages" subtitle="Classify by stage, not follower count">
              <Label>Exploring — curious, knows little</Label>
              <Quote>what made appointment setting stand out to you compared with the other things you've seen online?</Quote>
              <Label>Stuck — wants change, no direction</Label>
              <Quote>what have you tried so far, and where do you keep getting stuck?</Quote>
              <Label>Learning — taking courses, no role yet</Label>
              <Quote>what have you learned so far, and what's stopping you from turning it into a real opportunity?</Quote>
              <Label>In the game — already setting or closing</Label>
              <Quote>what does your current role look like, and what's the main thing stopping it from being consistent?</Quote>
            </Card>

            <Card cat="openers" width={340} title="Traits of a Strong Lead" subtitle="Psychographic signals">
              <ul className="space-y-1 list-disc list-inside">
                <li>Wants a career skill, not instant money</li>
                <li>Accepts skill and income take repetition</li>
                <li>Values directness, brotherhood, truth, accountability</li>
                <li>Willing to role-play, take feedback, track activity</li>
                <li>Healthy skepticism, asks specific questions</li>
                <li>Meaningful reason for change</li>
                <li>Can state 6–12 month goals</li>
                <li>Acts within a clear timeframe</li>
              </ul>
            </Card>

            <Card cat="openers" width={360} title="Objective DQ / Nurture Rules" subtitle="No bias — capacity only">
              <p className="font-medium text-card-foreground">Never qualify or disqualify by country, nationality, name, race, or accent. Location is only for timezone and scheduling.</p>
              <Label>Potential Red:</Label>
              <ul className="space-y-1 list-disc list-inside">
                <li>Under 18</li>
                <li>No income, no savings, no credible plan</li>
                <li>No reliable computer or internet</li>
                <li>Can't protect enough time</li>
                <li>Wants instant money without learning</li>
                <li>Wants to borrow, miss bills, or pressure family</li>
                <li>Unwilling to practice or take feedback</li>
                <li>Dishonest, abusive, or not serious</li>
              </ul>
              <Label>Potential Amber:</Label>
              <ul className="space-y-1 list-disc list-inside">
                <li>Strong fit but currently saving</li>
                <li>Temporary time constraint</li>
                <li>Ready in a few months, not this month</li>
                <li>Legitimate decision-maker involved</li>
                <li>$1,000–$1,499 accessible + strong rest of fit</li>
                <li>Over the ideal age range but otherwise strong</li>
              </ul>
            </Card>
          </Section>

          {/* SECTION: The 8 Stages */}
          <Section cat="qualifying" title="Ivy's 8-Stage DM Setting Process">
            <Card cat="qualifying" width={300} title="The 8 Stages" subtitle="From source to closer handoff">
              <Steps
                cat="qualifying"
                items={[
                  { title: "Source & Profile Research", desc: "~30 sec: source, context, visible signals, prior convos" },
                  { title: "Natural Opener", desc: "Earn a reply. No pitching. No checklist." },
                  { title: "Situation & Intent", desc: "Working, studying, exploring, or already setting?" },
                  { title: "Light Problem & Goal", desc: "One or two curious lines — what he wants changed, what's stopped him" },
                  { title: "Basic Fit Check", desc: "Age 18+, own laptop, real time. That's it — no income grilling in DMs." },
                  { title: "Bridge to a Call", desc: "Closing call (primary) or phone setting call (secondary)" },
                  { title: "Book & Confirm", desc: "Send calendar, confirm booking, warm reminder" },
                  { title: "Off-DM Qualification", desc: "Calendly form + triage call handle money/readiness before the closer" },
                ]}
              />
            </Card>

            <Card cat="qualifying" width={340} title="Stage 1: Source & Profile" subtitle="~30 seconds max">
              <Label>Check:</Label>
              <ul className="space-y-1 list-disc list-inside">
                <li>How he entered: PATH, story reply, comment, follow, outbound, referral</li>
                <li>Visible work, study, sales, or business context</li>
                <li>Does he already mention remote sales or setting?</li>
                <li>Recent content that supports a natural opener</li>
                <li>Prior conversation and resources already sent</li>
              </ul>
              <p className="mt-2 text-[11px]"><span className="font-medium text-card-foreground">Move on when:</span> you know the source, rough context, and likely awareness stage. Never ask what the profile already tells you.</p>
            </Card>

            <Card cat="qualifying" width={340} title="Stage 2: Natural Opener" subtitle="Earn a real reply">
              <Label>PATH inbound:</Label>
              <Quote>salam bro, appreciate you reaching out. what made you message PATH?</Quote>
              <Label>Reel or story inbound:</Label>
              <Quote>appreciate you bro. what part of the post caught your attention?</Quote>
              <Label>Warm outbound follower:</Label>
              <Quote>appreciate the follow bro. are you already in remote sales or just exploring it rn?</Quote>
              <p className="mt-2 text-[11px]"><span className="font-medium text-card-foreground">Move on when:</span> he gives more than a dead-end reply or identifies why he engaged.</p>
            </Card>

            <Card cat="qualifying" width={340} title="Stage 3: Situation & Identity" subtitle="One connected question at a time">
              <Label>Beginner:</Label>
              <Quote>got you. what does life look like rn, working, studying, or in between?</Quote>
              <Label>Sales-aware:</Label>
              <Quote>are you already setting or closing rn, or are you looking at this as your first remote sales skill?</Quote>
              <Label>Active setter:</Label>
              <Quote>what kind of offer are you setting for rn?</Quote>
              <p className="mt-2 text-[11px]"><span className="font-medium text-card-foreground">Move on when:</span> you can classify him as Exploring, Stuck, Learning, or In the game.</p>
            </Card>

            <Card cat="qualifying" width={360} title="Stage 4: Problem & Goal" subtitle="Real gap, not a wish for money">
              <Label>Core questions:</Label>
              <Quote>what are you actually trying to change over the next 6 to 12 months?</Quote>
              <Quote>what's the main thing keeping you from getting there rn?</Quote>
              <Quote>what have you tried already?</Quote>
              <Quote>if this worked properly, what would change for you day to day?</Quote>
              <Label>For an active setter:</Label>
              <Quote>is the bigger issue your skill, the quality of the opportunity, or staying consistent with the activity?</Quote>
              <p className="mt-2 text-[11px]"><span className="font-medium text-card-foreground">Move on when:</span> he's named a specific current problem and a meaningful desired outcome in his own words.</p>
            </Card>

            <Card cat="qualifying" width={340} title="Stage 5: Basic Fit Check" subtitle="Light, in flow, not a checklist">
              <p>Three things only. Don't grill income or savings in the DMs — that's what the Calendly form and triage call are for.</p>
              <Label>Age (only if not obvious):</Label>
              <Quote>quick one so i point you right — you 18+?</Quote>
              <Label>Setup:</Label>
              <Quote>you got a laptop and decent wifi to actually train and take calls on?</Quote>
              <Label>Time:</Label>
              <Quote>rough idea — how much time could you actually put into this daily if it was the right move?</Quote>
              <p className="mt-2 text-[11px]"><span className="font-medium text-card-foreground">Move on when:</span> he's 18+, has a laptop, and has real time. Book him.</p>
            </Card>

            <Card cat="qualifying" width={360} title="Stage 6: Bridge to the Call" subtitle="Primary: closing call · Secondary: setting call">
              <Label>Primary — closing call:</Label>
              <Quote>tbh the easiest way is a quick call with one of our guys. he'll walk you through how it actually works and see if it fits your situation. want me to send the link?</Quote>
              <Label>Secondary — phone setting call:</Label>
              <Quote>easier to just hop on a quick call than go back and forth here. 15 min, no pressure — you good for that?</Quote>
              <p className="mt-2 text-[11px]">Don't oversell the call. Don't promise outcomes. The point is to move him off DMs while he's warm.</p>
            </Card>

            <Card cat="qualifying" width={340} title="Stage 7: Book & Confirm" subtitle="Get him locked in">
              <Label>Send calendar:</Label>
              <Quote>here you go: [APPROVED CALENDAR LINK]. pick a slot that actually works — message me once it's booked so i can confirm.</Quote>
              <Label>After he books:</Label>
              <Quote>locked in for [DATE / TIME]. be somewhere quiet with decent wifi, and just come open about your situation. that's it.</Quote>
              <p className="mt-2 text-[11px]">If he ghosts on the link, one warm nudge same day, one the next day. Then leave it.</p>
            </Card>

            <Card cat="qualifying" width={360} title="Stage 8: Off-DM Qualification" subtitle="Calendly form + triage — not your job in DMs">
              <ul className="space-y-1 list-disc list-inside">
                <li><span className="font-medium text-card-foreground">Calendly form</span> captures the harder financial questions (readiness to invest, income, savings)</li>
                <li><span className="font-medium text-card-foreground">Triage call</span> ~1 day before the closing call confirms money and expectations</li>
                <li>Your job as setter ends at a booked, confirmed, warm lead</li>
              </ul>
              <p className="mt-2 text-[11px]">Don't try to save the triage/closer's job by hard-qualifying in DMs. It kills booking rate on an ICP that mostly won't answer money questions cold.</p>
            </Card>
          </Section>

          {/* SECTION: Inbound */}
          <Section cat="scripts" title="Inbound Scripts">
            <Card cat="scripts" width={340} title="PATH Keyword" subtitle="Main inbound trigger — keep it human">
              <Label>First response:</Label>
              <Quote>salam bro 🤝 what's going on, what made you slide in?</Quote>
              <Label>"I want to make money online":</Label>
              <Quote>fair enough. you working / studying rn or between things?</Quote>
              <Label>"I want to learn appointment setting":</Label>
              <Quote>nice one. you already tried it or you starting from scratch?</Quote>
              <Label>"just curious":</Label>
              <Quote>all good. curious about the job itself or more like how guys actually get started?</Quote>
              <p className="mt-2 text-[11px]">React like a normal person, not a form. One short question at a time. Goal is to earn the next reply, not qualify him in three messages.</p>
            </Card>

            <Card cat="scripts" width={340} title="He Asks for Info Immediately" subtitle="Redirect gently, then bridge to a call">
              <Label>Generic info ask:</Label>
              <Quote>got you. quicker if i just point you the right way — you trying to figure out the skill itself, how to land a role, or whether ivy would fit you?</Quote>
              <Label>"What does Ivy do?":</Label>
              <Quote>short version: we train muslim brothers into remote sales roles — mostly appointment setting and closing. way easier to explain on a quick call than typing paragraphs here. where you at rn, working / studying / in between?</Quote>
            </Card>

            <Card cat="scripts" width={320} title="He's Already Sold" subtitle="Book him, don't stall">
              <Label>Message:</Label>
              <Quote>respect bro. easiest thing is grab a slot with one of our guys, he'll break it down and see if it fits — cool if i send the link?</Quote>
              <p className="mt-2 text-[11px]">If he's warm and 18+ with a laptop, don't invent friction. Send the link.</p>
            </Card>

            <Card cat="scripts" width={300} title="One-Word Replies" subtitle="Don't over-invest early">
              <Label>Suggested message:</Label>
              <Quote>what caught your eye about it?</Quote>
              <p className="mt-2 text-[11px]">One short question back. No paragraphs, no checklist.</p>
            </Card>
          </Section>

          {/* SECTION: Outbound Openers */}
          <Section cat="closing" title="Outbound Openers">
            <Card cat="closing" width={340} title="The Opener's Only Job" subtitle="Start a natural conversation">
              <p>The first outbound message must not pitch, diagnose, or qualify financially. One job: earn a real reply.</p>
              <Label>Who to prioritize:</Label>
              <ul className="space-y-1 list-disc list-inside">
                <li>Recent followers who fit the audience</li>
                <li>People who commented or replied to Ivy content</li>
                <li>Repeat story viewers or engagers</li>
                <li>Muslim men posting about work, study, remote work, sales, career change, discipline, location freedom</li>
                <li>Existing setters or closers with visible sales context</li>
                <li>Old warm conversations never properly followed up</li>
              </ul>
            </Card>

            <Card cat="closing" width={360} title="Approved Direct Openers" subtitle="Use the situation that fits">
              <Label>New follower:</Label>
              <Quote>appreciate the follow bro. are you already in remote sales or just exploring it rn?</Quote>
              <Label>Repeated content engagement:</Label>
              <Quote>seen you around the page a few times bro, what are you trying to figure out about appointment setting?</Quote>
              <Label>Commenter:</Label>
              <Quote>appreciate the comment bro. what part of the video hit you most?</Quote>
              <Label>Visible setter or closer:</Label>
              <Quote>you already setting rn? curious how the role has been treating you</Quote>
              <Label>Work or study context:</Label>
              <Quote>what are you working or studying in rn bro?</Quote>
            </Card>

            <Card cat="closing" width={340} title="Never Use" subtitle="Instant credibility kill">
              <ul className="space-y-1 list-disc list-inside">
                <li>Fake compliments</li>
                <li>Generic mass messages ("Hey, how are you?")</li>
                <li>Manufactured controversy</li>
                <li>Business-owner assumptions about followers, clients, or revenue</li>
                <li>"We can help you make money"</li>
                <li>A price or booking link in the opener</li>
                <li>Financial questions before relevance and trust</li>
                <li>Religious guilt or claims that joining Ivy is the more pious choice</li>
              </ul>
            </Card>
          </Section>

          {/* SECTION: Story Replies */}
          <Section cat="objections" title="Story Replies">
            <Card cat="objections" width={340} title="The Rule" subtitle="Story first, sales later">
              <p>A story reply must be about the story first. Don't turn every story into a pitch.</p>
              <p className="mt-2 text-[11px]">A casual reply such as "thanks" or an emoji is not permission to pitch. Keep the relationship warm and wait for a real opening.</p>
            </Card>

            <Card cat="objections" width={340} title="Work / Long Shift" subtitle="Real reaction, one question">
              <Label>Opener:</Label>
              <Quote>long day bro 😂 what do you do for work?</Quote>
              <Label>If he opens up about feeling stuck:</Label>
              <Quote>i feel you. are you trying to build something remote alongside it, or have you not found the right path yet?</Quote>
            </Card>

            <Card cat="objections" width={320} title="Study" subtitle="React to what he shared">
              <Label>Opener:</Label>
              <Quote>what are you studying bro?</Quote>
              <Label>If he opens the topic of his future:</Label>
              <Quote>do you actually see yourself working in it long term?</Quote>
            </Card>

            <Card cat="objections" width={340} title="Sales or Business" subtitle="Meet him where he is">
              <Label>Opener:</Label>
              <Quote>how long have you been in sales?</Quote>
              <Label>If he says he's a setter:</Label>
              <Quote>nice. what's been harder for you, getting a good opportunity or becoming consistent in the role?</Quote>
            </Card>

            <Card cat="objections" width={320} title="Gym, Travel, Food, Life" subtitle="Just be a human">
              <p>Respond normally. Don't force a sales transition. Continue only if a natural topic opens.</p>
              <Quote>that place looks clean, where is it?</Quote>
              <Quote>solid session bro, how long have you been training?</Quote>
            </Card>
          </Section>

          {/* SECTION: Outbound Conversation */}
          <Section cat="templates" title="Outbound Conversation Flow">
            <Card cat="templates" width={300} title="The Outbound Flow" subtitle="From a reply to a routed outcome">
              <Steps
                cat="templates"
                items={[
                  { title: "Human Conversation", desc: "React, be curious, no pain questions in the first 2 messages" },
                  { title: "Relevance Check", desc: "Is remote sales relevant to him right now?" },
                  { title: "Problem & Goal", desc: "What does he want changed, what's stopped him?" },
                  { title: "Value or Nurture Asset", desc: "One asset that matches the exact pain" },
                  { title: "Qualification", desc: "Capacity, financial, decision, readiness" },
                  { title: "Route", desc: "Book, Nurture, Disqualify Warmly, or Manager Review" },
                ]}
              />
            </Card>

            <Card cat="templates" width={340} title="Phase 1: Human Conversation" subtitle="Learn through curiosity">
              <ul className="space-y-1 list-disc list-inside">
                <li>React to what he actually said</li>
                <li>Don't ask "what's your biggest pain?" in the first two messages</li>
                <li>Have opinions on what he shares</li>
                <li>Share about yourself when it's natural</li>
              </ul>
            </Card>

            <Card cat="templates" width={340} title="Phase 2: Relevance Check" subtitle="Is this the right conversation?">
              <Quote>are you already in remote sales, or is it something you're considering as a way out of your current situation?</Quote>
              <p className="mt-2 text-[11px]">If irrelevant, leave the conversation human. Don't force a funnel.</p>
            </Card>

            <Card cat="templates" width={340} title="Phase 3: Problem & Goal" subtitle="Get the real gap">
              <Quote>what would you want remote work to change for you realistically?</Quote>
              <Quote>what's stopped you from moving on it so far?</Quote>
            </Card>

            <Card cat="templates" width={360} title="Phase 4: Value or Nurture Asset" subtitle="One asset, matched to the pain">
              <ul className="space-y-1 list-disc list-inside">
                <li>Confused about the role or comparing paths → Dynamic Asset 01</li>
                <li>Understands the role, no experience → Dynamic Asset 02, "How to Become an Appointment Setter With No Experience"</li>
                <li>Already setting but inconsistent → approved performance/KPI asset when one exists</li>
                <li>Skeptical of Ivy → one verified proof or founder-story asset</li>
                <li>Not financially ready → approved free community or free training</li>
              </ul>
              <Label>Message:</Label>
              <Quote>this speaks directly to what you said about [specific pain]. watch it when you get a minute and tell me what part feels most relevant to your situation: [APPROVED LINK]</Quote>
              <p className="mt-2 text-[11px]">Never invent asset URLs. Never dump multiple links.</p>
            </Card>

            <Card cat="templates" width={340} title="Phase 5 & 6: Qualify + Route" subtitle="Use the same qualification stages">
              <p>Once a real problem is identified, use the same capacity, financial, decision, and readiness questions from DM Qualification. Do not force every outbound conversation into a call.</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <RouteChip kind="green">Book</RouteChip>
                <RouteChip kind="amber">Nurture</RouteChip>
                <RouteChip kind="red">Disqualify Warmly</RouteChip>
                <RouteChip kind="manager">Manager Review</RouteChip>
              </div>
            </Card>
          </Section>

          {/* SECTION: DM Qualification */}
          <Section cat="psychology" title="Light DM Qualification">
            <Card cat="psychology" width={340} title="Basic Fit — In DMs" subtitle="Three things, that's it">
              <p>This is what qualifies in DMs. Anything financial or family-related stays for the Calendly form / triage call.</p>
              <Label>Age (if not obvious):</Label>
              <Quote>quick one so i point you right — you 18+?</Quote>
              <Label>Setup:</Label>
              <Quote>you got a laptop and decent wifi?</Quote>
              <Label>Time:</Label>
              <Quote>rough idea — how much time could you actually put in daily?</Quote>
              <p className="mt-2 text-[11px]">Don't ask "what's your income," "how much savings do you have," "who decides in your family." Those questions kill warm broke leads before they ever see a closer.</p>
            </Card>

            <Card cat="psychology" width={340} title="Light Intent Check" subtitle="One curious question, not an interrogation">
              <Label>Why now:</Label>
              <Quote>what made you actually look into this rn vs six months ago?</Quote>
              <Label>What he's tried:</Label>
              <Quote>you tried anything similar before or this is fresh territory?</Quote>
              <p className="mt-2 text-[11px]">You want a feel for whether he's serious enough to show up to a call. You don't need his life story.</p>
            </Card>

            <Card cat="psychology" width={340} title="How the DM Should Feel" subtitle="Human, short, book-oriented">
              <ul className="space-y-1 list-disc list-inside">
                <li>React before asking anything</li>
                <li>One short question at a time</li>
                <li>Let him talk more than you</li>
                <li>No income / savings / family-decision questions in DMs</li>
                <li>Bridge to a call as soon as basic fit is clear</li>
                <li>If he's warm and 18+ with a laptop, send the link</li>
              </ul>
            </Card>

            <Card cat="psychology" width={340} title="Common DM Anti-Patterns" subtitle="What you're doing wrong if bookings are low">
              <ul className="space-y-1 list-disc list-inside">
                <li>Corporate options-list replies ("replace a job, build alongside it, or…")</li>
                <li>Paragraph responses to one-word messages</li>
                <li>Asking money questions before he trusts you</li>
                <li>Delivering the whole pitch in DMs, then asking for the call</li>
                <li>Trying to disqualify broke leads yourself — that's what triage is for</li>
              </ul>
            </Card>
          </Section>

          {/* SECTION: Off-DM Qualification */}
          <Section cat="engagement" title="Off-DM Qualification (Calendly + Triage)">
            <Card cat="engagement" width={360} title="Why It's Off-DM" subtitle="ICP-specific reason">
              <p>ICP is mostly younger Muslim men, many broke or between things. Hard financial qualification in DMs kills booking rate because:</p>
              <ul className="space-y-1 list-disc list-inside mt-1">
                <li>They won't answer money questions from a stranger</li>
                <li>They self-disqualify before they see what's actually possible</li>
                <li>They ghost the moment DMs feel like a sales interview</li>
              </ul>
              <p className="mt-2 text-[11px]">Get them warm. Get them booked. Let the form and triage do the filtering.</p>
            </Card>

            <Card cat="engagement" width={340} title="Layer 1 — Calendly Form" subtitle="Structured, off-DM, before the call">
              <p>The Calendly booking form carries the financial + readiness questions, e.g.:</p>
              <ul className="space-y-1 list-disc list-inside mt-1">
                <li>Are you ready and able to invest in a paid mentorship?</li>
                <li>Rough monthly income</li>
                <li>Rough savings accessible</li>
                <li>Timeline to start</li>
              </ul>
              <p className="mt-2 text-[11px]">Answers live in the CRM before the call — closer / triage sees them, not you.</p>
            </Card>

            <Card cat="engagement" width={340} title="Layer 2 — Triage Call" subtitle="~1 day before the closing call">
              <ul className="space-y-1 list-disc list-inside">
                <li>Confirms the form answers verbally</li>
                <li>Handles obvious financial mismatches</li>
                <li>Reschedules, reroutes, or cancels weak fits</li>
                <li>Warms up strong fits for the closer</li>
              </ul>
              <p className="mt-2 text-[11px]">If a lead is a hard "no money at all" on the triage, that's on the triage, not on you.</p>
            </Card>

            <Card cat="engagement" width={340} title="Secondary Path — Phone Setting Call" subtitle="When DMs stall but he's warm">
              <p>If he's engaged but not moving on the closing-call link, offer a short phone setting call as the lower-friction option.</p>
              <Quote>easier to just talk for 10-15 min than type all this out — you around for a quick call?</Quote>
              <p className="mt-2 text-[11px]">Same rules: no pressure, no promises. The setting call surfaces fit, then routes to the closer's calendar.</p>
            </Card>

            <Card cat="engagement" width={340} title="Price in DMs" subtitle="Don't quote, don't invent">
              <p>Don't hardcode a price. If asked directly:</p>
              <Quote>the guys on the call handle exact numbers — it depends on your situation. quicker to grab a slot and get the real answer than for me to guess.</Quote>
              <p className="mt-2 text-[11px]">Never invent a range. Never fake scarcity or "checking with management."</p>
            </Card>

            <Card cat="engagement" width={340} title="Financial Safety" subtitle="Still applies, even off-DM">
              <p>Setters, triage, and closers never encourage:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Debt or borrowing to buy in</li>
                <li>Missing rent, bills, food, tuition</li>
                <li>Hiding the decision from family</li>
                <li>Religious guilt as leverage</li>
              </ul>
            </Card>
          </Section>

          {/* SECTION: Booking & Handoff */}
          <Section cat="tracking" title="Booking & Handoff">
            <Card cat="tracking" width={340} title="Permission Close" subtitle="Never send a link without asking">
              <Quote>based on what you shared, a call actually makes sense. we'll map the right path around your schedule and where you're starting. want me to send the calendar?</Quote>
              <Label>Link sent:</Label>
              <Quote>perfect, here it is: [APPROVED CALENDAR LINK]. message me once you've booked so i can confirm it on my side.</Quote>
            </Card>

            <Card cat="tracking" width={340} title="Calendar Follow-ups" subtitle="Two nudges, then stop">
              <Label>24h after link sent:</Label>
              <Quote>bro, did you get a chance to check the calendar?</Quote>
              <Label>48h after link sent:</Label>
              <Quote>just checking so i don't leave this open. are you still looking to move forward, or should we pause it for now?</Quote>
              <p className="mt-2 text-[11px]">After that, stop chasing. Move him to nurture unless he reopens the conversation.</p>
            </Card>

            <Card cat="tracking" width={340} title="Booking Confirmation" subtitle="Set him up to show up ready">
              <Quote>you're locked in for [DATE AND TIME] in [TIMEZONE]. please be somewhere quiet with stable internet and watch [APPROVED PRE-CALL ASSET] beforehand. anything specific you'd want the advisor to be ready for?</Quote>
              <Label>Day-before reminder:</Label>
              <Quote>all set for the call tomorrow at [TIME]?</Quote>
            </Card>

            <Card cat="tracking" width={340} title="No-Show" subtitle="One honest check, no unlimited reschedules">
              <Quote>everything alright bro? i saw you couldn't make the call. if you're still serious, tell me what happened and i'll see whether rescheduling makes sense.</Quote>
              <p className="mt-2 text-[11px]">Do not immediately reward repeated no-shows with unlimited rescheduling.</p>
            </Card>

            <Card cat="tracking" width={380} title="Closer Handoff Template" subtitle="Copyable — collect only what's necessary">
              <pre className="whitespace-pre-wrap text-[10px] leading-snug bg-secondary/40 rounded p-2 font-mono">
{`Name / handle:
Lead source / trigger:
Lead stage: Exploring / Stuck / Learning / In the game
Current situation:
Current work or study:
Sales or setting experience:
Goal in his exact words:
Main pain in his exact words:
What he has already tried:
Time capacity:
Computer and internet: Yes / No
Income band:
Accessible savings band:
Decision-maker status:
Readiness timeframe:
Main objection or concern:
Resources sent:
Route: Green / Amber / Red / Manager Review
Why this route:
Booked date, time and timezone:
Anything promised by setter: None, or specify exactly`}
              </pre>
              <p className="mt-2 text-[11px]">Do not copy unnecessary private details.</p>
            </Card>
          </Section>

          {/* SECTION: Objections */}
          <Section cat="objections" title="Objection Library">
            <Card cat="objections" width={340} title="The Pattern" subtitle="How every objection is handled">
              <ol className="space-y-1 list-decimal list-inside">
                <li>Answer the real question honestly</li>
                <li>Reflect the concern without fake empathy</li>
                <li>Ask one useful follow-up</li>
                <li>Route according to the answer</li>
              </ol>
              <p className="mt-2 text-[11px]">Do not treat every hesitation as something to overcome. Sometimes thinking is reasonable.</p>
            </Card>

            <Card cat="objections" width={360} title={`"What is appointment setting?"`} subtitle="Explain, then route">
              <Quote>you start conversations with leads, qualify whether there's a real fit, follow up, and book qualified calls for a closer. the skill is communication, qualification, tracking and consistency. are you looking at it as your first remote skill or are you already in sales?</Quote>
            </Card>

            <Card cat="objections" width={340} title={`"Do I need experience?"`} subtitle="Honest, no promises">
              <Quote>not necessarily. experience helps, but what matters first is whether you're willing to train, role-play, take feedback and follow a process consistently. what experience do you have with sales or customer conversations, if any?</Quote>
            </Card>

            <Card cat="objections" width={340} title={`"Is a job guaranteed?"`} subtitle="Never promise placement">
              <Quote>no honest program should promise that every person is guaranteed a job. ivy helps you build the skill and access opportunities, but your preparation, performance and the hiring company still matter. is your bigger concern finding a role or becoming good enough to keep one?</Quote>
            </Card>

            <Card cat="objections" width={340} title={`"Is 3K–5K guaranteed?"`} subtitle="Never promise income">
              <Quote>no, that is a possible outcome, not a guarantee. income depends on the role, offer, commission structure, lead quality and your performance. what outcome are you realistically working toward first?</Quote>
            </Card>

            <Card cat="objections" width={360} title={`"Is it halal?"`} subtitle="No personalized fatwas">
              <Quote>we take deen seriously and do not teach lying or pressure tactics. whether a specific role is permissible depends on what is being sold and how the sale is conducted, so we don't make blanket rulings over every offer. is there a specific concern you have about the work?</Quote>
              <p className="mt-2 text-[11px]">For a specific religious ruling, tell the lead to ask a qualified scholar with the actual offer and job details.</p>
            </Card>

            <Card cat="objections" width={360} title={`"From my country / with my accent?"`} subtitle="Never use as a proxy for financial DQ">
              <Quote>location or accent alone doesn't decide whether someone can perform. communication, work ethic, availability, internet and the fit with a specific opportunity matter more. where are you based, mainly so i understand the timezone?</Quote>
            </Card>

            <Card cat="objections" width={340} title={`"How much is it?"`} subtitle="Never invent a price">
              <Quote>it's a four-figure mentorship, and i don't want to push you toward a call if that would be irresponsible for your situation. before i point you either way, would that level be realistic without borrowing or putting yourself or your family under pressure?</Quote>
              <p className="mt-2 text-[11px]">If current approved policy requires an exact figure, use the live Portal script — not an invented Lovable value.</p>
            </Card>

            <Card cat="objections" width={340} title={`"I cannot afford it"`} subtitle="Point to the free route">
              <Quote>appreciate you being straight. i wouldn't tell you to borrow or put yourself or your family under pressure. the paid mentorship isn't the right move rn, so i'll point you to [APPROVED FREE RESOURCE] and you can come back when your situation changes. fair?</Quote>
            </Card>

            <Card cat="objections" width={340} title={`"I don't have time"`} subtitle="Ask, don't argue">
              <Quote>how many hours could you honestly protect in a normal week?</Quote>
              <p className="mt-2 text-[11px]">If he can't protect the required time, route Amber or Red rather than arguing.</p>
            </Card>

            <Card cat="objections" width={340} title={`"I need to think about it"`} subtitle="Thinking is allowed">
              <Quote>of course. what specifically do you need to think through, the fit, the time, or the investment?</Quote>
            </Card>

            <Card cat="objections" width={340} title={`"I need to speak to my family"`} subtitle="Respect and include">
              <Quote>respect. who needs to be involved in the decision?</Quote>
              <Quote>would it help for them to join the call so nothing gets lost?</Quote>
            </Card>

            <Card cat="objections" width={340} title={`"I was burned by another program"`} subtitle="Address the specific failure">
              <Quote>i get why you'd be cautious. what went wrong with the last program?</Quote>
              <p className="mt-2 text-[11px]">Respond to the specific failure. Do not claim Ivy is different through features or results that aren't verified.</p>
            </Card>

            <Card cat="objections" width={340} title={`"Just send me information"`} subtitle="Point him accurately">
              <Quote>happy to. so i send the right thing, are you trying to understand the role, how to get your first opportunity, or how ivy works?</Quote>
            </Card>

            <Card cat="objections" width={360} title={`"Can I see results or testimonials?"`} subtitle="Only approved, verified proof">
              <Quote>happy to show verified examples we're approved to share. i won't promise your result will match someone else's. are you looking for proof that the model works or someone who started from a situation similar to yours?</Quote>
            </Card>

            <Card cat="objections" width={340} title={`"Is this a scam?"`} subtitle="Invite scrutiny">
              <Quote>fair question. don't take our word for it. review the public material, ask direct questions, and only move forward if the agreement, support and expectations are clear. what specifically made you cautious?</Quote>
            </Card>

            <Card cat="objections" width={340} title={`"I have no laptop"`} subtitle="Free path first">
              <Quote>then the paid path isn't responsible yet. you'll need a reliable computer and internet to train and work. build that first, use [APPROVED FREE RESOURCE], and message us when it's sorted.</Quote>
            </Card>

            <Card cat="objections" width={340} title="Under 18" subtitle="Hard paid-program DQ">
              <Quote>you're too early for the paid mentorship rn. use the free material, build your communication and discipline, and come back once you're 18 insha'Allah.</Quote>
            </Card>
          </Section>

          {/* SECTION: Follow-up & Nurture */}
          <Section cat="closing" title="Follow-up & Nurture">
            <Card cat="closing" width={360} title="The Principle" subtitle="A not-ready lead is not a failed lead">
              <p>Keep the relationship clean and give him the next honest step. Never use fake deadlines or vague "checking in" forever.</p>
            </Card>

            <Card cat="closing" width={340} title="Financial Gap" subtitle="Nurture with an honest next step">
              <Quote>the main gap rn is financial capacity, not whether you could learn the skill. use [FREE RESOURCE], focus on building [specific amount or stability goal], and i'll check back on [DATE].</Quote>
            </Card>

            <Card cat="closing" width={340} title="Time Gap" subtitle="Come back when the pressure changes">
              <Quote>your schedule doesn't support doing this properly rn. when [specific work/study pressure] changes, message me and we'll reassess. i'll check back on [DATE].</Quote>
            </Card>

            <Card cat="closing" width={340} title="Skill or Awareness Gap" subtitle="One asset, one follow-up">
              <Quote>watch this first because it answers the exact question you have about [pain]: [APPROVED ASSET]. after you watch, tell me what still feels unclear.</Quote>
            </Card>

            <Card cat="closing" width={320} title="Not Ready This Month" subtitle="Pin a real date">
              <Quote>makes sense. what date would be honest for you to revisit this instead of leaving it vague?</Quote>
            </Card>

            <Card cat="closing" width={340} title="Follow-up Cadence" subtitle="What good pace looks like">
              <ul className="space-y-1 list-disc list-inside">
                <li>Active qualified conversation: same day where practical</li>
                <li>Calendar sent, not booked: 24h, then 48h, then stop direct chasing</li>
                <li>Amber lead: real 30–60 day follow-up based on the specific gap</li>
                <li>Cold nurture: engage naturally with relevant content or stories, not repeated pitch messages</li>
                <li>Never use fake deadlines</li>
              </ul>
            </Card>
          </Section>

          {/* SECTION: Language, Deen & Truth */}
          <Section cat="frameworks" title="Language, Deen & Truth">
            <Card cat="frameworks" width={360} title="How Setters Should Sound" subtitle="Natural, calm, direct, brotherly">
              <ul className="space-y-1 list-disc list-inside">
                <li>Mostly lowercase if it matches the lead, but never sloppy</li>
                <li>Mirror the lead's formality and message length</li>
                <li>Usually 1–3 short sentences</li>
                <li>One question per message</li>
                <li>Use "bro" naturally, not in every sentence</li>
                <li>Emojis sparingly</li>
                <li>Reference one real detail from his message</li>
                <li>Answer direct questions briefly before redirecting</li>
              </ul>
            </Card>

            <Card cat="frameworks" width={360} title="Non-Negotiable Truth Rules" subtitle="Break any of these = out">
              <ul className="space-y-1 list-disc list-inside">
                <li>No fake proof, revenue, student stories, scarcity, deadlines, discounts, or management approval</li>
                <li>No guaranteed income or guaranteed job placement</li>
                <li>No claim that every appointment-setting role is halal</li>
                <li>No religious guilt, shame, or pressure</li>
                <li>No encouragement to borrow or neglect obligations</li>
                <li>No nationality, race, accent, or country-based qualification</li>
                <li>No pretending to be Abdurrahman if the setter is a team member</li>
                <li>No hiding that the person is speaking with Ivy's team when asked</li>
                <li>No booking clearly unqualified leads to hit a KPI</li>
                <li>No DM payment close unless the owner explicitly approves that policy</li>
              </ul>
            </Card>

            <Card cat="frameworks" width={360} title="Removed From The Old Playbook" subtitle="Do not use these anywhere">
              <ul className="space-y-1 list-disc list-inside">
                <li>"Never answer questions directly"</li>
                <li>"Every objection is a buying signal"</li>
                <li>"Impossible to refuse"</li>
                <li>"Financial pressure is the reason the plan needs to work"</li>
                <li>Fake high-price anchors followed by a special deal</li>
                <li>Treating a prospect's fear as leverage</li>
                <li>Any script written for coaches, agencies, info products, or personal-brand consulting</li>
              </ul>
            </Card>
          </Section>

          {/* SECTION: Pacing & Ops */}
          <Section cat="frameworks" title="Pacing & Operations">
            <Card cat="frameworks" width={340} title="Message Pacing" subtitle="How a conversation should feel">
              <ul className="space-y-1 list-disc list-inside">
                <li>React before asking the next question</li>
                <li>One connected question, not a checklist</li>
                <li>Let the lead speak more than the setter</li>
                <li>Don't jump to money before a real problem and goal</li>
                <li>Don't send the calendar before basic qualification</li>
                <li>Don't keep a qualified lead waiting unnecessarily</li>
                <li>Don't force speed when the lead is thoughtful</li>
                <li>Voice notes only when they genuinely improve clarity (per current team policy)</li>
              </ul>
            </Card>

            <Card cat="frameworks" width={320} title="Daily KPI Reference" subtitle="Current baseline">
              <p className="font-medium text-card-foreground">300 DMs · 6 qualified sets</p>
              <p className="mt-2">Quality matters more than inflated volume. A booked call counts only if it is actually qualified — Green or approved Manager Review.</p>
            </Card>

            <Card cat="frameworks" width={340} title="Tracked in Ivy Portal, Not Here" subtitle="This board is training and reference">
              <ul className="space-y-1 list-disc list-inside">
                <li>New inbound conversations</li>
                <li>Outbound DMs sent</li>
                <li>Replies</li>
                <li>Active conversations</li>
                <li>Follow-ups completed</li>
                <li>Qualification stage reached</li>
                <li>Green / Amber / Red / Manager Review counts</li>
                <li>Calendar links sent</li>
                <li>Qualified calls booked</li>
                <li>Show rate</li>
                <li>Disqualification reasons</li>
                <li>Resources sent</li>
                <li>Closer outcomes</li>
              </ul>
            </Card>

            <Card cat="frameworks" width={360} title="EOD Summary Template" subtitle="Copyable">
              <pre className="whitespace-pre-wrap text-[10px] leading-snug bg-secondary/40 rounded p-2 font-mono">
{`Outbound DMs:
Inbound conversations handled:
Replies:
Active qualified conversations:
Green:
Amber:
Red:
Manager Review:
Calendar links sent:
Qualified calls booked:
Follow-ups completed:
Main objections heard today:
Stalled leads requiring help:
Notes for sales manager:`}
              </pre>
            </Card>
          </Section>

          {/* SECTION: Full Script Examples */}
          <Section cat="scripts" title="Full Script Examples">
            {[
              {
                title: "A · PATH inbound · career switcher",
                route: "green" as const,
                lines: [
                  ["Lead", "PATH"],
                  ["Setter", "salam bro, appreciate you reaching out. what made you message PATH?"],
                  ["Lead", "i work in a warehouse and want to make money remotely"],
                  ["Setter", "got you. are you trying to replace the warehouse job eventually, or build something alongside it first?"],
                  ["Lead", "alongside it first then leave when it works"],
                  ["Setter", "that makes sense. what have you tried so far, and where do you keep getting stuck?"],
                  ["Lead", "watched videos about ecommerce and copywriting but never committed"],
                  ["Setter", "sounds like the issue is less effort and more choosing one path long enough to build real skill. what made appointment setting feel more realistic to you?"],
                  ["Lead", "i like talking to people and don't want to start a business"],
                  ["Setter", "good reason. if you took it seriously, how many hours a day could you realistically protect around work?"],
                  ["Lead", "5 hours most days"],
                  ["Setter", "solid. do you have your own computer and reliable internet for training, calls and tracking?"],
                  ["Lead", "yes"],
                  ["Setter", "thanks for being straight with me. what are you working with rn, income and savings wise? i need to know so i point you in a direction that doesn't put you or your family under pressure"],
                  ["Lead", "i make 2500 a month and have about 3000 saved"],
                  ["Setter", "understood. if the path made sense, can you make the decision yourself?"],
                  ["Lead", "yes"],
                  ["Setter", "and if the fit was right, would you genuinely move this month?"],
                  ["Lead", "yes"],
                  ["Setter", "based on what you shared, a call actually makes sense. we'll map the right path around your schedule and where you're starting. want me to send the calendar?"],
                ],
              },
              {
                title: "B · active setter, inconsistent results",
                route: "green" as const,
                lines: [
                  ["Setter", "appreciate the follow bro. you already setting rn?"],
                  ["Lead", "yeah but the offer is bad and i barely make anything"],
                  ["Setter", "i feel you. is the bigger issue weak leads, the commission structure, or your own booking consistency?"],
                  ["Lead", "mostly weak leads but my booking rate isn't great either"],
                  ["Setter", "fair. roughly how many qualified calls are you setting each week?"],
                  ["Lead", "about 80 convos a week and maybe 2 calls"],
                  ["Setter", "got you. so there may be an opportunity problem and a skill gap at the same time. what feedback or coaching are you getting rn?"],
                  ["Lead", "basically none"],
                  ["Setter", "that explains a lot. what are you trying to change over the next 6 months, better role, better skill, or both?"],
                  ["Setter", "(continues naturally into time, equipment, financial, decision, and readiness qualification)"],
                ],
              },
              {
                title: "C · strong fit but not financially ready",
                route: "amber" as const,
                lines: [
                  ["Lead", "i can invest but i don't have much saved"],
                  ["Setter", "got you. when you say you can invest, are you thinking somewhere in the four figures, or would that be a stretch rn?"],
                  ["Lead", "i only have 600 right now"],
                  ["Setter", "appreciate the honesty. would using that put pressure on bills or your family?"],
                  ["Lead", "yes probably"],
                  ["Setter", "then i wouldn't push you into a call rn. the fit may be there, but the timing isn't responsible. use [APPROVED FREE RESOURCE], focus on building stable savings, and i'll check back on [DATE]. fair?"],
                ],
              },
              {
                title: "D · wants instant money, no equipment",
                route: "red" as const,
                lines: [
                  ["Lead", "how fast can i make 5k? i need money this month"],
                  ["Setter", "i don't want to sell you a fantasy. nobody can responsibly guarantee that. are you looking to build a skill, or do you only need an immediate cash fix?"],
                  ["Lead", "immediate cash and i only have my phone"],
                  ["Setter", "then the paid mentorship isn't the right move rn. you'll need a reliable computer, time to train, and room to build the skill without betting your bills on it. start with [APPROVED FREE RESOURCE] and come back when those basics are in place."],
                ],
              },
              {
                title: "E · warm outbound conversation",
                route: "manager" as const,
                lines: [
                  ["Setter", "appreciate the follow bro. are you already in remote sales or just exploring it rn?"],
                  ["Lead", "just exploring, i work full time"],
                  ["Setter", "what has you looking at remote work rn?"],
                  ["Lead", "security, the hours are killing me"],
                  ["Setter", "i can imagine. are you trying to build something alongside the job first, or are you looking for the fastest exit possible?"],
                  ["Lead", "alongside first"],
                  ["Setter", "that's the sensible route. what have you looked at so far besides appointment setting?"],
                  ["Setter", "(continues into problem and goal; does not jump to financial qualification or a calendar link)"],
                ],
              },
            ].map((ex, i) => (
              <Card key={i} cat="scripts" width={420} title={`Example ${ex.title}`} subtitle="Verbatim">
                <div className="mb-2"><RouteChip kind={ex.route}>example outcome</RouteChip></div>
                <div className="space-y-1.5">
                  {ex.lines.map(([who, msg], j) => (
                    <div key={j} className="flex gap-2 text-[11px] leading-snug">
                      <div className={`w-14 flex-shrink-0 font-semibold ${who === "Setter" ? "text-primary" : "text-muted-foreground"}`}>{who}:</div>
                      <div className="italic">"{msg}"</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </Section>

          {/* SECTION: Checklist */}
          <Section cat="openers" title="Final Implementation Checks">
            <Card cat="openers" width={520} title="Setter Self-Audit" subtitle="Before considering a conversation clean">
              <ul className="space-y-1 list-disc list-inside">
                <li>ICP is Muslim men learning or improving appointment setting</li>
                <li>PATH is the main inbound keyword</li>
                <li>Lead classified: Exploring / Stuck / Learning / In the game</li>
                <li>Green includes $1,500 accessible as the clear threshold</li>
                <li>$1,000–$1,499 is reviewable when the rest is strong</li>
                <li>Time requirement: 4–5+ hours daily</li>
                <li>Computer and reliable internet included</li>
                <li>No country / nationality / accent qualification used</li>
                <li>No language encouraging debt or family pressure</li>
                <li>No guaranteed job or income claims made</li>
                <li>No exact price, calendar link, asset URL, or testimonial invented</li>
                <li>End goal: a qualified call and a clean closer handoff</li>
                <li>Daily reference: 300 DMs · 6 qualified sets</li>
                <li>Scripts stayed concise, natural, one question at a time</li>
              </ul>
            </Card>
          </Section>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card border rounded-lg sop-shadow-elevated px-3 py-2 text-xs">
        <Link
          to={"/knowledge" as string}
          className="flex items-center gap-1 px-2 h-7 rounded hover:bg-secondary font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
        <div className="w-px h-5 bg-border" />
        <button
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.05))}
          className="w-7 h-7 rounded hover:bg-secondary flex items-center justify-center font-bold"
        >
          −
        </button>
        <span className="font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.05))}
          className="w-7 h-7 rounded hover:bg-secondary flex items-center justify-center font-bold"
        >
          +
        </button>
        <button
          onClick={() => {
            setZoom(0.55);
            setTx(0);
            setTy(0);
          }}
          className="ml-2 px-2 h-7 rounded hover:bg-secondary font-medium"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
