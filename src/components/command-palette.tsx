import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Search, School, Users, LayoutDashboard, FileText, Phone, DollarSign,
  BarChart3, Calendar, GraduationCap, ListChecks, Trophy, Shield, HeartHandshake,
  BookOpen, Star, Sparkles,
} from "lucide-react";

type PageItem = { kind: "page"; title: string; to: string; icon: React.ComponentType<{ className?: string }>; roles?: string[] };
type StudentItem = { kind: "student"; id: string; name: string; email: string | null };
type PersonItem = { kind: "person"; id: string; name: string; role?: string };
type DocItem = { kind: "doc"; slug: string; title: string; category: string | null };
type TestimonialItem = { kind: "testimonial"; id: string; title: string };
type ContentItem = { kind: "content"; id: string; title: string; platform: string };
type Item = PageItem | StudentItem | PersonItem | DocItem | TestimonialItem | ContentItem;

let paletteCache: {
  at: number;
  students: StudentItem[];
  people: PersonItem[];
  docs: DocItem[];
  testimonials: TestimonialItem[];
  content: ContentItem[];
} | null = null;

const PAGES: PageItem[] = [
  { kind: "page", title: "Dashboard", to: "/dashboard", icon: LayoutDashboard, roles: ["admin", "founder", "closer", "setter", "coach"] },
  { kind: "page", title: "EOD Reports", to: "/eods", icon: FileText },
  { kind: "page", title: "Action Items", to: "/action-items", icon: ListChecks },
  { kind: "page", title: "Notes", to: "/notes", icon: FileText },
  { kind: "page", title: "Sales", to: "/sales", icon: BarChart3, roles: ["admin", "closer", "setter"] },
  { kind: "page", title: "Sales Trends", to: "/sales?tab=trends", icon: BarChart3, roles: ["admin", "closer", "setter"] },
  { kind: "page", title: "Revenue", to: "/revenue", icon: DollarSign, roles: ["admin", "closer", "setter", "coach"] },
  { kind: "page", title: "Installments", to: "/installments", icon: DollarSign, roles: ["admin", "closer", "coach"] },
  { kind: "page", title: "Payouts", to: "/payouts", icon: DollarSign, roles: ["admin"] },
  { kind: "page", title: "Students", to: "/students", icon: School },
  { kind: "page", title: "1-on-1 Calls", to: "/calls", icon: Phone, roles: ["admin", "coach", "csm"] },
  { kind: "page", title: "Coaches", to: "/coaches", icon: Trophy, roles: ["admin", "coach", "csm"] },
  { kind: "page", title: "Student Success", to: "/student-success", icon: HeartHandshake, roles: ["admin", "csm", "coach", "founder"] },
  { kind: "page", title: "CSM", to: "/csm", icon: HeartHandshake, roles: ["admin", "csm"] },
  { kind: "page", title: "Testimonials", to: "/testimonials", icon: Star, roles: ["admin", "coach", "closer", "setter", "csm"] },
  { kind: "page", title: "Calendar", to: "/calendar", icon: Calendar },
  { kind: "page", title: "Training", to: "/training", icon: GraduationCap, roles: ["admin", "founder", "closer", "setter", "coach"] },
  { kind: "page", title: "Knowledge", to: "/knowledge", icon: BookOpen },
  { kind: "page", title: "Gathering Hub", to: "/command", icon: Sparkles, roles: ["founder"] },
  { kind: "page", title: "Content", to: "/content", icon: Sparkles, roles: ["founder"] },
  { kind: "page", title: "Team", to: "/team", icon: Users, roles: ["admin"] },
  { kind: "page", title: "Admin", to: "/admin", icon: Shield, roles: ["admin"] },
  { kind: "page", title: "Profile", to: "/profile", icon: Users },
];

