# -*- coding: utf-8 -*-
"""
livekit_agent.py
----------------
Asha — Bengali AI receptionist voice agent for doctor appointment booking.
Uses LiveKit Agents framework with Google Gemini Realtime (STT + LLM + TTS in one).

Run with:
    python livekit_agent.py start
"""

from __future__ import annotations

import logging
import os
from dotenv import load_dotenv

load_dotenv()

from livekit import agents
from livekit.agents import AgentSession, Agent, JobContext, llm
from livekit.agents import AgentServer
from livekit.plugins import google, silero

from appointment_db import (
    create_patient,
    lookup_patient,
    update_patient_after_visit,
    get_department_for_problem,
    create_patients_table,
)

logger = logging.getLogger("asha-agent")
logger.setLevel(logging.DEBUG)

# ── Instructions ───────────────────────────────────────────────────────────────

INSTRUCTIONS = """আপনি আশা, একজন বাংলাদেশি হাসপাতালের AI রিসেপশনিস্ট। আপনার ভূমিকা হল রোগীদের স্বাগত জানানো, তাদের তথ্য সংগ্রহ করা এবং সঠিক বিভাগে পাঠানো।

**প্রাথমিক অভিবাদন:**
১. "আস্সালামুআলাইকুম" বলে শুরু করুন
২. আপনি সিস্টেমে স্বাগত জানান
৩. বাংলায় কথা বলুন, ইংরেজি এড়িয়ে চলুন

**রোগীর অবস্থা নির্ধারণ:**
১. প্রথমে জিজ্ঞাসা করুন "আপনি আগে এই হাসপাতালে এসেছেন কি?"
২. যদি হ্যাঁ বলে: "আপনার VIN নম্বর বলুন" → lookup_patient_by_vin ফাংশন ব্যবহার করুন
৩. যদি নতুন রোগী হয়: নিম্নলিখিত তথ্য সংগ্রহ করুন:
   - নাম
   - বয়স
   - ফোন নম্বর
   - বর্তমান সমস্যা (বাংলায়)

**নতুন রোগীর জন্য:**
১. create_patient_record ফাংশন ব্যবহার করে নতুন রেকর্ড তৈরি করুন
২. তাকে তার VIN নম্বর দিন এবং সংরক্ষণ করতে বলুন
৩. সমস্যা অনুযায়ী সঠিক বিভাগ সুপারিশ করুন

**পূর্ববর্তী রোগীর জন্য:**
১. তার চিকিৎসা ইতিহাস উল্লেখ করুন
২. নতুন উপসর্গ জিজ্ঞাসা করুন
৩. update_patient_visit ফাংশন ব্যবহার করে নতুন পরিদর্শন রেকর্ড করুন
৪. সঠিক বিভাগ সুপারিশ করুন

**বিভাগ সুপারিশ:**
- get_department ফাংশন ব্যবহার করুন
- রোগীকে বিভাগের নাম এবং বিবরণ জানান

**গুরুত্বপূর্ণ নিয়ম:**
- সর্বদা বাংলায় উত্তর দিন
- সম্পূর্ণ তথ্য সংগ্রহ করা পর্যন্ত এগিয়ে যাবেন না
- ডাটাবেসে রেকর্ড সংরক্ষণ নিশ্চিত করুন
- রোগীকে তাদের VIN নম্বর সংরক্ষণ করতে বলুন
- সহানুভূতিশীল এবং পেশাদার থাকুন
- সংক্ষিপ্ত উত্তর দিন, অতিরিক্ত কথা এড়িয়ে চলুন"""

WELCOME_MESSAGE = "আস্সালামুআলাইকুম! আমি আশা, এই হাসপাতালের AI রিসেপশনিস্ট। আপনাকে স্বাগতম। আপনি কি আগে এই হাসপাতালে এসেছেন?"

# ── Tools ──────────────────────────────────────────────────────────────────────

