import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DocEditor } from "@/components/doc-editor";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/knowledge/new")({
  head: () => ({ meta: [{ title: "New Doc — ISA Team" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/knowledge" });
  },
  component: NewDoc,
});

function NewDoc() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <Link to="/knowledge" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Knowledge
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">New doc</h1>
      <DocEditor
        saving={saving}
        onSave={async (draft) => {
          setSaving(true);
          const { data: { user } } = await supabase.auth.getUser();
          const { data, error } = await supabase.from("docs").insert({
            title: draft.title,
            slug: draft.slug,
            category: draft.category,
            content: draft.content,
            role_visibility: draft.role_visibility,
            pinned: draft.pinned,
            external_links: draft.external_links as never,
            updated_by: user?.id ?? null,
          }).select("slug").single();
          setSaving(false);
          if (error) { toast.error(error.message); return; }
          toast.success("Doc created");
          navigate({ to: "/knowledge/$slug", params: { slug: data.slug } });
        }}
      />
    </div>
  );
}
