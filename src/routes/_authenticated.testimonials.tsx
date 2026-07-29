import { StudentsTabBar } from "@/components/students-tab-bar";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateForTables } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Upload, Trash2, Search, Video, Image as ImageIcon, Quote, Star, Send,
  ExternalLink, X, Plus, Loader2, CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/testimonials")({
  head: () => ({ meta: [{ title: "Testimonials · ISA Team" }] }),
  component: TestimonialsPage,
});

type TType = "video" | "image" | "text" | "trustpilot";
type TStatus = "requested" | "received" | "approved" | "published";

type Testimonial = {
  id: string;
  student_id: string | null;
  type: TType;
  title: string | null;
  content_text: string | null;
  file_path: string | null;
  source_url: string | null;
  collected_by: string | null;
  collected_at: string | null;
  status: TStatus;
  tags: string[];
  created_at: string;
};

type StudentLite = { id: string; full_name: string };

const TYPE_META: Record<TType, { label: string; icon: typeof Video; color: string }> = {
  video:      { label: "Video",      icon: Video,      color: "bg-muted text-muted-foreground border-border" },
  image:      { label: "Image",      icon: ImageIcon,  color: "bg-muted text-muted-foreground border-border" },
  text:       { label: "Text",       icon: Quote,      color: "bg-muted text-muted-foreground border-border" },
  trustpilot: { label: "Trustpilot", icon: Star,       color: "bg-muted text-muted-foreground border-border" },
};

const STATUS_META: Record<TStatus, string> = {
  requested: "bg-warning-bg text-warning-fg border-warning/25",
  received:  "bg-muted text-muted-foreground border-border",
  approved:  "bg-success-bg text-success-fg border-success/25",
  published: "bg-primary/15 text-primary border-primary/30",
};

