import { useQuery } from "@tanstack/react-query";
import { UserPlus, MessageCircle, Star, PhoneCall, CircleDollarSign, Instagram } from "lucide-react";
import { getMochiDetail } from "@/lib/mochi.functions";

/**
 * Mochi-style pipeline funnel: stage columns with counts, a smooth flowing
 * ribbon whose band height tracks each stage's share, conversion chips at the
 * boundaries, and the drop-out strip (unqualified / deposit / no-show) below.
 */

const STAGES = [
  { key: "NEW", label: "New", icon: UserPlus, color: "text-chart-5" },
  { key: "IN_CONTACT", label: "In contact", icon: MessageCircle, color: "text-chart-4" },
  { key: "QUALIFIED", label: "Qualified", icon: Star, color: "text-warning-fg" },
  { key: "BOOKED", label: "Booked call", icon: PhoneCall, color: "text-chart-1" },
  { key: "WON", label: "Won", icon: CircleDollarSign, color: "text-success-fg" },
] as const;

const EXTRAS = [
  { key: "UNQUALIFIED", label: "Unqualified" },
  { key: "DEPOSIT", label: "Deposit" },
  { key: "NO_SHOW", label: "No show" },
] as const;

const matchStage = (pipeline: { stage: string; count: number }[], key: string) => {
  const norm = (s: string) => s.replace(/[^A-Z]/gi, "").toUpperCase();
  const row = pipeline.find((p) => {
    const s = norm(p.stage);
    if (key === "BOOKED") return s.includes("BOOK");
    if (key === "NO_SHOW") return s.includes("NOSHOW");
    return s === norm(key) || s.includes(norm(key));
  });
  return row?.count ?? 0;
};

export function MochiFunnel({ pipeline }: { pipeline: { stage: string; count: number }[] }) {
  const counts = STAGES.map((s) => matchStage(pipeline, s.key));
  const max = Math.max(...counts, 1);

  // Ribbon geometry: 1000×200 viewBox, five equal segments, band heights
  // proportional to stage counts with a floor so empty stages stay visible.
  const W = 1000;
  const H = 200;
  const cy = H / 2;
  const bandH = (c: number) => Math.max(14, (c / max) * (H - 24));
  const xs = STAGES.map((_, i) => (i / (STAGES.length - 1)) * W);

  const segments = STAGES.slice(0, -1).map((_, i) => {
    const h0 = bandH(counts[i]);
    const h1 = bandH(counts[i + 1]);
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const mx = (x0 + x1) / 2;
    return {
      d: [
        `M ${x0} ${cy - h0 / 2}`,
        `C ${mx} ${cy - h0 / 2}, ${mx} ${cy - h1 / 2}, ${x1} ${cy - h1 / 2}`,
        `L ${x1} ${cy + h1 / 2}`,
        `C ${mx} ${cy + h1 / 2}, ${mx} ${cy + h0 / 2}, ${x0} ${cy + h0 / 2}`,
        "Z",
      ].join(" "),
      opacity: 0.16 + (i / (STAGES.length - 2)) * 0.55,
      pct: counts[i] > 0 ? Math.round((counts[i + 1] / counts[i]) * 1000) / 10 : 0,
    };
  });

  return (
    <div>
      {/* Stage columns */}
      <div className="grid grid-cols-5">
        {STAGES.map((s, i) => (
          <div key={s.key} className={`px-3 py-2 ${i > 0 ? "border-l border-border/60" : ""}`}>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              <span className="truncate">{s.label}</span>
            </div>
            <div className="text-[22px] font-medium tabular-nums text-foreground leading-tight mt-1">{counts[i]}</div>
          </div>
        ))}
      </div>

      {/* Flowing ribbon with conversion chips */}
      <div className="relative mt-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32 sm:h-40 block" preserveAspectRatio="none" aria-hidden>
          {segments.map((seg, i) => (
            <path key={i} d={seg.d} fill="var(--chart-1)" opacity={seg.opacity} />
          ))}
        </svg>
        {segments.map((seg, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground shadow-sm"
            style={{ left: `${((i + 1) / STAGES.length) * 100 - 10}%`, top: "50%" }}
          >
            {seg.pct}% →
          </span>
        ))}
      </div>

      {/* Drop-out strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border/60 mt-1 px-3 py-2 text-[12px] text-muted-foreground">
        {EXTRAS.map((e) => (
          <span key={e.key} className="tabular-nums">
            {e.label}: <span className="text-foreground font-medium">{matchStage(pipeline, e.key)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Self-fetching card wrapper — drop into The Room or any founder surface. */
export function MochiFunnelPanel() {
  const q = useQuery({
    queryKey: ["mochi-detail", "last_7_days"],
    queryFn: () => getMochiDetail({ data: { period: "last_7_days" } }),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  if (q.isError || (q.data && !q.data.connected)) return null;
  return (
    <div className="card-surface p-1">
      <div className="flex items-center gap-2 px-3 pt-3 pb-1 text-[13px] font-medium text-foreground">
        <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
        The funnel
        <span className="text-[11px] text-muted-foreground font-normal">every lead's current stage · Mochi · live</span>
      </div>
      <MochiFunnel pipeline={q.data?.pipelineNow ?? []} />
    </div>
  );
}
