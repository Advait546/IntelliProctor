// Turns a raw detection result from the proctoring microservice into a risk
// delta + incident list, using the same thresholds the SettingsPage exposes.

const SEVERITY_CRITICAL = 'Critical';
const SEVERITY_WARNING = 'Warning';

export function applyDetection(session, detection, settings) {
  const incidents = [];
  let risk = session.risk_score;
  let warningCount = session.warning_count;
  let lastIncident = session.last_incident;

  const faceVisible = detection.face_count > 0;
  const multiplePerson = detection.face_count > 1;
  const phoneDetected = Boolean(detection.phone_detected);
  const bookDetected = Boolean(detection.book_detected);
  const lookingAway = Boolean(detection.looking_away);

  const bump = (amount, type, severity, confidence, details) => {
    risk = Math.max(0, Math.min(100, risk + amount));
    warningCount += 1;
    lastIncident = `${type} (just now)`;
    incidents.push({ type, severity, confidence, details });
  };

  if (!faceVisible) {
    bump(15, 'Candidate not in frame', SEVERITY_WARNING, 'n/a', 'No face detected by MediaPipe Face Mesh.');
  } else {
    // gentle decay back toward baseline when things look fine
    risk = Math.max(0, risk - 3);
  }

  if (multiplePerson) {
    bump(
      30,
      'Multiple persons detected',
      SEVERITY_CRITICAL,
      'n/a',
      `${detection.face_count} distinct faces identified in frame.`
    );
  }

  if (phoneDetected) {
    bump(25, 'Mobile phone detected', SEVERITY_CRITICAL, detection.phone_confidence ?? 'n/a', 'YOLO detected a phone-shaped object.');
  }

  if (bookDetected) {
    bump(12, 'Book / notes detected', SEVERITY_WARNING, detection.book_confidence ?? 'n/a', 'YOLO detected a book-shaped object.');
  }

  if (lookingAway && faceVisible && !multiplePerson) {
    const pose = detection.head_pose;
    const poseDetails = pose
      ? `Head pose outside neutral range (yaw ${pose.yaw}°, pitch ${pose.pitch}°, roll ${pose.roll}°).`
      : 'Head pose outside neutral range.';
    bump(8, 'Candidate looking away from screen', SEVERITY_WARNING, 'n/a', poseDetails);
  }

  // A simple word for UI badges that don't want to render raw angles. Only
  // meaningful with exactly one face -- multi-face/no-face frames just fall
  // back to whatever the caller already had.
  const gazeThreshold = settings?.head_pose_limit ?? 30;
  let gazeDirection = session.gaze_direction || 'Center';
  if (!faceVisible) {
    gazeDirection = 'Away';
  } else if (!multiplePerson && detection.head_pose) {
    const { yaw, pitch } = detection.head_pose;
    if (Math.abs(pitch) > gazeThreshold && Math.abs(pitch) >= Math.abs(yaw)) {
      gazeDirection = pitch < 0 ? 'Down' : 'Center';
    } else if (yaw > gazeThreshold) {
      gazeDirection = 'Right';
    } else if (yaw < -gazeThreshold) {
      gazeDirection = 'Left';
    } else {
      gazeDirection = 'Center';
    }
  }

  const maxWarnings = settings?.max_warnings_before_flag ?? 3;
  let status = 'Safe';
  if (risk > 75 || warningCount >= maxWarnings * 2) status = 'Critical';
  else if (risk > 40 || warningCount >= maxWarnings) status = 'Warning';

  return {
    riskScore: risk,
    status,
    warningCount,
    lastIncident,
    faceVisible,
    multiplePerson,
    phoneDetected,
    bookDetected,
    lookingAway,
    headPose: detection.head_pose ?? null,
    gazeDirection,
    incidents,
  };
}
