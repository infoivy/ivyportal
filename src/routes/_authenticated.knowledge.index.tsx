import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { DOC_CATEGORIES, CATEGORY_LABEL, type DocCategory } from "@/lib/knowledge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookOpen, Search, Plus, Pin, ExternalLink as ExtIcon, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/knowledge/")({
  head: () => ({ meta: [{ title: "Knowledge Hub — ISA Team" }] }),
  component: KnowledgeIndex,
});

type DocRow = {
  id: string;
  title: string;
  slug: string;
  category: DocCategory;
  content: string;
  role_visibility: string[];
  pinned: boolean;
  sort_order: number;
  updated_at: string;
  external_links: { label: string; url: string }[] | null;
};

function KnowledgeIndex() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isCloser = roles.includes("closer");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("docs")
        .select("*")
        .eq("is_founder_only", false)
        .order("pinned", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });
      setDocs((data ?? []) as DocRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(term) ||
        d.content.toLowerCase().includes(term) ||
        CATEGORY_LABEL[d.category].toLowerCase().includes(term),
    );
  }, [docs, q]);

  const grouped = useMemo(() => {
    const map = new Map<DocCategory, DocRow[]>();
    for (const d of filtered) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return map;
  }, [filtered]);


  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Knowledge Hub</h1>
            <p className="text-sm text-muted-foreground">SOPs, playbooks, and policies for the team.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCloser || isAdmin ? (
            <Link to={"/closer-resources" as string}>
              <Button variant="outline" size="sm">
                <ExtIcon className="h-4 w-4 mr-1" /> Closer Resources
              </Button>
            </Link>
          ) : null}
          {isAdmin && (
            <Link to={"/knowledge/new" as string}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New doc
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search docs by title, content, or category…"
          className="pl-9"
        />
      </div>


      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : docs.length === 0 && !(roles.includes("admin") || roles.includes("setter")) ? (
        <Card className="p-8 text-center">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            No docs yet. {isAdmin ? "Create the first one to get started." : "Ask an admin to add docs."}
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {DOC_CATEGORIES.map(({ value, label }) => {
            const items = grouped.get(value) ?? [];
            const staticItems =
              value === "setting" &&
              (roles.includes("admin") || roles.includes("setter"))
                ? [
                    {
                      key: "isa-setting-process",
                      title: "ISA Setting Process",
                      description:
                        "The full 8-stage setting system: openers, conversation flow, objection handling, follow-ups, psychology, engagement, and ops.",
                      to: "/sops/isa-setting-process",
                    },
                  ]
                : [];
            if (items.length === 0 && staticItems.length === 0) return null;
            const showSection = q
              ? items.length > 0 ||
                staticItems.some((s) =>
                  (s.title + " " + s.description).toLowerCase().includes(q.toLowerCase()),
                )
              : true;
            if (!showSection) return null;
            return (
              <section key={value}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 mb-3">
                  {label}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {staticItems.map((s) => (
                    <Link key={s.key} to={s.to as string}>
                      <Card className="p-4 h-full hover:border-primary/60 transition group border-primary/30">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm group-hover:text-primary transition line-clamp-2">
                            {s.title}
                          </h3>
                          <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                          {s.description}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="uppercase tracking-wider">Core SOP</span>
                          <span className="inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition">
                            Open <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                  {items.map((d) => (
                    <Link key={d.id} to={"/knowledge/$slug" as string} params={{ slug: d.slug } as never}>
                      <Card className="p-4 h-full hover:border-primary/60 transition group">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm group-hover:text-primary transition line-clamp-2">
                            {d.title}
                          </h3>
                          {d.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                          {stripMarkdown(d.content).slice(0, 160)}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Updated {new Date(d.updated_at).toLocaleDateString()}</span>
                          <span className="inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition">
                            Read <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
          {filtered.length === 0 && q && (
            <p className="text-sm text-muted-foreground text-center py-8">No docs match “{q}”.</p>
          )}
        </div>
      )}
    </div>
  );
}

function stripMarkdown(s: string) {
  return s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_>`\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
