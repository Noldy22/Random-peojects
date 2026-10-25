# PharmRevise TZ

Offline Android revision app for pharmacy in Tanzania, built around the Standard Treatment Guidelines and National Essential Medicines List (STG/NEMLIT).

- **Revise by disease:** overview, causes, risk factors, pathophysiology, signs and symptoms, investigations, non-drug and drug treatment, special groups, danger signs, pharmacist advice, exam pearls, and "what changed from 2021".
- **Revise by drug:** class, NEMLIT level, mechanism, uses, dosing, contraindications, side effects, drug–drug and food interactions, pregnancy/renal/hepatic notes, monitoring, counselling, storage.
- **Quizzes** (hand-written MCQs plus questions generated from the data), **spaced-repetition flashcards**, an **interaction checker**, **dose calculators**, a **NEMLIT 2021 browser**, **class notes offline**, bookmarks, personal notes, progress tracking, and dark mode.

## Layout

| Path | What it is |
| --- | --- |
| `content/drugs_*.txt` | Drug monographs (plain-text format, see the header of each file) |
| `content/diseases_from_notes.txt` | Additions to the disease topics built from the 7th-Edition (2026) class notes |
| `content/diseases_stg.txt` | Disease topics written from the 2021 STG (verify against the 7th Edition) |
| `content/mcqs.txt` | Hand-written MCQ bank |
| `content/notes/` | Class notes and STG extract — **not committed** (personal material); needed for a full build |
| `app/` | The web app (HTML/CSS/JS) that runs inside the Android WebView |
| `android/` | Android manifest, resources and `MainActivity` |
| `tools/` | Data compiler (`build_data.py`), notes/NEMLIT parsers, icon generator |

## Build

Needs Python 3 with Pillow, a JDK, and the Debian/Ubuntu Android tools:

```sh
sudo apt-get install aapt apksigner android-sdk-platform-23 dalvik-exchange zipalign
./build.sh            # → build/PharmRevise-TZ-v<version>.apk
```

`build.sh` generates a signing key in `keystore/` on first run. Keep that key: later versions install over the old one only if they are signed with the same key. The key is not committed.

To edit content, change the files in `content/` and rebuild. `tools/build_data.py` prints warnings for unknown drug ids or malformed entries.

> Study aid only. Always confirm doses and recommendations against the current STG/NEMLIT and product information.
