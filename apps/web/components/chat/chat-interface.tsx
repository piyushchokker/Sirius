"use client";

import { useRef, useEffect } from "react";
import { useChat } from "@/hooks/use-chat";
import { ChatMessage } from "@/components/chat/message";
import { ChatInput } from "@/components/chat/chat-input";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
  conversationId?: string;
  className?: string;
}

export function ChatInterface({ conversationId, className }: ChatInterfaceProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, send } = useChat(conversationId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(message: string) {
    send(message);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <span className="flex gap-1">
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                </span>
                AI is thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-background/80 backdrop-blur-sm p-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={handleSend}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-foreground/85">
        What can I help with?
      </h2>
    </div>
  );
}
