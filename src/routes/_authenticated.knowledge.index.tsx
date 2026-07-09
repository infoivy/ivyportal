import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { DOC_CATEGORIES, type Doc } from "@/lib/docs";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Search, Plus, Pin, Clock, DollarSign, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/knowledge/")({
  head: () => ({ meta: [{ title: "Knowledge Hub — ISA Team" }] }),
  component: KnowledgeIndex,
});

function KnowledgeIndex() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isCloser = roles.includes("closer") || isAdmin;
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("docs").select("*").order("pinned", { ascending: false }).order("sort_order").order("title");
      if (alive) { setDocs((data ?? []) as unknown as Doc[]); setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    if (!needle) return docs;
    return docs.filter(d =>
      d.title.toLowerCase().includes(needle) ||
      d.content.toLowerCase().includes(needle)
    );
  }, [docs, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, Doc[]>();
    for (const d of filtered) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return map;
  }, [filtered]);

  const recent = useMemo(() =>
    [...docs].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 5),
  [docs]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Knowledge Hub</h1>
            <p className="text-sm text-muted-foreground">SOPs, policies, playbooks — everything the team needs to run.</p>
          </div>
        </div>
        {isAdmin && (
          <Button asChild size="sm"><Link to="/knowledge/new"><Plus className="h-4 w-4 mr-1" /> New doc</Link></Button>
        )}
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search titles and content…" className="pl-9" />
      </div>

      {isCloser && (
        <Link to="/closer-resources">
          <Card className="p-4 flex items-center gap-3 border-primary/30 bg-primary/5 hover:bg-primary/10 transition">
            <div className="h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Closer Resources</div>
              <div className="text-xs text-muted-foreground">Payment links, bank details, and closer-only assets.</div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary" />
          </Card>
        </Link>
      )}

      {recent.length > 0 && !q && (
        <section>
          <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-widest text-muted-foreground/70">
            <Clock className="h-3.5 w-3.5" /> Recently updated
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recent.map(d => (
              <Link key={d.id} to="/knowledge/$slug" params={{ slug: d.slug }} className="shrink-0">
                <Card className="p-3 min-w-[220px] hover:border-primary/50 transition">
                  <div className="text-sm font-medium truncate">{d.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })} · {catLabel(d.category)}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          {q ? "No docs match your search." : isAdmin ? "No docs yet. Create the first one." : "No docs available for your role yet."}
        </Card>
      ) : (
        DOC_CATEGORIES.map(cat => {
          const items = grouped.get(cat.value) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={cat.value}>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/80 mb-2">{cat.label}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(d => (
                  <Link key={d.id} to="/knowledge/$slug" params={{ slug: d.slug }}>
                    <Card className="p-4 h-full hover:border-primary/60 transition group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold group-hover:text-primary transition line-clamp-2">{d.title}</div>
                        {d.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {firstText(d.content) || "—"}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground/70">
                        <span>Updated {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}</span>
                        <span className="uppercase tracking-widest">{d.role_visibility.slice(0, 2).join(" · ")}{d.role_visibility.length > 2 ? ` +${d.role_visibility.length - 2}` : ""}</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function catLabel(v: string) {
  return DOC_CATEGORIES.find(c => c.value === v)?.label ?? v;
}
function firstText(md: string) {
  return md.replace(/^#.*$/gm, "").replace(/[*_`>#-]/g, "").split("\n").map(s => s.trim()).find(Boolean) ?? "";
}
