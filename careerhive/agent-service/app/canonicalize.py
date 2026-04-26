import re

CANONICAL_RULES = [
    (re.compile(r"artificial intelligence|machine learning|nlp|chatbot|llm", re.I), "ai"),
    (re.compile(r"software engineer|software engineering|software development", re.I), "software"),
    (re.compile(r"cloud computing|cloud platform|cloud api|cloud service", re.I), "cloud"),
    (re.compile(r"web development|web app|web application", re.I), "web"),
    (re.compile(r"mobile development|mobile app|android|ios", re.I), "mobile"),
    (re.compile(r"system design|architecture", re.I), "system design"),
    (re.compile(r"node\.js|nodejs", re.I), "node"),
    (re.compile(r"react\.js|reactjs", re.I), "react"),
    (re.compile(r"restful|rest api", re.I), "rest"),
    (re.compile(r"amazon web services", re.I), "aws"),
    (re.compile(r"google cloud platform|google cloud", re.I), "gcp"),
]


def normalize_skill_token(raw) -> str:
    value = str(raw or "").strip().lower()
    if not value:
        return ""
    for pattern, canonical in CANONICAL_RULES:
        if pattern.search(value):
            return canonical
    return value


def canonicalize_skill_list(skills) -> list[str]:
    if not isinstance(skills, list):
        return []
    seen = []
    for s in skills:
        token = normalize_skill_token(s)
        if token and token not in seen:
            seen.append(token)
    return seen
