import { useMemo, useRef, useState } from "react";
import { User, Users } from "lucide-react";

export type MentionPerson = { id: string; name: string; kind: "student" | "member" };

/**
 * Textarea with inline @-mentions: typing "@" opens a picker over students and
 * team members, filtered as you type. Selecting inserts "@Name " into the text
 * and reports the pick (so callers can e.g. tag a student on the message).
 */
export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  onPick,
  people,
  placeholder,
  rows = 2,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onPick?: (p: MentionPerson) => void;
  people: MentionPerson[];
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<string | null>(null); // text after "@", null = closed
  const [anchor, setAnchor] = useState(0); // index of the "@"
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    if (query == null) return [];
    const q = query.toLowerCase();
    return people
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [people, query]);

  const sync = (text: string, caret: number) => {
    onChange(text);
    // An "@" with no whitespace after it, directly before the caret, opens the picker.
    const upToCaret = text.slice(0, caret);
    const m = /@([^\s@]*)$/.exec(upToCaret);
    if (m) {
      setQuery(m[1]);
      setAnchor(caret - m[0].length);
      setHighlight(0);
    } else {
      setQuery(null);
    }
  };

  const pick = (p: MentionPerson) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = value.slice(0, anchor) + "@" + p.name + " " + value.slice(caret);
    onChange(next);
    setQuery(null);
    onPick?.(p);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = anchor + p.name.length + 2;
      el?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="relative flex-1 min-w-0">
      {query != null && matches.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1.5 w-72 max-w-full rounded-md border border-border bg-popover shadow-md overflow-hidden z-20">
          {matches.map((p, i) => (
            <button
              key={`${p.kind}-${p.id}`}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-left ${
                i === highlight ? "bg-muted text-foreground" : "text-foreground"
              }`}
            >
              {p.kind === "student"
                ? <User className="h-3.5 w-3.5 text-warning-fg shrink-0" />
                : <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <span className="truncate">{p.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{p.kind}</span>
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => sync(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={(e) => {
          if (query != null && matches.length > 0) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % matches.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + matches.length) % matches.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[highlight]); return; }
            if (e.key === "Escape") { setQuery(null); return; }
          }
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
        }}
        onBlur={() => setTimeout(() => setQuery(null), 100)}
        placeholder={placeholder}
        rows={rows}
        className={className ?? "w-full resize-none rounded-md border border-border bg-card px-3 py-2.5 pr-12 text-[13px] outline-none focus:border-ring"}
      />
    </div>
  );
}
