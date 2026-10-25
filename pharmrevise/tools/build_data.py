"""Compiles content/*.txt, the class notes and the NEMLIT into app/data/*.js (offline data for the app).

Run from anywhere: python3 tools/build_data.py
"""
import datetime
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONTENT = os.path.join(ROOT, "content")
NOTES = os.path.join(CONTENT, "notes")
OUT = os.path.join(ROOT, "app", "data")
sys.path.insert(0, HERE)

import nemlit_parser  # noqa: E402
from notes_parser import clean_md, parse_quickref, parse_topics  # noqa: E402

LIST_KEYS = {
    "uses", "dose", "ci", "cautions", "se", "ddi", "food", "monitor", "advice", "pearls",
    "causes", "risk", "features", "investigations", "nonpharm", "treatment", "special",
    "complications", "danger",
}
TRIPLE_KEYS = {"ddi", "food"}
warnings = []


def parse_blocks(path, kind):
    """Parses the '=== kind: id' text format into a list of dicts."""
    items, cur, key = [], None, None
    for n, raw in enumerate(open(path, encoding="utf-8"), 1):
        line = raw.rstrip("\n")
        if not line.strip() or line.lstrip().startswith("#") and not line.startswith("- "):
            continue
        m = re.match(r"^=== (\w+): ([\w-]+)\s*$", line)
        if m:
            if m.group(1) != kind:
                raise SystemExit(f"{path}:{n}: expected {kind}, got {m.group(1)}")
            cur = {"id": m.group(2)}
            items.append(cur)
            key = None
            continue
        if cur is None:
            continue
        if line.startswith("- "):
            if key is None or not isinstance(cur.get(key), list):
                raise SystemExit(f"{path}:{n}: list item outside a list key")
            item = line[2:].strip()
            if key in TRIPLE_KEYS:
                parts = [p.strip() for p in item.split("::")]
                if len(parts) == 1:
                    item = {"note": parts[0]}  # e.g. "None significant"
                else:
                    if len(parts) > 3:
                        warnings.append(f"{path}:{n}: interaction has >3 parts: {item[:60]}")
                    parts = (parts + ["", ""])[:3]
                    item = {"with": parts[0], "effect": parts[1], "action": parts[2]}
            cur[key].append(item)
            continue
        m = re.match(r"^([a-z]+):\s?(.*)$", line)
        if m:
            key, val = m.group(1), m.group(2).strip()
            if val == "" and (key in LIST_KEYS or key not in cur):
                cur[key] = []
            else:
                cur[key] = val
            continue
        raise SystemExit(f"{path}:{n}: cannot parse line: {line[:80]}")
    return items


def load_drugs():
    drugs = []
    for f in sorted(os.listdir(CONTENT)):
        if f.startswith("drugs_") and f.endswith(".txt"):
            drugs += parse_blocks(os.path.join(CONTENT, f), "drug")
    ids = [d["id"] for d in drugs]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise SystemExit(f"duplicate drug ids: {dupes}")
    for d in drugs:
        for req in ("name", "class", "group", "moa", "uses", "dose", "se", "advice"):
            if not d.get(req):
                warnings.append(f"drug {d['id']} missing {req}")
    return drugs


def note_title(fname):
    return fname.rsplit(".", 1)[0].replace("_", " ").replace("  ", " ").strip()


NOTE_GROUPS = [
    ("Forensic", "Forensic Pharmacy & Law"),
    ("STG_2021", "STG / NEMLIT 2021 (extract)"),
    ("Cardiovascular_Disorders", "Therapeutics — 7th Ed. (2026) notes"),
    ("Pulmonary_GI", "Therapeutics — 7th Ed. (2026) notes"),
    ("Endocrine_Musculo", "Therapeutics — 7th Ed. (2026) notes"),
    ("Renal_RRT", "Therapeutics — 7th Ed. (2026) notes"),
    ("Hematological_Cancer", "Therapeutics — 7th Ed. (2026) notes"),
    ("Quick_Reference", "Therapeutics — 7th Ed. (2026) notes"),
]


def load_notes():
    if not os.path.isdir(NOTES):
        warnings.append("content/notes missing — notes library and 7th-Ed. disease text will be empty")
        return {}, []
    texts, library = {}, []
    for f in sorted(os.listdir(NOTES)):
        path = os.path.join(NOTES, f)
        raw = open(path, encoding="utf-8").read()
        stem = f.rsplit(".", 1)[0]
        if f.endswith(".md"):
            md = clean_md(raw)
        else:
            md = stg_extract_md(raw)
        texts[stem] = md
        group = next((g for k, g in NOTE_GROUPS if stem.startswith(k)), "Therapeutics — earlier notes (6th Ed. 2021)")
        library.append({"id": stem, "title": note_title(f), "group": group, "md": md})
    order = [g for _, g in NOTE_GROUPS]
    library.sort(key=lambda n: (order.index(n["group"]) if n["group"] in order else 99, n["title"]))
    return texts, library


