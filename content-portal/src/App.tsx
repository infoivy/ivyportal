import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity, ArrowRight, BarChart3, BookOpen, Bot, CalendarDays, Check,
  ChevronRight, CircleGauge, Clock3, Command, FileText, Flame, LayoutDashboard,
  Library, Lightbulb, Loader2, LogOut, Menu, MessageSquareText, MoreHorizontal,
  Plus, Search, Send, Settings2, Sparkles, Target, TrendingUp, Video, X, Zap,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { ContentPiece, ContentStage, NavId } from "./types";

const stages: { id: ContentStage; label: string }[] = [
  { id: "idea", label: "Ideas" },
  { id: "script", label: "Scripting" },
  { id: "ready", label: "Ready" },
  { id: "editing", label: "Editing" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
];

const demo: ContentPiece[] = [
  { id: "1", title: "Why most setters stay broke", hook: "The reason you're not making $10k isn't your close rate.", core_idea: "Activity quality compounds faster than motivation.", pillar: "Sales Truths", funnel_stage: "tof", format: "Talking head", primary_platform: "Instagram", status: "editing", scheduled_for: "2026-07-13", published_at: null, post_url: null, script: "", cta: "Comment SYSTEM", views: 0, likes: 0, comments: 0, shares: 0, saves: 0, leads: 0, booked_calls: 0, sales: 0, attributed_revenue: 0, avg_watch_seconds: null, retention_percent: null, created_at: "2026-07-11", updated_at: "2026-07-12" },
  { id: "2", title: "Student went from $0 to $8k", hook: "Three months ago, Omar had never closed a call.", core_idea: "Proof through a specific student transformation.", pillar: "Student Wins", funnel_stage: "mof", format: "Case study", primary_platform: "Instagram", status: "scheduled", scheduled_for: "2026-07-14", published_at: null, post_url: null, script: "", cta: "DM CLOSER", views: 0, likes: 0, comments: 0, shares: 0, saves: 0, leads: 0, booked_calls: 0, sales: 0, attributed_revenue: 0, avg_watch_seconds: null, retention_percent: null, created_at: "2026-07-09", updated_at: "2026-07-12" },
  { id: "3", title: "Stop learning sales like this", hook: "Watching another 40-minute sales video is keeping you average.", core_idea: "Reps beat passive education.", pillar: "Education", funnel_stage: "tof", format: "Whiteboard", primary_platform: "TikTok", status: "script", scheduled_for: "2026-07-15", published_at: null, post_url: null, script: "", cta: "Follow for daily reps", views: 0, likes: 0, comments: 0, shares: 0, saves: 0, leads: 0, booked_calls: 0, sales: 0, attributed_revenue: 0, avg_watch_seconds: null, retention_percent: null, created_at: "2026-07-12", updated_at: "2026-07-12" },
  { id: "4", title: "The call review nobody wants", hook: "I reviewed 100 losing calls. One mistake showed up in 82.", core_idea: "Diagnosis before prescription.", pillar: "Sales Skills", funnel_stage: "tof", format: "Miro breakdown", primary_platform: "YouTube", status: "ready", scheduled_for: "2026-07-17", published_at: null, post_url: null, script: "", cta: "Watch the full breakdown", views: 0, likes: 0, comments: 0, shares: 0, saves: 0, leads: 0, booked_calls: 0, sales: 0, attributed_revenue: 0, avg_watch_seconds: null, retention_percent: null, created_at: "2026-07-08", updated_at: "2026-07-11" },
  { id: "5", title: "Discipline is a bad strategy", hook: "If your business needs you motivated every day, your system is broken.", core_idea: "Systems remove emotional dependence.", pillar: "Founder POV", funnel_stage: "tof", format: "Talking head", primary_platform: "Instagram", status: "published", scheduled_for: null, published_at: "2026-07-10", post_url: "#", script: "", cta: "Save this", views: 48216, likes: 3104, comments: 184, shares: 871, saves: 1402, leads: 129, booked_calls: 17, sales: 3, attributed_revenue: 22500, avg_watch_seconds: 18.4, retention_percent: 64, created_at: "2026-07-05", updated_at: "2026-07-12" },
];

const nav = [
  { id: "command" as NavId, label: "Command center", icon: LayoutDashboard },
  { id: "pipeline" as NavId, label: "Content pipeline", icon: Activity },
  { id: "library" as NavId, label: "Content library", icon: Library },
  { id: "analytics" as NavId, label: "Performance", icon: BarChart3 },
  { id: "systems" as NavId, label: "Systems & SOPs", icon: BookOpen },
];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [allowed, setAllowed] = useState(!isSupabaseConfigured);
  const [active, setActive] = useState<NavId>("command");
  const [pieces, setPieces] = useState<ContentPiece[]>(demo);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setAuthReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !session) return;
    Promise.all([
      supabase.from("founder_access").select("user_id").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("content_pieces").select("*").order("updated_at", { ascending: false }),
    ]).then(([access, content]) => {
      setAllowed(Boolean(access.data));
      if (content.data) setPieces(content.data as ContentPiece[]);
    });
  }, [session]);

  if (!authReady) return <Splash />;
  if (isSupabaseConfigured && !session) return <Login />;
  if (!allowed) return <AccessDenied onLogout={() => supabase.auth.signOut()} />;

  const content = active === "command" ? <CommandCenter pieces={pieces} onNavigate={setActive} onOperator={() => setOperatorOpen(true)} />
    : active === "pipeline" ? <Pipeline pieces={pieces} />
    : active === "library" ? <LibraryView pieces={pieces} />
    : active === "analytics" ? <Analytics pieces={pieces} />
    : <Systems />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark">I</div><div><strong>IVY</strong><span>CONTENT</span></div></div>
        <button className="mobile-close" onClick={() => setMobileNav(false)}><X size={18} /></button>
        <div className="workspace-label">FOUNDER WORKSPACE</div>
        <nav>{nav.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => { setActive(item.id); setMobileNav(false); }}><item.icon size={17} /><span>{item.label}</span>{active === item.id && <span className="nav-dot" />}</button>)}</nav>
        <div className="sidebar-bottom">
          <button className="operator-mini" onClick={() => setOperatorOpen(true)}><span className="ai-orb"><Sparkles size={15} /></span><span><strong>Growth Operator</strong><small>Online · knows your data</small></span><ChevronRight size={16} /></button>
          <div className="founder"><div className="avatar">F</div><span><strong>Founder</strong><small>{isSupabaseConfigured ? session?.user.email : "Private workspace"}</small></span>{isSupabaseConfigured && <button title="Sign out" onClick={() => supabase.auth.signOut()}><LogOut size={15} /></button>}</div>
        </div>
      </aside>
      {mobileNav && <button aria-label="Close menu" className="scrim" onClick={() => setMobileNav(false)} />}
      <main>
        <header className="topbar"><button className="menu-btn" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="search"><Search size={16} /><span>Search content, hooks, scripts…</span><kbd>⌘ K</kbd></div><div className="top-actions"><span className="live-pill"><i />AI systems live</span><button className="icon-btn"><Settings2 size={17} /></button><button className="new-button" onClick={() => setCreateOpen(true)}><Plus size={17} /> New content</button></div></header>
        <div className="page">{content}</div>
      </main>
      <button className="floating-ai" onClick={() => setOperatorOpen(true)}><Sparkles size={19} /><span>Ask your operator</span></button>
      {operatorOpen && <Operator pieces={pieces} onClose={() => setOperatorOpen(false)} />}
      {createOpen && <NewContent onClose={() => setCreateOpen(false)} onCreated={(piece) => setPieces((old) => [piece, ...old])} />}
    </div>
  );
}

