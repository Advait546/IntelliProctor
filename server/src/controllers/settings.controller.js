import { supabase } from '../config/supabaseClient.js';

// Maps the single-row `settings` table (snake_case, schema.sql) to the nested
// shape SettingsPage.jsx actually renders (settings.aiSettings.*,
// settings.notificationSettings.*). Two of the frontend's toggles
// (soundAlertsOnWarning) have no dedicated column in schema.sql -- `admin_alerts`
// is the closest existing one, reused here rather than adding a migration for
// what is currently a single checkbox with no server-side behavior wired to it.
function toApiSettings(row) {
  return {
    aiSettings: {
      yoloConfidenceThreshold: row.object_detection_threshold,
      headPoseAngleLimit: row.head_pose_limit,
      faceDetectionThreshold: row.face_detection_threshold,
      audioNoiseThreshold: row.audio_threshold,
      autoFlagHighRisk: row.enable_auto_warning,
    },
    notificationSettings: {
      emailAlertsOnCritical: row.email_notifications,
      soundAlertsOnWarning: row.admin_alerts,
    },
    aiSensitivity: row.ai_sensitivity,
    maxWarningsBeforeFlag: row.max_warnings_before_flag,
    themeMode: row.theme_mode,
  };
}

// GET /api/v1/settings  (admin)
export async function getSettings(req, res, next) {
  try {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (error) throw error;
    res.json(toApiSettings(data));
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/settings  (admin) -- accepts the same nested shape GET returns;
// every field is optional so a partial patch (e.g. just one toggle) works.
export async function updateSettings(req, res, next) {
  try {
    const body = req.body || {};
    const patch = {};

    if (body.aiSettings?.yoloConfidenceThreshold !== undefined) {
      patch.object_detection_threshold = Number(body.aiSettings.yoloConfidenceThreshold);
    }
    if (body.aiSettings?.headPoseAngleLimit !== undefined) {
      patch.head_pose_limit = Number(body.aiSettings.headPoseAngleLimit);
    }
    if (body.aiSettings?.faceDetectionThreshold !== undefined) {
      patch.face_detection_threshold = Number(body.aiSettings.faceDetectionThreshold);
    }
    if (body.aiSettings?.audioNoiseThreshold !== undefined) {
      patch.audio_threshold = Number(body.aiSettings.audioNoiseThreshold);
    }
    if (body.aiSettings?.autoFlagHighRisk !== undefined) {
      patch.enable_auto_warning = Boolean(body.aiSettings.autoFlagHighRisk);
    }
    if (body.notificationSettings?.emailAlertsOnCritical !== undefined) {
      patch.email_notifications = Boolean(body.notificationSettings.emailAlertsOnCritical);
    }
    if (body.notificationSettings?.soundAlertsOnWarning !== undefined) {
      patch.admin_alerts = Boolean(body.notificationSettings.soundAlertsOnWarning);
    }
    if (body.maxWarningsBeforeFlag !== undefined) {
      patch.max_warnings_before_flag = Number(body.maxWarningsBeforeFlag);
    }
    if (body.themeMode !== undefined) {
      patch.theme_mode = body.themeMode;
    }

    const { data, error } = await supabase.from('settings').update(patch).eq('id', 1).select().single();
    if (error) throw error;

    res.json({ success: true, updated: true, settings: toApiSettings(data) });
  } catch (err) {
    next(err);
  }
}
