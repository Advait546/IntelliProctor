"""Demo data so a fresh install is usable immediately (SEED_DEMO_DATA=true).

Creates, only when the users table is empty:
  * examiner  dr.sharma@university.edu / password123
  * candidate 2026-CS-042 (Aarav Sharma) / student123
  * a published exam with code AI2026CS01, open for 30 days
  * the same questions in the examiner's question bank

These match the values pre-filled in the frontend login forms. Change or
disable for any real deployment (SEED_DEMO_DATA=false).

Also usable as a CLI to create accounts:
    python -m src.seed create-examiner "Dr. Name" name@uni.edu "StrongPass123!"
"""

from __future__ import annotations

import asyncio
import logging
import sys
import uuid
from datetime import timedelta

from sqlalchemy import func, select

from .db import get_sessionmaker, utcnow
from .models import Examination, Question, QuestionBankItem, User
from .security import hash_password
from .services.exams import assign_passkey, merge_settings
from .services.questions import from_ui

log = logging.getLogger("intelliproctor.seed")

DEMO_EXAMINER = ("Dr. Sharma", "dr.sharma@university.edu", "password123")
DEMO_STUDENT = ("Aarav Sharma", "2026-CS-042", "student123")
DEMO_CODE = "AI2026CS01"

DEMO_QUESTIONS = [
    {"type": "MCQ", "text": "Which neural network architecture is primarily designed for sequential time-series data and natural language processing?",
     "optionA": "Convolutional Neural Network (CNN)", "optionB": "Recurrent Neural Network (RNN / LSTM)", "optionC": "Generative Adversarial Network (GAN)",
     "optionD": "Multilayer Perceptron (MLP)", "correctAnswer": "B", "marks": 2, "difficulty": "Medium", "topic": "Neural Networks"},
    {"type": "MCQ", "text": "What is the primary loss function used in binary classification models?",
     "optionA": "Mean Squared Error (MSE)", "optionB": "Binary Cross-Entropy Loss", "optionC": "Categorical Cross-Entropy Loss",
     "optionD": "Hinge Loss", "correctAnswer": "B", "marks": 2, "difficulty": "Easy", "topic": "Machine Learning"},
    {"type": "MCQ", "text": "Which algorithm is used to compute gradients efficiently in a multi-layer neural network?",
     "optionA": "Gradient Boosting", "optionB": "K-Means Clustering", "optionC": "Backpropagation", "optionD": "Principal Component Analysis",
     "correctAnswer": "C", "marks": 2, "difficulty": "Easy", "topic": "Neural Networks"},
    {"type": "TrueFalse", "text": "Overfitting occurs when a model performs well on training data but poorly on unseen test data.",
     "correctAnswer": "A", "marks": 1, "difficulty": "Easy", "topic": "Machine Learning"},
    {"type": "MCQ", "text": "In YOLO object detection, what does Non-Maximum Suppression (NMS) do?",
     "optionA": "Removes overlapping duplicate bounding boxes", "optionB": "Increases image resolution", "optionC": "Normalizes pixel values",
     "optionD": "Selects the learning rate", "correctAnswer": "A", "marks": 2, "difficulty": "Medium", "topic": "Computer Vision"},
    {"type": "MCQ", "text": "Which activation function outputs values strictly between 0 and 1?",
     "optionA": "ReLU", "optionB": "Tanh", "optionC": "Sigmoid", "optionD": "Leaky ReLU", "correctAnswer": "C", "marks": 2,
     "difficulty": "Easy", "topic": "Neural Networks"},
    {"type": "TrueFalse", "text": "A higher learning rate always leads to faster and better convergence.",
     "correctAnswer": "B", "marks": 1, "difficulty": "Medium", "topic": "Optimization"},
    {"type": "MCQ", "text": "What does the 'k' represent in k-fold cross-validation?",
     "optionA": "The number of features", "optionB": "The number of data partitions", "optionC": "The number of neighbours",
     "optionD": "The number of epochs", "correctAnswer": "B", "marks": 2, "difficulty": "Medium", "topic": "Machine Learning"},
    {"type": "FillBlank", "text": "The process of reducing a model's complexity by adding a penalty term to the loss is called ______.",
     "correctAnswer": "regularization", "marks": 2, "difficulty": "Medium", "topic": "Machine Learning"},
    {"type": "MCQ", "text": "Which OpenCV function estimates an object's pose from 3D-2D point correspondences?",
     "optionA": "cv2.findContours", "optionB": "cv2.solvePnP", "optionC": "cv2.warpAffine", "optionD": "cv2.HoughLines",
     "correctAnswer": "B", "marks": 2, "difficulty": "Hard", "topic": "Computer Vision"},
]


async def create_user(full_name: str, password: str, role: str, email: str | None = None, candidate_id: str | None = None) -> User:
    from .api.auth import candidate_email

    async with get_sessionmaker()() as db:
        user = User(
            email=(email or candidate_email(candidate_id)).lower(),
            password_hash=hash_password(password),
            full_name=full_name,
            role=role,
            candidate_id_number=candidate_id,
        )
        db.add(user)
        await db.commit()
        return user


async def seed_demo_data() -> bool:
    async with get_sessionmaker()() as db:
        if (await db.execute(select(func.count()).select_from(User))).scalar_one() > 0:
            return False
        name, email, pwd = DEMO_EXAMINER
        examiner = User(email=email, password_hash=hash_password(pwd), full_name=name, role="setter",
                        institution="Department of AI & Computer Science")
        sname, prn, spwd = DEMO_STUDENT
        from .api.auth import candidate_email

        student = User(email=candidate_email(prn), password_hash=hash_password(spwd), full_name=sname, role="student", candidate_id_number=prn)
        db.add_all([examiner, student])
        await db.flush()

        now = utcnow()
        exam = Examination(
            exam_id=uuid.uuid4(),
            examiner_id=examiner.user_id,
            title="Computer Science & AI Fundamentals 2026",
            subject="Artificial Intelligence",
            duration_minutes=60,
            instructions="Strict AI proctoring enabled. Keep your face visible, stay on this tab, and keep phones and notes away.",
            settings=merge_settings({"negativeMarking": 0.25, "shuffleQuestions": False, "shuffleOptions": False}),
            status="ACTIVE",
            is_published=True,
            start_window=now - timedelta(minutes=5),
            end_window=now + timedelta(days=30),
        )
        await assign_passkey(db, exam, DEMO_CODE)
        db.add(exam)
        await db.flush()
        total = 0
        for i, q in enumerate(DEMO_QUESTIONS):
            cols = from_ui(q)
            total += cols["marks"]
            db.add(Question(exam_id=exam.exam_id, order_index=i, **cols))
            db.add(QuestionBankItem(owner_id=examiner.user_id, **cols))
        exam.total_marks = total
        await db.commit()
    log.warning(
        "Seeded demo data -> examiner %s / %s | candidate PRN %s / %s | exam code %s",
        email, pwd, prn, spwd, DEMO_CODE,
    )
    return True


def _cli(argv: list[str]) -> int:
    if len(argv) == 4 and argv[0] == "create-examiner":
        from .migrate import run_migrations

        run_migrations()
        _, name, email, password = argv
        user = asyncio.run(create_user(name, password, "setter", email=email))
        print(f"Created examiner {user.email}")
        return 0
    print('usage: python -m src.seed create-examiner "Full Name" email@example.com "Password"')
    return 2


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
