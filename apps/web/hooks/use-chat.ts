"use client";

import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import { useChat as useAIChat } from "@ai-sdk/react";
import { useCallback, useMemo } from "react";
import type { ChatMessage } from "@ai-saas/shared";

export type PersistedChatMessage = UIMessage<{
  createdAt?: string;
  model?: string;
  totalTokens?: number;
}>;

function fileSizeFromDataUrl(url: string) {
  const encoded = url.split(",", 2)[1] ?? "";
  return Math.floor((encoded.length * 3) / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
}

export function useChat(conversationId: string) {
  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/api/chat",
      body: { conversationId },
      prepareSendMessagesRequest: ({ id, messages, body }) => ({
        body: { ...body, id, messages: messages.length ? [messages[messages.length - 1]] : [] },
      }),
    }),
    [conversationId],
  );
  const { messages, sendMessage, status, stop, error, setMessages } = useAIChat<PersistedChatMessage>({
    id: conversationId,
    transport,
  });

  const send = useCallback(
    async (message: string, files: File[] = []) => {
      const fileParts: FileUIPart[] = await Promise.all(files.map(async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        return {
          type: "file" as const,
          mediaType: file.type || "application/octet-stream",
          filename: file.name,
          url: `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`,
        };
      }));
      await sendMessage({ text: message, files: fileParts });
    },
    [sendMessage],
  );

  const clear = useCallback(() => setMessages([]), [setMessages]);

  const chatMessages: ChatMessage[] = messages.map((message) => {
    const text = message.parts
      .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("");
    const attachments = message.parts
      .filter((part): part is Extract<(typeof message.parts)[number], { type: "file" }> => part.type === "file")
      .map((part, index) => ({
        fileId: `${message.id}-${index}`,
        name: part.filename ?? "Attachment",
        mimeType: part.mediaType,
        url: part.url,
        size: part.url.startsWith("data:") ? fileSizeFromDataUrl(part.url) : 0,
      }));
    return {
      id: message.id,
      role: message.role as ChatMessage["role"],
      content: text,
      createdAt: message.metadata?.createdAt,
      model: message.metadata?.model,
      totalTokens: message.metadata?.totalTokens,
      attachments,
    };
  });

  return {
    messages: chatMessages,
    uiMessages: messages,
    setMessages,
    isLoading: status === "submitted" || status === "streaming",
    error,
    send,
    clear,
    stop,
  };
}
