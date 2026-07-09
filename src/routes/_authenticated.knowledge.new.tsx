import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  DOC_CATEGORIES,
  ALL_ROLES,
  slugify,
  type DocCategory,
  type ExternalLink,
} from "@/lib/knowledge";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, X, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/knowledge/new")({
  head: () => ({ meta: [{ title: "New doc — Knowledge Hub" }] }),
  component: NewDoc,
});

function NewDoc() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const isAdmin = roles.includes("admin");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<DocCategory>("setting");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<string[]>(["admin"]);
  const [pinned, setPinned] = useState(false);
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  if (!isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Admins only.</div>;
  }

  const toggleRole = (r: string) =>
    setVisibility((v) => (v.includes(r) ? v.filter((x) => x !== r) : [...v, r]));

  const save = async () => {
    if (!title.trim() || !slug.trim()) return toast.error("Title and slug required");
    if (visibility.length === 0) return toast.error("Pick at least one role");
    setSaving(true);
    const { error } = await supabase.from("docs").insert({
      title: title.trim(),
      slug: slug.trim(),
      category,
      content,
      role_visibility: visibility,
      pinned,
      external_links: links,
      updated_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Doc created");
    navigate({ to: "/knowledge/$slug" as string, params: { slug } as never });
  };

  return (
    <DocForm
      mode="new"
      title={title}
      setTitle={setTitle}
      slug={slug}
      setSlug={(v) => {
        setSlug(v);
        setSlugTouched(true);
      }}
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

export function DocForm(props: {
  mode: "new" | "edit";
  title: string;
  setTitle: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  category: DocCategory;
  setCategory: (v: DocCategory) => void;
  content: string;
  setContent: (v: string) => void;
  visibility: string[];
  toggleRole: (r: string) => void;
  pinned: boolean;
  setPinned: (v: boolean) => void;
  links: ExternalLink[];
  setLinks: (v: ExternalLink[]) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const {
    mode, title, setTitle, slug, setSlug, category, setCategory,
    content, setContent, visibility, toggleRole, pinned, setPinned,
    links, setLinks, saving, onSave,
  } = props;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Link to={"/knowledge" as string}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Knowledge Hub
          </Button>
        </Link>
        <Button size="sm" onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : mode === "new" ? "Create doc" : "Save changes"}
        </Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Closer Onboarding" />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="closer-onboarding" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocCategory)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {DOC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {ALL_ROLES.map((r) => (
                <label
                  key={r}
                  className={
                    "text-xs border rounded-full px-2.5 py-1 cursor-pointer transition " +
                    (visibility.includes(r)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-[#1f2530] text-muted-foreground hover:border-primary/50")
                  }
                >
                  <input
                    type="checkbox"
                    checked={visibility.includes(r)}
                    onChange={() => toggleRole(r)}
                    className="hidden"
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(!!v)} />
          Pin to top of category
        </label>

        <div className="space-y-2">
          <Label>External links (Looms, booking, etc.)</Label>
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Label"
                value={l.label}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], label: e.target.value };
                  setLinks(next);
                }}
                className="max-w-[180px]"
              />
              <Input
                placeholder="https://…"
                value={l.url}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], url: e.target.value };
                  setLinks(next);
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setLinks(links.filter((_, j) => j !== i))}
                type="button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setLinks([...links, { label: "", url: "" }])}
          >
            <Plus className="h-4 w-4 mr-1" /> Add link
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <Label className="mb-2 block">Content (Markdown)</Label>
        <MarkdownEditor value={content} onChange={setContent} />
      </Card>
    </div>
  );
}
