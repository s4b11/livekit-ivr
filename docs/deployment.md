# Deployment

Everything deploys from GitHub Actions, configured only through GitHub secrets.
There is no `.env` to upload and nothing to create by hand: the workflow creates
the D1 database and registers the LiveKit agent on its first run.

| Part | Runs on | Deployed by |
| --- | --- | --- |
| React voice UI, embed widget, token + storage API, database | Cloudflare Workers + D1 | `wrangler deploy` |
| Agent worker | LiveKit Cloud | [`livekit/deploy-action`](https://github.com/livekit/deploy-action) |

## GitHub secrets

Add these under *Settings → Secrets and variables → Actions → Secrets*.

| Secret | Where to get it | Used by |
| --- | --- | --- |
| `LIVEKIT_URL` | [LiveKit Cloud](https://cloud.livekit.io) → Settings → API keys. Looks like `wss://your-project.livekit.cloud` | Worker, agent deploy |
| `LIVEKIT_API_KEY` | Same page | Worker, agent deploy |
| `LIVEKIT_API_SECRET` | Same page | Worker, agent deploy |
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) - a Gemini API key | Agent |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token. Start from the **Edit Cloudflare Workers** template and add **Account → D1 → Edit** | Cloudflare deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID | Cloudflare deploy |
| `BACKEND_API_KEY` | Make one up: any long random string, e.g. the output of `openssl rand -hex 32` | Worker, agent |

`BACKEND_API_KEY` is the shared secret between the agent and the Worker's
private endpoints. You never need it anywhere else, except to read stored calls
and messages yourself (see below).

### Optional variables

Under *Settings → Secrets and variables → Actions → Variables*:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_BASE_URL` | Set this if you put the Worker on a custom domain, e.g. `https://assistant.example.com`. Otherwise the `workers.dev` address is detected automatically. |
| `RUN_AGENT_EVALS` | `true` runs the LLM-judged behaviour tests in CI. They call an LLM, so they cost a little and can occasionally be flaky; off by default. |

## What a deploy does

[`deploy.yml`](../.github/workflows/deploy.yml) runs on every push to `main`
that touches the agent or the web project, and on manual runs.

1. **CI** - lint, tests, and builds for both halves ([`ci.yml`](../.github/workflows/ci.yml)).
2. **Cloudflare** - creates the D1 database if it does not exist, applies new
   migrations, builds and deploys the Worker, then sets the Worker's secrets.
3. **LiveKit Cloud** - deploys the agent with `GOOGLE_API_KEY`,
   `BACKEND_API_KEY`, and `BACKEND_BASE_URL` set to the Worker's address from
   step 2. Deploys are rolling: active calls finish on the old version.

On the **first** run there is no agent yet, so step 3 creates it and commits the
generated `livekit.toml` (project subdomain and agent ID - not secrets) to `main`.
Later runs deploy to that agent.

A target whose secrets are missing is skipped with a warning, so the workflow
stays green while you are still adding secrets. To require approval before each
deploy, add required reviewers to the `production` environment in the
repository settings.

## After the first deploy

- The run summary shows the Worker's address. Open it for the voice UI, or add
  `/embed/` for the widget demo.
- To restrict which sites may embed the widget, change `EMBED_ALLOWED_ORIGINS`
  in `web/wrangler.jsonc` to a comma-separated list of origins.
- To connect a phone number, run the provisioning script once (see the README).

## Reading stored calls and messages

```bash
curl -H "Authorization: Bearer $BACKEND_API_KEY" https://YOUR-WORKER-HOST/api/v1/messages
```

```bash
curl -H "Authorization: Bearer $BACKEND_API_KEY" https://YOUR-WORKER-HOST/api/v1/calls
```
