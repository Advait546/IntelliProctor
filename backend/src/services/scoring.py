"""Authoritative suspicion-scoring engine (BACKEND_ARCHITECTURE.md section 5).

Mandatory policy -- do not change without an approved policy amendment:

    +10   per completed group of THREE qualifying sideways head turns
    +50   per distinct accepted book-detection episode
    +100  per distinct accepted phone-detection episode
    0 <= S <= 1000 (hard ceiling: S_new = min(1000, S + dS))
    Suspicious  <=>  S >= 100

Every other signal (tab switching, candidate absence, multiple faces, pitch/roll
deviation, manual examiner flags) carries ZERO points (section 5.5). The engine
is pure: ``evaluate`` takes the session's scoring state and one accepted event
and returns the new state plus at most one ledger entry. Persistence and row
locking live in ``ingest.py``.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

SCORE_FLOOR = 0
SCORE_CEILING = 1000
SUSPICIOUS_THRESHOLD = 100
HEAD_TURNS_PER_GROUP = 3

RULE_PHONE = "PHONE_EPISODE"
RULE_BOOK = "BOOK_EPISODE"
RULE_HEAD_TURN_GROUP = "HEAD_TURN_GROUP_3"

POINTS = {
    RULE_PHONE: 100,
    RULE_BOOK: 50,
    RULE_HEAD_TURN_GROUP: 10,
}

# Accepted event types (section 6.2) + the examiner's manual flag (0 points).
EVENT_PHONE = "PHONE_DETECTED"
EVENT_BOOK = "BOOK_DETECTED"
EVENT_HEAD_TURN = "HEAD_TURN_SIDEWAYS"
EVENT_TAB_BLUR = "TAB_BLUR"
EVENT_TAB_FOCUS = "TAB_FOCUS"
EVENT_ABSENT = "CANDIDATE_ABSENT"
EVENT_MULTIPLE_FACES = "MULTIPLE_FACES"
EVENT_MANUAL_FLAG = "MANUAL_FLAG"

CV_EVENT_TYPES = {EVENT_PHONE, EVENT_BOOK, EVENT_HEAD_TURN, EVENT_ABSENT, EVENT_MULTIPLE_FACES}
BROWSER_EVENT_TYPES = {EVENT_TAB_BLUR, EVENT_TAB_FOCUS}
ALL_EVENT_TYPES = CV_EVENT_TYPES | BROWSER_EVENT_TYPES | {EVENT_MANUAL_FLAG}

SOURCES = {"YOLO_CV", "MEDIAPIPE_HEAD_POSE", "MEDIAPIPE_FACE_COUNT", "BROWSER_VISIBILITY", "EXAMINER"}
EXPECTED_SOURCE = {
    EVENT_PHONE: {"YOLO_CV"},
    EVENT_BOOK: {"YOLO_CV"},
    EVENT_HEAD_TURN: {"MEDIAPIPE_HEAD_POSE"},
    EVENT_ABSENT: {"MEDIAPIPE_FACE_COUNT"},
    EVENT_MULTIPLE_FACES: {"MEDIAPIPE_FACE_COUNT"},
    EVENT_TAB_BLUR: {"BROWSER_VISIBILITY"},
    EVENT_TAB_FOCUS: {"BROWSER_VISIBILITY"},
    EVENT_MANUAL_FLAG: {"EXAMINER"},
}

SEVERITY = {
    EVENT_PHONE: "CRITICAL",
    EVENT_BOOK: "HIGH",
    EVENT_MULTIPLE_FACES: "HIGH",
    EVENT_MANUAL_FLAG: "HIGH",
    EVENT_ABSENT: "MEDIUM",
    EVENT_TAB_BLUR: "MEDIUM",
    EVENT_HEAD_TURN: "LOW",
    EVENT_TAB_FOCUS: "LOW",
}


@dataclass(frozen=True)
class ScoreState:
    score: int = 0
    head_turn_pending: int = 0
    head_turns_total: int = 0

    @property
    def is_suspicious(self) -> bool:
        return is_suspicious(self.score)


@dataclass(frozen=True)
class LedgerEntry:
    rule_applied: str
    nominal_points: int
    applied_points: int
    previous_score: int
    new_score: int
    is_suspicious: bool


def is_suspicious(score: int) -> bool:
    return score >= SUSPICIOUS_THRESHOLD


def apply_points(score: int, nominal: int) -> tuple[int, int]:
    """Returns (new_score, applied_points) after enforcing the 1000 ceiling."""
    new_score = max(SCORE_FLOOR, min(SCORE_CEILING, score + nominal))
    return new_score, new_score - score


def evaluate(state: ScoreState, event_type: str) -> tuple[ScoreState, LedgerEntry | None]:
    """Apply one *accepted, de-duplicated* event to the scoring state."""
    rule: str | None = None
    if event_type == EVENT_PHONE:
        rule = RULE_PHONE
    elif event_type == EVENT_BOOK:
        rule = RULE_BOOK
    elif event_type == EVENT_HEAD_TURN:
        pending = state.head_turn_pending + 1
        total = state.head_turns_total + 1
        if pending < HEAD_TURNS_PER_GROUP:
            return replace(state, head_turn_pending=pending, head_turns_total=total), None
        state = replace(state, head_turn_pending=0, head_turns_total=total)
        rule = RULE_HEAD_TURN_GROUP
    else:
        # Section 5.5: tab switching, absence, multiple faces, manual flags -> +0.
        return state, None

    nominal = POINTS[rule]
    new_score, applied = apply_points(state.score, nominal)
    entry = LedgerEntry(
        rule_applied=rule,
        nominal_points=nominal,
        applied_points=applied,
        previous_score=state.score,
        new_score=new_score,
        is_suspicious=is_suspicious(new_score),
    )
    return replace(state, score=new_score), entry


def official_status_label(score: int, has_dismissed_flags: bool = False) -> str:
    """Dual-status label (sections 5.7 / 16.2)."""
    if not is_suspicious(score):
        return "Not Suspicious"
    if has_dismissed_flags:
        return "Suspicious (Flagged by AI, Dismissed by Examiner)"
    return "Suspicious"