def stg_extract_md(text):
    """The STG 2021 text we have: foreword + table of contents + Chapter 1 (emergency conditions)."""
    start = text.find("PART II THE STANDARD TREATMENT GUIDELINE")
    body = text[start:] if start != -1 else text
    body = re.sub(r"^\s*\d{1,3}\s*$", "", body, flags=re.M)  # page numbers
    body = re.sub(r"^(1\.\d{1,2}(?:\.\s?\d)? [A-Z][^\n]{2,80})", r"## \1", body, flags=re.M)
    body = re.sub(r"\\([<>\[\]*])", r"\1", body)
    head = (
        "# STG/NEMLIT 6th Edition (2021) — Chapter 1 extract\n\n"
        "> Verbatim text of Chapter 1 *Approach to Patients with Emergency Conditions* as extracted from your "
        "Drive copy of the 2021 STG (only the first part of the PDF could be read). The NEMLIT tab holds the full "
        "2021 medicines list.\n\n"
    )
    return head + re.sub(r"\n{3,}", "\n\n", body)


def load_diseases(drug_ids, notes_text):
    diseases = []
    qref = parse_quickref(notes_text.get("Quick_Reference_Summary_Signs_Symptoms_Treatment", ""))
    topics_cache = {}

    for d in parse_blocks(os.path.join(CONTENT, "diseases_from_notes.txt"), "disease"):
        fname, num = d["notes"].split("#")
        if fname not in topics_cache:
            topics_cache[fname] = {t["num"]: t for t in parse_topics(notes_text.get(fname, ""))}
        t = topics_cache[fname].get(int(num))
        d["source"] = "notes7"
        d["notesFile"] = fname
        if t:
            s = t["sections"]
            d["intro"] = s.get("intro", "")
            d["etiologyMd"] = s.get("etiology", "")
            d["riskMd"] = s.get("risk", "")
            d["pathoMd"] = s.get("patho", "")
            d["nonpharmMd"] = s.get("nonpharm", "")
            d["pharmMd"] = s.get("pharm", "") or "\n\n".join(c for h, c in t["extra"] if "harmac" in h)
            d["changes"] = t["changes"]
        else:
            warnings.append(f"disease {d['id']}: notes topic {d['notes']} not found")
        q = qref.get(d.get("quickref", ""), {})
        d["signsMd"] = q.get("signs", "")
        d["symptomsMd"] = q.get("symptoms", "")
        diseases.append(d)

    for d in parse_blocks(os.path.join(CONTENT, "diseases_stg.txt"), "disease"):
        d.setdefault("source", "stg2021")
        diseases.append(d)

    for d in diseases:
        d["aka"] = [a.strip() for a in d.get("aka", "").split(";") if a.strip()]
        d["drugs"] = [x.strip() for x in d.get("drugs", "").split(",") if x.strip()]
        bad = [x for x in d["drugs"] if x not in drug_ids]
        if bad:
            warnings.append(f"disease {d['id']}: unknown drug ids {bad}")
            d["drugs"] = [x for x in d["drugs"] if x in drug_ids]
    return diseases


def load_mcqs(valid_topics):
    qs = parse_blocks(os.path.join(CONTENT, "mcqs.txt"), "mcq")
    for q in qs:
        q["w"] = [w.strip() for w in q["w"].split("|")]
        if q["topic"] not in valid_topics:
            warnings.append(f"mcq {q['id']}: unknown topic {q['topic']}")
    return qs


def write_js(name, var, data):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"window.{var}=")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    return os.path.getsize(path)


def main():
    drugs = load_drugs()
    drug_ids = {d["id"] for d in drugs}
    notes_text, library = load_notes()
    diseases = load_diseases(drug_ids, notes_text)

    by_drug = {}
    for dz in diseases:
        for x in dz["drugs"]:
            by_drug.setdefault(x, []).append(dz["id"])
    for d in drugs:
        d["diseases"] = by_drug.get(d["id"], [])

    stg_raw = ""
    stg_path = os.path.join(NOTES, "STG_2021_extract.txt")
    if os.path.exists(stg_path):
        stg_raw = open(stg_path, encoding="utf-8").read()
    nemlit = nemlit_parser.parse(stg_raw) if stg_raw else []

    mcqs = load_mcqs(drug_ids | {d["id"] for d in diseases} | {"law"})
    meta = {
        "built": datetime.date.today().isoformat(),
        "counts": {"drugs": len(drugs), "diseases": len(diseases), "nemlit": len(nemlit),
                   "notes": len(library), "mcqs": len(mcqs)},
    }
    sizes = {
        "drugs.js": write_js("drugs.js", "PR_DRUGS", drugs),
        "diseases.js": write_js("diseases.js", "PR_DISEASES", diseases),
        "nemlit.js": write_js("nemlit.js", "PR_NEMLIT", nemlit),
        "notes.js": write_js("notes.js", "PR_NOTES", library),
        "mcqs.js": write_js("mcqs.js", "PR_MCQS", mcqs),
        "meta.js": write_js("meta.js", "PR_META", meta),
    }
    for w in warnings:
        print("WARN", w)
    print("data:", meta["counts"], {k: f"{v // 1024} KB" for k, v in sizes.items()})


if __name__ == "__main__":
    main()
