import { useEffect, useRef } from 'react';
import type { AgentState, ReceivedMessage } from '@livekit/components-react';

import { AgentChatIndicator } from '@/components/agents-ui/agent-chat-indicator';
import { cn } from '@/lib/utils';

interface ChatTranscriptProps {
  messages: ReceivedMessage[];
  agentState: AgentState;
  className?: string;
}

/** Distance from the bottom (px) within which new messages keep the view pinned. */
const STICKY_THRESHOLD = 80;

/**
 * A compact, mobile-first conversation transcript: one bubble per message,
 * plain text (no markdown), and auto-scroll that stops if the reader scrolls up.
 */
export function ChatTranscript({ messages, agentState, className }: ChatTranscriptProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const lastMessage = messages.at(-1);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && stickToBottom.current) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length, lastMessage?.message, agentState]);

  const onScroll = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    stickToBottom.current = distance < STICKY_THRESHOLD;
  };

  return (
    <div
      ref={viewportRef}
      onScroll={onScroll}
      role="log"
      aria-label="Conversation transcript"
      aria-live="polite"
      className={cn(
        'bg-card/60 overflow-y-auto overscroll-contain rounded-2xl border px-3 py-3 sm:px-4',
        className,
      )}
    >
      {messages.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Your conversation will appear here. Type below or just talk.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {messages.map(({ id, timestamp, from, message }) => {
            const isUser = Boolean(from?.isLocal);
            return (
              <li
                key={id}
                title={new Date(timestamp).toLocaleTimeString()}
                className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
              >
                <p
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap sm:max-w-[75%] sm:text-[15px]',
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md',
                  )}
                >
                  <span className="sr-only">{isUser ? 'You: ' : 'Assistant: '}</span>
                  {message}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {agentState === 'thinking' && (
        <div role="status" className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
          <AgentChatIndicator size="sm" />
          Thinking…
        </div>
      )}
    </div>
  );
}