function TestimonialsPage() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isStaff = roles.some(r => ["admin", "coach", "closer", "setter", "csm"].includes(r));

  const [rows, setRows] = useState<Testimonial[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState<TType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TStatus | "all">("all");
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; type: TType } | null>(null);

  const fetchPage = async () => {
    const [{ data: ts }, { data: sts }] = await Promise.all([
      supabase.from("testimonials").select("*, students!inner(is_demo)").eq("students.is_demo", false).order("created_at", { ascending: false }),
      supabase.from("students").select("id, full_name").eq("is_demo", false).order("full_name"),
    ]);
    const list = (ts ?? []) as Testimonial[];
    // Batch signed URLs for file-backed items
    const paths = list.map(r => r.file_path).filter(Boolean) as string[];
    let signed: Record<string, string> = {};
    if (paths.length) {
      const results = await Promise.all(
        paths.map(async p => {
          const { data } = await supabase.storage.from("testimonials").createSignedUrl(p, 60 * 60);
          return [p, data?.signedUrl ?? ""] as const;
        })
      );
      signed = Object.fromEntries(results);
    }
    return { list, students: (sts ?? []) as StudentLite[], signed };
  };

  const pageQ = useQuery({ queryKey: ["page", "testimonials"], queryFn: fetchPage, staleTime: 30 * 60_000 });
  useEffect(() => {
    if (!pageQ.data) return;
    setRows(pageQ.data.list);
    setStudents(pageQ.data.students);
    setSignedUrls(pageQ.data.signed);
    setLoading(false);
  }, [pageQ.data]);
  const qc = useQueryClient();
  const load = () => invalidateForTables(qc, ["testimonials"]);

  const studentName = useCallback(
    (id: string | null) => id ? (students.find(s => s.id === id)?.full_name ?? "–") : "–",
    [students],
  );

  const filtered = useMemo(() => {
    let out = rows;
    if (typeFilter !== "all")   out = out.filter(r => r.type === typeFilter);
    if (statusFilter !== "all") out = out.filter(r => r.status === statusFilter);
    if (studentFilter !== "all") out = out.filter(r => r.student_id === studentFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(r =>
        (r.title ?? "").toLowerCase().includes(q) ||
        (r.content_text ?? "").toLowerCase().includes(q) ||
        studentName(r.student_id).toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return out;
  }, [rows, typeFilter, statusFilter, studentFilter, query, studentName]);

  const counts = useMemo(() => {
    const c = { all: rows.length, video: 0, image: 0, text: 0, trustpilot: 0 } as Record<string, number>;
    rows.forEach(r => { c[r.type]++; });
    return c;
  }, [rows]);

  const setStatus = async (id: string, status: TStatus) => {
    const patch: Partial<Testimonial> = { status };
    if (status !== "requested" && !rows.find(r => r.id === id)?.collected_at) {
      (patch as { collected_at?: string }).collected_at = new Date().toISOString();
    }
    const { error } = await supabase.from("testimonials").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Marked ${status}`); load(); }
  };

  const del = async (t: Testimonial) => {
    if (!confirm("Delete this testimonial? This cannot be undone.")) return;
    if (t.file_path) {
      await supabase.storage.from("testimonials").remove([t.file_path]);
    }
    const { error } = await supabase.from("testimonials").delete().eq("id", t.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  if (!isStaff) {
    return <div className="p-8 text-muted-foreground">You don't have access to this page.</div>;
  }

  return (
    <div className="w-full max-w-none p-4 sm:p-6 space-y-5">
      <StudentsTabBar />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display text-foreground">Testimonials</h1>
          <p className="text-sm text-muted-foreground mt-1">Social proof library · video, image, text, and Trustpilot.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRequestOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Request testimonial
          </Button>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Upload
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label={`All · ${counts.all}`} active={typeFilter === "all"} onClick={() => setTypeFilter("all")} />
        {(["video","image","text","trustpilot"] as TType[]).map(t => {
          const M = TYPE_META[t];
          const Icon = M.icon;
          return (
            <FilterChip
              key={t}
              label={<><Icon className="h-3.5 w-3.5" /> {M.label} · {counts[t] ?? 0}</>}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            />
          );
        })}
        <div className="h-6 w-px bg-border mx-1" />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as TStatus | "all")}>
          <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Select value={studentFilter} onValueChange={setStudentFilter}>
          <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Student" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All students</SelectItem>
            {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, content, tags…" className="pl-8 h-8" />
        </div>
      </div>

      {/* Masonry gallery */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground">
          No testimonials match your filters.
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]">
          {filtered.map(t => (
            <TestimonialCard
              key={t.id}
              t={t}
              url={t.file_path ? signedUrls[t.file_path] : undefined}
              studentName={studentName(t.student_id)}
              isAdmin={isAdmin}
              onSetStatus={setStatus}
              onDelete={del}
              onOpenMedia={(url) => setLightbox({ url, type: t.type })}
            />
          ))}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        students={students}
        userId={user?.id ?? null}
        onDone={load}
      />
      <RequestDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        students={students}
        userId={user?.id ?? null}
        onDone={load}
      />

      {lightbox && (
        <div className="fixed inset-0 overflow-y-auto z-50 bg-black/90 flex p-8" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="h-6 w-6" />
          </button>
          {lightbox.type === "video" ? (
            <video src={lightbox.url} controls autoPlay className="m-auto max-h-[90vh] max-w-full rounded-lg" onClick={e => e.stopPropagation()} />
          ) : (
            <img src={lightbox.url} alt="testimonial" className="m-auto max-h-[90vh] max-w-full rounded-lg" onClick={e => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "h-8 px-3 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 " +
        (active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30")
      }
    >
      {label}
    </button>
  );
}

function TestimonialCard({
  t, url, studentName, isAdmin, onSetStatus, onDelete, onOpenMedia,
}: {
  t: Testimonial;
  url: string | undefined;
  studentName: string;
  isAdmin: boolean;
  onSetStatus: (id: string, s: TStatus) => void;
  onDelete: (t: Testimonial) => void;
  onOpenMedia: (url: string) => void;
}) {
  const M = TYPE_META[t.type];
  const Icon = M.icon;

  return (
    <div className="mb-4 break-inside-avoid rounded-lg border border-border bg-card overflow-hidden hover:border-foreground/20 transition-colors">
      {/* Media */}
      {t.type === "video" && url && (
        <video src={url} controls preload="metadata" className="w-full bg-black" />
      )}
      {t.type === "image" && url && (
        <button onClick={() => onOpenMedia(url)} className="block w-full">
          <img src={url} alt={t.title ?? ""} className="w-full object-cover hover:opacity-90 transition-opacity" />
        </button>
      )}
      {t.type === "text" && (
        <div className="p-5 pb-3">
          <Quote className="h-5 w-5 text-primary/60 mb-2" />
          <p className="text-sm leading-relaxed italic">"{t.content_text}"</p>
        </div>
      )}
      {t.type === "trustpilot" && (
        <div className="p-5 pb-3">
          <div className="flex items-center gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-warning-fg" />)}
          </div>
          {t.content_text && <p className="text-sm leading-relaxed">{t.content_text}</p>}
        </div>
      )}

      {/* Footer */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={"text-[10px] " + M.color}>
            <Icon className="h-3 w-3 mr-1" /> {M.label}
          </Badge>
          <Badge variant="outline" className={"text-[10px] " + STATUS_META[t.status]}>
            {t.status}
          </Badge>
        </div>

        {t.title && <div className="text-sm font-medium truncate">{t.title}</div>}
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span className="truncate">{studentName}</span>
          <span className="shrink-0">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
        </div>

        {t.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {t.tags.map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">#{tag}</span>
            ))}
          </div>
        )}

        {t.source_url && (
          <a href={t.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Source
          </a>
        )}

        <div className="flex items-center gap-1 pt-1 border-t border-border/60">
          <Select value={t.status} onValueChange={v => onSetStatus(t.id, v as TStatus)}>
            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(t)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadDialog({
  open, onClose, students, userId, onDone,
}: {
  open: boolean; onClose: () => void; students: StudentLite[]; userId: string | null; onDone: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [type, setType] = useState<TType>("video");
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFiles([]); setStudentId(""); setType("video"); setTitle("");
      setContentText(""); setSourceUrl(""); setTagsStr("");
    }
  }, [open]);

  const needsFile = type === "video" || type === "image";

  const submit = async () => {
    if (!userId) return;
    if (!studentId) { toast.error("Pick a student"); return; }
    if (needsFile && files.length === 0) { toast.error("Add at least one file"); return; }
    if (!needsFile && !contentText.trim()) { toast.error("Content text required"); return; }
    setBusy(true);
    const tags = tagsStr.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    try {
      if (needsFile) {
        for (const f of files) {
          const ext = f.name.split(".").pop() ?? "bin";
          const path = `${studentId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("testimonials").upload(path, f, { contentType: f.type });
          if (upErr) throw upErr;
          const { error: insErr } = await supabase.from("testimonials").insert({
            student_id: studentId, type, title: title || f.name, file_path: path,
            collected_by: userId, collected_at: new Date().toISOString(),
            status: "received", tags, source_url: sourceUrl || null,
          });
          if (insErr) throw insErr;
        }
      } else {
        const { error } = await supabase.from("testimonials").insert({
          student_id: studentId, type, title: title || null, content_text: contentText,
          source_url: sourceUrl || null, collected_by: userId, collected_at: new Date().toISOString(),
          status: "received", tags,
        });
        if (error) throw error;
      }
      toast.success("Testimonial saved");
      onDone(); onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload testimonial</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Student</label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a student" /></SelectTrigger>
                <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={type} onValueChange={v => setType(v as TType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="trustpilot">Trustpilot</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsFile && (
            <div
              className={
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors " +
                (dragging ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30")
              }
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault(); setDragging(false);
                setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
              }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <div className="text-sm">Drop files here or click to browse</div>
              <div className="text-xs text-muted-foreground mt-1">{type === "video" ? "MP4, MOV, WebM" : "JPG, PNG, WebP"}</div>
              <input
                ref={fileRef} type="file" multiple accept={type === "video" ? "video/*" : "image/*"}
                className="hidden"
                onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])}
              />
            </div>
          )}
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!needsFile && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Content</label>
              <Textarea value={contentText} onChange={e => setContentText(e.target.value)} rows={4} className="mt-1" placeholder="Quote or Trustpilot review text…" />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Title (optional)</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Source URL {type === "trustpilot" && "(Trustpilot link)"}</label>
            <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} className="mt-1" placeholder="https://…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tags (comma separated)</label>
            <Input value={tagsStr} onChange={e => setTagsStr(e.target.value)} className="mt-1" placeholder="job-offer, big-win, remote" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Save</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDialog({
  open, onClose, students, userId, onDone,
}: {
  open: boolean; onClose: () => void; students: StudentLite[]; userId: string | null; onDone: () => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<TType>("video");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setStudentId(""); setType("video"); setNote(""); } }, [open]);

  const submit = async () => {
    if (!studentId || !userId) return;
    setBusy(true);
    const { error } = await supabase.from("testimonials").insert({
      student_id: studentId, type, status: "requested",
      collected_by: userId, title: "Requested", content_text: note || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Testimonial requested · student flagged");
      onDone(); onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Request testimonial</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Student</label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a student" /></SelectTrigger>
              <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <Select value={type} onValueChange={v => setType(v as TType)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="trustpilot">Trustpilot</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="mt-1" placeholder="Prompt or context for the student…" />
          </div>
          <p className="text-xs text-muted-foreground">
            <Plus className="h-3 w-3 inline mr-1" />
            Student will be flagged on their graduation checklist and CSM workspace.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending</> : <><Send className="h-4 w-4 mr-2" /> Request</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
