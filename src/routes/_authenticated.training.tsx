import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Play, Search, Plus, Loader2, GraduationCap, Pencil, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({ meta: [{ title: "Training — ISA Team" }] }),
  component: Training,
});

type Video = {
  id: string;
  title: string;
  description: string;
  video_url: string | null;
  thumbnail_color: string;
  category: string;
  sort_order: number;
  active: boolean;
};

const THUMB_COLORS = ["#0d6b5b", "#3b82f6", "#f59e0b", "#22c55e", "#a855f7", "#ef4444", "#06b6d4", "#ec4899"];

function Training() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editVideo, setEditVideo] = useState<Video | null>(null);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("training_videos")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setVideos((data ?? []) as Video[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const categories = ["All", ...Array.from(new Set(videos.map(v => v.category))).sort()];

  const filtered = videos.filter(v =>
    (category === "All" || v.category === category) &&
    (query === "" || v.title.toLowerCase().includes(query.toLowerCase()) || v.description.toLowerCase().includes(query.toLowerCase()))
  );

  const deleteVideo = async (id: string) => {
    if (!confirm("Delete this training video?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("training_videos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Video deleted");
    load();
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-display text-foreground">Training</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {videos.length === 0 ? "No videos yet — admins can add them below." : `${videos.length} video${videos.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search videos…"
                className="pl-8 pr-3 py-1.5 rounded-sm border border-border bg-card text-xs w-44 sm:w-56 focus:outline-none focus:border-white/30"
              />
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => { setEditVideo(null); setAddOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add video
              </Button>
            )}
          </div>
        </div>

        {/* Categories */}
        {categories.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-sm border transition ${
                  category === c ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
                }`}>
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {videos.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card/50 p-12 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-muted-foreground">No training videos yet</h3>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs mx-auto">
              Admins can add videos by clicking "Add video". Paste in a YouTube, Loom, or any embed URL.
            </p>
            {isAdmin && (
              <Button size="sm" className="mt-4" onClick={() => { setEditVideo(null); setAddOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add first video
              </Button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-xs text-muted-foreground">No videos match your search.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(v => (
              <div key={v.id} className="card-surface overflow-hidden group motion-safe:transition-shadow">
                {/* Thumbnail */}
                <div
                  className="aspect-video relative flex items-center justify-center cursor-pointer"
                  style={{ background: `color-mix(in srgb, ${v.thumbnail_color} 14%, var(--card))` }}
                  onClick={() => v.video_url && window.open(v.video_url, "_blank")}
                >
                  <div className={`grid h-12 w-12 place-items-center rounded-full bg-white/90 group-hover:scale-110 transition ${v.video_url ? "cursor-pointer" : "opacity-40"}`}>
                    <Play className="h-5 w-5 text-black fill-black ml-0.5" />
                  </div>
                  {!v.video_url && (
                    <div className="absolute bottom-2 left-2 text-[10px] px-1.5 py-0.5 rounded-sm bg-black/70 text-warning-fg">
                      No URL yet
                    </div>
                  )}
                  {isAdmin && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={e => { e.stopPropagation(); setEditVideo(v); setAddOpen(true); }}
                        className="h-6 w-6 grid place-items-center rounded-sm bg-black/70 hover:bg-black/90 text-white"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteVideo(v.id); }}
                        className="h-6 w-6 grid place-items-center rounded-sm bg-black/70 hover:bg-danger/90 text-danger-fg"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-[12px] text-muted-foreground mb-1">{v.category}</div>
                  <h3 className="text-[15px] font-semibold leading-tight mb-1">{v.title}</h3>
                  <p className="text-[13px] text-muted-foreground line-clamp-2">{v.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddVideoDialog
        open={addOpen}
        onOpenChange={open => { setAddOpen(open); if (!open) setEditVideo(null); }}
        editing={editVideo}
        onSaved={() => { setAddOpen(false); setEditVideo(null); load(); }}
        thumbColors={THUMB_COLORS}
      />
    </div>
  );
}

function AddVideoDialog({
  open, onOpenChange, editing, onSaved, thumbColors,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Video | null;
  onSaved: () => void;
  thumbColors: string[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [category, setCategory] = useState("General");
  const [thumb, setThumb] = useState(thumbColors[0]);
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description);
      setVideoUrl(editing.video_url ?? "");
      setCategory(editing.category);
      setThumb(editing.thumbnail_color);
      setSortOrder(String(editing.sort_order));
    } else {
      setTitle(""); setDescription(""); setVideoUrl(""); setCategory("General");
      setThumb(thumbColors[0]); setSortOrder("0");
    }
  }, [editing, open]);

  const save = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      video_url: videoUrl.trim() || null,
      category: category.trim() || "General",
      thumbnail_color: thumb,
      sort_order: parseInt(sortOrder) || 0,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { error } = editing
      ? await db.from("training_videos").update(payload).eq("id", editing.id)
      : await db.from("training_videos").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Video updated" : "Video added");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit training video" : "Add training video"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. The 4-Question DM Opener" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What will they learn?" />
          </div>
          <div className="space-y-1">
            <Label>Video URL <span className="text-muted-foreground">(YouTube, Loom, etc.)</span></Label>
            <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Objection Handling" />
            </div>
            <div className="space-y-1">
              <Label>Sort order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Thumbnail colour</Label>
            <div className="flex gap-2 flex-wrap">
              {thumbColors.map(c => (
                <button
                  key={c}
                  onClick={() => setThumb(c)}
                  className={`h-7 w-7 rounded-sm border-2 transition ${thumb === c ? "border-white scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {editing ? "Save changes" : "Add video"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
