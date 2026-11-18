"use client";

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent, ClipboardEvent, DragEvent } from "react";
import { ArrowUp, FileText, Image as ImageIcon, Paperclip, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_FILES = 5;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", DOCX_MIME]);

interface ChatInputProps {
  onSend: (message: string, files: File[]) => void | Promise<void>;
  isLoading?: boolean;
  onStop?: () => void;
  agentMode?: boolean;
}

export function ChatInput({ onSend, isLoading, onStop, agentMode }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  async function handleSend() {
    const message = value.trim();
    if ((!message && files.length === 0) || isLoading) return;
    await onSend(message, files);
    setValue("");
    setFiles([]);
    setFileError("");
  }

  function inferMimeType(file: File) {
    if (file.type) return file.type;
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".docx")) return DOCX_MIME;
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".gif")) return "image/gif";
    return "application/octet-stream";
  }

  function addFiles(incoming: File[]) {
    setFileError("");
    let totalBytes = files.reduce((total, file) => total + file.size, 0);
    const accepted: File[] = [];
    for (const file of incoming) {
      const mimeType = inferMimeType(file);
      if (!ACCEPTED_TYPES.has(mimeType)) {
        setFileError("Attach an image, PDF, or Word (.docx) file.");
        continue;
      }
      if (files.length + accepted.length >= MAX_FILES || totalBytes + file.size > MAX_FILE_BYTES) {
        setFileError("A message can include up to 5 files and 3 MB total.");
        break;
      }
      accepted.push(file.type === mimeType ? file : new File([file], file.name, { type: mimeType }));
      totalBytes += file.size;
    }
    if (accepted.length) setFiles((current) => [...current, ...accepted]);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pastedFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (pastedFiles.length) {
      event.preventDefault();
      addFiles(pastedFiles);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false); }}
      className={cn(
        "relative rounded-2xl border border-border bg-background shadow-sm p-2 focus-within:ring-1 focus-within:ring-ring transition-shadow",
        isDragging && "border-primary ring-2 ring-primary/20",
      )}
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pt-1 pb-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 rounded-lg border bg-muted/50 px-2 py-1.5 text-xs">
              {file.type.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              <span className="max-w-40 truncate">{file.name}</span>
              <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {fileError && <p role="alert" className="px-2 pb-2 text-xs text-destructive">{fileError}</p>}
      <div className="flex items-end gap-2">
        <Button
          size="icon"
          variant="ghost"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
          title="Attach an image, PDF, or Word document"
          aria-label="Attach an image, PDF, or Word document"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
          multiple
          onChange={handleFileChange}
          className="hidden"
          aria-label="Choose chat attachments"
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={agentMode ? "Describe a task for the agent…" : "Message AI…"}
          rows={1}
          className={cn("flex-1 resize-none bg-transparent outline-none text-sm", "placeholder:text-muted-foreground py-1.5 max-h-[200px]")}
        />
        {isLoading ? (
          <Button size="icon" variant="ghost" type="button" onClick={onStop} className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive" title="Stop generation">
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button size="icon" type="button" onClick={() => void handleSend()} disabled={!value.trim() && files.length === 0} className="h-8 w-8 flex-shrink-0 rounded-xl" title="Send message">
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
