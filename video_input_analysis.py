import cv2
import time
import mediapipe as mp
from ultralytics import YOLO


mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=5,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

yolo_model = YOLO("yolo11m.pt")
CONF_THRESHOLD = 0.65
IMG_SIZE = 1280

# Classes we care about, each with its own aspect-ratio filter (None = skip filter)
TARGET_CLASSES = {
    "cell phone": {"aspect_range": (1.3, 2.9), "color": (0, 0, 255)},
    "book":       {"aspect_range": None,        "color": (0, 165, 255)},
}

NO_FACE_ALERT_SECONDS = 10

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise RuntimeError("Could not open webcam. Check camera index/permissions.")

no_face_start = None  # timestamp when face count first dropped to 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame.")
        break

    h_img, w_img = frame.shape[:2]
    now = time.time()

    # 1. Face detection (MediaPipe Face Mesh)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb_frame.flags.writeable = False
    mesh_results = face_mesh.process(rgb_frame)

    face_count = 0
    if mesh_results.multi_face_landmarks:
        face_count = len(mesh_results.multi_face_landmarks)
        for face_landmarks in mesh_results.multi_face_landmarks:
            mp_drawing.draw_landmarks(
                image=frame,
                landmark_list=face_landmarks,
                connections=mp_face_mesh.FACEMESH_TESSELATION,
                landmark_drawing_spec=None,
                connection_drawing_spec=mp_drawing_styles
                    .get_default_face_mesh_tesselation_style(),
            )
            mp_drawing.draw_landmarks(
                image=frame,
                landmark_list=face_landmarks,
                connections=mp_face_mesh.FACEMESH_CONTOURS,
                landmark_drawing_spec=None,
                connection_drawing_spec=mp_drawing_styles
                    .get_default_face_mesh_contours_style(),
            )
            xs = [lm.x * w_img for lm in face_landmarks.landmark]
            ys = [lm.y * h_img for lm in face_landmarks.landmark]
            x1, x2 = int(min(xs)), int(max(xs))
            y1, y2 = int(min(ys)), int(max(ys))
            cv2.putText(frame, "Face", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    # --- Alert state tracking ---
    alerts = []

    if face_count == 0:
        if no_face_start is None:
            no_face_start = now
        elif now - no_face_start >= NO_FACE_ALERT_SECONDS:
            alerts.append("ALERT: Candidate not in frame!")
    else:
        no_face_start = None

    if face_count > 1:
        alerts.append("ALERT: Multiple faces detected!")

    # 2. Object detection (phone + book)
    results = yolo_model(frame, imgsz=IMG_SIZE, device=0, verbose=False)[0]
    detection_counts = {name: 0 for name in TARGET_CLASSES}

    for box in results.boxes:
        cls_name = yolo_model.names[int(box.cls[0])]
        conf = float(box.conf[0])

        if cls_name not in TARGET_CLASSES or conf < CONF_THRESHOLD:
            continue

        x1, y1, x2, y2 = map(int, box.xyxy[0])
        box_w, box_h = x2 - x1, y2 - y1
        long_side = max(box_w, box_h)
        short_side = max(min(box_w, box_h), 1)
        aspect_ratio = long_side / short_side

        aspect_range = TARGET_CLASSES[cls_name]["aspect_range"]
        if aspect_range is not None and not (aspect_range[0] <= aspect_ratio <= aspect_range[1]):
            continue
        if short_side < 12:
            continue

        detection_counts[cls_name] += 1
        color = TARGET_CLASSES[cls_name]["color"]
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, f"{cls_name} {conf:.2f}", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    if detection_counts["cell phone"] > 0:
        alerts.append("ALERT: Phone detected!")
    if detection_counts["book"] > 0:
        alerts.append("ALERT: Book/notes detected!")

    # 3. Status overlay
    status = (f"Faces: {face_count} | Phones: {detection_counts['cell phone']} "
              f"| Books: {detection_counts['book']}")
    cv2.putText(frame, status, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)

    # Draw alerts stacked below status
    for i, alert_text in enumerate(alerts):
        cv2.putText(frame, alert_text, (10, 60 + i * 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    cv2.imshow("Face + Phone Detector", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

face_mesh.close()
cap.release()
cv2.destroyAllWindows()