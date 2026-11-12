import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useSession } from '@livekit/components-react';
import { ConnectionState, TokenSource } from 'livekit-client';

import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { SiteHeader } from '@/components/site-header';
import { WelcomeView } from '@/components/welcome-view';
import { useThemeMode } from '@/hooks/use-theme-mode';
import { TOKEN_ENDPOINT } from '@/lib/config';

// The session view pulls in the transcript renderer, so it loads on demand.
const SessionView = lazy(() =>
  import('@/components/session-view').then((module) => ({ default: module.SessionView })),
);

/**
 * LiveKit's token source reports "received <status> / <body>". Show the server's own
 * message for the daily limit (429); anything else gets a generic retry message.
 */
function errorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  const match = text.match(/received 429 \/ (.*)$/s);
  if (match) {
    try {
      const detail = JSON.parse(match[1]).detail;
      if (typeof detail === 'string') return detail;
    } catch {
      /* not JSON: fall through */
    }
    return "You've reached today's limit for conversations. Please come back tomorrow.";
  }
  return 'The assistant is unavailable right now. Please try again in a moment.';
}

export default function App() {
  const themeMode = useThemeMode();
  // The API picks the room and dispatches the agent, so no options are needed here.
  const tokenSource = useMemo(() => TokenSource.endpoint(TOKEN_ENDPOINT), []);
  const session = useSession(tokenSource);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setIsStarting(true);
    try {
      await session.start();
    } catch (err) {
      console.error(err);
      setError(errorMessage(err));
    } finally {
      setIsStarting(false);
    }
  }, [session]);

  const isConnecting = isStarting || session.connectionState === ConnectionState.Connecting;

  return (
    <AgentSessionProvider session={session}>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <SiteHeader />
        {session.isConnected ? (
          <Suspense fallback={<div className="flex-1" />}>
            <SessionView session={session} themeMode={themeMode} onDeviceError={setError} />
          </Suspense>
        ) : (
          <WelcomeView
            themeMode={themeMode}
            isConnecting={isConnecting}
            error={error}
            onStart={start}
          />
        )}
      </div>
    </AgentSessionProvider>
  );
}
