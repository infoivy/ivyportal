import { useState } from "react";
import TurndownService from "turndown";
import { MarkdownView } from "./markdown-view";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});
turndown.addRule("strikethrough", {
  filter: ["del", "s"],
  replacement: (c) => `~~${c}~~`,
});

export function MarkdownEditor({
  value,
  onChange,
  minHeight = 400,
}: {
  value: string;
  onChange: (v: string) => void;
  minHeight?: number;
}) {
  const [tab, setTab] = useState<"edit" | "preview" | "split">("split");

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html) return; // let plain text paste normally
    e.preventDefault();
    let md = turndown.turndown(html);
    // clean Google Docs artifacts
    md = md.replace(/\u00A0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    onChange(value.slice(0, start) + md + value.slice(end));
    setTimeout(() => {
      target.selectionStart = target.selectionEnd = start + md.length;
    }, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(["edit", "split", "preview"] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "default" : "outline"}
            onClick={() => setTab(t)}
            type="button"
          >
            {t[0].toUpperCase() + t.slice(1)}
          </Button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground self-center">
          Paste from Google Docs — formatting auto-converts to markdown.
        </span>
      </div>
      <div className={tab === "split" ? "grid md:grid-cols-2 gap-3" : ""}>
        {(tab === "edit" || tab === "split") && (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            spellCheck={false}
            className="font-mono text-xs leading-relaxed resize-y"
            style={{ minHeight }}
          />
        )}
        {(tab === "preview" || tab === "split") && (
          <div
            className="border border-[#1f2530] rounded-md p-4 overflow-auto bg-[#0a0b0f]"
            style={{ minHeight }}
          >
            {value.trim() ? (
              <MarkdownView content={value} />
            ) : (
              <p className="text-sm text-muted-foreground">Preview will appear here.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
