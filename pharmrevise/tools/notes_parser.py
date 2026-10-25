"""Turns the Google-Docs markdown exports of the class notes into clean markdown + topic sections."""
import re


def clean_md(text):
    """Undo the escaping that the Docs export applies, so a small markdown renderer can read it."""
    t = text.replace("\r\n", "\n")
    t = t.replace("<!-- end list -->", "")
    t = re.sub(r"\\+([*<>_.\-#!\[\]()|`~+=&])", r"\1", t)
    t = t.replace("&#10;", "<br>")
    t = t.replace("\u00a0", " ")
    # headings like "## **Introduction**" or "### ***Signs***"
    t = re.sub(r"^(#{1,6})\s+\*{1,3}(.+?)\*{1,3}\s*$", r"\1 \2", t, flags=re.M)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip() + "\n"


TOPIC_RE = re.compile(r"^# (\d+)\. (.+)$", re.M)
SECTION_RE = re.compile(r"^## (.+)$", re.M)

SECTION_KEYS = [
    ("introduction", "intro"),
    ("etiology", "etiology"),
    ("aetiology", "etiology"),
    ("risk factor", "risk"),
    ("pathophysiology", "patho"),
    ("non-pharmacological", "nonpharm"),
    ("pharmacological management", "pharm"),
    ("signs", "signs"),
    ("symptoms", "symptoms"),
    ("treatment", "treatment"),
]


def section_key(heading):
    h = heading.lower()
    for needle, key in SECTION_KEYS:
        if h.startswith(needle) or needle in h:
            return key
    return None


CHANGED_RE = re.compile(
    r"\|[^\n]*\*\*What Changed from the Sixth Edition \(2021\)\*\*(.*?)\|\s*$", re.S | re.M
)


def split_changes(md):
    """Pulls the single-cell 'What Changed from the Sixth Edition' table out of a section."""
    m = CHANGED_RE.search(md)
    if not m:
        return md, ""
    body = m.group(1).strip()
    body = body.replace("<br>", "\n").strip()
    # remove the empty table header rows that precede the cell
    start = md.rfind("|  |", 0, m.start())
    cut_from = start if start != -1 and m.start() - start < 40 else m.start()
    rest = (md[:cut_from] + md[m.end():]).strip()
    return rest, body


def parse_topics(md):
    """Returns [{num, title, sections:{key: markdown}, extra:[(heading, md)], changes}]."""
    topics = []
    matches = list(TOPIC_RE.finditer(md))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(md)
        body = md[m.end():end]
        t = {"num": int(m.group(1)), "title": m.group(2).strip(), "sections": {}, "extra": [], "changes": ""}
        secs = list(SECTION_RE.finditer(body))
        for j, s in enumerate(secs):
            send = secs[j + 1].start() if j + 1 < len(secs) else len(body)
            content = body[s.end():send].strip()
            content, changes = split_changes(content)
            if changes:
                t["changes"] = (t["changes"] + "\n" + changes).strip()
            key = section_key(s.group(1))
            if key and key not in t["sections"]:
                t["sections"][key] = content
            elif content:
                t["extra"].append((s.group(1).strip(), content))
        topics.append(t)
    return topics


def parse_quickref(md):
    """Quick-reference doc: '## Condition' with '### Signs/Symptoms/Treatment' lists."""
    out = {}
    blocks = re.split(r"^## ", md, flags=re.M)[1:]
    for b in blocks:
        title, _, rest = b.partition("\n")
        parts = {}
        for sm in re.finditer(r"^### (.+?)\n(.*?)(?=^### |\Z)", rest, re.S | re.M):
            k = section_key(sm.group(1))
            if k:
                parts[k] = sm.group(2).strip()
        out[title.strip()] = parts
    return out
