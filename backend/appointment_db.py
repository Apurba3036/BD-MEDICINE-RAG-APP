# -*- coding: utf-8 -*-
"""
appointment_db.py
-----------------
Patient database CRUD for the Asha voice appointment agent.
Table: patients
"""

import psycopg2
import os
import json
import random
import string
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# --- Department info ---
DEPARTMENTS = {
    "cardiology": {
        "name_bn": "কার্ডিওলজি",
        "description_bn": "হার্ট ও রক্তনালীর সমস্যা"
    },
    "neurology": {
        "name_bn": "নিউরোলজি",
        "description_bn": "স্নায়ুতন্ত্র ও মস্তিষ্কের সমস্যা"
    },
    "orthopedics": {
        "name_bn": "অর্থোপেডিক্স",
        "description_bn": "হাড়, জয়েন্ট ও মাংসপেশীর সমস্যা"
    },
    "gastroenterology": {
        "name_bn": "গ্যাস্ট্রোএন্টেরোলজি",
        "description_bn": "পাকস্থলী ও হজম সমস্যা"
    },
    "general": {
        "name_bn": "জেনারেল মেডিসিন",
        "description_bn": "সাধারণ স্বাস্থ্য সমস্যা"
    },
    "dermatology": {
        "name_bn": "ডার্মাটোলজি",
        "description_bn": "ত্বকের সমস্যা"
    },
    "ophthalmology": {
        "name_bn": "চক্ষু বিভাগ",
        "description_bn": "চোখের সমস্যা"
    },
    "ent": {
        "name_bn": "নাক-কান-গলা বিভাগ",
        "description_bn": "নাক, কান ও গলার সমস্যা"
    },
    "psychiatry": {
        "name_bn": "মনোরোগ বিভাগ",
        "description_bn": "মানসিক স্বাস্থ্য সমস্যা"
    },
    "gynecology": {
        "name_bn": "স্ত্রীরোগ বিভাগ",
        "description_bn": "মহিলাদের স্বাস্থ্য সমস্যা"
    }
}

DEPARTMENT_MAPPING = {
    "হার্ট": "cardiology",
    "বুকে ব্যথা": "cardiology",
    "বুকে চাপ": "cardiology",
    "বুক ধড়ফড়": "cardiology",
    "মাথাব্যথা": "neurology",
    "মাথা ঘোরা": "neurology",
    "স্ট্রোক": "neurology",
    "খিঁচুনি": "neurology",
    "হাড়": "orthopedics",
    "জয়েন্ট": "orthopedics",
    "হাঁটু": "orthopedics",
    "কোমর ব্যথা": "orthopedics",
    "পেটব্যথা": "gastroenterology",
    "বমি": "gastroenterology",
    "হজম": "gastroenterology",
    "ডায়রিয়া": "gastroenterology",
    "চর্ম": "dermatology",
    "ত্বক": "dermatology",
    "চুলকানি": "dermatology",
    "চোখ": "ophthalmology",
    "দৃষ্টি": "ophthalmology",
    "কান": "ent",
    "নাক": "ent",
    "গলা": "ent",
    "মানসিক": "psychiatry",
    "বিষণ্নতা": "psychiatry",
    "মহিলা": "gynecology",
    "মাসিক": "gynecology",
    "গর্ভাবস্থা": "gynecology",
}


def _get_conn():
    return psycopg2.connect(DATABASE_URL)


def generate_vin() -> str:
    """Generate a unique VIN like VIN382910"""
    digits = ''.join(random.choices(string.digits, k=6))
    return f"VIN{digits}"


def create_patients_table():
    """Create the patients table if it doesn't exist."""
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id            SERIAL PRIMARY KEY,
            vin           VARCHAR(12) UNIQUE NOT NULL,
            name          VARCHAR(255),
            age           INTEGER,
            phone         VARCHAR(30),
            email         VARCHAR(255),
            problem       TEXT,
            department    VARCHAR(100),
            visit_history JSONB DEFAULT '[]'::jsonb,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    conn.commit()
    cursor.close()
    conn.close()
    print("Patients table ready.")


def create_patient(name: str, age: int, phone: str, email: str, problem: str, department: str) -> dict:
    """Create a new patient record and return patient info with VIN."""
    conn = _get_conn()
    cursor = conn.cursor()
    
    # Ensure unique VIN
    while True:
        vin = generate_vin()
        cursor.execute("SELECT id FROM patients WHERE vin = %s", (vin,))
        if not cursor.fetchone():
            break

    from datetime import timezone
    first_visit = {
        "date": datetime.now(timezone.utc).isoformat(),
        "problem": problem,
        "department": department
    }
    
    cursor.execute("""
        INSERT INTO patients (vin, name, age, phone, email, problem, department, visit_history)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        RETURNING id, vin, created_at
    """, (vin, name, age, phone, email, problem, department, json.dumps([first_visit])))
    
    row = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()
    
    return {
        "id": row[0],
        "vin": row[1],
        "name": name,
        "age": age,
        "phone": phone,
        "email": email,
        "problem": problem,
        "department": department,
        "created_at": row[2].isoformat() if row[2] else None
    }


def lookup_patient(vin: str) -> dict | None:
    """Look up a patient by VIN number."""
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, vin, name, age, phone, email, problem, department, visit_history, created_at
        FROM patients WHERE vin = %s
    """, (vin.strip().upper(),))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row[0],
        "vin": row[1],
        "name": row[2],
        "age": row[3],
        "phone": row[4],
        "email": row[5],
        "problem": row[6],
        "department": row[7],
        "visit_history": row[8] if row[8] else [],
        "created_at": row[9].isoformat() if row[9] else None
    }


def update_patient_after_visit(vin: str, new_problem: str, new_department: str) -> dict | None:
    """Add a new visit entry to an existing patient's history."""
    patient = lookup_patient(vin)
    if not patient:
        return None
    
    visit_history = patient.get("visit_history", [])
    from datetime import timezone
    visit_history.append({
        "date": datetime.now(timezone.utc).isoformat(),
        "problem": new_problem,
        "department": new_department
    })
    
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE patients
        SET problem = %s, department = %s, visit_history = %s::jsonb
        WHERE vin = %s
        RETURNING id
    """, (new_problem, new_department, json.dumps(visit_history), vin.strip().upper()))
    conn.commit()
    cursor.close()
    conn.close()
    
    patient["problem"] = new_problem
    patient["department"] = new_department
    patient["visit_history"] = visit_history
    return patient


def get_department_for_problem(problem_bn: str) -> dict:
    """Return department key and Bengali name for a given Bengali problem description."""
    problem_lower = problem_bn.lower()
    for keyword, dept_key in DEPARTMENT_MAPPING.items():
        if keyword in problem_lower:
            dept = DEPARTMENTS.get(dept_key, DEPARTMENTS["general"])
            return {
                "key": dept_key,
                "name_bn": dept["name_bn"],
                "description_bn": dept["description_bn"]
            }
    # Default to general
    dept = DEPARTMENTS["general"]
    return {
        "key": "general",
        "name_bn": dept["name_bn"],
        "description_bn": dept["description_bn"]
    }


if __name__ == "__main__":
    create_patients_table()
    print("Table created. Running quick test...")
    p = create_patient("মোহাম্মদ রহিম", 45, "01712345678", "", "বুকে ব্যথা", "cardiology")
    print("Created:", p)
    found = lookup_patient(p["vin"])
    print("Found:", found)
