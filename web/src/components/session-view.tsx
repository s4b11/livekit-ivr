import { useState } from 'react';
import { useAgent, useSessionMessages, type UseSessionReturn } from '@livekit/components-react';

import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import { AgentControlBar } from '@/components/agents-ui/agent-control-bar';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { AURA_COLOR } from '@/lib/config';
import { cn } from '@/lib/utils';

const STATE_LABELS: Record<string, string> = {
  connecting: 'Connecting…',
  initializing: 'Getting ready…',
  idle: 'Ready',
  'pre-connect-buffering': 'Listening…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking',
  disconnected: 'Disconnected',
  failed: 'Something went wrong',
};

interface SessionViewProps {
  session: UseSessionReturn;
  themeMode: 'light' | 'dark';
  onDeviceError: (message: string) => void;
}

export function SessionView({ session, themeMode, onDeviceError }: SessionViewProps) {
  const { state, microphoneTrack } = useAgent();
  const { messages } = useSessionMessages(session);
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 pb-4 sm:pb-6">
      {/* The aura shrinks to make room when the chat transcript is open. */}
      <section
        aria-label="Assistant"
        className={cn(
          'flex flex-col items-center justify-center gap-3 transition-all duration-300',
          isChatOpen ? 'py-2' : 'flex-1',
        )}
      >
        <AgentAudioVisualizerAura
          size={isChatOpen ? 'md' : 'xl'}
          color={AURA_COLOR}
          colorShift={0.1}
          themeMode={themeMode}
          state={state}
          audioTrack={microphoneTrack}
        />
        <p aria-live="polite" className="text-muted-foreground font-mono text-xs uppercase">
          {STATE_LABELS[state] ?? state}
        </p>
        <StartAudioButton label="Tap to enable audio" />
      </section>

      {isChatOpen && (
        <AgentChatTranscript
          agentState={state}
          messages={messages}
          className="min-h-0 flex-1 rounded-xl border"
        />
      )}

      <AgentControlBar
        variant="livekit"
        className="mt-4 shrink-0"
        isConnected={session.isConnected}
        isChatOpen={isChatOpen}
        onIsChatOpenChange={setIsChatOpen}
        onDisconnect={() => void session.end()}
        onDeviceError={({ error }) => onDeviceError(error.message)}
        controls={{ microphone: true, chat: true, leave: true, camera: false, screenShare: false }}
      />
    </main>
  );
}
