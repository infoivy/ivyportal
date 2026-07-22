import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/** "Europe/London" → "London" · "America/New_York" → "New York" */
export function tzCity(tz: string): string {
  return (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}

export function timeIn(tz: string, at: Date): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at);
  } catch {
    return null; // bad/unknown zone string — render nothing rather than lie
  }
}

/** Full IANA list where the browser supports it; a sane shortlist otherwise. */
export function timezoneOptions(): string[] {
  try {
    const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (sv) return sv.call(Intl, "timeZone");
  } catch { /* fall through */ }
  return [
    "Europe/London", "Europe/Amsterdam", "Europe/Paris", "Europe/Stockholm", "Europe/Istanbul",
    "Asia/Riyadh", "Asia/Dubai", "Asia/Karachi", "Asia/Dhaka", "Asia/Jakarta", "Asia/Kuala_Lumpur",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto",
    "Africa/Cairo", "Africa/Lagos", "Africa/Nairobi", "Australia/Sydney",
  ];
}

/**
 * The student's current local time, ticking once a minute. Renders nothing
 * when no timezone is known — absence beats a wrong guess.
 */
export function StudentLocalTime({ tz, className = "" }: { tz: string | null | undefined; className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!tz) return null;
  const time = timeIn(tz, now);
  if (!time) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-muted-foreground ${className}`}>
      <Clock className="h-3 w-3" />
      {time} <span className="opacity-70">· {tzCity(tz)}</span>
    </span>
  );
}
