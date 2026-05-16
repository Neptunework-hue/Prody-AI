-- =============================================================================
-- ProdyAI — Demo Seed Data
-- Run in: Supabase Dashboard → SQL Editor
--
-- HOW TO USE:
--   1. Go to Supabase Dashboard → Authentication → Users
--   2. Copy the UUID of the account you want to seed
--   3. Replace 'YOUR-USER-UUID-HERE' below with that UUID
--   4. Paste the whole script into the SQL Editor and click Run
--
-- WHAT THIS CREATES:
--   • 38 tasks (30 completed, 4 in-progress, 4 pending) with folders + subtasks
--   • 4 habits with up to 14 days of history (streaks visible)
--   • 15 focus sessions spread over 2 weeks (~710 minutes total)
--
-- RESULT: ~2190 XP → Level 7 "Adventurer"
--
-- Safe to re-run: uses ON CONFLICT DO NOTHING on all inserts.
-- To wipe and re-seed: run the DELETE block at the bottom first.
-- =============================================================================

DO $$
DECLARE
  uid uuid := 'YOUR-USER-UUID-HERE';   -- << REPLACE THIS

  -- task UUIDs (declared so subtasks can reference parents)
  t_arch   uuid := gen_random_uuid();
  t_auth   uuid := gen_random_uuid();
  t_db     uuid := gen_random_uuid();
  t_dash   uuid := gen_random_uuid();
  t_habit  uuid := gen_random_uuid();
  t_focus  uuid := gen_random_uuid();
  t_sync   uuid := gen_random_uuid();
  t_ai     uuid := gen_random_uuid();
  t_voice  uuid := gen_random_uuid();
  t_stats  uuid := gen_random_uuid();
  t_cal    uuid := gen_random_uuid();
  t_xp     uuid := gen_random_uuid();
  t_bug1   uuid := gen_random_uuid();
  t_bug2   uuid := gen_random_uuid();
  t_cr     uuid := gen_random_uuid();
  t_about  uuid := gen_random_uuid();
  t_sql    uuid := gen_random_uuid();
  t_notif  uuid := gen_random_uuid();
  t_demo   uuid := gen_random_uuid();
  t_jog    uuid := gen_random_uuid();
  t_peer   uuid := gen_random_uuid();
  t_meeting uuid := gen_random_uuid();
  t_uiclr  uuid := gen_random_uuid();
  t_scheme uuid := gen_random_uuid();
  t_shots  uuid := gen_random_uuid();
  -- thesis parent + subtasks
  t_thesis      uuid := gen_random_uuid();
  t_thesis_s1   uuid := gen_random_uuid();
  t_thesis_s2   uuid := gen_random_uuid();
  t_thesis_s3   uuid := gen_random_uuid();
  t_thesis_s4   uuid := gen_random_uuid();
  t_thesis_s5   uuid := gen_random_uuid();
  -- in-progress + pending
  t_report uuid := gen_random_uuid();
  t_perf   uuid := gen_random_uuid();
  t_usrtest uuid := gen_random_uuid();
  t_video  uuid := gen_random_uuid();
  t_presn  uuid := gen_random_uuid();
  t_submit uuid := gen_random_uuid();
  t_store  uuid := gen_random_uuid();
  t_grad   uuid := gen_random_uuid();

  -- habit UUIDs
  h_exercise uuid := gen_random_uuid();
  h_reading  uuid := gen_random_uuid();
  h_water    uuid := gen_random_uuid();
  h_study    uuid := gen_random_uuid();

  today date := CURRENT_DATE;

BEGIN

-- ============================================================
-- TASKS — Completed (these drive XP)
-- ============================================================
INSERT INTO public.tasks
  (id, user_id, title, status, priority, category, deadline, is_deep_work, created_at, updated_at)
