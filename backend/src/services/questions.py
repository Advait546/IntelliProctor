"""Conversion between the frontend question shape and the relational schema,
plus objective grading (section 15.1).

Frontend shape (Frontend/src/constants/mockData.js / QuestionCreationPage):
    {id, type: MCQ|MSQ|TrueFalse|FillBlank|Subjective, text,
     optionA..optionD, correctAnswer: "B" | ["A","C"] | "text", marks, difficulty, topic}

DB shape (questions / question_bank_items):
    question_type: mcq|msq|truefalse|fillblank|subjective
    options: ["opt A text", ...]   (option keys are positional letters A, B, C, ...)
    correct_answer: ["B"] / ["A", "C"] / ["expected text"] / []
"""

from __future__ import annotations

import random
from decimal import Decimal

from ..errors import ApiError

LETTERS = "ABCDEFGH"
TYPE_TO_DB = {"MCQ": "mcq", "MSQ": "msq", "TRUEFALSE": "truefalse", "FILLBLANK": "fillblank", "SUBJECTIVE": "subjective"}
TYPE_TO_UI = {"mcq": "MCQ", "msq": "MSQ", "truefalse": "TrueFalse", "fillblank": "FillBlank", "subjective": "Subjective"}
OBJECTIVE_TYPES = {"mcq", "msq", "truefalse", "fillblank"}


def _norm_type(raw: str | None) -> str:
    key = (raw or "MCQ").replace("_", "").replace("-", "").replace(" ", "").upper()
    if key in ("TF", "BOOLEAN"):
        key = "TRUEFALSE"
    if key not in TYPE_TO_DB:
        raise ApiError(422, "INVALID_QUESTION", f"Unsupported question type '{raw}'")
    return TYPE_TO_DB[key]


def _as_list(value) -> list:
    if value is None or value == "":
        return []
    if isinstance(value, (list, tuple)):
        return [str(v).strip() for v in value if str(v).strip() != ""]
    text = str(value).strip()
    if "," in text and all(part.strip().upper() in LETTERS for part in text.split(",")):
        return [part.strip().upper() for part in text.split(",")]
    return [text]


def from_ui(q: dict) -> dict:
    """Validate a frontend question and return DB column values."""
    qtype = _norm_type(q.get("type") or q.get("questionType"))
    text = (q.get("text") or q.get("questionText") or "").strip()
    if not text:
        raise ApiError(422, "INVALID_QUESTION", "Question text is required")

    if isinstance(q.get("options"), list) and q["options"]:
        options = [str(o.get("text") if isinstance(o, dict) else o) for o in q["options"]]
    else:
        options = [q.get(f"option{L}") for L in "ABCD"]
        options = [str(o) for o in options if o is not None and str(o).strip() != ""]

    correct = _as_list(q.get("correctAnswer", q.get("correct_answer")))

    if qtype in ("mcq", "msq"):
        if len(options) < 2:
            raise ApiError(422, "INVALID_QUESTION", f"'{text[:40]}' needs at least two options")
        correct = [c.upper() for c in correct]
        valid = set(LETTERS[: len(options)])
        if not correct or any(c not in valid for c in correct):
            raise ApiError(422, "INVALID_QUESTION", f"'{text[:40]}' has an invalid correct answer")
        if qtype == "mcq":
            correct = correct[:1]
    elif qtype == "truefalse":
        options = ["True", "False"]
        mapped = []
        for c in correct:
            cu = c.upper()
            mapped.append("A" if cu in ("A", "TRUE", "T") else "B" if cu in ("B", "FALSE", "F") else cu)
        correct = mapped[:1] or ["A"]
    elif qtype == "fillblank":
        options = None
        if not correct:
            raise ApiError(422, "INVALID_QUESTION", f"'{text[:40]}' needs an expected answer")
    else:  # subjective -- graded manually
        options = None

    try:
        marks = int(float(q.get("marks", 1) or 1))
    except (TypeError, ValueError):
        marks = 1
    return {
        "question_text": text,
        "question_type": qtype,
        "options": options,
        "correct_answer": correct,
        "marks": max(0, marks),
        "difficulty": (q.get("difficulty") or "Medium").strip().capitalize(),
        "topic": (q.get("topic") or None),
    }


def to_ui(row, *, include_answer: bool, qid=None) -> dict:
    """DB row (Question or QuestionBankItem) -> frontend shape."""
    qid = qid or getattr(row, "question_id", None) or getattr(row, "item_id", None)
    out = {
        "id": str(qid),
        "type": TYPE_TO_UI.get(row.question_type, "MCQ"),
        "text": row.question_text,
        "marks": row.marks,
        "difficulty": row.difficulty,
        "topic": row.topic,
    }
    options = row.options or []
    for i, L in enumerate("ABCD"):
        out[f"option{L}"] = options[i] if i < len(options) else ""
    out["options"] = [{"key": LETTERS[i], "text": t} for i, t in enumerate(options)]
    if include_answer:
        correct = row.correct_answer or []
        out["correctAnswer"] = correct if row.question_type == "msq" else (correct[0] if correct else "")
    return out


def shuffled_options(ui_question: dict, seed: str) -> dict:
    """Per-candidate option shuffling: keys stay the original letters (so grading
    is unaffected) but presentation order changes."""
    if ui_question["type"] not in ("MCQ", "MSQ") or len(ui_question.get("options", [])) < 2:
        return ui_question
    opts = list(ui_question["options"])
    random.Random(seed).shuffle(opts)
    return {**ui_question, "options": opts}


def normalize_answer(question_type: str, answer) -> tuple[list | None, str | None]:
    """Candidate answer payload -> (selected_options, subjective_text)."""
    if answer is None or answer == "" or answer == []:
        return None, None
    if question_type in ("mcq", "truefalse"):
        val = answer[0] if isinstance(answer, list) else answer
        return [str(val).strip().upper()], None
    if question_type == "msq":
        vals = answer if isinstance(answer, list) else str(answer).split(",")
        return sorted({str(v).strip().upper() for v in vals if str(v).strip()}), None
    text = answer if isinstance(answer, str) else str(answer)
    return None, text


def answer_to_ui(question_type: str, selected: list | None, text: str | None):
    if question_type in ("mcq", "truefalse"):
        return (selected or [""])[0]
    if question_type == "msq":
        return selected or []
    return text or ""


def grade(question, selected: list | None, text: str | None, negative_marking: float) -> Decimal | None:
    """Returns marks awarded, or None for subjective (manual review)."""
    qtype = question.question_type
    marks = Decimal(question.marks)
    if qtype == "subjective":
        return None
    correct = question.correct_answer or []
    if qtype == "fillblank":
        if not text or not text.strip():
            return Decimal(0)
        ok = text.strip().casefold() in {c.strip().casefold() for c in correct}
    else:
        if not selected:
            return Decimal(0)  # unattempted: no negative marking
        ok = sorted(s.upper() for s in selected) == sorted(c.upper() for c in correct)
    if ok:
        return marks
    return -Decimal(str(negative_marking or 0))
