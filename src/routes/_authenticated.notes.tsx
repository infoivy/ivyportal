import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes — ISA Team" }] }),
  component: NotesPage,
});

type Note = { id: string; user_id: string; content: string; tags: string[] | null; created_at: string; display_name?: string };

function NotesPage() {
  const { user, roles } = useAuth();
  const canSeeAll = roles.includes("admin") || roles.includes("closer");
  const [content, setContent] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [scope, setScope] = useState<"mine" | "team">("mine");

  const load = async () => {
    let q = supabase.from("notes").select("*").order("created_at", { ascending: false }).limit(100);
    if (scope === "mine" && user) q = q.eq("user_id", user.id);
    const { data } = await q;
    const rows = (data ?? []) as Note[];
    if (scope === "team") {
      const ids = Array.from(new Set(rows.map(n => n.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map = new Map(profs?.map(p => [p.id, p.display_name]) ?? []);
      setNotes(rows.map(n => ({ ...n, display_name: map.get(n.user_id) ?? "Unknown" })));
    } else setNotes(rows);
  };

  useEffect(() => { load(); }, [user, scope]);

  const add = async () => {
    if (!user || !content.trim()) return;
    const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
    const { error } = await supabase.from("notes").insert({ user_id: user.id, content: content.trim(), tags });
    if (error) toast.error(error.message);
    else { setContent(""); setTagsStr(""); toast.success("Note saved"); load(); }
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Notes</h1>
        {canSeeAll && (
          <div className="flex gap-1 border rounded-md p-0.5">
            <Button size="sm" variant={scope === "mine" ? "default" : "ghost"} onClick={() => setScope("mine")}>Mine</Button>
            <Button size="sm" variant={scope === "team" ? "default" : "ghost"} onClick={() => setScope("team")}>Team</Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea placeholder="Capture context, an objection you heard, a win, a thought…" value={content} onChange={e => setContent(e.target.value)} rows={3} />
          <div className="flex gap-2">
            <Input placeholder="Tags (comma separated)" value={tagsStr} onChange={e => setTagsStr(e.target.value)} />
            <Button onClick={add} disabled={!content.trim()}>Save note</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {notes.length === 0 && <p className="text-muted-foreground">No notes yet.</p>}
        {notes.map(n => (
          <Card key={n.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="whitespace-pre-wrap">{n.content}</p>
                  <div className="flex gap-1 mt-2 flex-wrap items-center">
                    {(n.tags ?? []).map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {n.display_name && `${n.display_name} · `}{new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                {n.user_id === user?.id && (
                  <Button variant="ghost" size="icon" onClick={() => del(n.id)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
