import { useState, useMemo, useEffect } from "react";
import TurndownService from "turndown";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOC_CATEGORIES, ALL_ROLES, slugifyTitle, type Doc, type DocCategory } from "@/lib/docs";
import { MarkdownView } from "@/components/markdown-view";
import { Trash2, Plus } from "lucide-react";

type Draft = {
  title: string;
  slug: string;
  category: DocCategory;
  content: string;
  role_visibility: string[];
  pinned: boolean;
  external_links: { label: string; url: string }[];
};

export function DocEditor({
  initial,
  saving,
  onSave,
  onDelete,
}: {
  initial?: Partial<Doc>;
  saving: boolean;
  onSave: (draft: Draft) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    category: (initial?.category ?? "setting") as DocCategory,
    content: initial?.content ?? "",
    role_visibility: initial?.role_visibility ?? ["admin"],
    pinned: initial?.pinned ?? false,
    external_links: initial?.external_links ?? [],
  });
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [slugDirty, setSlugDirty] = useState(!!initial?.slug);

  useEffect(() => {
    if (!slugDirty && draft.title) setDraft(d => ({ ...d, slug: slugifyTitle(d.title) }));
  }, [draft.title, slugDirty]);

  const turndown = useMemo(() => {
    const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
    return td;
  }, []);

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (html && /<h[1-6]|<ul|<ol|<li|<p/i.test(html)) {
      e.preventDefault();
      const md = turndown.turndown(html);
      const el = e.currentTarget;
      const start = el.selectionStart, end = el.selectionEnd;
      const next = draft.content.slice(0, start) + md + draft.content.slice(end);
      setDraft(d => ({ ...d, content: next }));
    }
  };

  const toggleRole = (r: string) => {
    setDraft(d => ({
      ...d,
      role_visibility: d.role_visibility.includes(r)
        ? d.role_visibility.filter(x => x !== r)
        : [...d.role_visibility, r],
    }));
  };

  const addLink = () => setDraft(d => ({ ...d, external_links: [...d.external_links, { label: "", url: "" }] }));
  const updateLink = (i: number, patch: Partial<{ label: string; url: string }>) =>
    setDraft(d => ({ ...d, external_links: d.external_links.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  const removeLink = (i: number) => setDraft(d => ({ ...d, external_links: d.external_links.filter((_, idx) => idx !== i) }));

  const canSave = draft.title.trim() && draft.slug.trim() && draft.role_visibility.length > 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Title</Label>
          <Input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="How we run onboarding calls" />
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={draft.slug} onChange={e => { setSlugDirty(true); setDraft(d => ({ ...d, slug: slugifyTitle(e.target.value) })); }} placeholder="onboarding-calls" />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={draft.category} onValueChange={v => setDraft(d => ({ ...d, category: v as DocCategory }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={draft.pinned} onCheckedChange={v => setDraft(d => ({ ...d, pinned: !!v }))} />
            Pinned (show first in category)
          </label>
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Role visibility</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRole(r)}
              className={
                "text-xs px-2.5 py-1 rounded-full border capitalize " +
                (draft.role_visibility.includes(r)
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60")
              }
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Admins always see every doc regardless of these tags.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>External links</Label>
          <Button size="sm" variant="outline" onClick={addLink} type="button"><Plus className="h-3.5 w-3.5 mr-1" /> Add link</Button>
        </div>
        {draft.external_links.length === 0 && (
          <p className="text-xs text-muted-foreground">Optional. Loom recordings, booking pages, Notion pages.</p>
        )}
        <div className="space-y-2">
          {draft.external_links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Label" value={l.label} onChange={e => updateLink(i, { label: e.target.value })} />
              <Input placeholder="https://..." value={l.url} onChange={e => updateLink(i, { url: e.target.value })} />
              <Button variant="ghost" size="icon" onClick={() => removeLink(i)} type="button"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={() => setTab("write")} className={"text-xs px-2.5 py-1 rounded-md " + (tab === "write" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40")}>Write</button>
          <button type="button" onClick={() => setTab("preview")} className={"text-xs px-2.5 py-1 rounded-md " + (tab === "preview" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40")}>Preview</button>
          <span className="text-[10px] text-muted-foreground ml-auto">Paste from Google Docs converts to markdown automatically.</span>
        </div>
        {tab === "write" ? (
          <Textarea
            value={draft.content}
            onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
            onPaste={onPaste}
            placeholder="# Heading&#10;&#10;Content in markdown..."
            className="min-h-[480px] font-mono text-sm"
          />
        ) : (
          <div className="min-h-[480px] p-4 rounded-md border border-border bg-[#0f1116]">
            {draft.content ? <MarkdownView content={draft.content} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={() => onSave(draft)} disabled={!canSave || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {onDelete && (
          <Button variant="destructive" onClick={onDelete} disabled={saving}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        )}
      </div>
    </div>
  );
}
