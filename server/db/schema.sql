-- IntelliProctor backend schema (Supabase / Postgres)
-- Run this once in the Supabase SQL editor (or via `psql` against your Supabase
-- connection string) before starting the server.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text not null default 'Exam Setter / Admin',
  created_at timestamptz not null default now()
);

-- Students "self-register" on first login with a given PRN (see auth.controller.js):
-- the password they type the first time becomes their password going forward.
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  prn text unique not null,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Exams & questions
-- ---------------------------------------------------------------------------

create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  subject text,
  duration integer not null default 60,
  total_questions integer not null default 0,
  total_marks integer not null default 0,
  passing_score integer not null default 0,
  scheduled_date date,
  scheduled_time text,
  setter text,
  status text not null default 'Scheduled', -- Scheduled | Active | Completed
  students_enrolled integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'MCQ', -- MCQ | True/False | Fill in the Blank | Subjective
  text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text,
  marks integer not null default 2,
  difficulty text default 'Medium',
  subject text,
  topic text,
  explanation text,
  created_at timestamptz not null default now()
);

-- Which bank questions belong to which exam, and in what order.
create table if not exists exam_questions (
  exam_id uuid references exams(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  position integer not null default 0,
  primary key (exam_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Live proctoring
-- ---------------------------------------------------------------------------

-- One row per student attempt. Created when a student starts an exam,
-- updated continuously while frames are analyzed, closed on submission.
create table if not exists exam_sessions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references exams(id) on delete set null,
  student_prn text not null,
  student_name text not null,
  status text not null default 'Safe', -- Safe | Warning | Critical
  risk_score integer not null default 0,
  face_visible boolean not null default true,
  phone_detected boolean not null default false,
  book_detected boolean not null default false,
  multiple_person boolean not null default false,
  head_pose jsonb default '{"pitch":0,"yaw":0,"roll":0}'::jsonb,
  gaze_direction text default 'Center', -- Center | Left | Right | Down | Away
  warning_count integer not null default 0,
  last_incident text default 'None',
  camera_active boolean not null default true,
  mic_active boolean not null default true,
  ip_address text,
  browser text,
  answers jsonb not null default '{}'::jsonb,
  score numeric,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists idx_exam_sessions_active
  on exam_sessions (exam_id) where submitted_at is null;

create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references exam_sessions(id) on delete cascade,
  type text not null,
  confidence text,
  severity text not null default 'Warning', -- Warning | Critical
  details text,
  created_at timestamptz not null default now()
);

create table if not exists risk_log (
  id bigserial primary key,
  session_id uuid references exam_sessions(id) on delete cascade,
  risk integer not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------

create table if not exists settings (
  id integer primary key default 1,
  ai_sensitivity text default 'High',
  face_detection_threshold integer default 85,
  object_detection_threshold integer default 75,
  audio_threshold integer default 60,
  head_pose_limit integer default 30,
  enable_auto_warning boolean default true,
  max_warnings_before_flag integer default 3,
  theme_mode text default 'Light',
  email_notifications boolean default true,
  admin_alerts boolean default true,
  check (id = 1)
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- The Express server talks to Supabase with the SERVICE ROLE key, which
-- bypasses RLS entirely, so enabling RLS here does not break the API -- it
-- just blocks any direct anon/public access to these tables from the
-- frontend or Supabase's auto-generated REST API, which is what you want
-- since all reads/writes should go through your own backend.
alter table admins enable row level security;
alter table students enable row level security;
alter table exams enable row level security;
alter table questions enable row level security;
alter table exam_questions enable row level security;
alter table exam_sessions enable row level security;
alter table incidents enable row level security;
alter table risk_log enable row level security;
alter table settings enable row level security;