@llm.function_tool(description="নতুন রোগী তৈরি করুন এবং VIN নম্বর পান। সমস্ত তথ্য সংগ্রহের পরে কল করুন।")
async def create_patient_record(
    name: str,
    age: int,
    phone: str,
    email: str,
    problem: str,
    department: str,
) -> str:
    try:
        dept_info = get_department_for_problem(problem)
        dept_key = dept_info["key"] if department == "auto" else department
        result = create_patient(name, age, phone, email, problem, dept_key)
        return (
            f"রোগীর তথ্য সফলভাবে সংরক্ষিত হয়েছে। "
            f"নাম: {result['name']}, VIN নম্বর: {result['vin']}। "
            f"অনুগ্রহ করে এই VIN নম্বরটি সংরক্ষণ করুন।"
        )
    except Exception as e:
        logger.error(f"create_patient error: {e}")
        return "দুঃখিত, তথ্য সংরক্ষণে সমস্যা হয়েছে। আবার চেষ্টা করুন।"


@llm.function_tool(description="VIN নম্বর দিয়ে পূর্ববর্তী রোগী খুঁজুন।")
async def lookup_patient_by_vin(vin: str) -> str:
    try:
        patient = lookup_patient(vin)
        if not patient:
            return f"দুঃখিত, {vin} নম্বরের কোনো রোগী পাওয়া যায়নি। নতুন রোগী হিসেবে নিবন্ধন করবেন কি?"
        visits = patient.get("visit_history", [])
        return (
            f"রোগীর তথ্য পাওয়া গেছে। নাম: {patient['name']}, বয়স: {patient['age']}, "
            f"ফোন: {patient['phone']}। "
            f"মোট পরিদর্শন: {len(visits)} বার। "
            f"সর্বশেষ সমস্যা: {patient.get('problem', 'N/A')}। "
            f"এখন নতুন সমস্যা কী?"
        )
    except Exception as e:
        logger.error(f"lookup_patient error: {e}")
        return "রোগীর তথ্য খুঁজতে সমস্যা হয়েছে।"


@llm.function_tool(description="পূর্ববর্তী রোগীর নতুন পরিদর্শন রেকর্ড করুন।")
async def update_patient_visit(vin: str, new_problem: str, new_department: str) -> str:
    try:
        result = update_patient_after_visit(vin, new_problem, new_department)
        if not result:
            return f"VIN {vin} নম্বরের রোগী পাওয়া যায়নি।"
        return (
            f"{result['name']}-এর নতুন পরিদর্শন রেকর্ড হয়েছে। "
            f"সমস্যা: {new_problem}। বিভাগ: {new_department}।"
        )
    except Exception as e:
        logger.error(f"update_patient error: {e}")
        return "পরিদর্শন রেকর্ড করতে সমস্যা হয়েছে।"


@llm.function_tool(description="রোগীর সমস্যা অনুযায়ী সঠিক বিভাগ খুঁজুন।")
async def get_department(problem_bn: str) -> str:
    info = get_department_for_problem(problem_bn)
    return (
        f"সমস্যা '{problem_bn}'-এর জন্য প্রস্তাবিত বিভাগ: {info['name_bn']} "
        f"({info['description_bn']})।"
    )


TOOLS = [create_patient_record, lookup_patient_by_vin, update_patient_visit, get_department]

# ── Agent ──────────────────────────────────────────────────────────────────────

class AshaAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=INSTRUCTIONS,
            tools=TOOLS,
        )


# ── Server & entrypoint ────────────────────────────────────────────────────────

server = AgentServer()


@server.rtc_session(agent_name="asha-receptionist")
async def entrypoint(ctx: JobContext):
    logger.info(f"===== Agent Job Started — Room: {ctx.room.name} =====")

    try:
        create_patients_table()
    except Exception as e:
        logger.warning(f"Table setup warning: {e}")

    try:
        session = AgentSession(
            llm=google.realtime.RealtimeModel(
                voice="Aoede",
                instructions=INSTRUCTIONS,
                language="en-US",
                api_key=os.getenv("GOOGLE_API_KEY"),
            ),
            vad=silero.VAD.load(min_silence_duration=0.25),
        )

        await session.start(
            room=ctx.room,
            agent=AshaAgent(),
        )

        await session.generate_reply(
            instructions=WELCOME_MESSAGE,
        )

        logger.info("Asha session started — agent is live.")

    except Exception as e:
        logger.error(f"Agent error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    agents.cli.run_app(server)