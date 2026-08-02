import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { friendlyPastDay } from "@/lib/dates";
import { useEffect, useMemo, useState } from "react";
import { PageSkeleton } from "@/components/ui/skeletons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

// DB docs that became styled static pages (portal sweep 2026-07-29): old
// /knowledge/<slug> bookmarks land on the new routes.
const MOVED_TO_STATIC: Record<string, string> = {
  "simple-discovery-framework-phone-setters": "/sops/simple-discovery-framework",
  "objection-handling-playbook": "/sops/objection-handling-playbook",
  "objection-think-about-it": "/sops/objection-think-about-it",
  "isa-setting-process": "/sops/isa-setting-process",
  "dm-setting-mastery": "/sops/isa-setting-process",
};
import { CATEGORY_LABEL, type DocCategory } from "@/lib/knowledge";
import { MarkdownView, useToc } from "@/components/markdown-view";
import { DocShell } from "@/components/doc-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Pencil, Trash2, ExternalLink as ExtIcon, ListTree, Search as SearchIcon, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/knowledge/$slug")({
  head: () => ({ meta: [{ title: "Knowledge · ISA Team" }] }),
  component: KnowledgeDocGate,
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
  embed_url: string | null;
};

function KnowledgeDocGate() {
  const { slug } = Route.useParams();
  const movedTo = MOVED_TO_STATIC[slug];
  if (movedTo) return <Navigate to={movedTo as never} replace />;
  return <KnowledgeDoc />;
}

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
          .eq("is_demo", false)
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

  if (loading) return <PageSkeleton />;
  if (notFound || !doc) {
    return (
      <div className="w-full max-w-none p-6 space-y-4">
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
    <DocShell
      breadcrumb={{ to: "/knowledge", label: "Knowledge Hub", current: doc.title }}
      icon={FileText}
      title={doc.title}
      description={
        <>Last updated {friendlyPastDay(doc.updated_at)}{updatedByName ? ` by ${updatedByName}` : ""}</>
      }
      badges={[CATEGORY_LABEL[doc.category], ...(doc.pinned ? ["Pinned"] : [])]}
      sections={toc.filter(t => t.level <= 2).map(t => ({ id: t.id, label: t.text }))}
      actions={isAdmin ? (
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
      ) : undefined}
    >
      {/* Embedded docs render the live file; in-doc search only applies to text docs */}
      {!doc.embed_url && (
        <div className="relative mb-2">
          <SearchIcon className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={findQ}
            onChange={(e) => setFindQ(e.target.value)}
            placeholder="Search inside this doc…"
            className="pl-9 h-9 text-sm bg-[var(--card)]"
          />
        </div>
      )}

      {doc.embed_url ? (
        <iframe
          src={doc.embed_url}
          title={doc.title}
          className="w-full min-h-[75vh] rounded-sm border border-[var(--border)] bg-[var(--card)]"
          allow="fullscreen"
        />
      ) : !doc.content || doc.content.trim().length < 20 ? (
        <Card className="p-6 text-center bg-[var(--card)]">
          <FileText className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Content missing · {isAdmin ? "click Edit to paste it in." : "ask an admin to fill this in."}
          </p>
        </Card>
      ) : filteredContent ? (
        <MarkdownView content={filteredContent} />
      ) : (
        <p className="text-sm text-muted-foreground">No sections match “{findQ}”.</p>
      )}

      {doc.external_links && doc.external_links.length > 0 && (
        <div className="mt-10 pt-4 border-t border-[var(--border)]">
          <div className="text-[11px] text-muted-foreground/70 mb-2">Original source</div>
          <div className="flex flex-wrap gap-2">
            {doc.external_links.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition"
              >
                <ExtIcon className="h-3 w-3" /> {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </DocShell>
  );
}