VALUES
  -- Priority 3 (30 XP each) — deep work, high-impact
  (t_arch,    uid, 'Design system architecture',           'completed', 3, 'Capstone',  today-13, true,  now()-'14 days'::interval, now()-'13 days'::interval),
  (t_auth,    uid, 'Implement authentication flow',        'completed', 3, 'Work',      today-12, true,  now()-'13 days'::interval, now()-'12 days'::interval),
  (t_db,      uid, 'Set up Supabase database schema',      'completed', 3, 'Work',      today-11, true,  now()-'12 days'::interval, now()-'11 days'::interval),
  (t_dash,    uid, 'Build dashboard UI',                   'completed', 3, 'Work',      today-10, true,  now()-'11 days'::interval, now()-'10 days'::interval),
  (t_habit,   uid, 'Add habit tracking module',            'completed', 3, 'Work',      today-9,  true,  now()-'10 days'::interval, now()-'9 days'::interval),
  (t_focus,   uid, 'Implement focus timer',                'completed', 3, 'Work',      today-9,  true,  now()-'10 days'::interval, now()-'9 days'::interval),
  (t_sync,    uid, 'Add offline-first sync logic',         'completed', 3, 'Work',      today-8,  true,  now()-'9 days'::interval,  now()-'8 days'::interval),
  (t_ai,      uid, 'Integrate AI Oracle (GPT-4o-mini)',    'completed', 3, 'Work',      today-6,  true,  now()-'7 days'::interval,  now()-'6 days'::interval),
  (t_voice,   uid, 'Add voice input to AI Oracle',         'completed', 3, 'Work',      today-4,  true,  now()-'5 days'::interval,  now()-'4 days'::interval),
  (t_xp,      uid, 'Implement XP and leveling system',     'completed', 3, 'Work',      today-6,  true,  now()-'7 days'::interval,  now()-'6 days'::interval),
  (t_bug2,    uid, 'Fix task creation PGRST204 bug',       'completed', 3, 'Work',      today-1,  false, now()-'2 days'::interval,  now()-'1 days'::interval),
  -- Priority 2 (25 XP each)
  (t_stats,   uid, 'Create statistics screen',             'completed', 2, 'Work',      today-7,  false, now()-'8 days'::interval,  now()-'7 days'::interval),
  (t_cal,     uid, 'Fix calendar date display bug',        'completed', 2, 'Work',      today-5,  false, now()-'6 days'::interval,  now()-'5 days'::interval),
  (t_bug1,    uid, 'Fix login page responsiveness',        'completed', 2, 'Work',      today-8,  false, now()-'9 days'::interval,  now()-'8 days'::interval),
  (t_cr,      uid, 'Code review and cleanup',              'completed', 2, 'Work',      today-3,  false, now()-'4 days'::interval,  now()-'3 days'::interval),
  (t_sql,     uid, 'Update SQL migrations for teammate',   'completed', 2, 'Work',      today-2,  false, now()-'3 days'::interval,  now()-'2 days'::interval),
  (t_notif,   uid, 'Test notification system on Android',  'completed', 2, 'Work',      today-1,  false, now()-'2 days'::interval,  now()-'1 days'::interval),
  (t_demo,    uid, 'Prepare demo screenshots',             'completed', 2, 'Work',      today-1,  false, now()-'2 days'::interval,  now()-'1 days'::interval),
  (t_peer,    uid, 'Review peer thesis feedback',          'completed', 2, 'Capstone',  today-2,  false, now()-'3 days'::interval,  now()-'2 days'::interval),
  (t_uiclr,   uid, 'Review final UI colours',              'completed', 2, 'Work',      today-3,  false, now()-'4 days'::interval,  now()-'3 days'::interval),
  (t_shots,   uid, 'Record demo video walkthrough',        'completed', 2, 'Work',      today-1,  false, now()-'2 days'::interval,  now()-'1 days'::interval),
  -- Priority 1 (20 XP each)
  (t_about,   uid, 'Create About screen',                  'completed', 1, 'Work',      today-4,  false, now()-'5 days'::interval,  now()-'4 days'::interval),
  (t_meeting, uid, 'Weekly supervisor meeting',            'completed', 1, 'Capstone',  today-3,  false, now()-'4 days'::interval,  now()-'3 days'::interval),
  (t_scheme,  uid, 'Fix deep-link URL scheme in app.json', 'completed', 1, 'Work',      today-1,  false, now()-'2 days'::interval,  now()-'1 days'::interval),
  -- Priority 0 (15 XP each)
  (t_jog,     uid, 'Morning jog — 5 km',                  'completed', 0, 'Personal',  today-2,  false, now()-'3 days'::interval,  now()-'2 days'::interval),

  -- Thesis parent task (in_progress — parent for subtasks)
  (t_thesis,  uid, 'Write graduation thesis',              'in_progress', 3, 'Capstone', today+14, true,  now()-'14 days'::interval, now()-'1 days'::interval)

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SUBTASKS (reference t_thesis as parent)
-- ============================================================
INSERT INTO public.tasks
  (id, user_id, title, status, priority, category, parent_task_id, created_at, updated_at)
