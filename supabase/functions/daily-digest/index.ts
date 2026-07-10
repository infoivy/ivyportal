// F23: Daily digest edge function — runs on cron (3:00 UTC = 7:00 Dubai)
// Schedule via Supabase Dashboard → Edge Functions → Schedules: "0 3 * * *"
// Required secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Recipients: configure DIGEST_RECIPIENTS as JSON in edge function secrets:
//   [{"email":"a@ivysalesacademy.com","roles":["admin","founder"]},{"email":"bilal@...","roles":["admin"]}]

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (_req) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Missed EODs yesterday
    const [setterRolesRes, yesterdayEodsRes] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "setter"),
      supabase.from("eods").select("user_id").eq("report_date", yesterday),
    ]);
    const setterIds = new Set((setterRolesRes.data ?? []).map((r: any) => r.user_id));
    const filedYesterday = new Set((yesterdayEodsRes.data ?? []).map((r: any) => r.user_id));
    const missedCount = [...setterIds].filter(id => !filedYesterday.has(id)).length;

    // MTD cash
    const monthStart = today.slice(0, 8) + "01";
    const { data: dealsData } = await supabase
      .from("deals")
      .select("cash_collected_upfront")
      .gte("deal_date", monthStart);
    const mtdCash = (dealsData ?? []).reduce((s: number, d: any) => s + (d.cash_collected_upfront ?? 0), 0);

    // At-risk students
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const { count: atRisk } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("status", "ghosting");

    const recipientsRaw = Deno.env.get("DIGEST_RECIPIENTS");
    const recipients: { email: string; roles: string[] }[] = recipientsRaw ? JSON.parse(recipientsRaw) : [];

    if (!recipients.length) {
      return new Response(JSON.stringify({ ok: true, note: "No DIGEST_RECIPIENTS configured." }), { status: 200 });
    }

    const sends = await Promise.all(
      recipients.map(async (r) => {
        const isFounder = r.roles.includes("founder") || r.roles.includes("admin");
        const isCSM = r.roles.includes("csm") || r.roles.includes("founder");

        const lines: string[] = [`<strong>ISA Portal — Daily Digest (${today})</strong>`, "<hr/>"];
        if (isFounder) {
          lines.push(`<p>💰 MTD Cash: <strong>$${Math.round(mtdCash).toLocaleString()}</strong></p>`);
          lines.push(`<p>⚠️ EODs missed yesterday: <strong>${missedCount}</strong></p>`);
        }
        if (isCSM) {
          lines.push(`<p>🔴 At-risk students (ghosting): <strong>${atRisk ?? 0}</strong></p>`);
        }
        lines.push(`<p style="color:#666;font-size:12px">View portal → <a href="https://portal.ivysalesacademy.com">portal.ivysalesacademy.com</a></p>`);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: "ISA Portal <digest@ivysalesacademy.com>",
            to: [r.email],
            subject: `ISA Daily · ${missedCount > 0 ? `⚠️ ${missedCount} missed EODs · ` : ""}MTD $${Math.round(mtdCash / 1000)}k`,
            html: lines.join("\n"),
          }),
        });
        return { email: r.email, status: res.status };
      })
    );

    return new Response(JSON.stringify({ ok: true, sends }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
