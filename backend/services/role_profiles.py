"""
Role category detection and interviewer guidance.

This module turns a free-form role name (e.g. "Account Executive", "Backend
Engineer", "HR Generalist") into a hiring domain and supplies the LLM with a
role-appropriate interviewer *persona* and *focus areas*. This is guidance for
the model to generate its own questions dynamically — it is NOT a bank of
hardcoded questions.
"""
from typing import Dict

# Category -> interviewer persona, focus areas, and evaluation signals.
# `focus` is a comma-separated list; the first items are treated as the most
# central competencies when composing the degraded (no-LLM) safety-net prompt.
CATEGORY_GUIDANCE: Dict[str, Dict[str, str]] = {
    "IT": {
        "persona": "a senior engineering manager and technical interviewer",
        "focus": "system design, data structures and algorithms, architecture trade-offs, scalability and reliability, debugging, and ownership of technical projects",
        "signals": "technical depth, correctness, design trade-offs, and measurable engineering impact such as latency, throughput, or reliability",
    },
    "Sales": {
        "persona": "a sales hiring manager (VP of Sales)",
        "focus": "prospecting and lead generation, discovery and qualification, objection handling, closing technique, pipeline and quota management, CRM hygiene, and consultative selling",
        "signals": "deal ownership, quota attainment, discovery rigor, objection handling, and quantified revenue impact",
    },
    "HR": {
        "persona": "a people and HR hiring manager",
        "focus": "employee relations, conflict resolution, recruiting and onboarding, compliance, performance management, and stakeholder communication",
        "signals": "empathy, sound judgment, policy knowledge, confidentiality, and measurable people outcomes such as retention or time-to-hire",
    },
    "Finance": {
        "persona": "a finance hiring manager (controller)",
        "focus": "financial modeling, forecasting, variance analysis, reconciliations, controls and compliance, and data-driven decision support",
        "signals": "analytical rigor, numerical accuracy, attention to detail, and the business impact of financial insights",
    },
    "Admin": {
        "persona": "an operations and office manager",
        "focus": "calendar and scheduling management, prioritization under competing demands, stakeholder coordination, vendor and office operations, and clear communication",
        "signals": "organization, prioritization under pressure, communication, and reliability",
    },
    "General": {
        "persona": "an experienced hiring manager",
        "focus": "role-relevant competencies, relevant past experience, problem solving, and measurable outcomes",
        "signals": "relevance, clarity, depth, answer structure, and quantified impact",
    },
}

# Ordered keyword table. IT is checked last because generic words like
# "manager" / "analyst" should prefer their business domain when present.
_ROLE_KEYWORDS = [
    ("Sales", ["sales", "account executive", "account manager", "sdr", "business development",
               "customer success", "pre-sales", "presales", "revenue", "quota", "sales development"]),
    ("HR", ["human resources", " hr ", "hr ", " hr", "recruiter", "recruiting", "talent",
            "people ops", "people operations", "compensation", "benefits", "hris"]),
    ("Finance", ["finance", "financial", "accountant", "accounting", "bookkeeper", "payroll",
                 "audit", "auditor", "treasury", "fp&a", "controller", "tax"]),
    ("Admin", ["administrative", "office manager", "executive assistant", "receptionist",
               "data entry", "secretary", "office coordinator", "front desk"]),
    ("IT", ["engineer", "developer", "software", "backend", "frontend", "full stack", "fullstack",
            "devops", "sre", "qa ", "quality assurance", "data scientist", "data science",
            "machine learning", " ml ", "architect", "programmer", "security engineer", "cloud",
            "database", "mobile", "android", "ios", "web developer", "it support", "sysadmin"]),
]

# Normalization for an explicit category passed from the UI/select menu.
_EXPLICIT_SYNONYMS = {
    "it": "IT",
    "information technology": "IT",
    "tech": "IT",
    "technology": "IT",
    "engineering": "IT",
    "software": "IT",
    "hr": "HR",
    "human resources": "HR",
    "people": "HR",
    "sales": "Sales",
    "finance": "Finance",
    "accounting": "Finance",
    "admin": "Admin",
    "administration": "Admin",
    "administrative": "Admin",
    "operations": "Admin",
    "general": "General",
}


def detect_role_category(role_name: str, explicit_category: str = None) -> str:
    """
    Resolves a role to one of the known categories.

    An explicit category (e.g. the UI's "Sector / Category" selection) wins when
    it maps to a known domain; otherwise the role name is matched by keyword, and
    anything unrecognized falls back to "General".
    """
    if explicit_category:
        key = _EXPLICIT_SYNONYMS.get(explicit_category.strip().lower())
        if key:
            return key
        # Already a canonical key?
        if explicit_category.strip() in CATEGORY_GUIDANCE:
            return explicit_category.strip()

    name = f" {(role_name or '').lower()} "
    for category, keywords in _ROLE_KEYWORDS:
        if any(kw in name for kw in keywords):
            return category
    return "General"


def get_category_guidance(category: str) -> Dict[str, str]:
    """Returns the persona/focus/signals guidance for a category (safe default)."""
    return CATEGORY_GUIDANCE.get(category, CATEGORY_GUIDANCE["General"])
