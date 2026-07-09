import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Copy, Check, Plus, Trash2, ExternalLink, DollarSign } from "lucide-react";
import { toast } from "sonner";

type PaymentLink = {
  id: string;
  label: string;
  currency: string;
  amount: number | null;
  url: string;
  method: "whop" | "stripe" | "wise" | "paypal" | "bank" | "other";
  notes: string | null;
  active: boolean;
  sort_order: number;
};

const METHODS = ["stripe", "whop", "wise", "paypal", "bank", "other"] as const;

export const Route = createFileRoute("/_authenticated/closer-resources")({
  head: () => ({ meta: [{ title: "Closer Resources — ISA Team" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const [{ data: isAdmin }, { data: isCloser }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: user.id, _role: "closer" }),
    ]);
    if (!isAdmin && !isCloser) throw redirect({ to: "/knowledge" });
  },
  component: CloserResources,
});

function CloserResources() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("payment_links").select("*").order("sort_order").order("label");
    setLinks((data ?? []) as unknown as PaymentLink[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const copy = async (l: PaymentLink) => {
    await navigator.clipboard.writeText(l.url);
    setCopiedId(l.id);
    toast.success(`Copied ${l.label}`);
    setTimeout(() => setCopiedId(c => c === l.id ? null : c), 1500);
  };

  const activeLinks = links.filter(l => l.active || isAdmin);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/knowledge" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Knowledge
        </Link>
        {isAdmin && (
          <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => setEditing(e => !e)}>
            {editing ? "Done editing" : "Manage links"}
          </Button>
        )}
      </div>

      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
          <DollarSign className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Closer Resources</h1>
          <p className="text-sm text-muted-foreground">Payment links, bank details, and closer-only assets. One-click copy.</p>
        </div>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-widest text-muted-foreground/70">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Label</th>
                  <th className="text-left px-4 py-2 font-medium">Method</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-left px-4 py-2 font-medium">Link</th>
                  <th className="px-4 py-2 w-[1%]"></th>
                </tr>
              </thead>
              <tbody>
                {activeLinks.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No payment links yet.{isAdmin ? " Add one below." : ""}</td></tr>
                )}
                {activeLinks.map(l => (
                  <tr key={l.id} className={"border-t border-border/60 " + (!l.active ? "opacity-50" : "")}>
                    <td className="px-4 py-3 font-medium">
                      {l.label}
                      {l.notes && <div className="text-[11px] text-muted-foreground font-normal mt-0.5">{l.notes}</div>}
                    </td>
                    <td className="px-4 py-3 uppercase text-[11px] tracking-widest text-muted-foreground">{l.method}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.amount ? `${l.currency} ${Number(l.amount).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3 max-w-[280px] truncate text-muted-foreground">{l.url}</td>
                    <td className="px-2 py-3 flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => copy(l)} className="h-8">
                        {copiedId === l.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="h-8">
                        <a href={l.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isAdmin && editing && <AdminManager links={links} reload={load} />}

      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold">Bank details & other closer-only docs</div>
        <p className="text-xs text-muted-foreground">
          Sensitive resources like bank transfer details live as gated docs in the Knowledge Hub with role_visibility restricted to closers.
        </p>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link to="/knowledge">Open Knowledge Hub</Link>
        </Button>
      </Card>
    </div>
  );
}

function AdminManager({ links, reload }: { links: PaymentLink[]; reload: () => void }) {
  const [draft, setDraft] = useState({ label: "", currency: "USD", amount: "", url: "", method: "stripe" as PaymentLink["method"], notes: "" });

  const add = async () => {
    if (!draft.label || !draft.url) return;
    const { error } = await supabase.from("payment_links").insert({
      label: draft.label,
      currency: draft.currency,
      amount: draft.amount ? Number(draft.amount) : null,
      url: draft.url,
      method: draft.method,
      notes: draft.notes || null,
    });
    if (error) return toast.error(error.message);
    setDraft({ label: "", currency: "USD", amount: "", url: "", method: "stripe", notes: "" });
    toast.success("Added");
    reload();
  };

  const update = async (id: string, patch: Partial<PaymentLink>) => {
    const { error } = await supabase.from("payment_links").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this payment link?")) return;
    const { error } = await supabase.from("payment_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  return (
    <Card className="p-4 space-y-4 border-primary/30">
      <div className="text-sm font-semibold">Manage links</div>
      <div className="grid gap-2 md:grid-cols-6">
        <div className="md:col-span-2"><Label className="text-xs">Label</Label><Input value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} /></div>
        <div><Label className="text-xs">Method</Label>
          <Select value={draft.method} onValueChange={v => setDraft(d => ({ ...d, method: v as PaymentLink["method"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Currency</Label><Input value={draft.currency} onChange={e => setDraft(d => ({ ...d, currency: e.target.value.toUpperCase() }))} /></div>
        <div><Label className="text-xs">Amount</Label><Input type="number" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} /></div>
        <div className="flex items-end"><Button onClick={add} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add</Button></div>
        <div className="md:col-span-6"><Label className="text-xs">URL</Label><Input value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="https://..." /></div>
        <div className="md:col-span-6"><Label className="text-xs">Notes (optional)</Label><Input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></div>
      </div>

      <div className="space-y-2">
        {links.map(l => (
          <div key={l.id} className="flex items-center gap-2 text-sm border border-border/60 rounded-md p-2">
            <div className="flex-1 min-w-0 truncate"><span className="font-medium">{l.label}</span> <span className="text-xs text-muted-foreground">· {l.method}</span></div>
            <div className="flex items-center gap-2 text-xs">
              <Switch checked={l.active} onCheckedChange={v => update(l.id, { active: v })} />
              <span className="text-muted-foreground w-10">{l.active ? "Active" : "Off"}</span>
              <Button variant="ghost" size="icon" onClick={() => del(l.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
