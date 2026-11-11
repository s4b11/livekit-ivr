"""Everything the assistant is allowed to say about its owner.

This module is the single source of truth for the agent's knowledge. To update
what the assistant knows, edit the data here - the system prompt is rendered
from it (see `agent/prompts.py`). Only include facts that are fine to share
with any caller: no private phone number, home address, salary, or client data.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Role:
    title: str
    company: str
    location: str
    period: str
    highlights: tuple[str, ...]


@dataclass(frozen=True)
class Project:
    name: str
    status: str
    summary: str
    stack: str


@dataclass(frozen=True)
class Profile:
    name: str
    first_name: str
    headline: str
    location: str
    timezone: str
    summary: str
    focus_areas: tuple[str, ...]
    experience: tuple[Role, ...]
    projects: tuple[Project, ...]
    skills: dict[str, str]
    education: str
    leadership: str
    availability: str
    contact: dict[str, str] = field(default_factory=dict)


PROFILE = Profile(
    name="Sabith S B",
    first_name="Sabith",
    headline="AI Software Engineer focused on voice AI, GenAI, and Python and Rust backends",
    location="Kollam, Kerala, India",
    timezone="India Standard Time, UTC plus five thirty",
    summary=(
        "Sabith builds real-time voice AI agents, LLM retrieval tools, and the Python "
        "and Rust backends behind them. Most of his work is conversational voice AI: "
        "making an agent take turns naturally, hear domain terms correctly, and answer "
        "without long silences, and then measuring it so problems show up in data "
        "instead of in a live conversation. Outside work he builds small, readable "
        "open-source tools that test an idea end to end."
    ),
    focus_areas=(
        "Conversational voice AI: real-time agents over web and phone, turn-taking, "
        "interruption handling, transcripts, and per-turn latency measurement.",
        "LLM retrieval and grounding: RAG pipelines that cite their sources, keyword "
        "and hybrid retrieval, and prompts that refuse to invent.",
        "Backend services: APIs in Python with FastAPI and Flask, Rust, and ASP.NET "
        "Core, with PostgreSQL and SQL Server.",
    ),
    experience=(
        Role(
            title="Software Developer",
            company="IoTides Private Limited",
            location="Kollam, Kerala",
            period="November 2025 to present, full-time",
            highlights=(
                "Research and development of the real-time voice interview agent in the "
                "company's AI Interview Platform and applicant tracking product.",
                "Builds GenAI backends: RAG pipelines, multi-agent workflows with tool "
                "calling, MCP tooling, guardrails, and LLM evaluation loops.",
                "Instrumented each conversation turn stage by stage, which cut median "
                "response latency from about seven seconds to about three seconds.",
                "Takes IVR and calling-agent features from proof of concept to production "
                "using Gemini Live, SIP telephony, and LiveKit.",
                "Deploys services with Docker on Google Cloud and AWS.",
            ),
        ),
        Role(
            title="Software Developer Intern, .NET",
            company="VCNR Technologies",
            location="Bangalore, Karnataka",
            period="May 2025 to October 2025",
            highlights=(
                "Implemented the ASP.NET Core backend for the Masters module of an "
                "enterprise Warehouse Management System, with C# and SQL Server.",
                "Mapped legacy workflows and contributed to a legacy-to-modern migration.",
            ),
        ),
    ),
    projects=(
        Project(
            name="OKFBench Chat",
            status="Live demo, open source, solo build",
            summary=(
                "A RAG explorer that asks one question three ways - linked concept pages "
                "in Open Knowledge Format, BM25 keyword search, or a hybrid of both - and "
                "shows the cited answer, the sources, timing, and token use. It explores "
                "how the way knowledge is organised changes an AI answer."
            ),
            stack="Python, FastAPI, BM25, PostgreSQL, plain JavaScript",
        ),
        Project(
            name="Utility",
            status="Open source personal project, on web and Android",
            summary=(
                "A private personal productivity app that brings tasks, calendar, notes, "
                "an encrypted wallet, developer tools, an automated job feed matched with "
                "Google Gemini, and an AI assistant that only changes data with approval "
                "into one workspace. The whole app runs as a single Rust WebAssembly "
                "component, and GitHub Actions deploys it and publishes the Android build."
            ),
            stack="Rust, WebAssembly, Fermyon Spin, SQLite, React, TypeScript, Tauri 2",
        ),
        Project(
            name="AI Interview Platform and ATS",
            status="In production at IoTides, proprietary",
            summary=(
                "An AI-led hiring pipeline: resume and job description parsing, a "
                "real-time voice interview agent, and structured reports that shorten a "
                "recruiter's review. Sabith works on the real-time interview agent: "
                "conversation quality, latency instrumentation, and session reliability."
            ),
            stack="Python, FastAPI, WebRTC, speech-to-text, text-to-speech, LLMs",
        ),
        Project(
            name="AI phone and IVR calling agents",
            status="Proof of concept through production",
            summary=(
                "Phone agents on real numbers with speech-to-speech conversation, "
                "barge-in interruption, message taking, call transfers, and stored "
                "transcripts. This assistant is itself one of them."
            ),
            stack="LiveKit Agents, SIP telephony, Gemini Live, FastAPI, PostgreSQL",
        ),
        Project(
            name="Infant Guard",
            status="Academic prototype, BCA major project, team of three",
            summary=(
                "A newborn-care web app prototype with role-based dashboards, vaccination "
                "scheduling, alerts, and doctor-approved nutrition plans. It was never "
                "used with real patients."
            ),
            stack="Python, Flask, PostgreSQL",
        ),
        Project(
            name="FinWise",
            status="Personal project",
            summary="A financial tracker for goals, budgets, and expenses behind a REST API.",
            stack="Python, PostgreSQL",
        ),
    ),
    skills={
        "Daily languages": "Python and Rust",
        "Voice and AI": (
            "LiveKit Agents, SIP telephony, WebRTC, speech-to-text and text-to-speech, "
            "Gemini Live, OpenAI-compatible LLM APIs, RAG, agents, tool calling, MCP, "
            "prompt engineering, guardrails, and LLM evaluation"
        ),
        "Backend": "FastAPI, Flask, SQLAlchemy, Rocket and Axum in Rust, ASP.NET Core in C#",
        "Data": "PostgreSQL, SQLite, SQL Server, with exposure to MongoDB, Redis, and Kafka",
        "Shipping": "Docker, Git, GitHub Actions, AWS, Google Cloud, Fermyon Spin, LiveKit Cloud",
        "Front end": (
            "HTML, CSS, JavaScript, Tailwind CSS, plus Dioxus and Tauri for cross-platform apps"
        ),
    },
    education=(
        "Bachelor of Computer Applications from University Institute of Technology, "
        "Kottarakkara, University of Kerala, 2022 to 2025, with a CGPA of 8.25 out of 10."
    ),
    leadership="National Service Scheme volunteer leader at his college from 2023 to 2025.",
    availability=(
        "Sabith works full-time at IoTides and takes on selected freelance and side "
        "projects alongside it: voice AI agents, RAG and LLM tools, and API or backend "
        "work. He works remotely, or on-site in Kerala."
    ),
    contact={
        "Email (the fastest way to reach him)": "saabith.sb@gmail.com",
        "Portfolio": "sabithsb.fermyon.app",
        "LinkedIn": "linkedin.com/in/s4b11",
        "GitHub": "github.com/s4b11",
    },
)


def render_profile(profile: Profile = PROFILE) -> str:
    """Render the profile as plain text for the system prompt."""
    lines: list[str] = [
        f"Name: {profile.name}",
        f"Headline: {profile.headline}",
        f"Based in: {profile.location} ({profile.timezone})",
        "",
        f"Summary: {profile.summary}",
        "",
        "What he works on:",
        *[f"- {area}" for area in profile.focus_areas],
        "",
        "Experience:",
    ]
    for role in profile.experience:
        lines.append(f"- {role.title} at {role.company}, {role.location} ({role.period}).")
        lines.extend(f"  - {item}" for item in role.highlights)
    lines += ["", "Projects:"]
    for project in profile.projects:
        lines.append(
            f"- {project.name} ({project.status}): {project.summary} Built with {project.stack}."
        )
    lines += ["", "Skills:"]
    lines.extend(f"- {group}: {items}." for group, items in profile.skills.items())
    lines += [
        "",
        f"Education: {profile.education}",
        f"Leadership: {profile.leadership}",
        "",
        f"Availability: {profile.availability}",
        "",
        "Public contact details:",
        *[f"- {label}: {value}" for label, value in profile.contact.items()],
    ]
    return "\n".join(lines)
