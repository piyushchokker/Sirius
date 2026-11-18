"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bot, Loader2, MessageSquare, Plus } from "lucide-react";
import { useChat, type PersistedChatMessage } from "@/hooks/use-chat";
import { ChatMessage } from "@/components/chat/message";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_OPENAI_MODEL } from "@/lib/ai-models";
import { toast } from "sonner";

interface ConversationSummary {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
}

interface ChatInterfaceProps {
  conversationId?: string;
  className?: string;
}

export function ChatInterface({ conversationId, className }: ChatInterfaceProps) {
  const generatedId = `chat-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [activeId, setActiveId] = useState(conversationId ?? generatedId);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, setMessages, isLoading, error, send, stop } = useChat(activeId);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/chat", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load chat history");
      const payload = await response.json();
      setConversations(payload.conversations ?? []);
    } catch {
      toast.error("Unable to load chat history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (conversationId && conversationId !== activeId) setActiveId(conversationId);
  }, [conversationId, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function openConversation(id: string) {
    if (id === activeId || isLoading) return;
    setLoadingConversation(true);
    setActiveId(id);
    try {
      const response = await fetch(`/api/chat?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to open this conversation");
      const payload = await response.json();
      setMessages(payload.messages as PersistedChatMessage[]);
    } catch {
      toast.error("Unable to open this conversation.");
    } finally {
      setLoadingConversation(false);
    }
  }

  async function startNewChat() {
    if (isLoading) return;
    setMessages([]);
    setActiveId(crypto.randomUUID());
  }

  async function handleSend(message: string, files: File[]) {
    try {
      await send(message, files);
      await loadConversations();
    } catch {
      toast.error("Your message could not be sent. Please try again.");
    }
  }

  const isEmpty = messages.length === 0;
  const currentModel = conversations.find((conversation) => conversation.id === activeId)?.model ?? DEFAULT_OPENAI_MODEL;

  return (
    <div className={cn("flex h-full min-h-0", className)}>
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/20 md:flex md:flex-col">
        <div className="p-3">
          <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={() => void startNewChat()}>
            <Plus className="h-4 w-4" /> New chat
          </Button>
        </div>
        <div className="px-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent chats</div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {historyLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading history</div>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Your saved conversations will appear here.</p>
          ) : conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => void openConversation(conversation.id)}
              disabled={isLoading || loadingConversation}
              className={cn(
                "w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50",
                activeId === conversation.id && "bg-muted font-medium",
              )}
              title={conversation.title}
            >
              {conversation.title || "New conversation"}
            </button>
          ))}
        </div>
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {currentModel}{currentModel === DEFAULT_OPENAI_MODEL ? " · Fast" : ""}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 md:hidden">
          <div className="flex items-center gap-2 text-sm font-medium"><Bot className="h-4 w-4 text-primary" /> AI Chat</div>
          <Button type="button" size="sm" variant="ghost" onClick={() => void startNewChat()}><Plus className="mr-1 h-4 w-4" /> New</Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {isEmpty ? (
              <EmptyState />
            ) : (
              <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
                {messages.map((message) => <ChatMessage key={message.id} message={message} />)}
                {isLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                    <span className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    </span>
                    AI is thinking…
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
            {loadingConversation && <div className="p-3 text-center text-sm text-muted-foreground">Loading conversation…</div>}
            {error && <p role="alert" className="mx-auto max-w-3xl px-4 pb-3 text-sm text-destructive">The response stopped unexpectedly. Please try again.</p>}
          </div>
          <div className="bg-background/80 p-4 backdrop-blur-sm">
            <div className="mx-auto max-w-3xl">
              <ChatInput onSend={handleSend} isLoading={isLoading} onStop={stop} />
              <p className="pt-2 text-center text-[11px] text-muted-foreground">Images, PDF, and Word (.docx) · Up to 5 files, 3 MB per message</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageSquare className="h-6 w-6" /></div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground/85">What can I help with?</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Ask a question or attach an image, PDF, or Word document.</p>
    </div>
  );
}