function Splash() { return <div className="splash"><div className="brand-mark">I</div><Loader2 className="spin" /></div>; }

function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setLoading(true); setError(""); const { error: err } = await supabase.auth.signInWithPassword({ email, password }); if (err) setError(err.message); setLoading(false); };
  return <div className="auth-page"><div className="auth-glow" /><form className="auth-card" onSubmit={submit}><div className="brand auth-brand"><div className="brand-mark">I</div><div><strong>IVY</strong><span>CONTENT</span></div></div><div><p className="eyebrow">PRIVATE FOUNDER OS</p><h1>Run content like a growth company.</h1><p>Your content, systems, performance, and AI operator in one place.</p></div><label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="founder@ivysalesacademy.com" /></label><label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" /></label>{error && <p className="form-error">{error}</p>}<button className="auth-submit" disabled={loading}>{loading ? <Loader2 className="spin" size={18} /> : <>Enter command center <ArrowRight size={18} /></>}</button><small>Access is restricted to the authorized founder account.</small></form></div>;
}

function AccessDenied({ onLogout }: { onLogout: () => void }) { return <div className="auth-page"><div className="auth-card denied"><div className="ai-orb"><X /></div><h1>Founder access required</h1><p>This account is authenticated, but it is not on the private founder allowlist.</p><button className="auth-submit" onClick={onLogout}>Sign out</button></div></div>; }

