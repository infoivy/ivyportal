import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Copy, Check, Plus, Trash2, DollarSign, Save, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type PL = {
  id: string;
  label: string;
  currency: string;
  amount: number | null;
  url: string;
  method: PaymentMethod;
  notes: string | null;
  active: boolean;
  sort_order: number;
};

const METHODS: PaymentMethod[] = ["stripe", "whop", "wise", "paypal", "bank", "other"];

export const Route = createFileRoute("/_authenticated/closer-resources")({
  head: () => ({ meta: [{ title: "Closer Resources — ISA Team" }] }),
  component: CloserResources,
});

function CloserResources() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isCloser = roles.includes("closer");
  const [rows, setRows] = useState<PL[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("payment_links")
      .select("*")
      .order("active", { ascending: false })
      .order("sort_order")
      .order("label");
    setRows((data ?? []) as PL[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (!isAdmin && !isCloser) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-sm text-muted-foreground">
        This page is for closers and admins only.
      </div>
    );
  }

  const copy = async (id: string, text: string, label = "Copied") => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success(label);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  const whopMessage = (r: PL) =>
    `Payment link for $${Number(r.amount ?? 0).toLocaleString()}:\n${r.url}\n\nLet me know once it goes through.`;

  const categorize = (r: PL): string => {
    if (r.method === "whop") return "Whop (main gateway)";
    if (r.method === "wise" && r.currency === "USD") return "Wise USD — bank transfer";
    if (r.method === "wise" && r.currency === "EUR") return "Wise EUR — SEPA";
    if (r.method === "other") return "Revolut";
    if (r.method === "bank") return "YO (UAE bank)";
    return "Other";
  };
  const CATEGORY_ORDER = [
    "Whop (main gateway)",
    "Wise USD — bank transfer",
    "Wise EUR — SEPA",
    "Revolut",
    "YO (UAE bank)",
    "Other",
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Closer Resources</h1>
            <p className="text-sm text-muted-foreground">Payment links, ready to copy on a call.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={"/knowledge" as string}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Knowledge Hub
            </Button>
          </Link>
          {isAdmin && (
            <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => setEditing((v) => !v)}>
              <Pencil className="h-4 w-4 mr-1" /> {editing ? "Done" : "Manage"}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : editing && isAdmin ? (
        <EditTable rows={rows} reload={load} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0f1116] text-xs uppercase tracking-wider text-muted-foreground/70">
                <tr>
                  <th className="text-left px-4 py-2.5">Label</th>
                  <th className="text-left px-4 py-2.5">Method</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                  <th className="text-left px-4 py-2.5 hidden md:table-cell">Notes</th>
                  <th className="text-right px-4 py-2.5">Copy</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter((r) => r.active || isAdmin).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-8">
                      No payment links yet.
                    </td>
                  </tr>
                ) : (
                  rows
                    .filter((r) => r.active || isAdmin)
                    .map((r) => (
                      <tr key={r.id} className={"border-t border-[#1f2530] " + (!r.active ? "opacity-50" : "")}>
                        <td className="px-4 py-3 font-medium">{r.label}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] uppercase tracking-wider border border-[#1f2530] rounded-full px-2 py-0.5">
                            {r.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {r.amount != null ? `${r.currency} ${Number(r.amount).toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell truncate max-w-[280px]">
                          {r.notes ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => copy(r.id, r.url)}>
                            {copied === r.id ? (
                              <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                            ) : (
                              <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function EditTable({ rows, reload }: { rows: PL[]; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<PL[]>(rows);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(rows), [rows]);

  const update = (id: string, patch: Partial<PL>) =>
    setDraft((d) => d.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const saveRow = async (r: PL) => {
    setSaving(true);
    const { error } = await supabase
      .from("payment_links")
      .update({
        label: r.label,
        currency: r.currency,
        amount: r.amount,
        url: r.url,
        method: r.method,
        notes: r.notes,
        active: r.active,
      })
      .eq("id", r.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this link?")) return;
    const { error } = await supabase.from("payment_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  const add = async () => {
    const { error } = await supabase.from("payment_links").insert({
      label: "New link",
      currency: "USD",
      amount: null,
      url: "https://",
      method: "stripe",
      active: true,
    });
    if (error) return toast.error(error.message);
    reload();
  };

  return (
    <div className="space-y-3">
      {draft.map((r) => (
        <Card key={r.id} className="p-3 space-y-2">
          <div className="grid sm:grid-cols-[1fr_120px_140px_120px] gap-2">
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={r.label} onChange={(e) => update(r.id, { label: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Input value={r.currency} onChange={(e) => update(r.id, { currency: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                value={r.amount ?? ""}
                onChange={(e) => update(r.id, { amount: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Method</Label>
              <select
                value={r.method}
                onChange={(e) => update(r.id, { method: e.target.value as PaymentMethod })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">URL</Label>
            <Input value={r.url} onChange={(e) => update(r.id, { url: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={r.notes ?? ""} onChange={(e) => update(r.id, { notes: e.target.value || null })} />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={r.active} onCheckedChange={(v) => update(r.id, { active: !!v })} /> Active
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => remove(r.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => saveRow(r)} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        </Card>
      ))}
      <Button variant="outline" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Add link
      </Button>
    </div>
  );
}
