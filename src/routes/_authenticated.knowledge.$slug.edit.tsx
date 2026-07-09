import { createFileRoute, useNavigate, useParams, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DocEditor } from "@/components/doc-editor";
import type { Doc } from "@/lib/docs";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/knowledge/$slug/edit")({
  head: () => ({ meta: [{ title: "Edit Doc — ISA Team" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/knowledge" });
  },
  component: EditDoc,
});

function EditDoc() {
  const { slug } = useParams({ from: "/_authenticated/knowledge/$slug/edit" });
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("docs").select("*").eq("slug", slug).maybeSingle();
      if (alive) setDoc(data as unknown as Doc | null);
    })();
    return () => { alive = false; };
  }, [slug]);

  if (!doc) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <Link to="/knowledge/$slug" params={{ slug: doc.slug }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to doc
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Edit doc</h1>
      <DocEditor
        initial={doc}
        saving={saving}
        onSave={async (draft) => {
          setSaving(true);
          const { data: { user } } = await supabase.auth.getUser();
          const { error } = await supabase.from("docs").update({
            title: draft.title,
            slug: draft.slug,
            category: draft.category,
            content: draft.content,
            role_visibility: draft.role_visibility,
            pinned: draft.pinned,
            external_links: draft.external_links as never,
            updated_by: user?.id ?? null,
          }).eq("id", doc.id);
          setSaving(false);
          if (error) { toast.error(error.message); return; }
          toast.success("Doc updated");
          navigate({ to: "/knowledge/$slug", params: { slug: draft.slug } });
        }}
        onDelete={async () => {
          if (!confirm("Delete this doc? This cannot be undone.")) return;
          setSaving(true);
          const { error } = await supabase.from("docs").delete().eq("id", doc.id);
          setSaving(false);
          if (error) { toast.error(error.message); return; }
          toast.success("Doc deleted");
          navigate({ to: "/knowledge" });
        }}
      />
    </div>
  );
}