function CommandCenter({ pieces, onNavigate, onOperator }: { pieces: ContentPiece[]; onNavigate: (id: NavId) => void; onOperator: () => void }) {
  const published = pieces.filter((p) => p.status === "published");
  const totals = published.reduce((a, p) => ({ views: a.views + p.views, leads: a.leads + p.leads, calls: a.calls + p.booked_calls, revenue: a.revenue + Number(p.attributed_revenue) }), { views: 0, leads: 0, calls: 0, revenue: 0 });
  return <>
    <section className="page-heading"><div><p className="eyebrow">SUNDAY, JULY 12 · WEEK 28</p><h1>Good morning, Founder.</h1><p>Here’s exactly what moves the content machine forward today.</p></div><button className="brief-button" onClick={onOperator}><Sparkles size={17} />Generate today’s brief</button></section>
    <section className="focus-grid"><div className="focus-card"><div className="focus-head"><span className="focus-icon orange"><Flame size={18} /></span><div><p>TODAY’S NON-NEGOTIABLE</p><h2>Finish the recording batch</h2></div><span className="priority">HIGH PRIORITY</span></div><p>4 scripts are ready. Recording them today protects the next 8 days of distribution.</p><div className="focus-progress"><span><b>3</b> of 7 recorded</span><span>43%</span></div><div className="progress"><i style={{ width: "43%" }} /></div><button onClick={() => onNavigate("pipeline")}>Open recording queue <ArrowRight size={15} /></button></div>
      <div className="operator-card"><div className="operator-top"><span className="ai-orb"><Bot size={18} /></span><div><p>YOUR GROWTH OPERATOR</p><strong>I found 3 moves worth making</strong></div></div><ul><li><span>01</span><p><b>Double down on founder POV</b><small>2.4× more saves than education posts</small></p></li><li><span>02</span><p><b>Re-cut last week’s winner</b><small>The first 3 seconds are carrying retention</small></p></li><li><span>03</span><p><b>Your MOF gap starts Friday</b><small>One case study needs scripting today</small></p></li></ul><button onClick={onOperator}>Talk through the plan <MessageSquareText size={15} /></button></div></section>
    <section className="metric-grid"><Metric label="Views · 30 days" value={totals.views ? compact(totals.views) : "284K"} delta="+18.4%" icon={CircleGauge} /><Metric label="Inbound leads" value={totals.leads || 642} delta="+12.7%" icon={TrendingUp} /><Metric label="Booked calls" value={totals.calls || 89} delta="+9.2%" icon={CalendarDays} /><Metric label="Content revenue" value={totals.revenue ? money(totals.revenue) : "$82.5K"} delta="+24.1%" icon={Zap} /></section>
    <section className="two-col"><div className="panel"><PanelTitle eyebrow="EXECUTION" title="This week’s pipeline" action="View board" onAction={() => onNavigate("pipeline")} /><div className="pipeline-summary">{stages.slice(0, 5).map((s) => { const count = pieces.filter((p) => p.status === s.id).length; return <div key={s.id}><span className={`stage-dot ${s.id}`} /><strong>{count}</strong><small>{s.label}</small></div>; })}</div><div className="week-list">{pieces.slice(0, 4).map((p) => <div key={p.id}><span className={`format-icon ${p.funnel_stage}`}><Video size={15} /></span><div><strong>{p.title}</strong><small>{p.primary_platform} · {p.format}</small></div><span className={`status ${p.status}`}>{stageName(p.status)}</span><span className="date">{shortDate(p.scheduled_for)}</span><MoreHorizontal size={16} /></div>)}</div></div>
      <div className="panel cadence"><PanelTitle eyebrow="CONSISTENCY" title="Cadence score" /><div className="score"><div className="score-ring"><strong>92</strong><small>/100</small></div><div><span className="on-track"><Check size={13} /> ON TRACK</span><p>12 of 13 planned posts shipped in the last 14 days.</p></div></div><div className="days">{["M","T","W","T","F","S","S"].map((d, i) => <div key={i}><span className={i < 6 ? "done" : "today"}>{i < 6 ? <Check size={12} /> : d}</span><small>{i < 4 ? "TOF" : "MOF"}</small></div>)}</div><div className="next-recording"><Clock3 size={16} /><div><small>NEXT RECORDING DAY</small><strong>Thursday · 10:00 AM</strong></div><span>4 scripts ready</span></div></div></section>
  </>;
}

