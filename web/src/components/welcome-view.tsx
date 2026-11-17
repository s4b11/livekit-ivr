import { Loader, Mic } from 'lucide-react';

import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura';
import { Button } from '@/components/ui/button';
import { AURA_COLOR, OWNER } from '@/lib/config';

interface WelcomeViewProps {
  themeMode: 'light' | 'dark';
  isConnecting: boolean;
  error: string | null;
  onStart: () => void;
}

export function WelcomeView({ themeMode, isConnecting, error, onStart }: WelcomeViewProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-16 text-center">
      <AgentAudioVisualizerAura
        size="lg"
        color={AURA_COLOR}
        colorShift={0.1}
        themeMode={themeMode}
        state={isConnecting ? 'connecting' : 'disconnected'}
      />
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Talk to {OWNER.firstName}&rsquo;s AI assistant
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Ask who {OWNER.firstName} is, what he builds, or leave him a message. Speak or
          type, in English.
        </p>
      </div>
      <Button size="lg" onClick={onStart} disabled={isConnecting} className="rounded-full px-6">
        {isConnecting ? <Loader className="animate-spin" /> : <Mic />}
        {isConnecting ? 'Connecting…' : 'Start conversation'}
      </Button>
      <p role="alert" className="text-destructive min-h-5 text-sm">
        {error}
      </p>
    </main>
  );
}
