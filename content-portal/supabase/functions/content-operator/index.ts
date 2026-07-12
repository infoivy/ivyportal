import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://content.ivysalesacademy.com",
  "http://127.0.0.1:4174",
  "http://localhost:4174",
]);

function cors(origin: string | null) {
  const safeOrigin = origin && allowedOrigins.has(origin) ? origin : "https://content.ivysalesacademy.com";
  return {
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

Deno.serve(async (request) => {
  const headers = cors(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const { data: access } = await supabase.from("founder_access").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!access) return new Response(JSON.stringify({ error: "Founder access required" }), { status: 403, headers });

    const body = await request.json();
    const message = String(body.message || "").trim().slice(0, 12000);
    if (!message) return new Response(JSON.stringify({ error: "Message required" }), { status: 400, headers });

    const [content, goals, systems] = await Promise.all([
      supabase.from("content_pieces").select("title,hook,pillar,funnel_stage,format,primary_platform,status,scheduled_for,published_at,views,shares,saves,leads,booked_calls,sales,attributed_revenue,retention_percent").order("updated_at", { ascending: false }).limit(100),
      supabase.from("content_goals").select("name,metric,target,current_value,period_start,period_end").order("period_end", { ascending: false }).limit(20),
      supabase.from("content_systems").select("name,purpose,cadence,status,last_run_at,next_run_at").limit(30),
    ]);

    const instructions = `You are Ivy's private DFY Growth Operator for the founder of Ivy Sales Academy.
You are decisive, commercially minded, concise, and execution-focused. Use the live workspace data below as the source of truth.
Protect these fixed content rules: TOF runs Monday through Thursday; MOF runs Friday through Sunday; content is recorded in two-week batches; Thursday is recording day.
Never fabricate performance metrics. Distinguish observed facts from recommendations. Prefer a prioritized plan with an owner, deadline, and success measure.

LIVE CONTENT: ${JSON.stringify(content.data || [])}
GOALS: ${JSON.stringify(goals.data || [])}
SYSTEMS: ${JSON.stringify(systems.data || [])}`;

    const history = Array.isArray(body.history) ? body.history.slice(-8).map((item: { role?: string; text?: string }) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.text || "").slice(0, 8000),
    })) : [];

    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-5.4-mini",
        instructions,
        input: history.length ? history : [{ role: "user", content: message }],
        reasoning: { effort: "medium" },
        max_output_tokens: 1400,
      }),
    });
    if (!openAIResponse.ok) throw new Error(`Operator request failed (${openAIResponse.status})`);
    const response = await openAIResponse.json();
    const reply = response.output_text || response.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || []).find((item: { type?: string }) => item.type === "output_text")?.text;
    if (!reply) throw new Error("Operator returned no text");

    await supabase.from("ai_messages").insert([
      { owner_id: user.id, role: "user", content: message },
      { owner_id: user.id, role: "assistant", content: reply, model: response.model, input_tokens: response.usage?.input_tokens, output_tokens: response.usage?.output_tokens },
    ]);

    return new Response(JSON.stringify({ reply }), { headers });
  } catch (error) {
    console.error("content-operator", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "The growth operator is temporarily unavailable." }), { status: 500, headers });
  }
});
