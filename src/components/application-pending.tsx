import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";
import { TimezoneCombobox } from "@/components/ui/timezone-combobox";
import { Button } from "@/components/ui/button";

/**
 * What a fresh signup sees before the team links them (founder-directed
 * 2026-07-28): first a short details form (name, phone, timezone), then
 * "Application pending." Details land on their profiles row; approval copies
 * them into the student record so the portal's soft locks never re-ask.
 */
export function ApplicationPending({ email, onSignOut, onRecheck }: {
  email: string;
  onSignOut?: () => void;
  onRecheck?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["application-pending-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone, timezone" as never)
        .eq("id", user!.id)
        .maybeSingle();
      return (data ?? { display_name: null, phone: null, timezone: null }) as unknown as {
        display_name: string | null; phone: string | null; timezone: string | null;
      };
    },
  });

  // Poll for approval: roles/link can change server-side any minute.
  useEffect(() => {
    const recheck = () => {
      window.dispatchEvent(new CustomEvent("isa:roles-changed"));
      onRecheck?.();
    };
    const t = setInterval(recheck, 30_000);
    window.addEventListener("focus", recheck);
    return () => { clearInterval(t); window.removeEventListener("focus", recheck); };
  }, [onRecheck]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [tz, setTz] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!q.data || hydrated) return;
    setName(q.data.display_name ?? "");
    setPhone(q.data.phone ?? undefined);
    setTz(q.data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
    setHydrated(true);
  }, [q.data, hydrated]);

  if (!q.data) return null;
  const detailsDone = !!q.data.phone && !!q.data.timezone;
  const canSave = !!name.trim() && !!phone && isValidPhoneNumber(phone) && !!tz;

  const save = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim(), phone, timezone: tz } as never)
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved. You're in the queue.");
    qc.invalidateQueries({ queryKey: ["application-pending-profile"] });
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div dir="rtl" className="text-[14px] text-muted-foreground/80">السلام عليكم ورحمة الله وبركاته</div>
        {!detailsDone ? (
          <>
            <h1 className="mt-4 text-[30px] sm:text-[38px] font-semibold tracking-[-0.02em] leading-[1.12]">
              Welcome to <span className="text-primary">Ivy Sales Academy</span>.
            </h1>
            <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
              A few details while the team reviews your application. Your phone and timezone let us reach you at sane hours.
            </p>
            <div className="mt-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Full name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full h-11 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Phone (WhatsApp)</label>
                <PhoneInput value={phone} onChange={setPhone} placeholder="Your number" />
                {phone && !isValidPhoneNumber(phone) && (
                  <p className="text-[11px] text-danger-fg">That number doesn't look complete yet.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your timezone</label>
                <TimezoneCombobox value={tz} onChange={setTz} />
              </div>
              <button
                onClick={save}
                disabled={saving || !canSave}
                className="inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save my details"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-[30px] sm:text-[38px] font-semibold tracking-[-0.02em] leading-[1.12]">
              Application <span className="text-primary">pending</span>.
            </h1>
            <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
              You're in the queue. The moment the team approves <span className="text-foreground">{email}</span>, this page opens into your portal on its own.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-success-fg">
              <CheckCircle2 className="h-3.5 w-3.5" /> Details saved · phone and timezone in
            </div>
            {onSignOut && (
              <div className="mt-8">
                <Button variant="outline" size="sm" onClick={onSignOut}>
                  <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
