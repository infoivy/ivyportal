import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h3:text-xl prose-p:leading-relaxed prose-a:text-primary prose-code:text-primary prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#0f1116] prose-pre:border prose-pre:border-[#1f2530]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ node, ...props }) => {
            const text = String(props.children ?? "");
            const id = slugify(text);
            return <h2 id={id} {...props} />;
          },
          h3: ({ node, ...props }) => {
            const text = String(props.children ?? "");
            const id = slugify(text);
            return <h3 id={id} {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function extractHeadings(md: string): { depth: number; text: string; id: string }[] {
  const lines = md.split("\n");
  const out: { depth: number; text: string; id: string }[] = [];
  let inCode = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ depth: m[1].length, text: m[2], id: slugify(m[2]) });
  }
  return out;
}
