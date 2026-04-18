-- =============================================================================
-- QuestLog / ProdyAI — FULL Supabase schema (tables + RLS + RPCs + storage)
-- Run in Supabase → SQL Editor in order (single paste is OK).
-- Safe to re-run for policies/functions: uses IF NOT EXISTS / DROP POLICY IF EXISTS.
--
-- After SQL: Dashboard → Storage → create bucket "avatars" if insert below fails,
-- then re-run only the storage section or fix bucket name.
--
-- Client note: PostgREST uses DB column names. This file uses snake_case.
-- If your JS inserts use camelCase (e.g. startTime), map to start_time before insert
-- or align TypeScript Task fields with API responses (snake_case from Supabase).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1) profiles (optional — used by hooks/useAuth.ts registration flow)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (username);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- RPC: signup when RLS blocks direct insert (service role / security definer)
CREATE OR REPLACE FUNCTION public.create_profile(
  user_id uuid,
  user_email text,
  user_username text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (user_id, user_email, user_username)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile(uuid, text, text) TO service_role;

-- -----------------------------------------------------------------------------
-- 2) tasks (matches services/supabase/task.ts, types/task.ts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  priority integer NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 3),
  xp_reward integer,
  folder_id text,
  deadline timestamptz,
  start_time timestamptz,
  end_time timestamptz,
  category text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_deep_work boolean NOT NULL DEFAULT false,
  ai_priority_score numeric,
  parent_task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  activities jsonb DEFAULT '[]'::jsonb,
  notify_time timestamptz,
  notification_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS tasks_parent_task_id_idx ON public.tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks (status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select_own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_own" ON public.tasks;

CREATE POLICY "tasks_select_own"
ON public.tasks FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "tasks_insert_own"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "tasks_update_own"
ON public.tasks FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "tasks_delete_own"
ON public.tasks FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3) focus_sessions (matches services/supabase/focus.ts, types/focus.ts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  notes text NOT NULL DEFAULT '',
  interruptions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS focus_sessions_user_id_idx ON public.focus_sessions (user_id);
CREATE INDEX IF NOT EXISTS focus_sessions_start_time_idx ON public.focus_sessions (start_time);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "focus_sessions_select_own" ON public.focus_sessions;
DROP POLICY IF EXISTS "focus_sessions_insert_own" ON public.focus_sessions;
DROP POLICY IF EXISTS "focus_sessions_update_own" ON public.focus_sessions;
DROP POLICY IF EXISTS "focus_sessions_delete_own" ON public.focus_sessions;

CREATE POLICY "focus_sessions_select_own"
ON public.focus_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "focus_sessions_insert_own"
ON public.focus_sessions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "focus_sessions_update_own"
ON public.focus_sessions FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "focus_sessions_delete_own"
ON public.focus_sessions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- RPC: services/supabase/focus.ts increment_interruptions
CREATE OR REPLACE FUNCTION public.increment_interruptions(session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.focus_sessions
  SET
    interruptions = COALESCE(interruptions, 0) + 1,
    updated_at = now()
  WHERE id = session_id
    AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_interruptions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_interruptions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_interruptions(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 4) habits + habit_history (same as docs/supabase_habits_full.sql)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  progress integer NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'daily'
    CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  streak integer NOT NULL DEFAULT 0,
  days integer[] NOT NULL DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6],
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  notify_time timestamptz,
  notification_id text,
  xp_reward integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS habits_user_id_idx ON public.habits (user_id);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "habits_select_own" ON public.habits;
DROP POLICY IF EXISTS "habits_insert_own" ON public.habits;
DROP POLICY IF EXISTS "habits_update_own" ON public.habits;
DROP POLICY IF EXISTS "habits_delete_own" ON public.habits;

CREATE POLICY "habits_select_own"
ON public.habits FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "habits_insert_own"
ON public.habits FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "habits_update_own"
ON public.habits FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "habits_delete_own"
ON public.habits FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.habit_history (
  habit_id uuid NOT NULL REFERENCES public.habits (id) ON DELETE CASCADE,
  date date NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (habit_id, date)
);

CREATE INDEX IF NOT EXISTS habit_history_habit_id_idx ON public.habit_history (habit_id);

ALTER TABLE public.habit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "habit_history_select_own" ON public.habit_history;
DROP POLICY IF EXISTS "habit_history_insert_own" ON public.habit_history;
DROP POLICY IF EXISTS "habit_history_update_own" ON public.habit_history;
DROP POLICY IF EXISTS "habit_history_delete_own" ON public.habit_history;

CREATE POLICY "habit_history_select_own"
ON public.habit_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.id = habit_history.habit_id
      AND h.user_id = auth.uid()
  )
);

CREATE POLICY "habit_history_insert_own"
ON public.habit_history FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.id = habit_history.habit_id
      AND h.user_id = auth.uid()
  )
);

CREATE POLICY "habit_history_update_own"
ON public.habit_history FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.id = habit_history.habit_id
      AND h.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.id = habit_history.habit_id
      AND h.user_id = auth.uid()
  )
);

CREATE POLICY "habit_history_delete_own"
ON public.habit_history FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.id = habit_history.habit_id
      AND h.user_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- 5) Realtime (optional)
-- -----------------------------------------------------------------------------
-- Dashboard → Database → Replication: enable for `habits` and `habit_history`
-- if you use live subscriptions (app/(app)/statistics.tsx).

-- -----------------------------------------------------------------------------
-- 6) Storage: bucket "avatars" (services/supabase/storage.ts)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_auth" ON storage.objects;

CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_update_auth"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_delete_auth"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars');
