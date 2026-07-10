import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";
import { slugify } from "@/lib/knowledge";

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="prose dark:prose-invert prose-sm sm:prose-base max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[var(--card)] prose-pre:border prose-pre:border-[var(--border)] prose-blockquote:border-primary prose-hr:border-[var(--border)] prose-table:text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children, ...p }) => <h1 id={slugify(String(children))} {...p}>{children}</h1>,
          h2: ({ children, ...p }) => <h2 id={slugify(String(children))} {...p}>{children}</h2>,
          h3: ({ children, ...p }) => <h3 id={slugify(String(children))} {...p}>{children}</h3>,
          a: ({ href, children }) => (
            <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export type TocEntry = { id: string; text: string; level: number };

export function useToc(content: string): TocEntry[] {
  return useMemo(() => {
    const out: TocEntry[] = [];
    const lines = content.split("\n");
    let inFence = false;
    for (const line of lines) {
      if (/^```/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
      if (m) {
        const text = m[2].replace(/[#*_`]/g, "").trim();
        out.push({ id: slugify(text), text, level: m[1].length });
      }
    }
    return out;
  }, [content]);
}