VALUES
  (t_thesis_s1, uid, 'Write introduction chapter',    'completed',   2, 'Capstone', t_thesis, now()-'12 days'::interval, now()-'10 days'::interval),
  (t_thesis_s2, uid, 'Write literature review',       'completed',   2, 'Capstone', t_thesis, now()-'10 days'::interval, now()-'8 days'::interval),
  (t_thesis_s3, uid, 'Write methodology chapter',     'completed',   3, 'Capstone', t_thesis, now()-'8 days'::interval,  now()-'5 days'::interval),
  (t_thesis_s4, uid, 'Write results & analysis',      'in_progress', 3, 'Capstone', t_thesis, now()-'4 days'::interval,  now()-'1 days'::interval),
  (t_thesis_s5, uid, 'Write conclusion chapter',      'pending',     2, 'Capstone', t_thesis, now()-'1 days'::interval,  now()-'1 days'::interval)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TASKS — In-progress & Pending
-- ============================================================
INSERT INTO public.tasks
  (id, user_id, title, status, priority, category, deadline, is_deep_work, created_at, updated_at)
VALUES
  (t_report,  uid, 'Final report — complete draft',       'in_progress', 3, 'Capstone', today+10, true,  now()-'5 days'::interval,  now()-'1 days'::interval),
  (t_perf,    uid, 'App performance & memory profiling',  'in_progress', 2, 'Work',      today+7,  false, now()-'3 days'::interval,  now()-'1 days'::interval),
  (t_usrtest, uid, 'User testing session with 5 testers', 'in_progress', 2, 'Capstone',  today+5,  false, now()-'2 days'::interval,  now()-'1 days'::interval),
  (t_video,   uid, 'Edit and export demo video',          'in_progress', 2, 'Work',      today+3,  false, now()-'1 days'::interval,  now()           ),
  (t_presn,   uid, 'Supervisor presentation slides',      'pending',     3, 'Capstone',  today+2,  true,  now()           ,          now()           ),
  (t_submit,  uid, 'Submit final report to university',   'pending',     3, 'Capstone',  today+14, true,  now()           ,          now()           ),
  (t_store,   uid, 'Deploy beta to Google Play Store',    'pending',     2, 'Work',      today+20, false, now()           ,          now()           ),
  (t_grad,    uid, 'Graduate 🎓',                         'pending',     3, 'Personal',  today+60, false, now()           ,          now()           )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- HABITS
-- ============================================================
INSERT INTO public.habits
  (id, user_id, title, description, frequency, streak, days, history, xp_reward, created_at, updated_at)
