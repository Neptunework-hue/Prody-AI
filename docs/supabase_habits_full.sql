-- =============================================================================
-- ProdyAI — Habits + habit_history (schema + RLS)
-- Run in Supabase → SQL Editor. Safe to re-run: policies use DROP IF EXISTS.
-- Matches: services/supabase/habitService.ts, app/(app)/habits.tsx inserts
-- =============================================================================

-- Optional: ensure UUID generation (usually enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1) habits
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

-- -----------------------------------------------------------------------------
-- 2) habit_history (daily log / upsert by habit_id + date)
-- -----------------------------------------------------------------------------
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
-- 3) If you already had `habits` but missing columns (run only if needed)
-- -----------------------------------------------------------------------------
-- ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS xp_reward integer;
-- ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS days integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6];
-- ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;
