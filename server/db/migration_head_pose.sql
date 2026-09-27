-- Run this once against your existing Supabase project to pick up real
-- head-pose ("looking away") proctoring support added after the initial
-- schema.sql. Safe to re-run (every statement is idempotent).
--
-- Paste into the Supabase SQL Editor and run, same as schema.sql originally.

-- The original schema.sql shipped `head_pose` as a plain text label
-- ('Center') that nothing ever wrote to. The real detector now returns a
-- {pitch, yaw, roll} object per frame, so this switches the column to jsonb.
-- No real data has ever been written to this column, so it's dropped and
-- recreated rather than migrated in place.
alter table exam_sessions drop column if exists head_pose;
alter table exam_sessions add column if not exists head_pose jsonb default '{"pitch":0,"yaw":0,"roll":0}'::jsonb;

-- New: a simple Center/Left/Right/Down/Away label derived from head_pose,
-- for UI badges that just want a word rather than raw angles.
alter table exam_sessions add column if not exists gaze_direction text default 'Center';

-- Make sure PostgREST picks up the schema change immediately rather than
-- waiting for its next periodic reload (see the PGRST205 troubleshooting in
-- BACKEND_SETUP.md if this doesn't seem to take effect).
notify pgrst, 'reload schema';