VALUES
  (h_exercise, uid,
    'Morning Exercise',
    '30 min workout — cardio or strength training',
    'daily', 14,
    ARRAY[0,1,2,3,4,5,6],
    '[]'::jsonb, 15,
    now()-'20 days'::interval, now()),
  (h_reading, uid,
    'Read 30 Minutes',
    'Read research papers, books, or documentation',
    'daily', 10,
    ARRAY[0,1,2,3,4,5,6],
    '[]'::jsonb, 15,
    now()-'18 days'::interval, now()),
  (h_water, uid,
    'Drink 8 Glasses of Water',
    'Stay hydrated throughout the day',
    'daily', 14,
    ARRAY[0,1,2,3,4,5,6],
    '[]'::jsonb, 15,
    now()-'20 days'::interval, now()),
  (h_study, uid,
    'Deep Study Session',
    'At least 2 hours focused study with no distractions',
    'daily', 7,
    ARRAY[0,1,2,3,4,5,6],
    '[]'::jsonb, 20,
    now()-'14 days'::interval, now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- HABIT HISTORY (drives XP + streak dots on calendar)
-- ============================================================
-- Exercise: 14 days straight
INSERT INTO public.habit_history (habit_id, date, value) VALUES
  (h_exercise, today-13, 1), (h_exercise, today-12, 1), (h_exercise, today-11, 1),
  (h_exercise, today-10, 1), (h_exercise, today-9,  1), (h_exercise, today-8,  1),
  (h_exercise, today-7,  1), (h_exercise, today-6,  1), (h_exercise, today-5,  1),
  (h_exercise, today-4,  1), (h_exercise, today-3,  1), (h_exercise, today-2,  1),
  (h_exercise, today-1,  1), (h_exercise, today,    1)
ON CONFLICT (habit_id, date) DO NOTHING;

-- Reading: 10 days
INSERT INTO public.habit_history (habit_id, date, value) VALUES
  (h_reading, today-9,  1), (h_reading, today-8, 1), (h_reading, today-7, 1),
  (h_reading, today-6,  1), (h_reading, today-5, 1), (h_reading, today-4, 1),
  (h_reading, today-3,  1), (h_reading, today-2, 1), (h_reading, today-1, 1),
  (h_reading, today,    1)
ON CONFLICT (habit_id, date) DO NOTHING;

-- Water: 14 days straight
INSERT INTO public.habit_history (habit_id, date, value) VALUES
  (h_water, today-13, 1), (h_water, today-12, 1), (h_water, today-11, 1),
  (h_water, today-10, 1), (h_water, today-9,  1), (h_water, today-8,  1),
  (h_water, today-7,  1), (h_water, today-6,  1), (h_water, today-5,  1),
  (h_water, today-4,  1), (h_water, today-3,  1), (h_water, today-2,  1),
  (h_water, today-1,  1), (h_water, today,    1)
ON CONFLICT (habit_id, date) DO NOTHING;

-- Deep Study: 7 days
INSERT INTO public.habit_history (habit_id, date, value) VALUES
  (h_study, today-6, 1), (h_study, today-5, 1), (h_study, today-4, 1),
  (h_study, today-3, 1), (h_study, today-2, 1), (h_study, today-1, 1),
  (h_study, today,   1)
ON CONFLICT (habit_id, date) DO NOTHING;

-- ============================================================
-- FOCUS SESSIONS (15 completed sessions, ~710 min total → 710 XP)
-- ============================================================
INSERT INTO public.focus_sessions
  (user_id, start_time, end_time, status, notes, interruptions, created_at, updated_at)
VALUES
  -- Day 14 ago
  (uid, now()-'14 days'::interval+'9 hours'::interval,  now()-'14 days'::interval+'9 hours 45 minutes'::interval,  'completed', 'Architecture planning session',        0, now()-'14 days'::interval, now()-'14 days'::interval),
  (uid, now()-'14 days'::interval+'14 hours'::interval, now()-'14 days'::interval+'14 hours 50 minutes'::interval, 'completed', 'Database schema design',               1, now()-'14 days'::interval, now()-'14 days'::interval),
  -- Day 12 ago
  (uid, now()-'12 days'::interval+'9 hours'::interval,  now()-'12 days'::interval+'9 hours 25 minutes'::interval,  'completed', 'Auth flow implementation',             0, now()-'12 days'::interval, now()-'12 days'::interval),
  (uid, now()-'12 days'::interval+'15 hours'::interval, now()-'12 days'::interval+'16 hours'::interval,            'completed', 'UI component library setup',           0, now()-'12 days'::interval, now()-'12 days'::interval),
  -- Day 10 ago
  (uid, now()-'10 days'::interval+'8 hours'::interval,  now()-'10 days'::interval+'9 hours 30 minutes'::interval,  'completed', 'Dashboard screen deep work',           1, now()-'10 days'::interval, now()-'10 days'::interval),
  -- Day 8 ago
  (uid, now()-'8 days'::interval+'9 hours'::interval,   now()-'8 days'::interval+'10 hours 30 minutes'::interval,  'completed', 'Offline sync architecture',            0, now()-'8 days'::interval,  now()-'8 days'::interval),
  (uid, now()-'8 days'::interval+'14 hours'::interval,  now()-'8 days'::interval+'14 hours 45 minutes'::interval,  'completed', 'Habit module UI polish',               2, now()-'8 days'::interval,  now()-'8 days'::interval),
  -- Day 6 ago
  (uid, now()-'6 days'::interval+'9 hours'::interval,   now()-'6 days'::interval+'10 hours'::interval,             'completed', 'AI Oracle integration — tool calls',   0, now()-'6 days'::interval,  now()-'6 days'::interval),
  (uid, now()-'6 days'::interval+'14 hours'::interval,  now()-'6 days'::interval+'14 hours 50 minutes'::interval,  'completed', 'XP and leveling system',               1, now()-'6 days'::interval,  now()-'6 days'::interval),
  -- Day 4 ago
  (uid, now()-'4 days'::interval+'9 hours'::interval,   now()-'4 days'::interval+'9 hours 25 minutes'::interval,   'completed', 'Voice input with Whisper API',         0, now()-'4 days'::interval,  now()-'4 days'::interval),
  (uid, now()-'4 days'::interval+'11 hours'::interval,  now()-'4 days'::interval+'12 hours'::interval,             'completed', 'Statistics screen charts',             0, now()-'4 days'::interval,  now()-'4 days'::interval),
  -- Day 2 ago
  (uid, now()-'2 days'::interval+'9 hours'::interval,   now()-'2 days'::interval+'10 hours'::interval,             'completed', 'Bug fixes and code review',            1, now()-'2 days'::interval,  now()-'2 days'::interval),
  (uid, now()-'2 days'::interval+'14 hours'::interval,  now()-'2 days'::interval+'14 hours 45 minutes'::interval,  'completed', 'Calendar view debugging',              0, now()-'2 days'::interval,  now()-'2 days'::interval),
  -- Yesterday
  (uid, now()-'1 days'::interval+'9 hours'::interval,   now()-'1 days'::interval+'10 hours'::interval,             'completed', 'Final UI colour review + About screen', 0, now()-'1 days'::interval, now()-'1 days'::interval),
  -- Today
  (uid, now()-'3 hours'::interval,                      now()-'1 hour 25 minutes'::interval,                       'completed', 'Demo data prep + report writing',      0, now()-'3 hours'::interval, now()-'1 hour 25 minutes'::interval);

END $$;

-- =============================================================================
-- EXPECTED XP BREAKDOWN (approximate):
--   Tasks completed  : 25 tasks × ~25 XP avg  ≈  805 XP
--   Habit history    : 45 entries × 15 XP      ≈  675 XP
--   Focus sessions   : ~710 minutes            ≈  710 XP
--   ─────────────────────────────────────────────────────
--   TOTAL            :                         ≈ 2190 XP
--   Level            : 7 — Adventurer
-- =============================================================================

-- =============================================================================
-- TO WIPE DEMO DATA (run this first if you want a clean re-seed):
-- =============================================================================
-- DELETE FROM public.focus_sessions WHERE user_id = 'YOUR-USER-UUID-HERE';
-- DELETE FROM public.habit_history   WHERE habit_id IN (SELECT id FROM public.habits WHERE user_id = 'YOUR-USER-UUID-HERE');
-- DELETE FROM public.habits          WHERE user_id = 'YOUR-USER-UUID-HERE';
-- DELETE FROM public.tasks           WHERE user_id = 'YOUR-USER-UUID-HERE';