function Metric({ label, value, delta, icon: Icon }: { label: string; value: string | number; delta: string; icon: typeof Activity }) { return <div className="metric"><div><span>{label}</span><Icon size={16} /></div><strong>{value}</strong><small><TrendingUp size={12} /> {delta} <i>vs last period</i></small></div>; }
function PanelTitle({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="panel-title"><div><small>{eyebrow}</small><h2>{title}</h2></div>{action && <button onClick={onAction}>{action}<ArrowRight size={14} /></button>}</div>; }

function Pipeline({ pieces }: { pieces: ContentPiece[] }) { return <><PageTitle eyebrow="PRODUCTION" title="Content pipeline" subtitle="Every piece, from raw signal to measured asset." /><div className="board">{stages.slice(0, 5).map((s) => <section className="board-column" key={s.id}><header><span className={`stage-dot ${s.id}`} /><strong>{s.label}</strong><small>{pieces.filter((p) => p.status === s.id).length}</small><Plus size={15} /></header>{pieces.filter((p) => p.status === s.id).map((p) => <article className="content-card" key={p.id}><div><span className={`funnel ${p.funnel_stage}`}>{p.funnel_stage.toUpperCase()}</span><MoreHorizontal size={15} /></div><h3>{p.title}</h3><p>“{p.hook}”</p><footer><span>{p.primary_platform}</span><span><CalendarDays size={12} />{shortDate(p.scheduled_for)}</span></footer></article>)}</section>)}</div></>; }

function LibraryView({ pieces }: { pieces: ContentPiece[] }) { return <><PageTitle eyebrow="KNOWLEDGE ASSETS" title="Content library" subtitle="Searchable memory for every hook, script, result, and reusable angle." /><div className="toolbar"><div className="search wide"><Search size={16} /><span>Search the library…</span></div><button>All platforms</button><button>All pillars</button><button>All stages</button></div><div className="library-grid">{pieces.map((p) => <article className="library-card" key={p.id}><div className={`thumb ${p.funnel_stage}`}><FileText size={28} /><span>{p.format}</span></div><div><span className={`funnel ${p.funnel_stage}`}>{p.funnel_stage.toUpperCase()}</span><h3>{p.title}</h3><p>{p.hook}</p><footer><span>{p.primary_platform}</span><span>{p.views ? `${compact(p.views)} views` : stageName(p.status)}</span></footer></div></article>)}</div></>; }

function Analytics({ pieces }: { pieces: ContentPiece[] }) { const winners = [...pieces].sort((a,b) => b.views-a.views); return <><PageTitle eyebrow="FEEDBACK LOOP" title="Performance intelligence" subtitle="Know what worked, why it worked, and what to make next." /><section className="metric-grid"><Metric label="Avg. hook retention" value="71.4%" delta="+8.2%" icon={Target} /><Metric label="Lead conversion" value="2.26%" delta="+0.4%" icon={TrendingUp} /><Metric label="Revenue per post" value="$2,947" delta="+17.1%" icon={Zap} /><Metric label="Winning formats" value="3" delta="+1" icon={Video} /></section><section className="two-col analytics-grid"><div className="panel chart-panel"><PanelTitle eyebrow="LAST 30 DAYS" title="Attention → revenue" /><div className="chart"><div className="chart-labels"><span>300K</span><span>200K</span><span>100K</span><span>0</span></div><div className="chart-bars">{[38,51,47,68,61,77,74,91,84,97,88,100].map((h,i)=><i key={i} style={{height:`${h}%`}} className={i>8?"hot":""}/>)}</div></div></div><div className="panel"><PanelTitle eyebrow="TOP CONTENT" title="Winners to compound" />{winners.slice(0,4).map((p,i)=><div className="winner" key={p.id}><strong>0{i+1}</strong><div><b>{p.title}</b><small>{p.pillar} · {p.format}</small></div><span>{compact(p.views)}<small>views</small></span></div>)}</div></section></>; }

function Systems() { const systems=[{icon:Lightbulb,title:"Signal capture",text:"Turn calls, student wins, objections, and founder notes into ranked ideas.",state:"Active"},{icon:Command,title:"Two-week planning",text:"TOF Monday–Thursday, MOF Friday–Sunday. Thursday batch recording protected.",state:"Active"},{icon:Video,title:"Production handoff",text:"Script, record, edit, review, caption, thumbnail, schedule — with no lost context.",state:"Active"},{icon:BarChart3,title:"Performance loop",text:"24h, 72h, 7d, and 30d snapshots connect attention to pipeline and revenue.",state:"Active"}]; return <><PageTitle eyebrow="OPERATING SYSTEM" title="Systems & SOPs" subtitle="The machine behind consistent, compounding content." /><div className="systems-grid">{systems.map((s)=><article className="system-card" key={s.title}><span className="system-icon"><s.icon size={20}/></span><span className="active-chip"><i/>{s.state}</span><h3>{s.title}</h3><p>{s.text}</p><button>Open system <ArrowRight size={14}/></button></article>)}</div></>; }

function PageTitle({ eyebrow,title,subtitle }:{eyebrow:string;title:string;subtitle:string}) { return <section className="page-heading compact"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div></section>; }

function Operator({ pieces, onClose }: { pieces: ContentPiece[]; onClose: () => void }) {
  const [messages,setMessages]=useState<{role:"user"|"assistant";text:string}[]>([{role:"assistant",text:"I’m synced with your content system. What are we solving — today’s priorities, a hook, a script, or the performance data?"}]); const [input,setInput]=useState(""); const [loading,setLoading]=useState(false);
  const send=async (text=input)=>{if(!text.trim()||loading)return; const next=[...messages,{role:"user" as const,text:text.trim()}];setMessages(next);setInput("");setLoading(true);if(!isSupabaseConfigured){setTimeout(()=>{setMessages([...next,{role:"assistant",text:"Your highest-leverage move is to finish the four ready scripts before creating anything new. Founder POV is currently producing the strongest save rate, so lead the batch with a contrarian operating lesson and use the student case study as Friday’s MOF proof."}]);setLoading(false)},650);return;} const {data,error}=await supabase.functions.invoke("content-operator",{body:{message:text,history:next.slice(-8)}});setMessages([...next,{role:"assistant",text:error?"I couldn’t reach the operator. Check the Edge Function secrets and try again.":data.reply}]);setLoading(false);};
  return <><button className="drawer-scrim" onClick={onClose}/><aside className="operator-drawer"><header><div className="operator-top"><span className="ai-orb"><Bot size={18}/></span><div><p>IVY AI</p><strong>Growth Operator</strong></div></div><button onClick={onClose}><X size={19}/></button></header><div className="context-strip"><span><i/>Live context</span><span>{pieces.length} content assets</span><span>Week 28</span></div><div className="messages">{messages.map((m,i)=><div className={`message ${m.role}`} key={i}>{m.role==="assistant"&&<span className="ai-orb small"><Sparkles size={13}/></span>}<p>{m.text}</p></div>)}{loading&&<div className="message assistant"><span className="ai-orb small"><Sparkles size={13}/></span><p className="typing"><i/><i/><i/></p></div>}</div><div className="suggestions">{["What should I make today?","Write 5 hooks","Analyze my winners"].map(s=><button key={s} onClick={()=>send(s)}>{s}</button>)}</div><form className="composer" onSubmit={e=>{e.preventDefault();send()}}><textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask about your content machine…" rows={2}/><button disabled={!input.trim()||loading}><Send size={17}/></button><small>Your operator uses live workspace context</small></form></aside></>;
}

function NewContent({onClose,onCreated}:{onClose:()=>void;onCreated:(p:ContentPiece)=>void}) { const [title,setTitle]=useState("");const [hook,setHook]=useState("");const [saving,setSaving]=useState(false); const submit=async(e:FormEvent)=>{e.preventDefault();setSaving(true);const base={title,hook,pillar:"Founder POV",funnel_stage:"tof" as const,format:"Talking head",primary_platform:"Instagram",status:"idea" as const}; if(isSupabaseConfigured){const {data}=await supabase.from("content_pieces").insert(base).select().single();if(data)onCreated(data as ContentPiece);}else onCreated({...demo[0],...base,id:crypto.randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()});setSaving(false);onClose();}; return <><button className="drawer-scrim" onClick={onClose}/><div className="modal"><header><div><p className="eyebrow">CAPTURE THE SIGNAL</p><h2>New content</h2></div><button onClick={onClose}><X size={18}/></button></header><form onSubmit={submit}><label>Working title<input autoFocus required value={title} onChange={e=>setTitle(e.target.value)} placeholder="What is this piece about?"/></label><label>Hook<textarea required value={hook} onChange={e=>setHook(e.target.value)} placeholder="The first line that earns attention…" rows={3}/></label><div className="form-row"><label>Funnel<select><option>TOF · Reach</option><option>MOF · Trust</option><option>BOF · Convert</option></select></label><label>Platform<select><option>Instagram</option><option>TikTok</option><option>YouTube</option></select></label></div><button className="auth-submit" disabled={saving}>{saving?<Loader2 className="spin" size={18}/>:<>Add to pipeline <ArrowRight size={17}/></>}</button></form></div></>; }

function stageName(s: ContentStage){return stages.find(x=>x.id===s)?.label||s} function compact(n:number){return Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(n)} function money(n:number){return Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1}).format(n)} function shortDate(d:string|null){if(!d)return "Unscheduled";return new Date(`${d}T12:00:00`).toLocaleDateString("en",{month:"short",day:"numeric"})}
