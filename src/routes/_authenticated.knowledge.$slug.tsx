import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MarkdownView, extractHeadings } from "@/components/markdown-view";
import { DOC_CATEGORIES, type Doc } from "@/lib/docs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/knowledge/$slug")({
  component: DocView,
});

function DocView() {
  const { slug } = useParams({ from: "/_authenticated/knowledge/$slug" });
  const navigate = useNavigate();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("docs").select("*").eq("slug", slug).maybeSingle();
      if (!alive) return;
      if (!data) { setNotFound(true); setLoading(false); return; }
      setDoc(data as unknown as Doc);
      if (data.updated_by) {
        const { data: p } = await supabase.from("profiles").select("display_name").eq("id", data.updated_by).maybeSingle();
        if (alive) setAuthorName(p?.display_name ?? null);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [slug]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (notFound || !doc) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-3">
        <p className="text-sm text-muted-foreground">This doc doesn't exist or isn't visible to your role.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/knowledge" })}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Knowledge</Button>
      </div>
    );
  }

  const headings = extractHeadings(doc.content);
  const category = DOC_CATEGORIES.find(c => c.value === doc.category)?.label ?? doc.category;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link to="/knowledge" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Knowledge
        </Link>
        {isAdmin && (
          <Button asChild size="sm" variant="outline">
            <Link to="/knowledge/$slug/edit" params={{ slug: doc.slug }}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
        <article className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-2">{category}</div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">{doc.title}</h1>
          {doc.external_links.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {doc.external_links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-muted/30 hover:bg-muted/60">
                  <ExternalLink className="h-3 w-3" /> {l.label || l.url}
                </a>
              ))}
            </div>
          )}
          <MarkdownView content={doc.content} />
          <footer className="mt-10 pt-4 border-t border-border/60 text-xs text-muted-foreground">
            Last updated {format(new Date(doc.updated_at), "PPP")}
            {authorName ? ` by ${authorName}` : ""}
          </footer>
        </article>

        {headings.length > 2 && (
          <aside className="hidden lg:block">
            <div className="sticky top-16 space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">On this page</div>
              <nav className="space-y-1 text-sm">
                {headings.map(h => (
                  <a key={h.id} href={`#${h.id}`} className={"block text-muted-foreground hover:text-foreground truncate " + (h.depth === 3 ? "pl-3 text-xs" : "")}>
                    {h.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