export function CommandPalette() {
  const { roles } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [testimonialsList, setTestimonialsList] = useState<TestimonialItem[]>([]);
  const [contentList, setContentList] = useState<ContentItem[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(v => !v);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Session cache: the palette opens dozens of times; the underlying data
    // changes rarely. Refresh at most once a minute.
    if (paletteCache && Date.now() - paletteCache.at < 60_000) {
      setStudents(paletteCache.students);
      setPeople(paletteCache.people);
      setDocs(paletteCache.docs);
      setTestimonialsList(paletteCache.testimonials);
      setContentList(paletteCache.content);
      return;
    }
    let alive = true;
    (async () => {
      const [sRes, pRes, rRes, dRes, tRes, cRes] = await Promise.all([
        supabase.from("students").select("id, full_name, email").order("full_name").limit(500),
        supabase.from("profiles").select("id, display_name").limit(200),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("docs").select("slug, title, category").limit(300),
        supabase.from("testimonials").select("id, title").limit(200),
        supabase.from("content_items").select("id, hook, platform").limit(200),
      ]);
      if (!alive) return;
      const roleMap = new Map<string, string[]>();
      ((rRes.data ?? []) as any[]).forEach(r => {
        const arr = roleMap.get(r.user_id) ?? []; arr.push(r.role); roleMap.set(r.user_id, arr);
      });
      const students2 = ((sRes.data ?? []) as any[]).map(s => ({ kind: "student" as const, id: s.id, name: s.full_name, email: s.email }));
      const people2 = ((pRes.data ?? []) as any[]).map(p => ({
        kind: "person" as const, id: p.id, name: p.display_name ?? "Unnamed",
        role: (roleMap.get(p.id) ?? [])[0],
      }));
      const docs2 = ((dRes.data ?? []) as any[]).map(d => ({ kind: "doc" as const, slug: d.slug, title: d.title, category: d.category }));
      const testimonials2 = ((tRes.data ?? []) as any[]).map(t => ({ kind: "testimonial" as const, id: t.id, title: t.title ?? "Untitled" }));
      const content2 = ((cRes.data ?? []) as any[]).map(c => ({ kind: "content" as const, id: c.id, title: c.hook ?? "Untitled", platform: c.platform ?? "" }));
      setStudents(students2);
      setPeople(people2);
      setDocs(docs2);
      setTestimonialsList(testimonials2);
      setContentList(content2);
      paletteCache = { at: Date.now(), students: students2, people: people2, docs: docs2, testimonials: testimonials2, content: content2 };
    })();
    return () => { alive = false; };
  }, [open]);

  const visiblePages = useMemo(
    () => PAGES.filter(p => !p.roles || p.roles.some(r => roles.includes(r))),
    [roles]
  );

  const results = useMemo<Item[]>(() => {
    const term = q.trim().toLowerCase();
    const pages = visiblePages.filter(p => !term || p.title.toLowerCase().includes(term)).slice(0, 8);
    const st = (term
      ? students.filter(s => s.name.toLowerCase().includes(term) || (s.email ?? "").toLowerCase().includes(term))
      : students
    ).slice(0, 8);
    const pe = (term
      ? people.filter(p => p.name.toLowerCase().includes(term))
      : []
    ).slice(0, 6);
    const dc = (term ? docs.filter(d => d.title.toLowerCase().includes(term)) : []).slice(0, 6);
    const ts = (term ? testimonialsList.filter(t => t.title.toLowerCase().includes(term)) : []).slice(0, 6);
    const cn = (term ? contentList.filter(c => c.title.toLowerCase().includes(term)) : []).slice(0, 6);
    return [...pages, ...st, ...pe, ...dc, ...ts, ...cn];
  }, [q, visiblePages, students, people, docs, testimonialsList, contentList]);

  useEffect(() => { setActive(0); }, [q, open]);

  const go = (it: Item) => {
    setOpen(false); setQ("");
    if (it.kind === "page") {
      const [path, qs] = it.to.split("?");
      const search = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
      nav({ to: path as any, search: search as any });
    }
    else if (it.kind === "student") nav({ to: "/students/$id", params: { id: it.id } });
    else if (it.kind === "doc") nav({ to: "/knowledge/$slug", params: { slug: it.slug } });
    else if (it.kind === "testimonial") nav({ to: "/testimonials" });
    else if (it.kind === "content") nav({ to: "/content", search: { tab: "plan" } as any });
    else nav({ to: "/team" });
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-[var(--card)] border border-[var(--border)] rounded-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 border-b border-[var(--border)]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
              if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active]); }
            }}
            placeholder="Search students, team, pages…"
            className="flex-1 h-11 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          <span className="text-[10px] text-muted-foreground border border-[var(--border)] rounded px-1.5 py-0.5">ESC</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto overscroll-contain py-1">
          {results.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No matches.</div>}
          {results.map((it, i) => {
            const isActive = i === active;
            const base = `flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer ${isActive ? "bg-[var(--accent)]" : "hover:bg-[var(--muted)]"}`;
            if (it.kind === "page") {
              const Icon = it.icon;
              return (
                <div key={`p-${it.to}`} className={base} onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{it.title}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Page</span>
                </div>
              );
            }
            if (it.kind === "student") {
              return (
                <div key={`s-${it.id}`} className={base} onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
                  <School className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{it.name}</div>
                    {it.email && <div className="text-[10px] text-muted-foreground truncate">{it.email}</div>}
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Student</span>
                </div>
              );
            }
            if (it.kind === "person") {
              return (
                <div key={`u-${it.id}`} className={base} onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{it.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{it.role ?? "Team"}</span>
                </div>
              );
            }
            if (it.kind === "doc") {
              return (
                <div key={`d-${it.slug}`} className={base} onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{it.title}</div>
                    {it.category && <div className="text-[10px] text-muted-foreground truncate">{it.category}</div>}
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Doc</span>
                </div>
              );
            }
            if (it.kind === "testimonial") {
              return (
                <div key={`t-${it.id}`} className={base} onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
                  <Star className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{it.title}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Testimonial</span>
                </div>
              );
            }
            return (
              <div key={`c-${it.id}`} className={base} onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{it.title}</div>
                  {it.platform && <div className="text-[10px] text-muted-foreground truncate">{it.platform}</div>}
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Content</span>
              </div>
            );
          })}
        </div>
        <div className="border-t border-[var(--border)] px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>↑↓ navigate · ↵ open</span>
          <span className="">⌘K</span>
        </div>
      </div>
    </div>
  );
}
