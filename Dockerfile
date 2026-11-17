# syntax=docker/dockerfile:1
# Container image for the agent worker, built and run by LiveKit Cloud
# (`lk agent deploy`). See https://docs.livekit.io/deploy/agents/builds/

ARG PYTHON_VERSION=3.13
FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim AS base

# Don't buffer stdout/stderr, so logs are not lost if the process crashes.
ENV PYTHONUNBUFFERED=1

# --- Build stage: compilers are needed for native extensions only ---
FROM base AS build

RUN apt-get update && apt-get install -y gcc g++ python3-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first, from the lockfile, so this layer is cached
# until pyproject.toml or uv.lock change.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# Then add the source and install the project itself.
COPY . .
RUN uv sync --locked --no-dev

# Pre-download any model files the agent needs, so startup is immediate.
RUN uv run --no-sync python -m voice_assistant.agent.worker download-files

# --- Runtime stage: no build tools ---
FROM base

ARG UID=10001
RUN adduser --disabled-password --gecos "" --home "/app" \
    --shell "/sbin/nologin" --uid "${UID}" appuser

WORKDIR /app
COPY --from=build --chown=appuser:appuser /app /app
USER appuser

# "start" connects the worker to LiveKit and waits for dispatched jobs.
CMD ["uv", "run", "--no-sync", "python", "-m", "voice_assistant.agent.worker", "start"]
