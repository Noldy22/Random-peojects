"""Best-effort parser for the NEMLIT 2021 table text (as extracted from the STG PDF).

The PDF text loses table structure: rows wrap and neighbouring rows merge. We join everything
into one stream, then cut it at standalone level letters (A, B, C, D, S). Each piece is
"[section heading] Name Dosage-forms", which we split on the first dosage-form keyword.
"""
import re

FORM_WORDS = (
    "Tablet|Tablets|Capsule|Capsules|Injection|Injectable|Syrup|Suspension|Oral|Cream|Ointment|"
    "Gel|Drops|Eye|Ear|Nasal|Inhalation|Inhaler|Solution|Powder|Suppositor|Suppositories|Pessar|"
    "Lotion|Spray|Infusion|Liquid|Granules|Sachet|Patch|Patches|Paint|Cylinder|Implant|Vaginal|"
    "Rectal|Shampoo|Elixir|Emulsion|Lozenge|Chewable|Dispersible|Mouth|Topical|Concentrate|"
    "Transdermal|Intra|Device|Kit|Vial|Ampoule|Pre-filled|Prefilled|Film|Respules|Nebuli|IUD|"
    "Rod|Bottle|Bag|Dental|Platelets|Packed|Whole|Fresh|Medical|Recto"
)
SECTION_RE = re.compile(r"(?<![\d.])(\d{1,2}(?:\.\d{1,2}){0,3})\\?\.?\s+([A-Z][A-Za-z ,()&/'’\-]{3,90}?)(?=\s+[A-Z][a-z])")
FORM_RE = re.compile(r"\b(" + FORM_WORDS + r")\b", re.I)


HEADING_WORDS = {
    "anaesthetics", "anasthetics", "oxygen", "medicines", "medicine", "analgesics/antagonists", "used",
    "for", "in", "and", "the", "of", "heart", "failure", "antiseptics", "ocular", "preparations",
    "agents", "other", "antibiotics", "group", "disorders", "anxiety", "drugs", "specific", "general",
    "local", "inhalational", "injectable", "pre-medication", "antidotes", "(specific)", "(non-specific)",
    "anti-", "platelet", "anti-platelet", "treatment", "therapy", "solutions", "vitamins", "minerals",
}


def clean_name(name):
    # drop everything up to the last section number that leaked into the name
    m = list(re.finditer(r"\d{1,2}(?:\.\d{1,2}){1,3}\.?\s", name))
    if m:
        name = name[m[-1].end():]
    words = name.split()
    # drop leading heading words (keep at least one word)
    while len(words) > 1 and words[0].lower() in HEADING_WORDS:
        words.pop(0)
    # a heading title may still sit before the real name: "Inhalational Medicines Halothane"
    for k in range(len(words) - 1, 0, -1):
        if words[k - 1].lower() in ("medicines", "agents", "antibiotics", "anaesthetics", "antiseptics", "preparations", "failure", "disorders", "oxygen"):
            words = words[k:]
            break
    return " ".join(words).strip(" ,;:")


def parse(text):
    start = text.find("1.0 Anasthetics")
    end = text.find("PART II THE STANDARD TREATMENT GUIDELINE")
    body = text[start:end]
    body = re.sub(r"^\s*[ivxlc]*\d*\s*$", " ", body, flags=re.M)  # page numbers
    body = re.sub(r"\s+", " ", body)

    pieces = re.split(r"\s([ABCDS])(?=\s|$)", " " + body + " ")
    items, section, sub = [], "", ""
    for i in range(0, len(pieces) - 1, 2):
        chunk, level = pieces[i].strip(), pieces[i + 1]
        # peel off any section headings at the start (there may be several)
        while True:
            m = SECTION_RE.match(chunk)
            if not m:
                break
            num, title = m.group(1), m.group(2).strip()
            if num.count(".") == 0 or num.endswith(".0"):
                section, sub = f"{num.split('.')[0]}. {title}", ""
            else:
                sub = f"{num} {title}"
            chunk = chunk[m.end():].strip()
        # a heading can also sit mid-chunk when rows merged
        mm = list(SECTION_RE.finditer(chunk))
        for m in mm:
            if m.start() > 0 and FORM_RE.search(chunk[:m.start()]):
                num, title = m.group(1), m.group(2).strip()
                tail = chunk[m.end():].strip()
                if num.count(".") == 0 or num.endswith(".0"):
                    section, sub = f"{num.split('.')[0]}. {title}", ""
                else:
                    sub = f"{num} {title}"
                chunk = tail
                break
        f = FORM_RE.search(chunk)
        if not f or f.start() < 2:
            continue
        name = chunk[: f.start()].strip(" ,;")
        forms = chunk[f.start():].strip(" ,;")
        # merged rows: the name may be duplicated ("Miconazole Miconazole Oral gel")
        words = name.split()
        if len(words) >= 2 and len(words) % 2 == 0 and words[: len(words) // 2] == words[len(words) // 2:]:
            name = " ".join(words[: len(words) // 2])
        name = re.sub(r"^[^()]*\)\s*", "", name)
        name = clean_name(name)
        if not name or len(name) > 70 or not re.match(r"[A-Za-z0-9]", name):
            continue
        items.append({"name": name, "forms": forms[:220], "level": level, "section": section, "sub": sub})
    return items
