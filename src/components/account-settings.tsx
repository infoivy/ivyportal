import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Mail, Building2, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmailCard({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const next = email.trim();
    if (!next || next === currentEmail) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: next });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check both inboxes · the change confirms by email");
    setEmail("");
  };

  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-1">
        <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">
        You sign in as <span className="font-medium text-foreground">{currentEmail}</span>. Changing it sends a confirmation link to both the old and new address.
      </p>
      <div className="flex items-center gap-2">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="new@email.com" type="email" className="h-9" />
        <Button size="sm" onClick={save} disabled={busy || !email.trim() || email.trim() === currentEmail}>
          Change
        </Button>
      </div>
    </div>
  );
}

export function PasswordCard() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && pw !== confirm;

  const save = async () => {
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    if (pw !== confirm) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPw("");
    setConfirm("");
  };

  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-1">
        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> Password
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">
        Forgot it entirely? Sign out and use “Forgot password” on the sign-in page instead.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" type="password" className="h-9" autoComplete="new-password" />
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat it" type="password" className="h-9" autoComplete="new-password" />
      </div>
      {mismatch && <p className="text-[11px] text-danger-fg mt-1.5">Passwords don’t match.</p>}
      <div className="flex justify-end mt-3">
        <Button size="sm" onClick={save} disabled={busy || pw.length < 8 || pw !== confirm}>
          Update password
        </Button>
      </div>
    </div>
  );
}

export function OrgCard({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const q = useQuery({
    queryKey: ["org-settings"],
    queryFn: async () => (await supabase.from("org_settings").select("*").maybeSingle()).data,
  });
  useEffect(() => {
    if (q.data) setName(q.data.org_name);
  }, [q.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["org-settings"] });

  const saveName = async () => {
    if (!q.data || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("org_settings")
      .update({ org_name: name.trim(), updated_by: userId, updated_at: new Date().toISOString() })
      .eq("id", q.data.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Organization name saved");
    refresh();
  };

  const uploadLogo = async (file: File) => {
    if (!q.data) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Keep the logo under 2 MB");
    setBusy(true);
    const path = `org/logo-${Date.now()}.${file.name.split(".").pop() ?? "png"}`;
    const { error: upErr } = await supabase.storage.from("doc-assets").upload(path, file, { upsert: true });
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { data: pub } = supabase.storage.from("doc-assets").getPublicUrl(path);
    const { error } = await supabase.from("org_settings")
      .update({ logo_url: pub.publicUrl, updated_by: userId, updated_at: new Date().toISOString() })
      .eq("id", q.data.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Logo updated");
    refresh();
  };

  const clearLogo = async () => {
    if (!q.data) return;
    const { error } = await supabase.from("org_settings")
      .update({ logo_url: null, updated_by: userId, updated_at: new Date().toISOString() })
      .eq("id", q.data.id);
    if (error) return toast.error(error.message);
    toast.success("Back to the default logo");
    refresh();
  };

  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-1">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Organization
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">Name and logo shown in the sidebar for everyone.</p>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-muted-foreground">Name</label>
          <div className="flex items-center gap-2 mt-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" placeholder="Ivy Portal" />
            <Button size="sm" onClick={saveName} disabled={busy || !name.trim() || name.trim() === q.data?.org_name}>
              Save
            </Button>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground">Logo</label>
          <div className="flex items-center gap-3 mt-1">
            <div className="h-10 w-10 rounded-lg border border-border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
              {q.data?.logo_url ? (
                <img src={q.data.logo_url} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              Upload
            </Button>
            {q.data?.logo_url && (
              <Button size="sm" variant="ghost" onClick={clearLogo} disabled={busy}>
                Use default
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
