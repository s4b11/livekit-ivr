"""Provision LiveKit telephony for the assistant (idempotent).

1. Rent a free US phone number through LiveKit Phone Numbers (first number is free
   on every LiveKit Cloud plan) using the `lk` CLI.
2. Create an individual SIP dispatch rule (one room per caller, prefix "call-")
   that dispatches the assistant (`AGENT_NAME`) into each call room.
3. Assign the phone number to the dispatch rule.

Run:  uv run python -m voice_assistant.telephony.provision
"""

import asyncio
import json
import shutil
import subprocess
import sys

from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

from livekit import api  # noqa: E402

from voice_assistant.config import get_settings  # noqa: E402

settings = get_settings()
RULE_NAME = f"{settings.agent_name}-inbound"


def run_lk(*args: str) -> str:
    lk = shutil.which("lk")
    if not lk:
        sys.exit("The `lk` CLI is required. Install it and run `lk cloud auth` first.")
    result = subprocess.run([lk, *args], capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        raise RuntimeError(f"lk {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def _items(raw: str) -> list[dict]:
    data = json.loads(raw or "{}")
    if isinstance(data, dict):
        return data.get("items", [])
    return data if isinstance(data, list) else []


def _e164(number: dict) -> str:
    return number.get("e164Format") or number.get("phoneNumber") or number.get("e164") or ""


def get_or_rent_number() -> dict:
    numbers = _items(run_lk("number", "list", "--json"))
    active = [n for n in numbers if n.get("status", "").lower().endswith("active")]
    if active:
        print(f"Using existing number: {_e164(active[0])}")
        return active[0]

    print("No active number found. Searching LiveKit Phone Numbers inventory (US)...")
    inventory = _items(run_lk("number", "search", "--country-code", "US", "--limit", "5", "--json"))
    if not inventory:
        sys.exit("No US numbers available in inventory right now.")
    candidate = _e164(inventory[0])
    print(f"Renting {candidate} (first US number is free on all LiveKit Cloud plans)")
    run_lk("number", "purchase", "--numbers", candidate)
    numbers = _items(run_lk("number", "list", "--json"))
    for n in numbers:
        if _e164(n) == candidate:
            return n
    sys.exit("Number purchase did not show up in `lk number list`.")


async def get_or_create_dispatch_rule(phone: str) -> str:
    """Create the dispatch rule that routes inbound calls to the assistant.

    Note: LiveKit Cloud strips the `numbers` scoping field on dispatch rule writes,
    so an API-created rule is always a "catch-all" rule, and the phone-number API
    refuses to formally assign catch-all rules. In a project with a single phone
    number the catch-all rule matches every inbound call - including
    calls to our number - so routing works without the formal assignment. To pin
    the rule to the number explicitly, use the Cloud dashboard's
    "Assign dispatch rule" action on the Phone Numbers page.
    """
    lkapi = api.LiveKitAPI(
        url=settings.livekit_http_url,
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    )
    try:
        existing = await lkapi.sip.list_sip_dispatch_rule(api.ListSIPDispatchRuleRequest())
        for rule in existing.items:
            if rule.name == RULE_NAME:
                print(f"Using existing dispatch rule: {rule.sip_dispatch_rule_id}")
                return rule.sip_dispatch_rule_id

        request = api.CreateSIPDispatchRuleRequest(
            dispatch_rule=api.SIPDispatchRuleInfo(
                name=RULE_NAME,
                rule=api.SIPDispatchRule(
                    dispatch_rule_individual=api.SIPDispatchRuleIndividual(
                        room_prefix=settings.sip_room_prefix,
                    )
                ),
                room_config=api.RoomConfiguration(
                    agents=[api.RoomAgentDispatch(agent_name=settings.agent_name)]
                ),
            )
        )
        created = await lkapi.sip.create_sip_dispatch_rule(request)
        print(f"Created dispatch rule: {created.sip_dispatch_rule_id}")
        return created.sip_dispatch_rule_id
    finally:
        await lkapi.aclose()


def main() -> None:
    number = get_or_rent_number()
    phone = _e164(number)
    rule_id = asyncio.run(get_or_create_dispatch_rule(phone))

    assigned = number.get("sipDispatchRuleIds") or number.get("sipDispatchRuleId") or []
    if isinstance(assigned, str):
        assigned = [assigned]
    if rule_id not in assigned:
        print(f"Assigning number {phone} -> rule {rule_id}")
        try:
            run_lk("number", "update", "--number", phone, "--sip-dispatch-rule-id", rule_id)
        except RuntimeError as exc:
            # Known LiveKit Cloud limitation: API-created rules are catch-all and
            # cannot be formally assigned. The catch-all rule still matches every
            # inbound call in this project, so routing to the agent works.
            print(f"Formal assignment rejected (catch-all rule still routes the call): {exc}")
    else:
        print("Number already assigned to the dispatch rule.")
    print("\n=== Telephony ready ===")
    print(f"Phone number : {phone}")
    print(f"Dispatch rule: {rule_id} (agent: {settings.agent_name})")
    print("Add to .env ->  PHONE_NUMBER=" + str(phone))


if __name__ == "__main__":
    main()
