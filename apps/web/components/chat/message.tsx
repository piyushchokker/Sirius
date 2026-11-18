"use client";

import React from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot, FileText, Image as ImageIcon } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@ai-saas/shared";
import { cn } from "@/lib/utils";

const CodeBlock = dynamic(
  () => import("@/components/chat/code-block").then((module) => module.CodeBlock),
  { loading: () => <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100">Loading code…</pre> }
);

interface MessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-4 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground border border-border"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex flex-col gap-1 max-w-[80%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm"
          )}
        >
          {isUser ? (
            <>
              {message.content && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
              {message.attachments && message.attachments.length > 0 && (
                <div className={cn("flex flex-wrap gap-2", message.content && "mt-3")}>
                  {message.attachments.map((attachment) => (
                    <div key={attachment.fileId} className="max-w-full">
                      {attachment.mimeType.startsWith("image/") && attachment.url ? (
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${attachment.name}`}>
                          <img src={attachment.url} alt={attachment.name} className="max-h-72 max-w-full rounded-lg object-contain" />
                        </a>
                      ) : (
                        <a
                          href={attachment.url || undefined}
                          target={attachment.url ? "_blank" : undefined}
                          rel={attachment.url ? "noopener noreferrer" : undefined}
                          className="inline-flex items-center gap-2 rounded-lg border border-current/15 bg-background/40 px-3 py-2 text-xs"
                        >
                          {attachment.mimeType.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          <span className="max-w-48 truncate">{attachment.name}</span>
                          {attachment.size > 0 && <span className="opacity-70">{(attachment.size / 1024).toFixed(0)} KB</span>}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>

        {/* Token count */}
        {message.totalTokens && (
          <span className="text-xs text-muted-foreground px-1">
            {message.totalTokens.toLocaleString()} tokens
          </span>
        )}
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose prose-sm dark:prose-invert max-w-none"
      components={{
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const isInline = !match;

          if (isInline) {
            return (
              <code
                className="bg-muted-foreground/10 rounded px-1 py-0.5 text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <CodeBlock language={match[1]} code={String(children).trim()} />
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
