"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/cn";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const markdownComponents: Components = {
  // Headings
  h1: ({ children, ...props }) => (
    <h1
      className="mb-4 mt-6 scroll-m-20 text-3xl font-bold tracking-tight text-zinc-100 first:mt-0"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mb-3 mt-8 scroll-m-20 border-b border-white/10 pb-2 text-2xl font-semibold tracking-tight text-zinc-100 first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="mb-2 mt-6 scroll-m-20 text-xl font-semibold tracking-tight text-zinc-200 first:mt-0"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4
      className="mb-2 mt-4 scroll-m-20 text-lg font-semibold tracking-tight text-zinc-200"
      {...props}
    >
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="mb-1 mt-4 text-base font-semibold text-zinc-300" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="mb-1 mt-3 text-sm font-semibold text-zinc-400" {...props}>
      {children}
    </h6>
  ),

  // Paragraphs
  p: ({ children, ...props }) => (
    <p
      className="mb-4 leading-7 text-zinc-300 [&:not(:first-child)]:mt-4"
      {...props}
    >
      {children}
    </p>
  ),

  // Lists
  ul: ({ children, ...props }) => (
    <ul
      className="my-4 ml-6 list-disc space-y-2 text-zinc-300 [&>li]:mt-2"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="my-4 ml-6 list-decimal space-y-2 text-zinc-300 [&>li]:mt-2"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-7" {...props}>
      {children}
    </li>
  ),

  // Blockquote
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-4 border-l-4 border-zinc-600 bg-zinc-900/50 py-2 pl-4 pr-4 italic text-zinc-400"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Code blocks
  code: ({ className, children, ...props }) => {
    const isInline = !className;

    if (isInline) {
      return (
        <code
          className="relative rounded bg-zinc-800 px-[0.4em] py-[0.2em] font-mono text-sm text-zinc-200"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <code
        className={cn(
          "block overflow-x-auto rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-200",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre
      className="my-4 overflow-x-auto rounded-lg border border-white/10 bg-zinc-900/80 p-4"
      {...props}
    >
      {children}
    </pre>
  ),

  // Links
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className="font-medium text-blue-400 underline underline-offset-4 transition-colors hover:text-blue-300"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),

  // Emphasis
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-zinc-100" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-zinc-300" {...props}>
      {children}
    </em>
  ),

  // Horizontal rule
  hr: ({ ...props }) => <hr className="my-6 border-zinc-700" {...props} />,

  // Tables (for GFM support)
  table: ({ children, ...props }) => (
    <div className="my-6 w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="border-b border-zinc-700 bg-zinc-900/50" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-zinc-800" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr className="transition-colors hover:bg-zinc-800/30" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th className="px-4 py-3 text-left font-semibold text-zinc-200" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-4 py-3 text-zinc-300" {...props}>
      {children}
    </td>
  ),

  // Images
  img: ({ src, alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      className="my-4 max-w-full rounded-lg border border-white/10"
      {...props}
    />
  ),
};

export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
