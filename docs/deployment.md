# Deployment and CI/CD

The **agent worker** runs on LiveKit Cloud, deployed by GitHub Actions. The
**API service** is a standard container that you host wherever you like; it is
only needed for the web widget and for storing transcripts and messages.

## Pipelines

| Workflow | Trigger | What it does |
| --- | --- | --- |
| [`ci.yml`](../.github/workflows/ci.yml) | every pull request and push to `main` | Ruff lint and format check, pytest against PostgreSQL, and a build of the agent image |
| [`deploy.yml`](../.github/workflows/deploy.yml) | push to `main` that touches the agent, or a manual run | Runs CI, then deploys to LiveKit Cloud and waits for the new version to be running |

Deploys are rolling: new sessions go to the new version while active calls
finish on the old one.

## One-time setup

1. **Register the agent.** With the [`lk` CLI](https://docs.livekit.io/reference/developer-tools/livekit-cli/)
   signed in (`lk cloud auth`), run this from the repository root:

   ```bash
   lk agent create --secrets "GOOGLE_API_KEY=your-key"
   ```

   It builds the `Dockerfile`, deploys the first version, and writes
   `livekit.toml` containing the project subdomain and agent ID. Neither is a
   secret. **Commit `livekit.toml`** - until it exists, the deploy workflow
   skips itself with a warning.

2. **Add repository secrets** under *Settings → Secrets and variables → Actions*:

   | Secret | Value |
   | --- | --- |
   | `LIVEKIT_URL` | `wss://your-project.livekit.cloud` |
   | `LIVEKIT_API_KEY` | LiveKit Cloud API key |
   | `LIVEKIT_API_SECRET` | LiveKit Cloud API secret |
   | `SECRET_LIST` | Comma-separated agent secrets, see below |

   `SECRET_LIST` holds the environment the agent runs with, for example:

   ```text
   GOOGLE_API_KEY=your-key,BACKEND_BASE_URL=https://api.example.com,BACKEND_API_KEY=your-shared-key
   ```

   LiveKit Cloud injects `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and
   `LIVEKIT_API_SECRET` into the agent itself, so they do not go in the list.

3. **Optional: require approval.** The deploy job runs in a GitHub environment
   named `production`. Add required reviewers to it to gate each deploy.

4. **Optional: run behaviour tests in CI.** Set the repository variable
   `RUN_AGENT_EVALS` to `true`. These tests call an LLM, so they cost a little
   and can occasionally be flaky; they are off by default.

## Hosting the API service

```bash
docker build -f Dockerfile.api -t voice-assistant-api .
```

Run it with these environment variables:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | `postgresql+asyncpg://user:password@host:5432/dbname` |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Used to mint web session tokens |
| `AGENT_NAME` | Must match the agent's, default `sabith-assistant` |
| `BACKEND_API_KEY` | Shared with the agent through `SECRET_LIST`. Always set this in production |
| `EMBED_ALLOWED_ORIGINS` | Comma-separated sites allowed to embed the widget, e.g. `https://sabithsb.fermyon.app` |

Then point the agent at it with `BACKEND_BASE_URL` in `SECRET_LIST`.

## Useful commands

```bash
lk agent status
```

```bash
lk agent logs
```

```bash
lk agent update-secrets --secrets "GOOGLE_API_KEY=new-key"
```
