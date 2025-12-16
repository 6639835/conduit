"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Card } from "./card";
import { Button } from "./button";
import { Copy, Check, Square, RotateCcw } from "lucide-react";

interface StreamingPanelProps {
  content: string;
  isStreaming?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const StreamingPanel = ({
  content,
  isStreaming = false,
  onCancel,
  onRetry,
  className,
}: StreamingPanelProps) => {
  const [copied, setCopied] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content updates
  React.useEffect(() => {
    if (scrollRef.current && isStreaming) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Response</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              Streaming...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <Square className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
          {!isStreaming && onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-4 font-mono text-sm"
        style={{ maxHeight: "400px" }}
      >
        {content ? (
          <div className="whitespace-pre-wrap">
            {content}
            {isStreaming && <BlinkingCursor />}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
            {isStreaming ? (
              <StreamingLoader />
            ) : (
              <p>No response yet. Send a request to see streaming output.</p>
            )}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      {content && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>{content.length.toLocaleString()} characters</span>
          <span className="mx-2">|</span>
          <span>~{Math.ceil(content.split(/\s+/).length).toLocaleString()} words</span>
        </div>
      )}
    </Card>
  );
};

// Blinking cursor component
const BlinkingCursor = () => {
  return (
    <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5" />
  );
};

// Streaming loader/skeleton
const StreamingLoader = () => {
  return (
    <div className="space-y-3 w-full max-w-md">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="h-3 w-3 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="h-3 w-3 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <p className="text-center">Waiting for response...</p>
    </div>
  );
};

// Shimmer skeleton for loading state
export const StreamingSkeleton = () => {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="p-4 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/6 animate-pulse rounded bg-muted" />
      </div>
    </Card>
  );
};
