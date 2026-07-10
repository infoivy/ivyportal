import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CATEGORY_LABEL, type DocCategory } from "@/lib/knowledge";
import { MarkdownView, useToc } from "@/components/markdown-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Pencil, Trash2, ExternalLink as ExtIcon, ListTree, Search as SearchIcon, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/knowledge/$slug")({
  head: () => ({ meta: [{ title: "Knowledge — ISA Team" }] }),
  component: KnowledgeDoc,
});

type DocRow = {
  id: string;
  title: string;
  slug: string;
  category: DocCategory;
  content: string;
  role_visibility: string[];
  pinned: boolean;
  updated_at: string;
  updated_by: string | null;
  external_links: { label: string; url: string }[] | null;
};

function KnowledgeDoc() {
  const { slug } = Route.useParams();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocRow | null>(null);
  const [updatedByName, setUpdatedByName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("docs").select("*").eq("slug", slug).maybeSingle();
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setDoc(data as DocRow);
      if (data.updated_by) {
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.updated_by)
          .maybeSingle();
        setUpdatedByName(p?.display_name ?? null);
      }
      setLoading(false);
    })();
  }, [slug]);

  const [findQ, setFindQ] = useState("");
  const filteredContent = useMemo(() => {
    if (!doc) return "";
    if (!findQ.trim()) return doc.content;
    const term = findQ.trim().toLowerCase();
    // Keep paragraphs (blank-line-separated blocks) whose text contains the term.
    const blocks = doc.content.split(/\n{2,}/);
    const kept = blocks.filter((b) => b.toLowerCase().includes(term));
    return kept.length ? kept.join("\n\n") : "";
  }, [doc, findQ]);

  const toc = useToc(filteredContent);

  const handleDelete = async () => {
    if (!doc) return;
    if (!confirm(`Delete “${doc.title}”? This cannot be undone.`)) return;
    const { error } = await supabase.from("docs").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Doc deleted");
    navigate({ to: "/knowledge" as string });
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (notFound || !doc) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-muted-foreground">Doc not found or you don't have access.</p>
        <Link to={"/knowledge" as string}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Knowledge Hub
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link to={"/knowledge" as string}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Knowledge Hub
          </Button>
        </Link>
        {isAdmin && (
          <div className="flex gap-2">
            <Link to={"/knowledge/$slug/edit" as string} params={{ slug: doc.slug } as never}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_240px] gap-6">
        <article className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70 mb-1">
            {CATEGORY_LABEL[doc.category]}
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">{doc.title}</h1>
          <div className="text-xs text-muted-foreground mb-6">
            Last updated {new Date(doc.updated_at).toLocaleDateString()}
            {updatedByName ? ` by ${updatedByName}` : ""}
          </div>

          {doc.external_links && doc.external_links.length > 0 && (
            <Card className="p-4 mb-6 bg-[#0f1116]">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70 mb-2">
                Links
              </div>
              <div className="flex flex-wrap gap-2">
                {doc.external_links.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs border border-[#1f2530] rounded-md px-2.5 py-1.5 hover:border-primary hover:text-primary transition"
                  >
                    <ExtIcon className="h-3 w-3" /> {l.label}
                  </a>
                ))}
              </div>
            </Card>
          )}

          <MarkdownView content={doc.content} />

          <div className="mt-12 pt-4 border-t border-[#1f2530] text-xs text-muted-foreground">
            Last updated {new Date(doc.updated_at).toLocaleString()}
            {updatedByName ? ` by ${updatedByName}` : ""}
          </div>
        </article>

        {toc.length > 2 && (
          <aside className="hidden lg:block">
            <div className="sticky top-16">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70 mb-2 flex items-center gap-1.5">
                <ListTree className="h-3 w-3" /> Contents
              </div>
              <nav className="space-y-1 text-sm">
                {toc.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className="block text-muted-foreground hover:text-primary transition truncate"
                    style={{ paddingLeft: (t.level - 1) * 12 }}
                  >
                    {t.text}
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
