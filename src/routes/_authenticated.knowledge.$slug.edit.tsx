import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { type DocCategory, type ExternalLink } from "@/lib/knowledge";
import { DocForm } from "./_authenticated.knowledge.new";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/knowledge/$slug/edit")({
  head: () => ({ meta: [{ title: "Edit doc — Knowledge Hub" }] }),
  component: EditDoc,
});

function EditDoc() {
  const { slug: slugParam } = Route.useParams();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const navigate = useNavigate();
  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState<DocCategory>("setting");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<string[]>(["admin"]);
  const [pinned, setPinned] = useState(false);
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("docs").select("*").eq("slug", slugParam).maybeSingle();
      if (!data) {
        toast.error("Not found");
        navigate({ to: "/knowledge" as string });
        return;
      }
      setId(data.id);
      setTitle(data.title);
      setSlug(data.slug);
      setCategory(data.category as DocCategory);
      setContent(data.content);
      setVisibility(data.role_visibility);
      setPinned(data.pinned);
      setLinks(((data.external_links as ExternalLink[] | null) ?? []) as ExternalLink[]);
      setLoading(false);
    })();
  }, [slugParam, navigate]);

  if (!isAdmin) return <div className="p-6 text-sm text-muted-foreground">Admins only.</div>;
  if (loading || !id) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const toggleRole = (r: string) =>
    setVisibility((v) => (v.includes(r) ? v.filter((x) => x !== r) : [...v, r]));

  const save = async () => {
    if (!title.trim() || !slug.trim()) return toast.error("Title and slug required");
    if (visibility.length === 0) return toast.error("Pick at least one role");
    setSaving(true);
    const { error } = await supabase
      .from("docs")
      .update({
        title: title.trim(),
        slug: slug.trim(),
        category,
        content,
        role_visibility: visibility,
        pinned,
        external_links: links,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    navigate({ to: "/knowledge/$slug" as string, params: { slug } as never });
  };

  return (
    <DocForm
      mode="edit"
      title={title}
      setTitle={setTitle}
      slug={slug}
      setSlug={setSlug}
      category={category}
      setCategory={setCategory}
      content={content}
      setContent={setContent}
      visibility={visibility}
      toggleRole={toggleRole}
      pinned={pinned}
      setPinned={setPinned}
      links={links}
      setLinks={setLinks}
      saving={saving}
      onSave={save}
    />
  );
}
